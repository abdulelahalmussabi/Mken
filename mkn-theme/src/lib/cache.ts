/**
 * Lightweight in-memory cache and request deduplicator for client-side API fetches.
 * Prevents redundant HTTP requests during rapid route changes and across simultaneous components.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Fetches JSON from a URL with in-memory caching and in-flight request deduplication.
 * @param url The API endpoint to fetch.
 * @param ttlMs Time-to-live in milliseconds (default: 60,000ms = 1 min).
 * @param init Optional RequestInit options (only GET requests are cached).
 */
export async function fetchCachedJson<T = unknown>(
  url: string,
  ttlMs = 60000,
  init?: RequestInit
): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === "GET";

  // If not a GET request, bypass cache directly
  if (!isGet) {
    const res = await fetch(url, init);
    return res.json();
  }

  const now = Date.now();
  const cached = memoryCache.get(url);

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  // Check if a request for this URL is already in-flight
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = (await res.json()) as T;
      memoryCache.set(url, {
        data,
        expiry: Date.now() + ttlMs,
      });
      return data;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise as Promise<T>;
}

/**
 * Manually invalidate a specific URL or all cached URLs.
 */
export function invalidateCache(urlPattern?: string | RegExp) {
  if (!urlPattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (typeof urlPattern === "string" ? key.includes(urlPattern) : urlPattern.test(key)) {
      memoryCache.delete(key);
    }
  }
}
