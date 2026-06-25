let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
  });

  io.on('connection', (socket) => {
    socket.on('join_ticket', ({ ticketId }) => {
      socket.rooms.forEach((room) => {
        if (room !== socket.id) socket.leave(room);
      });
      socket.join(ticketId);
    });

    socket.on('send_message', async ({ ticketId, sender, text, imageUrl, agentName }) => {
      try {
        const { createChatHelper } = require('../controllers/chat.controller');
        const savedChat = await createChatHelper(ticketId, sender, text, imageUrl);
        io.emit('receive_message', { ...savedChat.toObject(), agentName: agentName || null });
      } catch (error) {
        console.error('Error handling send_message socket event:', error);
      }
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
