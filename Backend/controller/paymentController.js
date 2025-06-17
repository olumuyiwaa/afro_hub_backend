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

        // Find the event
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        // Validate pricing and availability using the flexible pricing structure
        const ticketTypeData = ticket.pricing.get(ticketType);
        if (!ticketTypeData) {
            return res.status(400).json({
                message: `Ticket type "${ticketType}" is not available for this event.`
            });
        }

        // Verify the price matches what's stored in the database (security check)
        const storedPrice = ticketTypeData.price;
        if (Math.abs(parseFloat(pricePerTicket) - storedPrice) > 0.01) {
            return res.status(400).json({
                message: 'Price mismatch. Please refresh and try again.',
                details: {
                    expectedPrice: storedPrice,
                    providedPrice: parseFloat(pricePerTicket)
                }
            });
        }

        // Check availability
        const availableTickets = ticketTypeData.available;
        const requestedCount = parseInt(ticketCount, 10);
        if (availableTickets < requestedCount) {
            return res.status(400).json({
                message: `Only ${availableTickets} ${ticketTypeData.name} tickets available.`,
                availableTickets: availableTickets
            });
        }

        const pricePerTicketFloat = parseFloat(pricePerTicket);
        const totalPrice = pricePerTicketFloat * requestedCount;

        // Create PayPal order
        const paypalOrder = await createOrder(totalPrice);

        // Create transaction record
        const transaction = new Transaction({
            transactionId: uuidv4(),
            userId,
            ticketId,
            paypalOrderId: paypalOrder.id,
            amount: totalPrice,
            ticketCount: requestedCount,
            ticketType,
            ticketTypeName: ticketTypeData.name,
            pricePerTicket: pricePerTicketFloat,
            status: 'PENDING'
        });
        await transaction.save();

        const approvalUrl = paypalOrder.links.find(link => link.rel === 'approve').href;
        res.json({
            transactionId: transaction.transactionId,
            approvalUrl,
            orderDetails: {
                eventTitle: ticket.title,
                ticketType,
                ticketTypeName: ticketTypeData.name,
                ticketCount: requestedCount,
                pricePerTicket: pricePerTicketFloat,
                totalAmount: totalPrice,
                availableAfterPurchase: availableTickets - requestedCount
            }
        });
    } catch (error) {
        console.error('Error creating order:', error);
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
            return res.status(404).json({ message: 'Transaction not found or already processed.' });
        }

        // Check if event still exists
        if (!transaction.ticketId) {
            throw new Error('Event associated with this transaction no longer exists');
        }

        // Capture payment
        const captureData = await capturePayment(token);

        // Update event availability using the flexible pricing structure
        const event = transaction.ticketId;
        const ticketType = transaction.ticketType;
        const ticketCount = transaction.ticketCount;

        // Double-check availability before final update
        const ticketTypeData = event.pricing.get(ticketType);
        if (!ticketTypeData || ticketTypeData.available < ticketCount) {
            throw new Error(`Insufficient ${transaction.ticketTypeName} tickets available`);
        }

        const success = event.reduceTicketAvailability(ticketType, ticketCount);
        if (!success) {
            throw new Error('Failed to update ticket availability');
        }

        await event.save();

        // Update transaction status
        transaction.status = 'COMPLETED';
        transaction.paymentStatus = 'paid';
        transaction.paymentDetails = captureData;
        await transaction.save();

        // Calculate remaining tickets for this type
        const updatedTicketTypeData = event.pricing.get(ticketType);
        const remainingTickets = updatedTicketTypeData ? updatedTicketTypeData.available : 0;

        res.json({
            message: 'Payment successful',
            transactionId: transaction.transactionId,
            ticketDetails: {
                eventTitle: event.title,
                ticketType: transaction.ticketType,
                ticketTypeName: transaction.ticketTypeName,
                ticketCount: transaction.ticketCount,
                totalAmount: transaction.amount,
                remainingTickets: remainingTickets
            },
            paymentDetails: {
                paymentId: captureData.id,
                status: captureData.status,
                completedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error completing order:', error);

        // Update transaction status if it exists
        if (transaction) {
            transaction.status = 'FAILED';
            transaction.paymentDetails = { error: error.message };
            await transaction.save();
        }

        res.status(500).json({
            message: 'Error completing order: ' + error.message,
            transactionId: transaction?.transactionId
        });
    }
};

const cancelOrderController = async (req, res) => {
    try {
        const { token } = req.query;
        if (token) {
            const transaction = await Transaction.findOne({
                paypalOrderId: token,
                status: 'PENDING'
            });

            if (transaction) {
                transaction.status = 'CANCELLED';
                transaction.paymentDetails = {
                    cancelledAt: new Date(),
                    reason: 'User cancelled payment'
                };
                await transaction.save();

                return res.json({
                    message: 'Order cancelled successfully',
                    transactionId: transaction.transactionId
                });
            }
        }

        res.json({ message: 'Order cancellation processed' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Error cancelling order: ' + error.message });
    }
};

// Enhanced payment history with flexible ticket type details
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10, status, eventId } = req.query;

        // Build filter object
        const filter = { userId };
        if (status) filter.status = status;
        if (eventId) filter.ticketId = eventId;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Fetch transactions with pagination
        const transactions = await Transaction.find(filter)
            .populate('ticketId', 'title location date image category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalTransactions = await Transaction.countDocuments(filter);

        // Format transactions to include flexible ticket type information
        const formattedTransactions = transactions.map(transaction => {
            const baseTransaction = transaction.toObject();

            return {
                ...baseTransaction,
                ticketDetails: {
                    eventTitle: transaction.ticketId?.title,
                    eventLocation: transaction.ticketId?.location,
                    eventDate: transaction.ticketId?.date,
                    eventImage: transaction.ticketId?.image,
                    eventCategory: transaction.ticketId?.category,
                    ticketType: transaction.ticketType,
                    ticketTypeName: transaction.ticketTypeName,
                    pricePerTicket: transaction.pricePerTicket,
                    ticketCount: transaction.ticketCount,
                    totalAmount: transaction.amount
                },
                paymentMethod: transaction.paypalOrderId ? 'PayPal' :
                             transaction.stripePaymentIntentId ? 'Stripe' : 'Unknown',
                formattedAmount: `$${transaction.amount.toFixed(2)}`,
                formattedDate: transaction.createdAt.toLocaleDateString(),
                canRefund: transaction.status === 'COMPLETED' &&
                          transaction.paymentStatus === 'paid' &&
                          new Date(transaction.ticketId?.date) > new Date()
            };
        });

        // Calculate summary statistics
        const completedTransactions = formattedTransactions.filter(t => t.status === 'COMPLETED');
        const totalSpent = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalTickets = completedTransactions.reduce((sum, t) => sum + t.ticketCount, 0);

        res.json({
            transactions: formattedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalTransactions / parseInt(limit)),
                totalTransactions,
                hasNextPage: skip + parseInt(limit) < totalTransactions,
                hasPrevPage: parseInt(page) > 1
            },
            summary: {
                totalSpent: totalSpent.toFixed(2),
                totalTickets,
                totalEvents: new Set(completedTransactions.map(t => t.ticketId)).size,
                completedTransactions: completedTransactions.length
            }
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ message: 'Error fetching payment history: ' + error.message });
    }
};

