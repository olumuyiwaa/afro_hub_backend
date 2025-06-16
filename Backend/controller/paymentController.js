import { createOrder, capturePayment } from '../utils/paypal.js';
import Ticket from '../models/Event.js';
import Transaction from '../models/Transaction.js';
import { v4 as uuidv4 } from 'uuid';

const createOrderController = async (req, res) => {
    try {
        const { ticketId, ticketCount, ticketType, pricePerTicket } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!ticketId || !ticketCount || !ticketType || !pricePerTicket) {
            return res.status(400).json({
                message: 'Ticket ID, count, type, and price per ticket are required.'
            });
        }

        // Validate ticket type
        if (!['regular', 'vip'].includes(ticketType)) {
            return res.status(400).json({
                message: 'Invalid ticket type. Must be "regular" or "vip".'
            });
        }

        // Find the event
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // Validate pricing and availability
        const ticketTypeData = ticket.pricing?.[ticketType];
        if (!ticketTypeData) {
            return res.status(400).json({
                message: `${ticketType} tickets are not available for this event.`
            });
        }

        // Verify the price matches what's stored in the database (security check)
        const storedPrice = ticketTypeData.price;
        if (Math.abs(parseFloat(pricePerTicket) - storedPrice) > 0.01) {
            return res.status(400).json({
                message: 'Price mismatch. Please refresh and try again.'
            });
        }

        // Check availability
        const availableTickets = ticketTypeData.available;
        if (availableTickets < parseInt(ticketCount, 10)) {
            return res.status(400).json({
                message: `Only ${availableTickets} ${ticketType} tickets available.`
            });
        }

        const ticketCountInt = parseInt(ticketCount, 10);
        const pricePerTicketFloat = parseFloat(pricePerTicket);
        const totalPrice = pricePerTicketFloat * ticketCountInt;

        // Create PayPal order
        const paypalOrder = await createOrder(totalPrice);

        // Create transaction record
        const transaction = new Transaction({
            transactionId: uuidv4(),
            userId,
            ticketId,
            paypalOrderId: paypalOrder.id,
            amount: totalPrice,
            ticketCount: ticketCountInt,
            ticketType,
            pricePerTicket: pricePerTicketFloat,
            status: 'PENDING'
        });
        await transaction.save();

        const approvalUrl = paypalOrder.links.find(link => link.rel === 'approve').href;
        res.json({
            transactionId: transaction.transactionId,
            approvalUrl,
            orderDetails: {
                ticketType,
                ticketCount: ticketCountInt,
                pricePerTicket: pricePerTicketFloat,
                totalAmount: totalPrice
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating order: ' + error.message });
    }
};

const completeOrderController = async (req, res) => {
    let transaction;
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: 'Missing payment token.' });
        }

        // Find the pending transaction
        transaction = await Transaction.findOne({
            paypalOrderId: token,
            status: 'PENDING'
        }).populate('ticketId');

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        // Capture payment
        const captureData = await capturePayment(token);

        // Update event availability
        const event = transaction.ticketId;
        const ticketType = transaction.ticketType;
        const ticketCount = transaction.ticketCount;

        if (event.pricing && event.pricing[ticketType]) {
            event.pricing[ticketType].available -= ticketCount;
            await event.save();
        }

        // Update transaction status
        transaction.status = 'COMPLETED';
        transaction.paymentStatus = 'paid';
        transaction.paymentDetails = captureData;
        await transaction.save();

        res.json({
            message: 'Payment successful',
            transactionId: transaction.transactionId,
            ticketDetails: {
                eventTitle: event.title,
                ticketType: transaction.ticketType,
                ticketCount: transaction.ticketCount,
                totalAmount: transaction.amount
            },
            details: captureData
        });
    } catch (error) {
        // Update transaction status if it exists
        if (transaction) {
            transaction.status = 'FAILED';
            transaction.paymentDetails = { error: error.message };
            await transaction.save();
        }
        res.status(500).json({ message: 'Error completing order: ' + error.message });
    }
};

const cancelOrderController = async (req, res) => {
    try {
        const { token } = req.query;
        if (token) {
            const transaction = await Transaction.findOne({ paypalOrderId: token });
            if (transaction) {
                transaction.status = 'CANCELLED';
                await transaction.save();
            }
        }
        res.redirect('/');
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling order: ' + error.message });
    }
};

// Updated payment history with ticket type details
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const transactions = await Transaction.find({ userId })
            .populate('ticketId')
            .sort({ createdAt: -1 });

        // Format transactions to include ticket type information
        const formattedTransactions = transactions.map(transaction => ({
            ...transaction.toObject(),
            ticketDetails: {
                eventTitle: transaction.ticketId?.title,
                ticketType: transaction.ticketType,
                pricePerTicket: transaction.pricePerTicket,
                ticketCount: transaction.ticketCount,
                totalAmount: transaction.amount
            }
        }));

        res.json(formattedTransactions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment history: ' + error.message });
    }
};

export {
    createOrderController,
    completeOrderController,
    cancelOrderController,
    getPaymentHistory
};