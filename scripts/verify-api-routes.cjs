'use strict';

/**
 * Lists every public API URL before and after the Hobby function consolidation
 * and checks each old URL still reaches a handler. Does not call the network.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const root = path.join(__dirname, '..');
const table = require('../api/_lib/route-table');
const { dispatch, resolveRoute, loadHandler } = require('../api/_lib/router');

function listFunctions(dir, acc) {
  const out = acc || [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listFunctions(full, out);
    else if (/\.(js|mjs|cjs|ts)$/.test(ent.name)) out.push(path.relative(root, full));
  }
  return out;
}

function findRewrite(rewrites, source) {
  return rewrites.find((rule) => rule.source === source && !rule.has);
}

function destinationParts(destination) {
  const hash = destination.indexOf('#');
  const clean = hash === -1 ? destination : destination.slice(0, hash);
  const q = clean.indexOf('?');
  const pathname = q === -1 ? clean : clean.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : clean.slice(q + 1));
  const query = {};
  for (const [key, value] of params.entries()) query[key] = value;
  return { pathname, query };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    send(data) { this.body = data; return this; },
    end(data) { if (data !== undefined) this.body = data; return this; }
  };
}

function mockReq(url, method, extra) {
  const req = new EventEmitter();
  req.method = method || 'GET';
  req.url = url;
  req.query = Object.assign({}, extra && extra.query);
  req.headers = Object.assign({ host: 'mken.live', 'x-forwarded-proto': 'https' }, extra && extra.headers);
  req.body = extra && Object.prototype.hasOwnProperty.call(extra, 'body') ? extra.body : undefined;
  return req;
}

async function main() {
  const functions = listFunctions(path.join(root, 'api')).sort();
  console.log('Serverless functions after consolidation (' + functions.length + '):');
  functions.forEach((file) => console.log('  ' + file));
  assert.ok(functions.length <= 8, 'target is 6-8 functions, got ' + functions.length);
  assert.ok(functions.length < table.HOBBY_FUNCTION_CAP, 'Hobby cap is 12, got ' + functions.length);

  const expectedFns = [
    'api/auth/[...mken].js',
    'api/booking/[...mken].js',
    'api/crm/[...mken].js',
    'api/invoices/[...mken].js',
    'api/payments/[...mken].js',
    'api/tenant/[...mken].js',
    'api/v1/queue.js'
  ];
  assert.deepStrictEqual(functions, expectedFns);

  const legacyFiles = new Set(table.ROUTES.filter((route) => !route.alias).map((route) => route.file));
  const before = legacyFiles.size + 1;
  console.log('Serverless functions before consolidation: ' + before + ' (18 handlers + api/v1/queue.js)');
  assert.strictEqual(before, table.LEGACY_FUNCTION_COUNT);

  const removed = [
    'api/whatsapp-webhook.js',
    'api/moyasar-webhook.js',
    'api/cron-whatsapp.js',
    'api/v1/auth.js',
    'api/v1/checkout.js',
    'api/license.js',
    'api/google-business.js'
  ];
  for (const file of removed) {
    assert.ok(!fs.existsSync(path.join(root, file)), file + ' would still count as a function');
  }
  assert.ok(fs.existsSync(path.join(root, table.QUEUE_FUNCTION)));

  for (const file of legacyFiles) {
    const handler = loadHandler(file);
    assert.strictEqual(typeof handler, 'function', file);
  }
  const queue = require('../api/v1/queue.js');
  assert.strictEqual(typeof queue, 'function');

  const crmEntry = require('../api/crm/[...mken].js');
  assert.strictEqual(crmEntry.config.api.bodyParser, false, 'WhatsApp router must not parse the body');
  const whatsapp = require('../api/_lib/handlers/whatsapp-webhook.js');
  assert.strictEqual(whatsapp.config.api.bodyParser, false);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.strictEqual(vercel.outputDirectory, 'public');
  assert.strictEqual(vercel.crons[0].path, '/api/cron-whatsapp');

  const queueEvents = findRewrite(vercel.rewrites, '/api/v1/queue-events');
  assert.ok(queueEvents, 'queue-events rewrite missing');
  assert.strictEqual(queueEvents.destination, '/api/v1/queue?action=events');

  console.log('\nRoute map (public URL → function → handler):');
  const seen = new Set();

  function expectRoute(source, query) {
    const rule = findRewrite(vercel.rewrites, source);
    assert.ok(rule, 'missing rewrite for ' + source);
    const dest = destinationParts(rule.destination);
    const expectedPath = table.internalPath(source);
    assert.strictEqual(dest.pathname, expectedPath, source + ' destination path');
    const keys = query ? Object.keys(query) : [];
    for (const key of keys) {
      assert.strictEqual(dest.query[key], query[key], source + ' query ' + key);
    }
    const resolved = resolveRoute(dest.pathname.split('/')[2], dest.pathname + (rule.destination.includes('?') ? rule.destination.slice(rule.destination.indexOf('?')) : ''));
    assert.ok(resolved, 'resolver missed ' + source);
    assert.strictEqual(resolved.publicPath, source);
    const route = table.matchMount(source);
    assert.strictEqual(resolved.file, route.file);
    assert.strictEqual(resolved.id, route.id);
    if (route.rawBody) assert.strictEqual(resolved.rawBody, true);
    const line = source + '  →  ' + dest.pathname + '  →  ' + route.file;
    if (!seen.has(line)) {
      console.log('  ' + line + (keys.length ? '  ?' + keys.map((k) => k + '=' + query[k]).join('&') : ''));
      seen.add(line);
    }
  }

  for (const route of table.ROUTES) {
    if (route.alias) continue;
    expectRoute(route.mount, null);
  }
  for (const rewrite of table.QUERY_REWRITES) {
    expectRoute(rewrite.source, rewrite.query);
  }

  const apiSources = vercel.rewrites.filter((rule) => String(rule.source || '').startsWith('/api/'));
  console.log('\nAPI rewrites in vercel.json: ' + apiSources.length);
  for (const rule of apiSources) {
    if (rule.destination.startsWith('/api/v1/queue')) {
      assert.ok(rule.destination.startsWith(table.QUEUE_MOUNT), rule.source);
      continue;
    }
    const dest = destinationParts(rule.destination);
    const group = dest.pathname.split('/')[2];
    const resolved = resolveRoute(group, rule.destination);
    assert.ok(resolved, 'rewrite does not resolve: ' + rule.source + ' → ' + rule.destination);
    assert.strictEqual(resolved.publicPath, rule.source.split('?')[0]);
  }

  // Query params on the public URL are preserved alongside rewrite params.
  const login = findRewrite(vercel.rewrites, '/api/v1/auth/login-verify');
  const loginDest = new URL(login.destination, 'http://localhost');
  const merged = new URLSearchParams(loginDest.search);
  merged.set('tenant', 'rewa');
  const loginInternal = loginDest.pathname + '?' + merged.toString();
  const loginResolved = resolveRoute('auth', loginInternal);
  assert.strictEqual(loginResolved.publicUrl, '/api/v1/auth/login-verify?' + merged.toString());
  assert.ok(loginResolved.publicUrl.includes('type=login'));
  assert.ok(loginResolved.publicUrl.includes('step=verify'));
  assert.ok(loginResolved.publicUrl.includes('tenant=rewa'));

  // Webhook URL bytes: no extra query, path restored exactly.
  const hookReq = mockReq('/api/crm/whatsapp-webhook?hub.mode=subscribe&hub.challenge=99&tenant=rewa', 'GET', {
    query: { 'hub.mode': 'subscribe', 'hub.challenge': '99', tenant: 'rewa', mken: ['whatsapp-webhook'] }
  });
  const hookRes = mockRes();
  const hookPending = dispatch('crm', hookReq, hookRes);
  process.nextTick(() => hookReq.emit('end'));
  await hookPending;
  assert.strictEqual(hookReq.url, '/api/whatsapp-webhook?hub.mode=subscribe&hub.challenge=99&tenant=rewa');
  assert.strictEqual(hookReq.query.mken, undefined);
  assert.strictEqual(hookRes.statusCode, 403);
  assert.strictEqual(hookRes.body, 'Forbidden: Token mismatch');

  const liveReq = mockReq('/api/crm/whatsapp-webhook?tenant=default', 'GET', { query: { tenant: 'default' } });
  const liveRes = mockRes();
  const livePending = dispatch('crm', liveReq, liveRes);
  process.nextTick(() => liveReq.emit('end'));
  await livePending;
  assert.strictEqual(liveRes.statusCode, 200);
  assert.strictEqual(liveRes.body.service, 'mken-whatsapp-webhook');
  assert.strictEqual(liveReq.url, '/api/whatsapp-webhook?tenant=default');

  const proxyReq = mockReq('/api/crm/webhook-proxy', 'POST', {
    headers: { 'content-type': 'application/json', host: 'mken.live' }
  });
  const proxyRes = mockRes();
  const proxyPending = dispatch('crm', proxyReq, proxyRes);
  process.nextTick(() => {
    proxyReq.emit('data', Buffer.from('{"method":"POST"}'));
    proxyReq.emit('end');
  });
  await proxyPending;
  assert.strictEqual(proxyRes.statusCode, 400);
  assert.ok(String(proxyRes.body.error || '').toLowerCase().includes('url'));
  assert.strictEqual(proxyReq.url, '/api/webhook-proxy');

  const payReq = mockReq('/api/payments/moyasar-webhook', 'POST', { body: {} });
  const payRes = mockRes();
  await dispatch('payments', payReq, payRes);
  assert.strictEqual(payRes.statusCode, 400);
  assert.ok(String(payRes.body.error || '').includes('payment'));
  assert.strictEqual(payReq.url, '/api/moyasar-webhook');

  const bookReq = mockReq('/api/booking/staff-availability?activity=desk', 'GET', { query: { activity: 'desk' } });
  const bookRes = mockRes();
  await dispatch('booking', bookReq, bookRes);
  assert.strictEqual(bookRes.statusCode, 400);
  assert.strictEqual(bookReq.url, '/api/staff-availability?activity=desk');

  const missing = mockRes();
  await dispatch('invoices', mockReq('/api/invoices/does-not-exist', 'GET'), missing);
  assert.strictEqual(missing.statusCode, 404);

  const cross = mockRes();
  await dispatch('auth', mockReq('/api/auth/whatsapp-webhook', 'POST'), cross);
  assert.strictEqual(cross.statusCode, 404, 'a group must not dispatch another group\'s handler');

  console.log('\nAll ' + seen.size + ' public routes resolve to a handler. Function count ' + before + ' → ' + functions.length + '.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
