const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },
  sender: {
    type: String,
    enum: ['user', 'support'],
    required: true
  },
  text: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for fast multi-tenant message queries
chatSchema.index({ companyId: 1, ticketId: 1 });
chatSchema.index({ companyId: 1, createdAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
