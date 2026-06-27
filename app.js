require('dotenv').config();

// Validate environment BEFORE anything else touches it.
const { validateEnv, config } = require('./config/env');
validateEnv();

const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');

const logger = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimiters');
const connectDB = require('./dbconnect/db');
const { initSocket } = require('./socket/socket');
const { seedDefaultAgents } = require('./controllers/agent.controller');

const app = express();
const server = http.createServer(app);

// ─── Proxy trust (CRITICAL on Render/any load balancer) ───────────────────────
// Without this, express-rate-limit sees every request as coming from the proxy's
// single IP, so all users share one rate-limit bucket → "too many requests" with
// just a handful of people. Trust the first proxy hop so the real client IP from
// X-Forwarded-For is used for rate limiting.
app.set('trust proxy', 1);

// ─── Security & performance middleware ───────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.use(compression());

// ─── CORS ────────────────────────────────────────────────────────────────────

const allowAll = config.allowedOrigins.includes('*');
app.use(cors({
  origin: allowAll ? '*' : config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiting ───────────────────────────────────────────────────────────
// General read limiter is broad (1000/min/IP) so normal browsing + session
// restore polling never trips it. The tight write limiters (ticket creation,
// login) are applied POST-only INSIDE their routers so GET stays fast.
app.use('/api/', generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

const ticketRoutes = require('./routes/ticket.routes');
const chatRoutes = require('./routes/chat.routes');
const agentRoutes = require('./routes/agent.routes');
const authRoutes = require('./routes/auth.routes');
const uploadRoutes = require('./routes/upload.routes');

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/uploads', uploadRoutes);

// ─── Health check (with real DB ping) ─────────────────────────────────────────

app.get('/health', async (_req, res) => {
  const state = mongoose.connection.readyState; // 1 = connected
  if (state !== 1) {
    return res.status(503).json({ status: 'degraded', db: 'disconnected', uptime: process.uptime() });
  }
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', uptime: process.uptime() });
  }
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  logger.error('Unhandled request error', { err: err.message, stack: err.stack });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: config.isProd ? 'Internal server error' : err.message
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// ─── DB + Socket + Start ─────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down', { signal });

  // Stop accepting new connections, then close DB.
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      logger.info('Clean shutdown complete');
      process.exit(0);
    }).catch(() => process.exit(1));
  });

  // Force-exit if graceful close hangs.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

if (require.main === module) {
  connectDB()
    .then(() => seedDefaultAgents())
    .then(() => {
      initSocket(server);
      server.listen(config.port, () => {
        logger.info('Server running', { port: config.port, env: process.env.NODE_ENV || 'development' });
      });
    })
    .catch((err) => {
      logger.error('Startup failed', { err: err.message });
      process.exit(1);
    });
}

module.exports = { app, server };
