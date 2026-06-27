// Image upload endpoint.
//
// Frontends (chatbot widget + agent dashboard) POST a base64 image data URL
// here. We push it to S3 and return only the public URL, which then travels
// through the socket / DB instead of multi-megabyte base64 blobs.
//
// Public endpoint (the anonymous chat widget needs it) but rate-limited,
// size-capped, and type-validated.

const logger = require('../utils/logger');
const { uploadImageDataUrl } = require('../utils/s3');
const { config } = require('../config/env');

const uploadImage = async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl || req.body?.image;
    if (!dataUrl) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const url = await uploadImageDataUrl(dataUrl, { keyPrefix: 'chat' });
    return res.status(201).json({ url });
  } catch (err) {
    // S3 not configured yet → tell the client clearly so it can fall back to
    // inline base64 during the transition period.
    if (err.code === 'S3_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Image storage not configured', code: 'S3_NOT_CONFIGURED' });
    }
    const status = err.status || 500;
    if (status >= 500) {
      logger.error('Image upload failed', { err: err.message });
      return res.status(500).json({ message: 'Failed to upload image' });
    }
    return res.status(status).json({ message: err.message });
  }
};

// Lets the frontend know whether to use the upload endpoint or base64 fallback.
const uploadStatus = (_req, res) => {
  res.json({ enabled: config.s3Enabled, maxBytes: config.s3.maxUploadBytes });
};

module.exports = { uploadImage, uploadStatus };
