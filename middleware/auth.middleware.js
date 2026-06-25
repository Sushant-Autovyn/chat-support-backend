const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'autovyn-secret-key-change-in-production';

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.agentId = decoded.agentId;
    req.agentRole = decoded.role;
    req.companyId = decoded.companyId || null;
    next();
  } catch (err) {
    // Support legacy mock tokens for backward compatibility during migration
    if (token && token.startsWith('mock-jwt-token-')) {
      const parts = token.split('-');
      req.agentId = parts[3] || null;
      req.agentRole = 'agent';
      req.companyId = null;
      return next();
    }
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

const generateToken = (agentId, role, companyId = null) => {
  return jwt.sign(
    { agentId, role, companyId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = { requireAuth, requireAdmin, generateToken };
