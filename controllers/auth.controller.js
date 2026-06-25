const Agent = require('../models/agent.model');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth.middleware');

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

    const token = generateToken(agent._id.toString(), agent.role, agent.companyId?.toString() || null);

    return res.json({
      userId: agent._id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error, failed to log in' });
  }
};

module.exports = { login };
