const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const logger = require('../utils/logger');
const { sanitizeText, sanitizeField } = require('../utils/sanitize');

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

    // Sanitise all free-text before it ever touches the database.
    const cleanName = sanitizeField(name, 100);
    const cleanEmail = email.trim().toLowerCase().slice(0, 200);
    const cleanPhone = sanitizeField(phone, 20);
    const cleanIssue = sanitizeField(issue, 2000);

    const newTicket = new Ticket({
      companyId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      issue: cleanIssue,
      messages: [{ sender: 'user', text: cleanIssue }]
    });

    const savedTicket = await newTicket.save();

    // Save initial chat message. Pass the raw issue — createChatHelper does its
    // own sanitisation, so passing cleanIssue here would double-encode entities.
    try {
      const { createChatHelper } = require('./chat.controller');
      await createChatHelper(savedTicket._id, 'user', issue.trim().slice(0, 2000), null, companyId);
    } catch (err) {
      logger.error('Failed to create initial chat message', { err: err.message });
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
      logger.error('Failed to broadcast new ticket', { err: err.message });
    }

    res.status(201).json(savedTicket);
  } catch (error) {
    logger.error('Error creating ticket', { err: error.message });
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

    // Filter by assigned agent: ?assignedAgentId=<id> or ?mine=true (current agent).
    if (req.query.mine === 'true' && req.agentId) {
      filter.assignedAgentId = req.agentId;
    } else if (req.query.assignedAgentId && mongoose.isValidObjectId(req.query.assignedAgentId)) {
      filter.assignedAgentId = req.query.assignedAgentId;
    }

    // Exclude the embedded `messages` array from list results — it grows
    // unbounded per ticket and the UI loads conversation history separately via
    // GET /api/chats/:id. Dropping it keeps the list query fast at scale.
    const [tickets, total] = await Promise.all([
      Ticket.find(filter).select('-messages').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Ticket.countDocuments(filter)
    ]);

    res.json({ tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error('Error getting tickets', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to get tickets' });
  }
};

const getTicketById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    // Public endpoint: find ticket by ID only (no company filtering).
    const ticket = await Ticket.findById(req.params.id).lean();
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    res.json(ticket);
  } catch (error) {
    logger.error('Error getting ticket by ID', { err: error.message });
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
        logger.error('Failed to emit ticket_solved event', { err: err.message });
      }
    }

    res.json(ticket);
  } catch (error) {
    logger.error('Error updating status', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to update status' });
  }
};

// Persist ticket → agent assignment in the database (was previously client-only).
const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body; // null/'' to unassign
    const companyId = req.companyId || null;

    if (agentId && !mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({ message: 'Invalid agent id' });
    }

    const filter = { _id: id };
    if (companyId) filter.companyId = companyId;

    const ticket = await Ticket.findOneAndUpdate(
      filter,
      { $set: { assignedAgentId: agentId || null } },
      { returnDocument: 'after', runValidators: true }
    );

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Notify dashboards that assignment changed.
    try {
      const { getIO } = require('../socket/socket');
      const io = getIO();
      if (io) {
        const room = companyId ? String(companyId) : 'global';
        io.to(room).emit('ticket_assigned', { ticketId: id, agentId: agentId || null });
      }
    } catch (err) {
      logger.error('Failed to emit ticket_assigned event', { err: err.message });
    }

    res.json(ticket);
  } catch (error) {
    logger.error('Error assigning ticket', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to assign ticket' });
  }
};

module.exports = { createTicket, getTickets, getTicketById, updateStatus, assignTicket };
