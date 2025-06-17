import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  id: Number,
  image: String,
  geoTag: String,
  title: {
    type: String,
    required: true
  },
  paypalUsername: String,
  location: String,
  date: String,
  // Updated pricing structure to support up to 10 flexible payment options
  pricing: {
    type: Map,
    of: {
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      available: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        default: ""
      }
    },
    validate: {
      validator: function(pricingMap) {
        return pricingMap.size <= 10 && pricingMap.size > 0;
      },
      message: 'Event must have between 1 and 10 pricing options'
    }
  },
  // Keep the old price field for backward compatibility
  price: {
    type: String,
    default: 0
  },
  category: String,
  time: String,
  address: String,
  latitude: Number,
  longitude: Number,
  organiser: String,
  description: String,
  unit: {
    type: Number,
    default: 0
  },
  organizerPhoto: String,
  QRCodeLink: String
}, {
  timestamps: true
});

// Helper method to get all ticket types for this event
eventSchema.methods.getTicketTypes = function() {
  const types = [];
  for (const [key, value] of this.pricing) {
    types.push({
      id: key,
      name: value.name,
      price: value.price,
      available: value.available,
      description: value.description
    });
  }
  return types;
};

// Helper method to check if a ticket type exists and is available
eventSchema.methods.isTicketTypeAvailable = function(ticketTypeId, quantity = 1) {
  const ticketType = this.pricing.get(ticketTypeId);
  return ticketType && ticketType.available >= quantity;
};

// Helper method to reduce ticket availability
eventSchema.methods.reduceTicketAvailability = function(ticketTypeId, quantity) {
  const ticketType = this.pricing.get(ticketTypeId);
  if (ticketType && ticketType.available >= quantity) {
    ticketType.available -= quantity;
    this.pricing.set(ticketTypeId, ticketType);
    return true;
  }
  return false;
};

const Event = mongoose.model('Event', eventSchema);
export default Event;