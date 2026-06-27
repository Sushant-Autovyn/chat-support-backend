#!/usr/bin/env node
// Smoke-test a running backend. Run after every deploy to confirm the server,
// database, and key endpoints are actually working — instead of finding out
// from users.
//
//   node scripts/healthcheck.js                 # checks http://localhost:3000
//   node scripts/healthcheck.js https://api.example.com
//
// Exits 0 if all critical checks pass, 1 otherwise (good for CI / cron).

const http = require('http');
const https = require('https');

const base = (process.argv[2] || process.env.HEALTHCHECK_URL || 'http://localhost:3000').replace(/\/+$/, '');

function request(path) {
  return new Promise((resolve) => {
    const url = base + path;
    const lib = url.startsWith('https:') ? https : http;
    const started = Date.now();
    const req = lib.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, ms: Date.now() - started, body }));
    });
    req.on('error', (err) => resolve({ status: 0, ms: Date.now() - started, error: err.message }));
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
  });
}

// [name, path, predicate(result) -> ok, critical]
const checks = [
  ['Health + DB ping', '/health', (r) => r.status === 200 && /"db":"connected"/.test(r.body), true],
  ['Tickets endpoint reachable', '/api/tickets', (r) => r.status === 200 || r.status === 401, true],
  ['Auth route mounted', '/api/auth/login', (r) => r.status !== 0, true],
  ['Upload status', '/api/uploads/status', (r) => r.status === 200, false],
  ['404 handler', '/api/__nope__', (r) => r.status === 404, false],
];

(async () => {
  console.log(`\nHealth-checking ${base}\n${'─'.repeat(48)}`);
  let failedCritical = 0;

  for (const [name, path, predicate, critical] of checks) {
    const r = await request(path);
    const ok = (() => { try { return predicate(r); } catch { return false; } })();
    const tag = ok ? 'PASS' : (critical ? 'FAIL' : 'WARN');
    const extra = r.error ? ` (${r.error})` : ` [${r.status}, ${r.ms}ms]`;
    console.log(`  ${tag.padEnd(4)}  ${name}${extra}`);
    if (!ok && critical) failedCritical++;
  }

  // Report S3 image storage status (informational).
  const up = await request('/api/uploads/status');
  if (up.status === 200) {
    try {
      const enabled = JSON.parse(up.body).enabled;
      console.log(`\n  Image storage (S3): ${enabled ? 'ENABLED ✓' : 'not configured (base64 fallback)'}`);
    } catch { /* ignore */ }
  }

  console.log('─'.repeat(48));
  if (failedCritical > 0) {
    console.error(`✗ ${failedCritical} critical check(s) failed\n`);
    process.exit(1);
  }
  console.log('✓ All critical checks passed\n');
})();
