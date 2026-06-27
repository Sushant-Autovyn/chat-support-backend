const express = require('express');
const router = express.Router();
const { getAgents, createAgent, updateAgent, deleteAgent, updateAgentPassword, updateAvailability } = require('../controllers/agent.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

router.get('/', requireAuth, getAgents);
router.post('/', requireAdmin, createAgent);

// Self-service: any authenticated agent sets their own availability.
// MUST be declared before '/:id' so it isn't captured as an id param.
router.put('/availability', requireAuth, updateAvailability);

router.put('/:id', requireAdmin, updateAgent);
router.put('/:id/password', requireAdmin, updateAgentPassword);
router.delete('/:id', requireAdmin, deleteAgent);

module.exports = router;