// Get transaction details by ID
const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user._id;

        const transaction = await Transaction.findOne({
            transactionId,
            userId
        }).populate('ticketId');

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const formattedTransaction = {
            ...transaction.toObject(),
            ticketDetails: {
                eventTitle: transaction.ticketId?.title,
                eventLocation: transaction.ticketId?.location,
                eventDate: transaction.ticketId?.date,
                eventTime: transaction.ticketId?.time,
                eventAddress: transaction.ticketId?.address,
                eventImage: transaction.ticketId?.image,
                ticketType: transaction.ticketType,
                ticketTypeName: transaction.ticketTypeName,
                pricePerTicket: transaction.pricePerTicket,
                ticketCount: transaction.ticketCount,
                totalAmount: transaction.amount
            },
            paymentMethod: transaction.paypalOrderId ? 'PayPal' :
                         transaction.stripePaymentIntentId ? 'Stripe' : 'Unknown',
            canRefund: transaction.status === 'COMPLETED' &&
                      transaction.paymentStatus === 'paid' &&
                      new Date(transaction.ticketId?.date) > new Date()
        };

        res.json(formattedTransaction);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ message: 'Error fetching transaction details: ' + error.message });
    }
};

export {
    createOrderController,
    completeOrderController,
    cancelOrderController,
    getPaymentHistory,
    getTransactionDetails
};