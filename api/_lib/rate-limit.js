'use strict';

const rateBuckets = new Map();

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Checks if a key has exceeded the request limit in the specified time window.
 * @param {string} key Unique key (e.g., ip + action)
 * @param {number} [limit=5] Maximum allowed requests
 * @param {number} [windowMs=60000] Time window in milliseconds
 * @param {boolean} [increment=true] Whether to increment the request count
 * @returns {{limited: boolean, retryAfterSec: number}}
 */
function isRateLimited(key, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS, increment = true) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (!increment) return { limited: false, retryAfterSec: 0 };
    bucket = { windowStart: now, count: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
    return { limited: true, retryAfterSec: retryAfterSec > 0 ? retryAfterSec : 1 };
  }

  if (increment) {
    bucket.count += 1;
    rateBuckets.set(key, bucket);
  }
  return { limited: false, retryAfterSec: 0 };
}

module.exports = {
  isRateLimited: isRateLimited
};
