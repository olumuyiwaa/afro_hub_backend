import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
            .populate('ticketId', 'title location date image category time address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalTransactions = await Transaction.countDocuments(filter);

        // Process Stripe transactions if they exist
        const stripeTransactionIds = transactions
            .filter(tx => tx.stripePaymentIntentId)
            .map(tx => tx.stripePaymentIntentId);

        let stripePaymentIntents = [];
        if (stripeTransactionIds.length > 0) {
            try {
                stripePaymentIntents = await Promise.all(
                    stripeTransactionIds.map(async (paymentIntentId) => {
                        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                        return {
                            id: paymentIntent.id,
                            amount: paymentIntent.amount / 100,
                            currency: paymentIntent.currency,
                            status: paymentIntent.status,
                            created: new Date(paymentIntent.created * 1000),
                        };
                    })
                );
            } catch (stripeError) {
                console.error('Error fetching Stripe payment intents:', stripeError);
                // Continue without Stripe data if there's an error
            }
        }

        // Format transactions to include flexible ticket type information
        const formattedTransactions = transactions.map(transaction => {
            const baseTransaction = transaction.toObject();

            // Find corresponding Stripe data if it exists
            const stripeData = stripePaymentIntents.find(
                stripe => stripe.id === transaction.stripePaymentIntentId
            );

            return {
                ...baseTransaction,
                ticketDetails: {
                    eventTitle: transaction.ticketId?.title,
                    eventLocation: transaction.ticketId?.location,
                    eventDate: transaction.ticketId?.date,
                    eventTime: transaction.ticketId?.time,
                    eventAddress: transaction.ticketId?.address,
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
                stripeDetails: stripeData || null,
                canRefund: transaction.status === 'COMPLETED' &&
                          transaction.paymentStatus === 'paid' &&
                          transaction.ticketId?.date &&
                          new Date(transaction.ticketId.date) > new Date()
            };
        });

        // Calculate summary statistics
        const completedTransactions = formattedTransactions.filter(
            t => t.status === 'COMPLETED' || t.status === 'PAID'
        );
        const totalSpent = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalTickets = completedTransactions.reduce((sum, t) => sum + t.ticketCount, 0);

        // Group transactions by ticket type for analytics
        const ticketTypeBreakdown = {};
        completedTransactions.forEach(transaction => {
            const ticketType = transaction.ticketTypeName || transaction.ticketType;
            if (!ticketTypeBreakdown[ticketType]) {
                ticketTypeBreakdown[ticketType] = {
                    count: 0,
                    totalSpent: 0,
                    transactions: 0
                };
            }
            ticketTypeBreakdown[ticketType].count += transaction.ticketCount;
            ticketTypeBreakdown[ticketType].totalSpent += transaction.amount;
            ticketTypeBreakdown[ticketType].transactions += 1;
        });

        res.json({
            transactions: formattedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalTransactions / parseInt(limit)),
                totalTransactions,
                hasNextPage: skip + parseInt(limit) < totalTransactions,
                hasPrevPage: parseInt(page) > 1,
                itemsPerPage: parseInt(limit)
            },
            summary: {
                totalSpent: totalSpent.toFixed(2),
                totalTickets,
                totalEvents: new Set(completedTransactions.map(t => t.ticketId?.toString())).size,
                completedTransactions: completedTransactions.length,
                ticketTypeBreakdown
            },
            filters: {
                appliedStatus: status || 'all',
                appliedEventId: eventId || 'all'
            }
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            message: 'Error fetching payment history: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
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

        // Fetch Stripe details if it's a Stripe transaction
        let stripeDetails = null;
        if (transaction.stripePaymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(
                    transaction.stripePaymentIntentId
                );
                stripeDetails = {
                    id: paymentIntent.id,
                    amount: paymentIntent.amount / 100,
                    currency: paymentIntent.currency,
                    status: paymentIntent.status,
                    created: new Date(paymentIntent.created * 1000),
                    paymentMethod: paymentIntent.payment_method,
                    charges: paymentIntent.charges?.data || []
                };
            } catch (stripeError) {
                console.error('Error fetching Stripe payment intent:', stripeError);
            }
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
                eventCategory: transaction.ticketId?.category,
                organiser: transaction.ticketId?.organiser,
                description: transaction.ticketId?.description,
                ticketType: transaction.ticketType,
                ticketTypeName: transaction.ticketTypeName,
                pricePerTicket: transaction.pricePerTicket,
                ticketCount: transaction.ticketCount,
                totalAmount: transaction.amount
            },
            paymentMethod: transaction.paypalOrderId ? 'PayPal' :
                         transaction.stripePaymentIntentId ? 'Stripe' : 'Unknown',
            stripeDetails,
            formattedAmount: `$${transaction.amount.toFixed(2)}`,
            formattedDate: transaction.createdAt.toLocaleDateString(),
            formattedTime: transaction.createdAt.toLocaleTimeString(),
            canRefund: transaction.status === 'COMPLETED' &&
                      transaction.paymentStatus === 'paid' &&
                      transaction.ticketId?.date &&
                      new Date(transaction.ticketId.date) > new Date(),
            isUpcoming: transaction.ticketId?.date &&
                       new Date(transaction.ticketId.date) > new Date()
        };

        res.json(formattedTransaction);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({
            message: 'Error fetching transaction details: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Get payment statistics for analytics
const getPaymentStatistics = async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const filter = { userId };
        if (Object.keys(dateFilter).length > 0) {
            filter.createdAt = dateFilter;
        }

        // Aggregate statistics
        const statistics = await Transaction.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    totalTickets: { $sum: '$ticketCount' },
                    completedTransactions: {
                        $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'PAID']] }, 1, 0] }
                    },
                    completedAmount: {
                        $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'PAID']] }, '$amount', 0] }
                    },
                    completedTickets: {
                        $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'PAID']] }, '$ticketCount', 0] }
                    }
                }
            }
        ]);

        // Get ticket type breakdown
        const ticketTypeStats = await Transaction.aggregate([
            { $match: { ...filter, status: { $in: ['COMPLETED', 'PAID'] } } },
            {
                $group: {
                    _id: '$ticketTypeName',
                    count: { $sum: '$ticketCount' },
                    totalAmount: { $sum: '$amount' },
                    transactions: { $sum: 1 },
                    averagePrice: { $avg: '$pricePerTicket' }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Get monthly breakdown
        const monthlyStats = await Transaction.aggregate([
            { $match: { ...filter, status: { $in: ['COMPLETED', 'PAID'] } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: '$ticketCount' },
                    totalAmount: { $sum: '$amount' },
                    transactions: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);

        const result = {
            overview: statistics[0] || {
                totalTransactions: 0,
                totalAmount: 0,
                totalTickets: 0,
                completedTransactions: 0,
                completedAmount: 0,
                completedTickets: 0
            },
            ticketTypeBreakdown: ticketTypeStats,
            monthlyBreakdown: monthlyStats,
            period: {
                startDate: startDate || 'All time',
                endDate: endDate || 'Present'
            }
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching payment statistics:', error);
        res.status(500).json({
            message: 'Error fetching payment statistics: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

export {
    getPaymentHistory,
    getTransactionDetails,
    getPaymentStatistics
};