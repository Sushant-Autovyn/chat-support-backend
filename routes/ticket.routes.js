const express = require('express');
const router = express.Router();
const { createTicket, getTickets, getTicketById, updateStatus } = require('../controllers/ticket.controller');

router.get('/', getTickets);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.put('/:id/status', updateStatus);

module.exports = router;
