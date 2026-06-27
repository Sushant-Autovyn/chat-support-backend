// Tiny in-memory TTL cache.
//
// For hot, rarely-changing reads (e.g. the agents list) this avoids hitting
// MongoDB on every request. Entries auto-expire after `ttlMs`, and writes call
// `invalidate()` so the next read repopulates with fresh data — so the cache
// stays correct AND refreshes over time.
//
// Single-instance only (per-process). When you scale to multiple instances
// behind a load balancer, point this at Redis instead — but for tens of
// thousands of daily users on one box, in-memory is faster and simpler.

const store = new Map(); // key -> { value, expires }

const DEFAULT_TTL = 30 * 1000; // 30s

function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function set(key, value, ttlMs = DEFAULT_TTL) {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

// Delete one key, or every key starting with `prefix` if it ends with ':'.
function invalidate(keyOrPrefix) {
  if (typeof keyOrPrefix === 'string' && keyOrPrefix.endsWith(':')) {
    for (const k of store.keys()) {
      if (k.startsWith(keyOrPrefix)) store.delete(k);
    }
    return;
  }
  store.delete(keyOrPrefix);
}

function clear() {
  store.clear();
}

// Read-through helper: return cached value or run loader() and cache it.
async function wrap(key, ttlMs, loader) {
  const cached = get(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  set(key, value, ttlMs);
  return value;
}

// Periodically sweep expired entries so the Map can't grow unbounded if keys
// are never read again. Unref so it never holds the process open.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.expires) store.delete(k);
  }
}, 60 * 1000).unref();

module.exports = { get, set, invalidate, clear, wrap, DEFAULT_TTL };
