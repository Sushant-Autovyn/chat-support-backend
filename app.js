require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./dbconnect/db');
const { initSocket } = require('./socket/socket');
const { seedDefaultAgents } = require('./controllers/agent.controller');

const app = express();
const server = http.createServer(app);

// ─── Security & performance middleware ───────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.use(compression());

// ─── CORS ────────────────────────────────────────────────────────────────────

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiting ───────────────────────────────────────────────────────────

// General API: 300 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' }
});

// Ticket creation: 10 new tickets per 5 minutes per IP (anti-spam)
const ticketCreateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: 'Too many tickets submitted. Please wait a few minutes.' }
});

// Login: 10 attempts per 15 minutes per IP (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' }
});

app.use('/api/', generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

const ticketRoutes = require('./routes/ticket.routes');
const chatRoutes = require('./routes/chat.routes');
const agentRoutes = require('./routes/agent.routes');
const authRoutes = require('./routes/auth.routes');

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tickets', ticketCreateLimiter, ticketRoutes);
app.use('/api/chats', chatRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// ─── DB + Socket + Start ─────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => seedDefaultAgents())
  .then(() => {
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

module.exports = { app, server };
