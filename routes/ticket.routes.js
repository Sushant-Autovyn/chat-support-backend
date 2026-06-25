const express = require('express');
const router = express.Router();
const { createTicket, getTickets, getTicketById, updateStatus } = require('../controllers/ticket.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Public: chatbot widget can create tickets
router.post('/', createTicket);

// Public: chatbot widget can check ticket status
router.get('/:id', getTicketById);

// Protected: only authenticated agents/admins can list all tickets or update status
router.get('/', requireAuth, getTickets);
router.put('/:id/status', requireAuth, updateStatus);

module.exports = router;
