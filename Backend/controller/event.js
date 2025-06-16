import Event from "../models/Event.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = async (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    
    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};

const eventController = {
  // Get featured and upcoming events
  getFeaturedEvents: async (req, res) => {
    try {
      const events = await Event.find()
        .sort({ date: 1 })
        .limit(10);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get event details
  getEventDetails: async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  createEvent: async (req, res) => {
    try {
      const { 
        title, location, date, price, category, time, address, latitude, longitude, 
        organiser, description, unit, paypalUsername, geoTag,
        regularPrice, regularAvailable, vipPrice, vipAvailable
      } = req.body;

      // Upload image to Cloudinary if provided
      let imageUrl = null;
      if (req.file) {
        const imageUpload = await uploadToCloudinary(
          req.file.buffer,
          'events/images'
        );
        imageUrl = imageUpload.secure_url;
      }

      // Create pricing structure
      const pricingData = {};
      if (regularPrice !== undefined && regularAvailable !== undefined) {
        pricingData.regular = {
          price: parseFloat(regularPrice),
          available: parseInt(regularAvailable)
        };
      }
      if (vipPrice !== undefined && vipAvailable !== undefined) {
        pricingData.vip = {
          price: parseFloat(vipPrice),
          available: parseInt(vipAvailable)
        };
      }

      const event = new Event({
        title, location, date, price, category, time, address, latitude, longitude,
        organiser, description, unit, paypalUsername, geoTag,
        pricing: pricingData,
        image: imageUrl
      });

      const savedEvent = await event.save();

      // Create and save a notification
      const notification = new Notification({
        title: 'New Event Created',
        message: `A new event ${savedEvent.title} has been created!`,
        eventID: savedEvent._id,
        type: 'event',
        createdAt: new Date(),
      });
      await notification.save();

      // Emit notification to all clients
      req.io.emit("newEventNotification", {
        notification: {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          eventID: notification.eventID,
          type: notification.type,
          createdAt: notification.createdAt,
        },
      });

      res.status(201).json({ event: savedEvent, notification });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update event
  updateEvent: async (req, res) => {
    try {
      const eventId = req.params.id;

      // Find the existing event
      const existingEvent = await Event.findById(eventId);
      if (!existingEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Prepare update data
      const updateData = { ...req.body };

      // Handle pricing updates
      const { regularPrice, regularAvailable, vipPrice, vipAvailable } = req.body;
      if (regularPrice !== undefined || regularAvailable !== undefined ||
          vipPrice !== undefined || vipAvailable !== undefined) {
        updateData.pricing = existingEvent.pricing || {};

        if (regularPrice !== undefined || regularAvailable !== undefined) {
          updateData.pricing.regular = {
            price: regularPrice !== undefined ? parseFloat(regularPrice) : existingEvent.pricing?.regular?.price || 0,
            available: regularAvailable !== undefined ? parseInt(regularAvailable) : existingEvent.pricing?.regular?.available || 0
          };
        }

        if (vipPrice !== undefined || vipAvailable !== undefined) {
          updateData.pricing.vip = {
            price: vipPrice !== undefined ? parseFloat(vipPrice) : existingEvent.pricing?.vip?.price || 0,
            available: vipAvailable !== undefined ? parseInt(vipAvailable) : existingEvent.pricing?.vip?.available || 0
          };
        }
      }

      // Upload new image to Cloudinary if provided
      if (req.file) {
        const imageUpload = await uploadToCloudinary(
          req.file.buffer,
          'events/images'
        );
        updateData.image = imageUpload.secure_url;
      }

      // Update the event
      const event = await Event.findByIdAndUpdate(
        eventId,
        updateData,
        { new: true }
      );

      // Emit event update notification
      req.io.emit("eventUpdated", {
        message: "An event has been updated!",
        event,
      });

      res.json(event);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete event
  deleteEvent: async (req, res) => {
    try {
      const event = await Event.findByIdAndDelete(req.params.id);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get event buyers with ticket type breakdown
  getEventBuyers: async (req, res) => {
    try {
      const { eventId } = req.params;

      // Check if event exists
      const eventExists = await Event.findById(eventId);
      if (!eventExists) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Fetch transactions for the specific event
      const transactions = await Transaction.find({
        ticketId: eventId,
        paymentStatus: "paid"
      }).populate("userId", "email full_name");

      if (transactions.length === 0) {
        return res.status(404).json({ message: "No tickets sold for this event" });
      }

      // Calculate totals by ticket type
      const regularTickets = transactions
        .filter(t => t.ticketType === 'regular')
        .reduce((total, transaction) => total + transaction.ticketCount, 0);

      const vipTickets = transactions
        .filter(t => t.ticketType === 'vip')
        .reduce((total, transaction) => total + transaction.ticketCount, 0);

      const totalTicketsSold = regularTickets + vipTickets;

      // Format the buyers' details
      const buyers = transactions.map((transaction) => ({
        username: transaction.userId.username,
        full_name: transaction.userId.full_name,
        ticketCount: transaction.ticketCount,
        ticketType: transaction.ticketType,
        pricePerTicket: transaction.pricePerTicket,
        amount: transaction.amount,
        purchaseDate: transaction.createdAt,
      }));

      // Return response with buyers and ticket breakdown
      res.status(200).json({
        totalTicketsSold,
        regularTicketsSold: regularTickets,
        vipTicketsSold: vipTickets,
        buyers,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

export default eventController;