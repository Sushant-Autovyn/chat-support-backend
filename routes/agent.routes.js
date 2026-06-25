const express = require('express');
const router = express.Router();
const {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  updateAgentPassword
} = require('../controllers/agent.controller');

router.get('/', getAgents);
router.get('/:id', getAgentById);
router.post('/', createAgent);
router.put('/:id', updateAgent);
router.put('/:id/password', updateAgentPassword);
router.delete('/:id', deleteAgent);

module.exports = router;
