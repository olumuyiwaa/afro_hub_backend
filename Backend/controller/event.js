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

// Enhanced pricing data parser to support multiple flexible payment options
const parsePricingData = (body) => {
  const pricingMap = new Map();

  // Priority 1: Check for pricingOptions array format (most flexible)
  let pricingOptions = body.pricingOptions;
  if (typeof pricingOptions === 'string') {
    try {
      pricingOptions = JSON.parse(pricingOptions);
    } catch (e) {
      pricingOptions = null;
    }
  }

  if (pricingOptions && Array.isArray(pricingOptions)) {
    pricingOptions.forEach((option, index) => {
      if (option.name && option.price !== undefined && option.available !== undefined) {
        const ticketId = option.id || `option_${index + 1}`;
        pricingMap.set(ticketId, {
          name: option.name.trim(),
          price: parseFloat(option.price),
          available: parseInt(option.available),
          description: option.description || ""
        });
      }
    });
    return pricingMap;
  }

  // Priority 2: Check for indexed format (pricing_0_name, pricing_0_price, etc.)
  for (let index = 0; index < 10; index++) {
    const nameKey = `pricing_${index}_name`;
    const priceKey = `pricing_${index}_price`;
    const availableKey = `pricing_${index}_available`;
    const descriptionKey = `pricing_${index}_description`;

    if (body[nameKey] && body[priceKey] !== undefined && body[availableKey] !== undefined) {
      const ticketId = `option_${index + 1}`;
      pricingMap.set(ticketId, {
        name: body[nameKey].trim(),
        price: parseFloat(body[priceKey]),
        available: parseInt(body[availableKey]),
        description: body[descriptionKey] || ""
      });
    }
  }

  // Priority 3: Check for custom named fields (ticketName_0, ticketPrice_0, etc.)
  if (pricingMap.size === 0) {
    for (let index = 0; index < 10; index++) {
      const nameKey = `ticketName_${index}`;
      const priceKey = `ticketPrice_${index}`;
      const availableKey = `ticketAvailable_${index}`;
      const descriptionKey = `ticketDescription_${index}`;

      if (body[nameKey] && body[priceKey] !== undefined && body[availableKey] !== undefined) {
        const ticketId = `option_${index + 1}`;
        pricingMap.set(ticketId, {
          name: body[nameKey].trim(),
          price: parseFloat(body[priceKey]),
          available: parseInt(body[availableKey]),
          description: body[descriptionKey] || ""
        });
      }
    }
  }

  // Priority 4: Fallback to legacy regular/vip format
  if (pricingMap.size === 0) {
    if (body.regularPrice !== undefined && body.regularAvailable !== undefined) {
      pricingMap.set('regular', {
        name: 'Regular',
        price: parseFloat(body.regularPrice),
        available: parseInt(body.regularAvailable),
        description: body.regularDescription || ""
      });
    }
    if (body.vipPrice !== undefined && body.vipAvailable !== undefined) {
      pricingMap.set('vip', {
        name: 'VIP',
        price: parseFloat(body.vipPrice),
        available: parseInt(body.vipAvailable),
        description: body.vipDescription || ""
      });
    }
  }

  return pricingMap;
};

// Validation helper for pricing data
const validatePricingData = (pricingMap) => {
  if (pricingMap.size === 0) {
    return { valid: false, message: 'At least one pricing option is required' };
  }

  if (pricingMap.size > 10) {
    return { valid: false, message: 'Maximum 10 pricing options allowed' };
  }

  for (const [key, value] of pricingMap) {
    if (!value.name || value.name.trim() === '') {
      return { valid: false, message: `Pricing option ${key} must have a name` };
    }
    if (value.price < 0) {
      return { valid: false, message: `Price for ${value.name} cannot be negative` };
    }
    if (value.available < 0) {
      return { valid: false, message: `Available tickets for ${value.name} cannot be negative` };
    }
  }

  return { valid: true };
};

