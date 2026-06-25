const Ticket = require('../models/ticket.model');

const createTicket = async (req, res) => {
  try {
    const { name, email, phone, issue } = req.body;
    const companyId = req.companyId || null;

    if (!name || !email || !phone || !issue) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (name.length > 100 || email.length > 200 || phone.length > 20 || issue.length > 2000) {
      return res.status(400).json({ message: 'Input too long' });
    }

    const newTicket = new Ticket({
      companyId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      issue: issue.trim(),
      messages: [{ sender: 'user', text: issue.trim() }]
    });

    const savedTicket = await newTicket.save();

    // Save initial chat message
    try {
      const { createChatHelper } = require('./chat.controller');
      await createChatHelper(savedTicket._id, 'user', issue.trim(), null, companyId);
    } catch (err) {
      console.error('Failed to create initial chat message:', err);
    }

    // Broadcast to all agents (or company room if multi-tenant)
    try {
      const { getIO } = require('../socket/socket');
      const io = getIO();
      if (io) {
        const room = companyId ? String(companyId) : 'global';
        io.to(room).emit('new_ticket', savedTicket);
      }
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
    const companyId = req.companyId || null;
    const filter = companyId ? { companyId } : {};

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const status = req.query.status;

    if (status && ['pending', 'solved'].includes(status)) {
      filter.status = status;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Ticket.countDocuments(filter)
    ]);

    res.json({ tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error getting tickets:', error);
    res.status(500).json({ message: 'Server error, failed to get tickets' });
  }
};

const getTicketById = async (req, res) => {
  try {
    const companyId = req.companyId || null;
    const filter = { _id: req.params.id };
    if (companyId) filter.companyId = companyId;

    const ticket = await Ticket.findOne(filter).lean();
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    res.json(ticket);
  } catch (error) {
    console.error('Error getting ticket by ID:', error);
    res.status(500).json({ message: 'Server error, failed to get ticket' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const companyId = req.companyId || null;

    if (!status || !['pending', 'solved'].includes(status)) {
      return res.status(400).json({ message: 'Valid status required: pending or solved' });
    }

    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;

    // Atomic update — safe for concurrent agents
    const ticket = await Ticket.findOneAndUpdate(
      filter,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    );

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (status === 'solved') {
      try {
        const { getIO } = require('../socket/socket');
        const io = getIO();
        if (io) {
          io.to(String(id)).emit('ticket_solved', { ticketId: id });
        }
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

module.exports = { createTicket, getTickets, getTicketById, updateStatus };
