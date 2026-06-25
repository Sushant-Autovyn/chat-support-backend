let io;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_ticket', ({ ticketId }) => {
      // Leave previous rooms (excluding the socket's own ID room)
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      socket.join(ticketId);
      console.log(`Socket ${socket.id} joined room ${ticketId}`);
    });

    socket.on('send_message', async ({ ticketId, sender, text, imageUrl }) => {
      try {
        const { createChatHelper } = require('../controllers/chat.controller');
        const savedChat = await createChatHelper(ticketId, sender, text, imageUrl);
        io.emit('receive_message', savedChat);
      } catch (error) {
        console.error('Error handling send_message socket event:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

module.exports = {
  initSocket,
  getIO
};
