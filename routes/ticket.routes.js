const express = require('express');
const router = express.Router();
const { createTicket, getTickets, getTicketById, updateStatus, assignTicket } = require('../controllers/ticket.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { ticketCreateLimiter } = require('../middleware/rateLimiters');

// Public: chatbot widget can create tickets (anti-spam limiter on POST only).
router.post('/', ticketCreateLimiter, createTicket);

// Public: chatbot widget can check ticket status (NOT rate-limited beyond general).
router.get('/:id', getTicketById);

// Protected: only authenticated agents/admins can list all tickets, update status, or assign.
router.get('/', requireAuth, getTickets);
router.put('/:id/status', requireAuth, updateStatus);
router.put('/:id/assign', requireAuth, assignTicket);

module.exports = router;
