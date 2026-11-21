'use strict';

/**
 * Public URLs the root Vercel project served, pointed at one Next.js catch-all
 * (plus the queue route) so Hobby does not get a function per URL.
 * Paths that already have an mkn route are left alone.
 */

const fs = require('fs');
const path = require('path');
const table = require('./_lib/route-table');

const themeRoot = path.join(__dirname, '..', '..', '..');
const appDir = path.join(themeRoot, 'src', 'app');

const QUEUE_ALIASES = [
  { source: '/api/v1/queue-events', destination: '/api/v1/queue/events', query: { action: 'events' } },
  { source: '/api/queue/tickets', destination: '/api/v1/queue/tickets', query: { action: 'list-tickets' } },
  { source: '/api/queue/intake/status', destination: '/api/v1/queue/intake/status', query: { action: 'intake-status' } }
];

const PAGE_REWRITES = [
  { source: '/display', destination: '/queue-display.html' },
  { source: '/display/', destination: '/queue-display.html' },
  { source: '/queue', destination: '/queue.html' },
  { source: '/queue/', destination: '/queue.html' },
  { source: '/queue/scan', destination: '/queue.html' },
  { source: '/queue/scan/', destination: '/queue.html' },
  { source: '/queue-display', destination: '/queue-display.html' },
  { source: '/queue-display/', destination: '/queue-display.html' },
  { source: '/kitchen-display', destination: '/kitchen-display.html' },
  { source: '/kitchen-display/', destination: '/kitchen-display.html' },
  { source: '/admin-tables', destination: '/admin-tables.html' },
  { source: '/admin-tables/', destination: '/admin-tables.html' },
  { source: '/ticket-print', destination: '/ticket-print.html' },
  { source: '/ticket-print/', destination: '/ticket-print.html' },
  { source: '/invoice-print', destination: '/invoice-print.html' },
  { source: '/invoice-print/', destination: '/invoice-print.html' },
  { source: '/track', destination: '/track.html' },
  { source: '/track/', destination: '/track.html' }
];

const OWN_API = ['/api/platform', '/api/v1/queue'];

function isCatchAll(segment) {
  return segment.startsWith('[[...') || segment.startsWith('[...');
}

function collectPatterns(dir, parts, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('(') && ent.name.endsWith(')')) {
      collectPatterns(path.join(dir, ent.name), parts, out);
      continue;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectPatterns(full, parts.concat(ent.name), out);
    else if (ent.name === 'route.ts' || ent.name === 'route.js') out.push(parts.slice());
  }
}

const apiPatterns = [];
collectPatterns(path.join(appDir, 'api'), ['api'], apiPatterns);

function isOwnApi(pathname) {
  return OWN_API.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix + '/');
  });
}

function matchPattern(pattern, urlParts) {
  let i = 0;
  let j = 0;
  while (i < pattern.length) {
    const segment = pattern[i];
    const optional = segment.startsWith('[[...') && segment.endsWith(']]');
    const rest = !optional && segment.startsWith('[...') && segment.endsWith(']');
    const dynamic = !optional && !rest && segment.startsWith('[') && segment.endsWith(']');
    if (optional) return i === pattern.length - 1;
    if (rest) return i === pattern.length - 1 && j < urlParts.length;
    if (j >= urlParts.length) return false;
    if (dynamic || segment === urlParts[j]) {
      i += 1;
      j += 1;
      continue;
    }
    return false;
  }
  return j === urlParts.length;
}

function matchesExistingApi(pathname) {
  const clean = String(pathname || '').split('?')[0];
  const normalized = clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
  if (!normalized.startsWith('/api/') && normalized !== '/api') return false;
  if (isOwnApi(normalized)) return false;
  const parts = normalized.split('/').filter(Boolean);
  return apiPatterns.some(function (pattern) { return matchPattern(pattern, parts); });
}

