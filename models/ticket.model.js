const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  issue: {
    type: String,
    required: true,
    trim: true
  },
  assignedAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'solved'],
    default: 'pending',
    index: true
  },
  messages: [
    {
      sender: {
        type: String,
        enum: ['user', 'support'],
        required: true
      },
      text: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for fast multi-tenant queries
ticketSchema.index({ companyId: 1, status: 1 });
ticketSchema.index({ companyId: 1, createdAt: -1 });
ticketSchema.index({ companyId: 1, assignedAgentId: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
