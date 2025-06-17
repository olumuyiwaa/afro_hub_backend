import express from 'express';
import eventController from '../controller/event.js';
import upload from "../middleware/multer.js"
const router = express.Router();

/**
 * @swagger
 * /events/featured:
 *   get:
 *     summary: Get featured and upcoming events
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of featured events with pricing information
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   location:
 *                     type: string
 *                   date:
 *                     type: string
 *                   ticketTypes:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         price:
 *                           type: number
 *                         available:
 *                           type: integer
 *                         description:
 *                           type: string
 *                   priceRange:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: number
 *                       max:
 *                         type: number
 */
router.get('/featured', eventController.getFeaturedEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event details by ID with all pricing options
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Event ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details with complete pricing information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 location:
 *                   type: string
 *                 date:
 *                   type: string
 *                 time:
 *                   type: string
 *                 address:
 *                   type: string
 *                 description:
 *                   type: string
 *                 organiser:
 *                   type: string
 *                 image:
 *                   type: string
 *                 ticketTypes:
 *                   type: array
 *                   description: All available ticket types for this event
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier for the ticket type
 *                       name:
 *                         type: string
 *                         description: Display name of the ticket type
 *                       price:
 *                         type: number
 *                         description: Price per ticket
 *                       available:
 *                         type: integer
 *                         description: Number of tickets available
 *                       description:
 *                         type: string
 *                         description: Additional details about the ticket type
 *                 totalAvailable:
 *                   type: integer
 *                   description: Total tickets available across all types
 *                 priceRange:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 *       404:
 *         description: Event not found
 */
router.get('/:id', eventController.getEventDetails);

/**
 * @swagger
 * /events/{eventId}/buyers:
 *   get:
 *     summary: Get buyers for an event with detailed ticket type breakdown
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         description: Event ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of event buyers with comprehensive ticket type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventTitle:
 *                   type: string
 *                 totalTicketsSold:
 *                   type: number
 *                 totalRevenue:
 *                   type: number
 *                 averageTicketPrice:
 *                   type: number
 *                 ticketTypeSummary:
 *                   type: object
 *                   description: Summary by ticket type
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       revenue:
 *                         type: number
 *                       averagePrice:
 *                         type: number
 *                 totalTicketTypeOptions:
 *                   type: integer
 *                 buyers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       ticketCount:
 *                         type: number
 *                       ticketType:
 *                         type: string
 *                       ticketTypeName:
 *                         type: string
 *                       pricePerTicket:
 *                         type: number
 *                       amount:
 *                         type: number
 *                       purchaseDate:
 *                         type: string
 *                         format: date-time
 *                       transactionId:
 *                         type: string
 *       404:
 *         description: No tickets sold or event not found
 */
router.get("/:eventId/buyers", eventController.getEventBuyers);

/**
 * @swagger
 * /events/createvent:
 *   post:
 *     summary: Create a new event with VIP and Regular pricing
 *     tags: [Events]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               date:
 *                 type: string
 *               price:
 *                 type: number
 *                 description: Legacy price field for backward compatibility
 *               regularPrice:
 *                 type: number
 *                 description: Price for regular tickets
 *               regularAvailable:
 *                 type: number
 *                 description: Number of regular tickets available
 *               vipPrice:
 *                 type: number
 *                 description: Price for VIP tickets
 *               vipAvailable:
 *                 type: number
 *                 description: Number of VIP tickets available
 *               category:
 *                 type: string
 *               time:
 *                 type: string
 *               address:
 *                 type: string
 *               latitude:
 *                 type: string
 *               longitude:
 *                 type: string
 *               organiser:
 *                 type: string
 *               description:
 *                 type: string
 *               unit:
 *                 type: string
 *               paypalUsername:
 *                 type: string
 *               geoTag:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event created successfully
 */
router.post('/createvent', upload.single('image'), eventController.createEvent);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update an event with pricing options
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Event ID
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               date:
 *                 type: string
 *               price:
 *                 type: number
 *               regularPrice:
 *                 type: number
 *               regularAvailable:
 *                 type: number
 *               vipPrice:
 *                 type: number
 *               vipAvailable:
 *                 type: number
 *               category:
 *                 type: string
 *               time:
 *                 type: string
 *               address:
 *                 type: string
 *               latitude:
 *                 type: string
 *               longitude:
 *                 type: string
 *               organiser:
 *                 type: string
 *               description:
 *                 type: string
 *               unit:
 *                 type: string
 *               paypalUsername:
 *                 type: string
 *               geoTag:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       404:
 *         description: Event not found
 */
router.patch('/:id', upload.single('image'), eventController.updateEvent);

/**
 * @swagger
 * /events/{id}/delete:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Event ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       404:
 *         description: Event not found
 */
router.delete("/:id/delete", eventController.deleteEvent);

export default router;