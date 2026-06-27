const Agent = require('../models/agent.model');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth.middleware');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const agent = await Agent.findOne({ email: email.toLowerCase() }).select('+password');
    if (!agent) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (agent.status !== 'active') {
      return res.status(403).json({ message: 'This account has been disabled' });
    }

    // Support both bcrypt hashed and legacy plaintext passwords
    let passwordValid = false;
    if (agent.password.startsWith('$2')) {
      // bcrypt hash
      passwordValid = await bcrypt.compare(password, agent.password);
    } else {
      // Legacy plaintext — compare directly, then upgrade to bcrypt
      passwordValid = agent.password === password;
      if (passwordValid) {
        agent.password = await bcrypt.hash(password, 10);
        await agent.save();
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const companyId = agent.companyId?.toString() || null;
    const token = generateToken(agent._id.toString(), agent.role, companyId);
    const refreshToken = generateRefreshToken(agent._id.toString(), agent.role, companyId);

    return res.json({
      userId: agent._id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login failed', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to log in' });
  }
};

// Exchange a valid refresh token for a fresh access token (+ rotated refresh token)
// so agents are never logged out mid-shift.
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Confirm the agent still exists and is active before issuing new tokens.
    const agent = await Agent.findById(decoded.agentId);
    if (!agent || agent.status !== 'active') {
      return res.status(401).json({ message: 'Account is no longer active' });
    }

    const companyId = agent.companyId?.toString() || null;
    const token = generateToken(agent._id.toString(), agent.role, companyId);
    const newRefreshToken = generateRefreshToken(agent._id.toString(), agent.role, companyId);

    return res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('Token refresh failed', { err: error.message });
    res.status(500).json({ message: 'Server error, failed to refresh token' });
  }
};

module.exports = { login, refresh };
