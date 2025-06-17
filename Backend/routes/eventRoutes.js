import express from 'express';
import eventController from '../controller/event.js';
import upload from "../middleware/multer.js"
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PricingOption:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - available
 *       properties:
 *         id:
 *           type: string
 *           description: Optional unique identifier for the pricing option
 *         name:
 *           type: string
 *           description: Display name for the ticket type (e.g., "Early Bird", "VIP", "General Admission")
 *           example: "VIP Premium"
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Price per ticket in dollars
 *           example: 150.00
 *         available:
 *           type: integer
 *           minimum: 0
 *           description: Number of tickets available for this type
 *           example: 50
 *         description:
 *           type: string
 *           description: Optional description of what this ticket type includes
 *           example: "Includes backstage access and complimentary drinks"
 *     EventResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         location:
 *           type: string
 *         date:
 *           type: string
 *         ticketTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PricingOption'
 *         priceRange:
 *           type: object
 *           properties:
 *             min:
 *               type: number
 *             max:
 *               type: number
 *         totalAvailable:
 *           type: integer
 */

/**
 * @swagger
 * /events/featured:
 *   get:
 *     summary: Get featured and upcoming events
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of featured events with flexible pricing options
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EventResponse'
 *       500:
 *         description: Server error
 */
router.get('/featured', eventController.getFeaturedEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event details by ID
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
 *         description: Event details with all pricing options
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/EventResponse'
 *                 - type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                     time:
 *                       type: string
 *                     address:
 *                       type: string
 *                     organiser:
 *                       type: string
 *                     description:
 *                       type: string
 *                     image:
 *                       type: string
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event not found"
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
 *         description: List of event buyers with comprehensive ticket type analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventTitle:
 *                   type: string
 *                 totalTicketsSold:
 *                   type: number
 *                   description: Total number of tickets sold across all types
 *                 totalRevenue:
 *                   type: number
 *                   description: Total revenue generated from all ticket sales
 *                 averageTicketPrice:
 *                   type: number
 *                   description: Average price per ticket across all sales
 *                 ticketTypeSummary:
 *                   type: object
 *                   description: Breakdown by ticket type
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       count:
 *                         type: number
 *                       revenue:
 *                         type: number
 *                       averagePrice:
 *                         type: number
 *                 totalTicketTypeOptions:
 *                   type: number
 *                   description: Number of different ticket types that have been sold
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
 *                         description: Internal ticket type identifier
 *                       ticketTypeName:
 *                         type: string
 *                         description: Display name of the ticket type
 *                       pricePerTicket:
 *                         type: number
 *                       amount:
 *                         type: number
 *                         description: Total amount paid for this purchase
 *                       purchaseDate:
 *                         type: string
 *                         format: date-time
 *                       transactionId:
 *                         type: string
 *       404:
 *         description: No tickets sold or event not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No tickets sold for this event"
 */
router.get("/:eventId/buyers", eventController.getEventBuyers);

/**
 * @swagger
 * /events/createvent:
 *   post:
 *     summary: Create a new event with flexible pricing options (up to 10 types)
 *     tags: [Events]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - location
 *               - date
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Event image file
 *               title:
 *                 type: string
 *                 description: Event title
 *                 example: "Summer Music Festival 2024"
 *               location:
 *                 type: string
 *                 description: Event location/venue
 *                 example: "Central Park Amphitheater"
 *               date:
 *                 type: string
 *                 description: Event date
 *                 example: "2024-07-15"
 *               time:
 *                 type: string
 *                 description: Event time
 *                 example: "7:00 PM"
 *               category:
 *                 type: string
 *                 description: Event category
 *                 example: "Music"
 *               address:
 *                 type: string
 *                 description: Full address
 *                 example: "123 Park Ave, New York, NY 10001"
 *               latitude:
 *                 type: string
 *                 description: GPS latitude
 *               longitude:
 *                 type: string
 *                 description: GPS longitude
 *               organiser:
 *                 type: string
 *                 description: Event organizer name
 *                 example: "NYC Events Co."
 *               description:
 *                 type: string
 *                 description: Event description
 *               unit:
 *                 type: string
 *                 description: Unit identifier
 *               paypalUsername:
 *                 type: string
 *                 description: PayPal username for payments
 *               geoTag:
 *                 type: string
 *                 description: Geographic tag
 *
 *               # Method 1: pricingOptions array (recommended)
 *               pricingOptions:
 *                 type: array
 *                 description: Array of pricing options (up to 10)
 *                 maxItems: 10
 *                 items:
 *                   $ref: '#/components/schemas/PricingOption'
 *                 example:
 *                   - name: "Early Bird"
 *                     price: 50.00
 *                     available: 100
 *                     description: "Limited time early bird pricing"
 *                   - name: "General Admission"
 *                     price: 75.00
 *                     available: 500
 *                     description: "Standard admission ticket"
 *                   - name: "VIP Premium"
 *                     price: 150.00
 *                     available: 50
 *                     description: "VIP access with premium amenities"
 *
 *               # Method 2: Indexed format (alternative)
 *               pricing_0_name:
 *                 type: string
 *                 description: Name for first pricing option
 *                 example: "Early Bird"
 *               pricing_0_price:
 *                 type: number
 *                 description: Price for first pricing option
 *                 example: 50.00
 *               pricing_0_available:
 *                 type: number
 *                 description: Available tickets for first pricing option
 *                 example: 100
 *               pricing_0_description:
 *                 type: string
 *                 description: Description for first pricing option
 *                 example: "Limited time early bird pricing"
 *               pricing_1_name:
 *                 type: string
 *                 description: Name for second pricing option
 *               pricing_1_price:
 *                 type: number
 *                 description: Price for second pricing option
 *               pricing_1_available:
 *                 type: number
 *                 description: Available tickets for second pricing option
 *               pricing_1_description:
 *                 type: string
 *                 description: Description for second pricing option
 *
 *               # Method 3: Custom named fields (alternative)
 *               ticketName_0:
 *                 type: string
 *                 description: Custom ticket name format
 *               ticketPrice_0:
 *                 type: number
 *                 description: Custom ticket price format
 *               ticketAvailable_0:
 *                 type: number
 *                 description: Custom ticket availability format
 *               ticketDescription_0:
 *                 type: string
 *                 description: Custom ticket description format
 *
 *               # Method 4: Legacy format (backward compatibility)
 *               price:
 *                 type: number
 *                 description: Legacy price field for backward compatibility
 *               regularPrice:
 *                 type: number
 *                 description: Regular ticket price (legacy)
 *               regularAvailable:
 *                 type: number
 *                 description: Regular tickets available (legacy)
 *               regularDescription:
 *                 type: string
 *                 description: Regular ticket description (legacy)
 *               vipPrice:
 *                 type: number
 *                 description: VIP ticket price (legacy)
 *               vipAvailable:
 *                 type: number
 *                 description: VIP tickets available (legacy)
 *               vipDescription:
 *                 type: string
 *                 description: VIP ticket description (legacy)
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   allOf:
 *                     - $ref: '#/components/schemas/EventResponse'
 *                     - type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 notification:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     message:
 *                       type: string
 *                     type:
 *                       type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "At least one pricing option is required"
 *       500:
 *         description: Server error
 */
router.post('/createvent', upload.single('image'), eventController.createEvent);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update an event with flexible pricing options
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Event ID to update
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
 *                 description: New event image file
 *               title:
 *                 type: string
 *                 description: Updated event title
 *               location:
 *                 type: string
 *                 description: Updated event location
 *               date:
 *                 type: string
 *                 description: Updated event date
 *               time:
 *                 type: string
 *                 description: Updated event time
 *               category:
 *                 type: string
 *                 description: Updated event category
 *               address:
 *                 type: string
 *                 description: Updated full address
 *               latitude:
 *                 type: string
 *                 description: Updated GPS latitude
 *               longitude:
 *                 type: string
 *                 description: Updated GPS longitude
 *               organiser:
 *                 type: string
 *                 description: Updated organizer name
 *               description:
 *                 type: string
 *                 description: Updated event description
 *               unit:
 *                 type: string
 *                 description: Updated unit identifier
 *               paypalUsername:
 *                 type: string
 *                 description: Updated PayPal username
 *               geoTag:
 *                 type: string
 *                 description: Updated geographic tag
 *
 *               # Pricing updates using any of the supported methods
 *               pricingOptions:
 *                 type: array
 *                 description: Updated pricing options (up to 10)
 *                 maxItems: 10
 *                 items:
 *                   $ref: '#/components/schemas/PricingOption'
 *
 *               # Alternative indexed format for updates
 *               pricing_0_name:
 *                 type: string
 *               pricing_0_price:
 *                 type: number
 *               pricing_0_available:
 *                 type: number
 *               pricing_0_description:
 *                 type: string
 *
 *               # Legacy format still supported
 *               price:
 *                 type: number
 *                 description: Legacy price field
 *               regularPrice:
 *                 type: number
 *               regularAvailable:
 *                 type: number
 *               vipPrice:
 *                 type: number
 *               vipAvailable:
 *                 type: number
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event not found"
 *       500:
 *         description: Server error
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
 *         description: Event ID to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event deleted successfully"
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event not found"
 *       500:
 *         description: Server error
 */
router.delete("/:id/delete", eventController.deleteEvent);

export default router;