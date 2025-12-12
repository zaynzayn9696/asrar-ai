// server/src/utils/ttlCache.js
// Lightweight in-memory TTL cache for small objects.

const cache = new Map();

function getEntry(key) {
  const now = Date.now();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCachedValue(key, value, ttlMs) {
  const ttl = Math.max(0, Number(ttlMs) || 0);
  const expiresAt = Date.now() + ttl;
  cache.set(key, { value, expiresAt });
}

/**
 * Get a cached value or populate it using the provided async loader.
 * Returns { value, hit, durationMs }.
 */
async function getCachedValue(key, ttlMs, loader) {
  const entry = getEntry(key);
  if (entry) {
    return { value: entry.value, hit: true, durationMs: 0 };
  }

  const tStart = Date.now();
  const value = await loader();
  const durationMs = Date.now() - tStart;
  setCachedValue(key, value, ttlMs);

  return { value, hit: false, durationMs };
}

function clearCachedValue(key) {
  cache.delete(key);
}

module.exports = {
  getCachedValue,
  setCachedValue,
  clearCachedValue,
};
