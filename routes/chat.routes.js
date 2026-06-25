const express = require('express');
const router = express.Router();
const { getChatsByTicketId } = require('../controllers/chat.controller');

// GET /api/chats/:ticketId
router.get('/:ticketId', getChatsByTicketId);

module.exports = router;
