// Shared rate limiters so they can be applied per-route (POST-only) instead of
// across whole routers. All are PER-IP and rely on `app.set('trust proxy', 1)`
// being configured in app.js so the real client IP is used behind Render.

const rateLimit = require('express-rate-limit');

const sharedOpts = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health',
};

// General API: 1000 requests / minute / IP.
const generalLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 60 * 1000,
  max: 1000,
  message: { message: 'Too many requests, please slow down.' },
});

// Ticket CREATION only: 15 new tickets / 5 min / IP.
const ticketCreateLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: { message: 'Too many tickets submitted. Please wait a few minutes.' },
});

// Login: 10 attempts / 15 min / IP.
const loginLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Image uploads: 40 / 5 min / IP. Generous for a real conversation, tight
// enough to stop an anonymous widget user from hammering S3.
const uploadLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 5 * 60 * 1000,
  max: 40,
  message: { message: 'Too many uploads. Please wait a few minutes.' },
});

module.exports = { generalLimiter, ticketCreateLimiter, loginLimiter, uploadLimiter };
