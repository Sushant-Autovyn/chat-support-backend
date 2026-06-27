// Centralised environment validation.
// In production we crash early with a clear error if anything required is
// missing or left at an insecure default. In development we warn and fall
// back to safe local defaults so the app still boots.

const isProd = process.env.NODE_ENV === 'production';

const INSECURE_JWT_DEFAULT = 'autovyn-secret-key-change-in-production';

function validateEnv() {
  const problems = [];

  // ─── MONGO_URI ──────────────────────────────────────────────────────────
  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    if (isProd) {
      problems.push('MONGO_URI is required in production but is not set.');
    } else {
      console.warn('[env] MONGO_URI not set — using local fallback mongodb://127.0.0.1:27017/supportchat');
    }
  }

  // ─── JWT_SECRET ─────────────────────────────────────────────────────────
  const jwt = process.env.JWT_SECRET;
  if (!jwt || !jwt.trim()) {
    if (isProd) {
      problems.push('JWT_SECRET is required in production but is not set.');
    } else {
      console.warn('[env] JWT_SECRET not set — using an insecure development secret. DO NOT use in production.');
      process.env.JWT_SECRET = 'dev-only-insecure-secret';
    }
  } else if (jwt === INSECURE_JWT_DEFAULT) {
    if (isProd) {
      problems.push('JWT_SECRET is set to the well-known insecure default. Set a strong random secret.');
    } else {
      console.warn('[env] JWT_SECRET is the insecure default — fine for dev, never for production.');
    }
  } else if (isProd && jwt.length < 32) {
    problems.push('JWT_SECRET should be at least 32 characters for production.');
  }

  if (problems.length > 0) {
    console.error('\n========================================');
    console.error(' FATAL: Invalid environment configuration');
    console.error('========================================');
    problems.forEach((p) => console.error('  ✗ ' + p));
    console.error('\nServer will not start until these are fixed.\n');
    process.exit(1);
  }
}

const config = {
  isProd,
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/supportchat',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  // Access token lifetime — one full work shift (8h). The refresh-token flow
  // renews it transparently after that, so agents are never logged out mid-shift.
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '8h',
  // Refresh token lifetime — used by /api/auth/refresh to mint new access tokens.
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '30d',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['*'],
  // Max base64 image payload accepted over a socket message (~4MB encoded).
  maxSocketImageBytes: parseInt(process.env.MAX_SOCKET_IMAGE_BYTES, 10) || 4 * 1024 * 1024,

  // ─── S3 image storage ───────────────────────────────────────────────────
  // When configured, chat images are uploaded to S3 and only the URL is stored
  // in MongoDB (keeps the DB small + fast). If left unset, the app falls back to
  // inline base64 (dev-friendly) so nothing breaks before credentials are added.
  s3: {
    region: process.env.S3_REGION || 'us-east-1',
    // S3_BUCKET may be given as "bucket", "bucket/folder/prefix", or even a full
    // "s3://bucket/folder/" URI. We strip the scheme, then split: the first
    // segment is the real bucket name (used in the hostname) and the rest becomes
    // a key prefix so images land under that folder.
    bucket: (process.env.S3_BUCKET || '').replace(/^s3:\/\//i, '').split('/').filter(Boolean)[0] || '',
    basePrefix: (process.env.S3_BUCKET || '').replace(/^s3:\/\//i, '').split('/').filter(Boolean).slice(1).join('/'),
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    // Optional: custom endpoint for S3-compatible stores (R2, Spaces, MinIO).
    // Leave empty for standard AWS S3.
    endpoint: process.env.S3_ENDPOINT || '',
    // Optional: public base URL / CDN domain used to build the returned image URL.
    // e.g. https://cdn.autovyn.ai  or  https://my-bucket.s3.amazonaws.com
    // If empty, a sensible default URL is derived from bucket + region.
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    // Max decoded image size accepted by the upload endpoint (default 5MB).
    maxUploadBytes: parseInt(process.env.S3_MAX_UPLOAD_BYTES, 10) || 5 * 1024 * 1024,
    // Optional canned ACL, e.g. 'public-read'. Leave EMPTY if the bucket has
    // ACLs disabled (modern default "Bucket owner enforced") and uses a bucket
    // policy / CDN for public access — sending an ACL then would error.
    acl: process.env.S3_ACL || '',
  },

  // Optional Redis URL. When set, Socket.IO uses the Redis adapter so the app
  // can run as multiple horizontally-scaled instances behind a load balancer.
  // Unset = single-instance in-memory (fine for tens of thousands of daily users).
  redisUrl: process.env.REDIS_URL || '',
};

// Convenience flag — true only when all required S3 settings are present.
config.s3Enabled = Boolean(config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey);

module.exports = { validateEnv, config };
