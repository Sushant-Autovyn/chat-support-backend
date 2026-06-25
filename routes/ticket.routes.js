const express = require('express');
const router = express.Router();
const { createTicket, getTickets, getTicketById, addMessage, updateStatus } = require('../controllers/ticket.controller');

// GET /api/tickets
router.get('/', getTickets);

// GET /api/tickets/:id
router.get('/:id', getTicketById);

// POST /api/tickets
router.post('/', createTicket);

// POST /api/tickets/:id/messages
router.post('/:id/messages', addMessage);

// PUT /api/tickets/:id/status
router.put('/:id/status', updateStatus);

module.exports = router;
