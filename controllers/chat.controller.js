const Chat = require('../models/chat.model');

// @desc    Get all chat messages for a specific ticket
// @route   GET /api/chats/:ticketId
// @access  Public
const getChatsByTicketId = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const chats = await Chat.find({ ticketId }).sort({ createdAt: 1 });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error, failed to fetch chats' });
  }
};

// Helper function to save chat message in database
const createChatHelper = async (ticketId, sender, text, imageUrl = null) => {
  const newChat = new Chat({
    ticketId,
    sender,
    text: text || '',
    imageUrl: imageUrl || null
  });
  return await newChat.save();
};

module.exports = {
  getChatsByTicketId,
  createChatHelper
};
