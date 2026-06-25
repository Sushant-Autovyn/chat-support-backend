const express = require('express');
const router = express.Router();
const { getAgents, createAgent, updateAgent, deleteAgent, updateAgentPassword } = require('../controllers/agent.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

router.get('/', requireAuth, getAgents);
router.post('/', requireAdmin, createAgent);
router.put('/:id', requireAdmin, updateAgent);
router.put('/:id/password', requireAdmin, updateAgentPassword);
router.delete('/:id', requireAdmin, deleteAgent);

module.exports = router;
