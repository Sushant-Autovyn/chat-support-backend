const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const JWT_SECRET = config.jwtSecret;

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Reject refresh tokens used as access tokens.
    if (decoded.type === 'refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }
    req.agentId = decoded.agentId;
    req.agentRole = decoded.role;
    req.companyId = decoded.companyId || null;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.agentRole !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

// Short-lived access token used for API calls.
const generateToken = (agentId, role, companyId = null) => {
  return jwt.sign(
    { agentId, role, companyId },
    JWT_SECRET,
    { expiresIn: config.accessTokenTtl }
  );
};

// Long-lived refresh token — exchanged at /api/auth/refresh for a new access token.
const generateRefreshToken = (agentId, role, companyId = null) => {
  return jwt.sign(
    { agentId, role, companyId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: config.refreshTokenTtl }
  );
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return decoded;
};

module.exports = { requireAuth, requireAdmin, generateToken, generateRefreshToken, verifyRefreshToken };
