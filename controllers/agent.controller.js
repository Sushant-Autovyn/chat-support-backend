const Agent = require('../models/agent.model');

const seedDefaultAgents = async () => {
  const existing = await Agent.countDocuments();
  if (existing > 0) return;

  const defaultAgents = [
    { name: 'System Administrator', email: 'admin@autovyn.com', password: 'admin123', department: 'Management', role: 'admin', status: 'active', activeChats: 0 },
    { name: 'Agent Smith', email: 'agent@autovyn.com', password: 'agent123', department: 'Support', role: 'agent', status: 'active', activeChats: 0 },
    { name: 'Jane Doe', email: 'jane@autovyn.com', password: 'password', department: 'Billing', role: 'agent', status: 'active', activeChats: 0 },
    { name: 'John Miller', email: 'john@autovyn.com', password: 'password', department: 'Technical', role: 'agent', status: 'active', activeChats: 0 },
    { name: 'Sarah Connor', email: 'sarah@autovyn.com', password: 'password', department: 'Sales', role: 'agent', status: 'inactive', activeChats: 0 },
  ];

  try {
    await Agent.insertMany(defaultAgents);
  } catch (error) {
    console.error('Error seeding default agents:', error);
  }
};

const getAgents = async (req, res) => {
  try {
    const agents = await Agent.find().sort({ createdAt: -1 });
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Server error, failed to get agents' });
  }
};

const createAgent = async (req, res) => {
  try {
    const { name, email, password, department, role, status } = req.body;
    if (!name || !email || !password || !department || !role || !status) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await Agent.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'An agent with that email already exists' });

    const savedAgent = await new Agent({ name, email: email.toLowerCase(), password, department, role, status, activeChats: 0 }).save();
    res.status(201).json(savedAgent);
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ message: 'Server error, failed to create agent' });
  }
};

const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.password;

    const agent = await Agent.findById(id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    Object.assign(agent, updates);
    res.json(await agent.save());
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ message: 'Server error, failed to update agent' });
  }
};

const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    await agent.deleteOne();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ message: 'Server error, failed to delete agent' });
  }
};

const updateAgentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required' });

    const agent = await Agent.findById(id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    agent.password = password;
    await agent.save();
    res.status(200).json({ message: 'Password updated' });
  } catch (error) {
    console.error('Error resetting agent password:', error);
    res.status(500).json({ message: 'Server error, failed to reset password' });
  }
};

module.exports = { seedDefaultAgents, getAgents, createAgent, updateAgent, deleteAgent, updateAgentPassword };
