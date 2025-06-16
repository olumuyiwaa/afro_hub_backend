import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
    },
    paypalOrderId: {
        type: String,
    },
    amount: {
        type: Number,
    },
    stripePaymentIntentId: {
        type: String
    },
    ticketCount: {
        type: Number,
        required: true
    },
    // Add ticket type to track VIP or Regular
    ticketType: {
        type: String,
        enum: ['regular', 'vip'],
        required: true
    },
    // Add price per ticket for transparency
    pricePerTicket: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', "PAID"],
    },
    paymentDetails: {
        type: Object
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    paymentStatus: {
        type: String,
    },
    stripeSessionId: { type: String },
});

export default mongoose.model('Transaction', transactionSchema);