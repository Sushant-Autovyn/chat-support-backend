const Agent = require('../models/agent.model');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const agent = await Agent.findOne({ email: email.toLowerCase() });
    if (!agent) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (agent.status !== 'active') {
      return res.status(403).json({ message: 'This account has been disabled' });
    }

    if (agent.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({
      userId: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      token: `mock-jwt-token-${agent.id}-${Date.now()}`
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error, failed to log in' });
  }
};

module.exports = {
  login
};
