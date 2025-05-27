import Country from '../models/Country.js';
import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';
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

// Create a new country
export const createCountry = asyncHandler(async (req, res) => {
  const {
    title,
    president,
    independence_date,
    capital,
    currency,
    population,
    demonym,
    description,
    language,
    time_zone,
    link,
    arts_and_crafts,
    cultural_dance,
    created_by_id,
  } = req.body;

  // Upload main image if provided
  let imageUrl = null;
  if (req.files?.image?.[0]) {
    const imageUpload = await uploadToCloudinary(
      req.files.image[0].buffer,
      'countries/images'
    );
    imageUrl = imageUpload.secure_url;
  }

  const country = new Country({
    image: imageUrl,
    title,
    president,
    independence_date,
    capital,
    currency,
    population,
    demonym,
    description,
    language,
    time_zone: time_zone || "", // Make optional with default empty string
    link: link || "", // Make optional with default empty string
    arts_and_crafts,
    cultural_dance: cultural_dance || "", // Make optional with default empty string
    created_by_id
  });

  const savedCountry = await country.save();

  // Create and save a notification
  const notification = new Notification({
    title: 'New Country Created',
    message: `A new country ${savedCountry.title} has been created!`,
    countryID: savedCountry._id,
    type: 'country',
    createdAt: new Date(),
  });
  await notification.save();

  // Emit notification to all clients
  req.io.emit("newCountryNotification", {
    notification: {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      countryID: notification.countryID,
      type: notification.type,
      createdAt: notification.createdAt,
    },
  });

  // Format the response to match the expected structure
  res.status(201).json({
    country: savedCountry,
    notification: {
      _id: notification._id,
      countryID: notification.countryID,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    },
  });
});

// Get all countries (only title and image)
export const getAllCountries = asyncHandler(async (req, res) => {
  const countries = await Country.find({}, 'title image');
  res.status(200).json(countries);
});

// Get a particular country by ID
export const getCountryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const country = await Country.findById(id);

  if (!country) {
    res.status(404);
    throw new Error('Country not found');
  }

  res.status(200).json(country);
});

// Edit a country by ID
export const editCountry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the country first to get existing data
  const existingCountry = await Country.findById(id);
  if (!existingCountry) {
    res.status(404);
    throw new Error('Country not found');
  }

  // Extract fields from request body
  const {
    title,
    president,
    independence_date,
    capital,
    currency,
    population,
    demonym,
    description,
    language,
    time_zone,
    link,
    arts_and_crafts,
    cultural_dance
  } = req.body;

  // Upload main image if provided
  let imageUrl = existingCountry.image;
  if (req.files?.image?.[0]) {
    const imageUpload = await uploadToCloudinary(
      req.files.image[0].buffer,
      'countries/images'
    );
    imageUrl = imageUpload.secure_url;
  }

  // Create update object with proper handling of optional fields
  const updateData = {
    image: imageUrl,
  };

  // Only update fields that are provided (including empty strings for optional fields)
  if (title !== undefined) updateData.title = title;
  if (president !== undefined) updateData.president = president;
  if (independence_date !== undefined) updateData.independence_date = independence_date;
  if (capital !== undefined) updateData.capital = capital;
  if (currency !== undefined) updateData.currency = currency;
  if (population !== undefined) updateData.population = population;
  if (demonym !== undefined) updateData.demonym = demonym;
  if (description !== undefined) updateData.description = description;
  if (language !== undefined) updateData.language = language;
  if (arts_and_crafts !== undefined) updateData.arts_and_crafts = arts_and_crafts;

  // Optional fields - allow empty strings
  if (time_zone !== undefined) updateData.time_zone = time_zone;
  if (link !== undefined) updateData.link = link;
  if (cultural_dance !== undefined) updateData.cultural_dance = cultural_dance;

  // Update country
  const updatedCountry = await Country.findByIdAndUpdate(
    id,
    updateData,
    { new: true } // Return the updated document
  );

  res.status(200).json(updatedCountry);
});

// Delete a country by ID
export const deleteCountry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const country = await Country.findByIdAndDelete(id);

  if (!country) {
    res.status(404);
    throw new Error('Country not found');
  }

  res.status(200).json({ message: 'Country deleted successfully' });
});