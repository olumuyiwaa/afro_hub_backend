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
    // Updated to support flexible ticket types
    ticketType: {
        type: String,
        required: true
    },
    // Store the display name of the ticket type for reference
    ticketTypeName: {
        type: String,
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