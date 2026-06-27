// S3 image storage — zero-dependency implementation.
//
// Uploads chat images to S3 (or any S3-compatible store: R2, Spaces, MinIO)
// using a hand-rolled AWS Signature V4 signer over Node's built-in `crypto` +
// `https`. No external SDK is pulled in, so the backend stays small and boots
// instantly. Only the resulting public URL is persisted in MongoDB — never the
// raw bytes — which keeps every ticket/chat query fast.
//
// If S3 isn't configured (no bucket/keys in .env) the upload throws a tagged
// 503 so the frontends transparently fall back to inline base64.

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { config } = require('../config/env');
const logger = require('./logger');

// Accepted image types → file extension.
const ALLOWED_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const SERVICE = 's3';

// ─── SigV4 helpers ────────────────────────────────────────────────────────────
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();

function getSigningKey(secret, dateStamp, region) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

// RFC 3986 encoding for each path segment (S3 does not encode '/').
function encodeKey(key) {
  return key.split('/').map((seg) =>
    encodeURIComponent(seg).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  ).join('/');
}

// Resolve the request target (host, path, transport) for both AWS and
// S3-compatible custom endpoints.
function resolveTarget(key) {
  const encodedKey = encodeKey(key);
  if (config.s3.endpoint) {
    // Path-style for custom endpoints (R2/Spaces/MinIO): https://endpoint/bucket/key
    const u = new URL(config.s3.endpoint);
    return {
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      path: `/${config.s3.bucket}/${encodedKey}`,
    };
  }
  // Virtual-hosted style for AWS: https://bucket.s3.region.amazonaws.com/key
  const host = `${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com`;
  return { protocol: 'https:', host, hostname: host, port: '', path: `/${encodedKey}` };
}

// PUT a buffer to S3 with SigV4 signing.
function putObject(key, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const target = resolveTarget(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256hex(buffer);

    const headers = {
      host: target.host,
      'content-type': contentType,
      'content-length': String(buffer.length),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    // Optional canned ACL (only if the bucket allows ACLs).
    if (config.s3.acl) headers['x-amz-acl'] = config.s3.acl;

    // Canonical request.
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      'PUT', target.path, '', canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${config.s3.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest),
    ].join('\n');

    const signature = crypto
      .createHmac('sha256', getSigningKey(config.s3.secretAccessKey, dateStamp, config.s3.region))
      .update(stringToSign, 'utf8')
      .digest('hex');

    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${config.s3.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const transport = target.protocol === 'http:' ? http : https;
    const req = transport.request(
      { method: 'PUT', hostname: target.hostname, port: target.port || undefined, path: target.path, headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
          reject(new Error(`S3 responded ${res.statusCode}: ${body.slice(0, 300)}`));
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('S3 upload timed out')));
    req.write(buffer);
    req.end();
  });
}

// Build the public URL for a stored object key.
function buildPublicUrl(key) {
  const encodedKey = encodeKey(key);
  if (config.s3.publicBaseUrl) return `${config.s3.publicBaseUrl}/${encodedKey}`;
  if (config.s3.endpoint) {
    const base = config.s3.endpoint.replace(/\/+$/, '');
    return `${base}/${config.s3.bucket}/${encodedKey}`;
  }
  return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${encodedKey}`;
}

// Parse a data URL (data:image/png;base64,XXXX) into { mime, buffer }.
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

// Upload a base64 image data URL to S3. Returns the public URL.
async function uploadImageDataUrl(dataUrl, { keyPrefix = 'chat' } = {}) {
  if (!config.s3Enabled) {
    const e = new Error('S3 is not configured');
    e.status = 503; e.code = 'S3_NOT_CONFIGURED';
    throw e;
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) { const e = new Error('Invalid image data'); e.status = 400; throw e; }

  const ext = ALLOWED_TYPES[parsed.mime];
  if (!ext) { const e = new Error('Unsupported image type'); e.status = 415; throw e; }

  if (parsed.buffer.length > config.s3.maxUploadBytes) {
    const e = new Error('Image too large'); e.status = 413; throw e;
  }

  // Random, unguessable key sharded by date (easy lifecycle rules).
  // Honour an optional base folder prefix configured via S3_BUCKET=bucket/folder.
  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(16).toString('hex');
  const key = [config.s3.basePrefix, keyPrefix, day, `${rand}.${ext}`]
    .filter(Boolean)
    .join('/');

  await putObject(key, parsed.buffer, parsed.mime);
  const url = buildPublicUrl(key);
  logger.info('Image uploaded to S3', { key, bytes: parsed.buffer.length });
  return url;
}

module.exports = { uploadImageDataUrl, parseDataUrl, ALLOWED_TYPES };
