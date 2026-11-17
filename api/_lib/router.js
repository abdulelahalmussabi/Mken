'use strict';

const table = require('./route-table');

const handlerCache = Object.create(null);
const BODY_METHODS = { POST: 1, PUT: 1, PATCH: 1, DELETE: 1 };

function loadHandler(file) {
  if (!handlerCache[file]) handlerCache[file] = require('./handlers/' + file);
  const mod = handlerCache[file];
  if (typeof mod !== 'function') {
    throw new Error('Handler is not a function: ' + file);
  }
  return mod;
}

/**
 * Map an internal router URL back to the public path the client called.
 * The query string is kept byte-for-byte so webhook signature checks
 * (Twilio signs protocol + host + req.url) still see the public URL.
 */
function publicPathFrom(group, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api' || !table.GROUPS[group]) return '';

  // Rewrite targets are /api/<group>/<one-segment>. A direct hit uses that shape.
  if (parts[1] === group && parts.length === 3) {
    return '/api/' + parts[2].split('__').join('/');
  }

  // Vercel keeps the visitor's original path on req.url after a rewrite.
  if (parts[1] !== group) return pathname;

  // Older multi-segment destinations, if a builder ever forwards them.
  if (parts.length > 3) return '/api/' + parts.slice(2).join('/');
  return '';
}

function resolveRoute(group, rawUrl) {
  const split = table.splitUrl(rawUrl);
  const publicPath = publicPathFrom(group, split.pathname);
  if (!publicPath) return null;
  const route = table.matchMount(publicPath);
  if (!route || route.group !== group) return null;
  return {
    id: route.id,
    file: route.file,
    rawBody: !!route.rawBody,
    group: group,
    publicPath: publicPath,
    publicUrl: publicPath + split.search
  };
}

function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) return Promise.resolve();
  if (typeof req.on !== 'function') {
    req.body = {};
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const buf = Buffer.concat(chunks);
      req.rawBody = buf;
      const text = buf.toString('utf8');
      const ct = String((req.headers && req.headers['content-type']) || '');
      if (!text) {
        req.body = {};
      } else if (ct.indexOf('application/json') !== -1 || text.charAt(0) === '{' || text.charAt(0) === '[') {
        try { req.body = JSON.parse(text); } catch (err) { req.body = {}; }
      } else if (ct.indexOf('application/x-www-form-urlencoded') !== -1) {
        req.body = Object.fromEntries(new URLSearchParams(text));
      } else {
        req.body = {};
      }
      resolve();
    };
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', finish);
    req.on('error', finish);
    req.on('aborted', finish);
  });
}

function notFound(res) {
  if (typeof res.status === 'function') {
    return res.status(404).json({ error: 'not_found' });
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not_found' }));
}

async function dispatch(group, req, res) {
  const resolved = resolveRoute(group, req.url || '/');
  if (!resolved) return notFound(res);

  if (req.query) {
    delete req.query.mken;
    delete req.query['...mken'];
  }

  req.url = resolved.publicUrl;

  const manual = table.GROUPS[group] && table.GROUPS[group].manualBody;
  if (manual && !resolved.rawBody && BODY_METHODS[req.method]) {
    await readJsonBody(req);
  }

  const handler = loadHandler(resolved.file);
  return handler(req, res);
}

module.exports = {
  dispatch,
  resolveRoute,
  loadHandler
};
