import express from 'express';
import {
    createOrderController,
    completeOrderController,
    cancelOrderController,
    getPaymentHistory,
    getTransactionDetails
} from '../controller/paymentController.js';
import Secure from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /payment/pay:
 *   post:
 *     summary: Create a payment order for tickets with flexible pricing
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *               - ticketCount
 *               - ticketType
 *               - pricePerTicket
 *             properties:
 *               ticketId:
 *                 type: string
 *                 description: Event ID
 *               ticketCount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of tickets to purchase
 *               ticketType:
 *                 type: string
 *                 description: ID of the ticket type (e.g., 'option_1', 'vip', 'regular')
 *               pricePerTicket:
 *                 type: number
 *                 minimum: 0
 *                 description: Price per ticket for the selected type
 *           example:
 *             ticketId: "60f1b2b3c4567890abcdef12"
 *             ticketCount: 2
 *             ticketType: "option_1"
 *             pricePerTicket: 50.00
 *     responses:
 *       200:
 *         description: Payment order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactionId:
 *                   type: string
 *                 approvalUrl:
 *                   type: string
 *                 orderDetails:
 *                   type: object
 *                   properties:
 *                     eventTitle:
 *                       type: string
 *                     ticketType:
 *                       type: string
 *                     ticketTypeName:
 *                       type: string
 *                     ticketCount:
 *                       type: integer
 *                     pricePerTicket:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                     availableAfterPurchase:
 *                       type: integer
 *       400:
 *         description: Invalid request or insufficient tickets
 *       404:
 *         description: Event not found
 */
router.post('/pay', Secure, createOrderController);

/**
 * @swagger
 * /payment/complete-order:
 *   get:
 *     summary: Complete a payment order
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: PayPal order token
 *     responses:
 *       200:
 *         description: Payment completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *                 ticketDetails:
 *                   type: object
 *                   properties:
 *                     eventTitle:
 *                       type: string
 *                     ticketType:
 *                       type: string
 *                     ticketTypeName:
 *                       type: string
 *                     ticketCount:
 *                       type: integer
 *                     totalAmount:
 *                       type: number
 *                     remainingTickets:
 *                       type: integer
 *                 paymentDetails:
 *                   type: object
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Payment processing error
 */
router.get('/complete-order', completeOrderController);

/**
 * @swagger
 * /payment/cancel-order:
 *   get:
 *     summary: Cancel a payment order
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: false
 *         schema:
 *           type: string
 *         description: PayPal order token
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 */
router.get('/cancel-order', Secure, cancelOrderController);

/**
 * @swagger
 * /payment/payment-history:
 *   get:
 *     summary: Get user's payment history with flexible ticket type support
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of transactions per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, PAID]
 *         description: Filter by transaction status
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by specific event ID
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transactionId:
 *                         type: string
 *                       status:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       ticketDetails:
 *                         type: object
 *                         properties:
 *                           eventTitle:
 *                             type: string
 *                           ticketType:
 *                             type: string
 *                           ticketTypeName:
 *                             type: string
 *                           ticketCount:
 *                             type: integer
 *                           pricePerTicket:
 *                             type: number
 *                           totalAmount:
 *                             type: number
 *                       paymentMethod:
 *                         type: string
 *                       canRefund:
 *                         type: boolean
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalTransactions:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalSpent:
 *                       type: string
 *                     totalTickets:
 *                       type: integer
 *                     totalEvents:
 *                       type: integer
 *                     completedTransactions:
 *                       type: integer
 */
router.get('/payment-history', Secure, getPaymentHistory);

/**
 * @swagger
 * /payment/transaction/{transactionId}:
 *   get:
 *     summary: Get detailed information about a specific transaction
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactionId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 ticketDetails:
 *                   type: object
 *                   properties:
 *                     eventTitle:
 *                       type: string
 *                     eventLocation:
 *                       type: string
 *                     eventDate:
 *                       type: string
 *                     eventTime:
 *                       type: string
 *                     eventAddress:
 *                       type: string
 *                     ticketType:
 *                       type: string
 *                     ticketTypeName:
 *                       type: string
 *                     ticketCount:
 *                       type: integer
 *                     pricePerTicket:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                 paymentMethod:
 *                   type: string
 *                 canRefund:
 *                   type: boolean
 *       404:
 *         description: Transaction not found
 */
router.get('/transaction/:transactionId', Secure, getTransactionDetails);

export default router;