function coveredByExistingCatchAll(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  return apiPatterns.some(function (pattern) {
    if (!pattern.length || !isCatchAll(pattern[pattern.length - 1])) return false;
    const head = pattern.slice(0, -1);
    if (head.length !== parts.length) return false;
    return head.every(function (segment, index) { return segment === parts[index]; });
  });
}

function vercelRewriteMap() {
  const file = path.join(themeRoot, 'vercel.json');
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  (json.rewrites || []).forEach(function (rule) {
    if (rule && rule.source && !rule.has) map.set(rule.source, rule.destination);
  });
  return map;
}

function platformPath(source) {
  return '/api/platform' + String(source || '').replace(/^\/api/, '');
}

function withQuery(pathname, query) {
  const params = new URLSearchParams();
  if (query) {
    Object.keys(query).forEach(function (key) { params.set(key, query[key]); });
  }
  const qs = params.toString();
  return qs ? pathname + '?' + qs : pathname;
}

function publicApiEntries() {
  const entries = [];
  table.ROUTES.forEach(function (route) {
    if (route.alias) return;
    entries.push({ source: route.mount, query: null });
  });
  table.QUERY_REWRITES.forEach(function (rewrite) {
    entries.push({ source: rewrite.source, query: rewrite.query });
  });
  return entries;
}

function queueEntries() {
  return [{ source: '/api/v1/queue', query: null }].concat(QUEUE_ALIASES.map(function (rule) {
    return { source: rule.source, query: rule.query || null };
  }));
}

function buildApiRewrites() {
  const taken = vercelRewriteMap();
  const exact = [];
  const prefixes = [];
  const seen = new Set();

  function push(list, source, destination) {
    if (seen.has(source)) return;
    seen.add(source);
    list.push({ source: source, destination: destination });
  }

  publicApiEntries().forEach(function (entry) {
    if (taken.has(entry.source) || matchesExistingApi(entry.source)) return;
    push(exact, entry.source, withQuery(platformPath(entry.source), entry.query));
  });

  table.ROUTES.forEach(function (route) {
    if (route.alias) return;
    if (taken.has(route.mount) || coveredByExistingCatchAll(route.mount)) return;
    push(prefixes, route.mount + '/:path*', platformPath(route.mount) + '/:path*');
  });

  QUEUE_ALIASES.forEach(function (rule) {
    if (taken.has(rule.source) || matchesExistingApi(rule.source)) return;
    push(exact, rule.source, rule.destination);
  });

  return exact.concat(prefixes);
}

function explainApi(pathname) {
  const clean = String(pathname || '').split('?')[0];
  const normalized = clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
  if (normalized === '/api/v1/queue' || normalized.startsWith('/api/v1/queue/')) {
    return { source: normalized, kind: 'queue', destination: normalized, collision: false };
  }
  const alias = QUEUE_ALIASES.find(function (rule) { return rule.source === normalized; });
  if (alias && !matchesExistingApi(normalized)) {
    return { source: normalized, kind: 'queue', destination: alias.destination, collision: false };
  }
  const vercel = vercelRewriteMap().get(normalized);
  if (vercel) {
    return { source: normalized, kind: 'mkn-rewrite', destination: vercel, collision: true };
  }
  if (matchesExistingApi(normalized)) {
    return { source: normalized, kind: 'mkn-route', destination: normalized, collision: true };
  }
  const rule = buildApiRewrites().find(function (item) { return item.source === normalized; });
  if (rule) {
    return { source: normalized, kind: 'platform', destination: rule.destination, collision: false };
  }
  return { source: normalized, kind: 'missing', destination: '', collision: false };
}

function routeHandlerCount() {
  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'route.ts' || ent.name === 'route.js') count += 1;
    }
  }
  walk(appDir);
  return count;
}

module.exports = {
  PAGE_REWRITES,
  QUEUE_ALIASES,
  publicApiEntries,
  queueEntries,
  buildApiRewrites,
  explainApi,
  matchesExistingApi,
  routeHandlerCount,
  HOBBY_FUNCTION_CAP: table.HOBBY_FUNCTION_CAP
};
