let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Track connected agents per room for monitoring
  const roomAgents = new Map();

  io.on('connection', (socket) => {
    // Each agent/admin joins their company room (or 'global' if single-tenant)
    socket.on('join_company', ({ companyId }) => {
      const room = companyId ? String(companyId) : 'global';
      socket.join(room);
      if (!roomAgents.has(room)) roomAgents.set(room, new Set());
      roomAgents.get(room).add(socket.id);
    });

    // Join a specific ticket conversation room (for live chat)
    socket.on('join_ticket', ({ ticketId }) => {
      if (ticketId) socket.join(String(ticketId));
    });

    socket.on('leave_ticket', ({ ticketId }) => {
      if (ticketId) socket.leave(String(ticketId));
    });

    socket.on('send_message', async ({ ticketId, sender, text, imageUrl, agentName, companyId }) => {
      try {
        const { createChatHelper } = require('../controllers/chat.controller');
        const savedChat = await createChatHelper(ticketId, sender, text, imageUrl, companyId || null, agentName || null);
        const payload = { ...savedChat.toObject(), agentName: savedChat.agentName || null };

        // Broadcast to: ticket room + company room + global (covers all scenarios)
        io.to(String(ticketId)).emit('receive_message', payload);

        const room = companyId ? String(companyId) : 'global';
        io.to(room).emit('receive_message', payload);
      } catch (error) {
        console.error('Error handling send_message:', error);
        socket.emit('message_error', { error: 'Failed to send message', ticketId });
      }
    });

    socket.on('disconnect', () => {
      roomAgents.forEach((agents, room) => {
        agents.delete(socket.id);
        if (agents.size === 0) roomAgents.delete(room);
      });
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
