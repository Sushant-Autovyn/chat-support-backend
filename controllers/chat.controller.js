const mongoose = require('mongoose');
const Chat = require('../models/chat.model');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/sanitize');

const getChatsByTicketId = async (req, res) => {
  try {
    const { ticketId } = req.params;
    if (!mongoose.isValidObjectId(ticketId)) {
      return res.status(400).json({ message: 'Invalid ticket id' });
    }

    // Pagination: default cap of 500 most-recent messages so a long-running
    // ticket never streams thousands of rows to the browser. Returns oldest→newest
    // within the returned window. Response stays a plain array (backward-compatible).
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    // Grab the newest `limit` after `skip`, then return in chronological order.
    // Sort by _id as a tiebreaker so messages created in the same millisecond
    // keep stable insertion order.
    const recentDesc = await Chat.find({ ticketId })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(recentDesc.reverse());
  } catch (error) {
    logger.error('Error fetching chats', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to fetch chats' });
  }
};

const createChatHelper = async (ticketId, sender, text, imageUrl = null, companyId = null, agentName = null) => {
  const newChat = new Chat({
    companyId: companyId || null,
    ticketId,
    sender,
    agentName: agentName ? sanitizeText(agentName) : null,
    text: text ? sanitizeText(text) : '',
    imageUrl: imageUrl || null
  });
  return await newChat.save();
};

module.exports = { getChatsByTicketId, createChatHelper };