const eventController = {
  // Get featured and upcoming events
  getFeaturedEvents: async (req, res) => {
    try {
      const events = await Event.find()
        .sort({ date: 1 })
        .limit(10);

      // Convert pricing Map to Object for JSON response
      const formattedEvents = events.map(event => {
        const eventObj = event.toObject();
        if (eventObj.pricing) {
          eventObj.ticketTypes = event.getTicketTypes();
          // Calculate price range for display
          const prices = event.getTicketTypes().map(t => t.price);
          eventObj.priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices)
          };
        }
        return eventObj;
      });

      res.json(formattedEvents);
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

      const eventObj = event.toObject();
      eventObj.ticketTypes = event.getTicketTypes();

      // Calculate additional stats
      const ticketTypes = event.getTicketTypes();
      eventObj.totalAvailable = ticketTypes.reduce((sum, t) => sum + t.available, 0);
      eventObj.priceRange = {
        min: Math.min(...ticketTypes.map(t => t.price)),
        max: Math.max(...ticketTypes.map(t => t.price))
      };

      res.json(eventObj);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  createEvent: async (req, res) => {
    try {
      const {
        title, location, date, price, category, time, address, latitude, longitude,
        organiser, description, unit, paypalUsername, geoTag
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

      // Parse pricing data
      const pricingMap = parsePricingData(req.body);

      // Validate pricing data
      const validation = validatePricingData(pricingMap);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const event = new Event({
        title, location, date, price, category, time, address, latitude, longitude,
        organiser, description, unit, paypalUsername, geoTag,
        pricing: pricingMap,
        image: imageUrl
      });

      const savedEvent = await event.save();

      // Create and save a notification
      const notification = new Notification({
        title: 'New Event Created',
        message: `A new event ${savedEvent.title} has been created with ${pricingMap.size} ticket option(s)!`,
        eventID: savedEvent._id,
        type: 'event',
        createdAt: new Date(),
      });
      await notification.save();

      // Emit notification to all clients
      if (req.io) {
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
      }

      // Format response
      const responseEvent = savedEvent.toObject();
      responseEvent.ticketTypes = savedEvent.getTicketTypes();
      responseEvent.totalAvailable = responseEvent.ticketTypes.reduce((sum, t) => sum + t.available, 0);

      res.status(201).json({ event: responseEvent, notification });
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
      const pricingMap = parsePricingData(req.body);
      if (pricingMap.size > 0) {
        // Validate pricing data
        const validation = validatePricingData(pricingMap);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.message });
        }
        updateData.pricing = pricingMap;
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
      if (req.io) {
        req.io.emit("eventUpdated", {
          message: "An event has been updated!",
          event,
        });
      }

      // Format response
      const responseEvent = event.toObject();
      responseEvent.ticketTypes = event.getTicketTypes();
      responseEvent.totalAvailable = responseEvent.ticketTypes.reduce((sum, t) => sum + t.available, 0);

      res.json(responseEvent);
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

  // Get event buyers with enhanced ticket type breakdown
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
      }).populate("userId", "email full_name username");

      if (transactions.length === 0) {
        return res.status(404).json({ message: "No tickets sold for this event" });
      }

      // Calculate totals by ticket type
      const ticketTypeSummary = {};
      let totalTicketsSold = 0;
      let totalRevenue = 0;

      transactions.forEach(transaction => {
        const ticketType = transaction.ticketType;
        const count = transaction.ticketCount;
        const revenue = transaction.amount;

        if (!ticketTypeSummary[ticketType]) {
          ticketTypeSummary[ticketType] = {
            name: transaction.ticketTypeName,
            count: 0,
            revenue: 0,
            averagePrice: 0
          };
        }

        ticketTypeSummary[ticketType].count += count;
        ticketTypeSummary[ticketType].revenue += revenue;
        ticketTypeSummary[ticketType].averagePrice = ticketTypeSummary[ticketType].revenue / ticketTypeSummary[ticketType].count;

        totalTicketsSold += count;
        totalRevenue += revenue;
      });

      // Format the buyers' details
      const buyers = transactions.map((transaction) => ({
        username: transaction.userId.username,
        full_name: transaction.userId.full_name,
        email: transaction.userId.email,
        ticketCount: transaction.ticketCount,
        ticketType: transaction.ticketType,
        ticketTypeName: transaction.ticketTypeName,
        pricePerTicket: transaction.pricePerTicket,
        amount: transaction.amount,
        purchaseDate: transaction.createdAt,
        transactionId: transaction.transactionId
      }));

      // Return response with enhanced summary
      res.status(200).json({
        eventTitle: eventExists.title,
        totalTicketsSold,
        totalRevenue,
        averageTicketPrice: totalRevenue / totalTicketsSold,
        ticketTypeSummary,
        totalTicketTypeOptions: Object.keys(ticketTypeSummary).length,
        buyers,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

export default eventController;