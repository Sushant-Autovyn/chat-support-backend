const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  issue: { type: String, required: true, trim: true, maxlength: 2000 },
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
      sender: { type: String, enum: ['user', 'support'], required: true },
      text: { type: String, required: true, maxlength: 5000 },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now, index: true }
});

ticketSchema.index({ companyId: 1, status: 1 });
ticketSchema.index({ companyId: 1, createdAt: -1 });
ticketSchema.index({ companyId: 1, assignedAgentId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
