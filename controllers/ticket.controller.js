const Ticket = require('../models/ticket.model');

const createTicket = async (req, res) => {
  try {
    const { name, email, phone, issue } = req.body;
    const companyId = req.companyId;

    if (!name || !email || !phone || !issue) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newTicket = new Ticket({ companyId, name, email, phone, issue, messages: [{ sender: 'user', text: issue }] });
    const savedTicket = await newTicket.save();

    try {
      const { createChatHelper } = require('./chat.controller');
      await createChatHelper(savedTicket._id, 'user', issue);
    } catch (err) {
      console.error('Failed to create initial chat message:', err);
    }

    try {
      const { getIO } = require('../socket/socket');
      const io = getIO();
      if (io) io.emit('new_ticket', savedTicket);
    } catch (err) {
      console.error('Failed to broadcast new ticket:', err);
    }

    res.status(201).json(savedTicket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Server error, failed to save ticket' });
  }
};

const getTickets = async (req, res) => {
  try {
    const companyId = req.companyId;
    const tickets = await Ticket.find({ companyId }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error getting tickets:', error);
    res.status(500).json({ message: 'Server error, failed to get tickets' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const companyId = req.companyId;

    if (!status || !['pending', 'solved'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }

    const ticket = await Ticket.findOne({ _id: id, companyId });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    ticket.status = status;
    await ticket.save();

    if (status === 'solved') {
      try {
        const { getIO } = require('../socket/socket');
        const io = getIO();
        if (io) io.to(id).emit('ticket_solved', { ticketId: id });
      } catch (err) {
        console.error('Failed to emit ticket_solved event:', err);
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Server error, failed to update status' });
  }
};

const getTicketById = async (req, res) => {
  try {
    const companyId = req.companyId;
    const ticket = await Ticket.findOne({ _id: req.params.id, companyId });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    console.error('Error getting ticket by ID:', error);
    res.status(500).json({ message: 'Server error, failed to get ticket' });
  }
};

module.exports = { createTicket, getTickets, getTicketById, updateStatus };
