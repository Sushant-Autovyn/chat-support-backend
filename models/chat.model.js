const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true
  },
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },
  sender: { type: String, enum: ['user', 'support'], required: true },
  agentName: { type: String, default: null, maxlength: 100 },
  text: { type: String, default: '', maxlength: 5000 },
  imageUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

chatSchema.index({ ticketId: 1, createdAt: 1 });
chatSchema.index({ companyId: 1, ticketId: 1 });

module.exports = mongoose.model('Chat', chatSchema);
