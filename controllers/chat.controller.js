const Chat = require('../models/chat.model');

const getChatsByTicketId = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const companyId = req.companyId || null;

    const filter = { ticketId };
    if (companyId) filter.companyId = companyId;

    const chats = await Chat.find(filter).sort({ createdAt: 1 }).lean();
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error, failed to fetch chats' });
  }
};

const createChatHelper = async (ticketId, sender, text, imageUrl = null, companyId = null) => {
  const newChat = new Chat({
    companyId: companyId || null,
    ticketId,
    sender,
    text: text || '',
    imageUrl: imageUrl || null
  });
  return await newChat.save();
};

module.exports = { getChatsByTicketId, createChatHelper };
