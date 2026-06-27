const express = require('express');
const router = express.Router();
const { uploadImage, uploadStatus } = require('../controllers/upload.controller');
const { uploadLimiter } = require('../middleware/rateLimiters');

// GET /api/uploads/status — is S3 configured? (frontends decide upload vs fallback)
router.get('/status', uploadStatus);

// POST /api/uploads/image — base64 data URL in, S3 public URL out.
router.post('/image', uploadLimiter, uploadImage);

module.exports = router;
