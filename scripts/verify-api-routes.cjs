'use strict';

/**
 * Proves every public URL the root project served still resolves inside mkn.
 * Colliding paths stay on the existing mkn route. The queue and the other
 * root handlers go through two Next.js route modules, not one function per URL.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const root = path.join(__dirname, '..');
const routes = require('../mkn-theme/src/server/platform/public-routes.cjs');
const table = require('../mkn-theme/src/server/platform/_lib/route-table');
const { dispatch, loadHandler } = require('../mkn-theme/src/server/platform/_lib/router');

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

function mockReq(url, method) {
  const req = new EventEmitter();
  const parsed = new URL(url, 'http://localhost');
  req.method = method || 'GET';
  req.url = url;
  req.query = Object.fromEntries(parsed.searchParams.entries());
  req.headers = { host: 'mken.live', 'x-forwarded-proto': 'https' };
  req.body = method === 'GET' ? undefined : {};
  return req;
}

function handlerFor(pathname) {
  const route = table.matchMount(pathname);
  assert.ok(route, 'no handler for ' + pathname);
  const handler = loadHandler(route.file);
  assert.strictEqual(typeof handler, 'function', route.file);
  return route;
}

async function main() {
  assert.ok(!fs.existsSync(path.join(root, 'api')), 'root api/ must be removed after the move');
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/src/server/platform/queue.js')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/src/app/api/v1/queue/[[...extra]]/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/src/app/api/platform/[[...path]]/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/public/queue-display.html')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/public/queue.html')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/public/admin.html')));

  const legacy = routes.publicApiEntries();
  assert.strictEqual(legacy.length, 58, 'expected 58 legacy public URLs, got ' + legacy.length);

  const all = legacy.concat(routes.queueEntries());
  const seen = new Set();
  console.log('Route map (old public URL → mkn):');
  const collisions = [];
  for (const entry of all) {
    const explained = routes.explainApi(entry.source);
    assert.notStrictEqual(explained.kind, 'missing', entry.source + ' does not resolve');
    if (explained.kind === 'platform' || explained.kind === 'queue') {
      const pathname = entry.source;
      if (explained.kind === 'queue') {
        assert.strictEqual(typeof require('../mkn-theme/src/server/platform/queue.js'), 'function');
      } else {
        handlerFor(pathname);
      }
    }
    if (explained.collision) collisions.push(explained);
    const query = entry.query ? '?' + Object.keys(entry.query).map(function (key) {
      return key + '=' + entry.query[key];
    }).join('&') : '';
    const line = entry.source + query + '  →  ' + explained.kind + '  ' + explained.destination;
    if (!seen.has(line)) {
      console.log('  ' + line);
      seen.add(line);
    }
  }

  const rewrites = routes.buildApiRewrites();
  const pageRewrites = routes.PAGE_REWRITES;
  assert.ok(rewrites.some(function (rule) {
    return rule.source === '/api/v1/trust/challenge' && rule.destination.indexOf('/api/platform/v1/trust/challenge') === 0;
  }));
  assert.ok(!rewrites.some(function (rule) { return rule.destination.indexOf('/api/platform/api/') !== -1; }));
  assert.ok(pageRewrites.some(function (rule) { return rule.source === '/display' && rule.destination === '/queue-display.html'; }));
  assert.ok(pageRewrites.some(function (rule) { return rule.source === '/queue/scan'; }));
  assert.ok(!rewrites.some(function (rule) { return rule.source === '/api/whatsapp-webhook'; }), 'colliding webhook must stay on mkn');
  assert.ok(!rewrites.some(function (rule) { return rule.source === '/api/moyasar-webhook'; }));
  assert.ok(!rewrites.some(function (rule) { return rule.source === '/api/license/activate'; }));
  assert.ok(!rewrites.some(function (rule) { return rule.source === '/api/cron-whatsapp'; }));

  const whatsapp = require('../mkn-theme/src/server/platform/_lib/handlers/whatsapp-webhook.js');
  assert.strictEqual(whatsapp.config.api.bodyParser, false, 'WhatsApp handler must keep the raw body');
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/src/app/api/whatsapp-webhook/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'mkn-theme/src/app/api/moyasar-webhook/route.ts')));
  const mknWhatsapp = fs.readFileSync(path.join(root, 'mkn-theme/src/lib/mken/whatsapp-inbound.ts'), 'utf8');
  assert.ok(mknWhatsapp.includes('request.text()'), 'mkn WhatsApp route must read the raw body');

  const bookReq = mockReq('/api/staff-availability?activity=desk', 'GET');
  const bookRes = mockRes();
  await dispatch('booking', bookReq, bookRes);
  assert.strictEqual(bookRes.statusCode, 400);
  assert.strictEqual(bookReq.url, '/api/staff-availability?activity=desk');

  const proxyReq = mockReq('/api/webhook-proxy', 'POST');
  proxyReq.headers['content-type'] = 'application/json';
  proxyReq.body = { method: 'POST' };
  const proxyRes = mockRes();
  await dispatch('crm', proxyReq, proxyRes);
  assert.strictEqual(proxyRes.statusCode, 400);

  const missing = mockRes();
  await dispatch('invoices', mockReq('/api/invoices/does-not-exist', 'GET'), missing);
  assert.strictEqual(missing.statusCode, 404);

  const handlers = routes.routeHandlerCount();
  console.log('\nCollisions kept on mkn (' + collisions.length + '):');
  collisions.forEach(function (item) {
    console.log('  ' + item.source + '  →  ' + item.kind + '  ' + item.destination);
  });
  console.log('\nNext.js route handlers in mkn-theme: ' + handlers);
  console.log('New serverless entrypoints for the moved API: 2 (app/api/v1/queue/[[...extra]] and app/api/platform/[[...path]])');
  console.log('Hobby cap that applied to the old root api/ directory: ' + routes.HOBBY_FUNCTION_CAP);
  console.log('All ' + legacy.length + ' legacy URLs and ' + routes.queueEntries().length + ' queue URLs resolve.');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
