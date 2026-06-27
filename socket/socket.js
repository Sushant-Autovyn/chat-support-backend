const logger = require('../utils/logger');
const { config } = require('../config/env');

let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    // Cap per-message payload so a malicious/huge base64 image can't exhaust memory.
    maxHttpBufferSize: config.maxSocketImageBytes + 256 * 1024,
  });

  // ─── Optional horizontal scaling ─────────────────────────────────────────
  // When REDIS_URL is set, attach the Redis adapter so multiple server
  // instances behind a load balancer share socket rooms/broadcasts. If the
  // optional packages aren't installed we log and keep running single-instance
  // (perfectly fine for tens of thousands of daily users on one box).
  if (config.redisUrl) {
    (async () => {
      try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: config.redisUrl });
        const subClient = pubClient.duplicate();
        pubClient.on('error', (e) => logger.error('Redis pub error', { err: e.message }));
        subClient.on('error', (e) => logger.error('Redis sub error', { err: e.message }));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter enabled (multi-instance ready)');
      } catch (err) {
        logger.warn('REDIS_URL set but Redis adapter not active — running single-instance', { err: err.message });
        logger.warn('To enable multi-instance scaling: npm i redis @socket.io/redis-adapter');
      }
    })();
  }

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

    // Typing indicator passthrough (no persistence — purely transient).
    socket.on('typing', ({ ticketId, sender, agentName }) => {
      if (!ticketId) return;
      socket.to(String(ticketId)).emit('typing', { ticketId, sender, agentName: agentName || null });
    });

    socket.on('stop_typing', ({ ticketId, sender }) => {
      if (!ticketId) return;
      socket.to(String(ticketId)).emit('stop_typing', { ticketId, sender });
    });

    socket.on('send_message', async ({ ticketId, sender, text, imageUrl, agentName, companyId }) => {
      try {
        if (!ticketId || (sender !== 'user' && sender !== 'support')) {
          return socket.emit('message_error', { error: 'Invalid message', ticketId });
        }

        // Reject oversized image payloads early (defends memory + DB bloat).
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.length > config.maxSocketImageBytes) {
          return socket.emit('message_error', { error: 'Image too large', ticketId });
        }

        const { createChatHelper } = require('../controllers/chat.controller');
        // createChatHelper sanitises text/agentName before persisting.
        const savedChat = await createChatHelper(ticketId, sender, text, imageUrl, companyId || null, agentName || null);
        const payload = { ...savedChat.toObject(), agentName: savedChat.agentName || null };

        // Broadcast to the ticket room + company room (covers widget + dashboards).
        // Use socket.to(...).to(...) so:
        //  • the SENDER is excluded (it already showed the message optimistically) —
        //    otherwise they'd see their own message echoed back, and
        //  • a socket that's in BOTH rooms receives the event only ONCE (chained
        //    .to() targets the union, de-duplicated by Socket.IO).
        // Together this fixes messages appearing 2–3 times.
        const room = companyId ? String(companyId) : 'global';
        socket.to(String(ticketId)).to(room).emit('receive_message', payload);
      } catch (error) {
        logger.error('Error handling send_message', { err: error.message, ticketId });
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

  logger.info('Socket.IO initialised');
  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
