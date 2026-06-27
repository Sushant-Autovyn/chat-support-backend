const express = require('express');
const router = express.Router();
const { login, refresh } = require('../controllers/auth.controller');
const { loginLimiter } = require('../middleware/rateLimiters');

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);

module.exports = router;
