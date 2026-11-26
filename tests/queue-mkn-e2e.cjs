'use strict';

/**
 * Queue flow against the mkn Next dev server:
 * join → display → staff login → call → transfer → complete,
 * plus rejected staff calls and a public PII check.
 * Supabase and QUEUE_DATABASE_URL are stripped so this stays on the in-memory engine.
 */

const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const themeRoot = path.join(__dirname, '..', 'mkn-theme');
const PORT = 3217;
const BASE = 'http://127.0.0.1:' + PORT;
const HOST = 'demo.mken.live';
const PHONE = '0550001122';
const NAME = 'عميل تجربة الطابور';
const E2E_SESSION_SECRET = 'e2e-session-' + crypto.randomBytes(16).toString('hex');
const E2E_DEMO_PASSWORD = 'E2e!' + crypto.randomBytes(12).toString('hex');

function childEnv() {
  const env = Object.assign({}, process.env, {
    NODE_ENV: 'development',
    PORT: String(PORT),
    ADMIN_PIN: 'e2e-pin',
    ADMIN_SESSION_SECRET: E2E_SESSION_SECRET,
    ADMIN_SEED_PASSWORDS: JSON.stringify({ demo: E2E_DEMO_PASSWORD })
  });
  Object.keys(env).forEach(function (key) {
    if (
      key === 'QUEUE_DATABASE_URL' ||
      key.indexOf('SUPABASE_') === 0 ||
      key.indexOf('NEXT_PUBLIC_SUPABASE') === 0
    ) {
      delete env[key];
    }
  });
  return env;
}

function startServer() {
  const nextBin = path.join(themeRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'dev', '--port', String(PORT)], {
    cwd: themeRoot,
    env: childEnv(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', function (chunk) { log += chunk; });
  child.stderr.on('data', function (chunk) { log += chunk; });
  return { child: child, log: function () { return log; } };
}

async function waitForServer(handle) {
  const deadline = Date.now() + 90000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (handle.child.exitCode !== null) {
      throw new Error('next dev exited early\n' + handle.log());
    }
    try {
      const response = await fetch(BASE + '/api/v1/queue?action=list-queues', {
        headers: { 'x-forwarded-host': HOST, origin: 'https://' + HOST }
      });
      if (response.status === 200) return;
      lastError = new Error('status ' + response.status);
    } catch (err) {
      lastError = err;
    }
    await new Promise(function (resolve) { setTimeout(resolve, 500); });
  }
  throw new Error('mkn dev server did not become ready: ' + (lastError && lastError.message) + '\n' + handle.log());
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  const match = raw.match(/mkn_admin_session=([^;]+)/);
  assert.ok(match, 'staff login did not set mkn_admin_session: ' + raw);
  return 'mkn_admin_session=' + match[1];
}

async function api(pathname, options) {
  const headers = Object.assign({
    'x-forwarded-host': HOST,
    origin: 'https://' + HOST,
    'x-forwarded-for': '203.0.113.50'
  }, options && options.headers);
  const response = await fetch(BASE + pathname, {
    method: (options && options.method) || 'GET',
    headers: headers,
    body: options && options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual'
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (err) { body = text; }
  return { status: response.status, body: body, text: text, headers: response.headers };
}

async function main() {
  const handle = startServer();
  try {
    await waitForServer(handle);

    const display = await fetch(BASE + '/display', { headers: { 'x-forwarded-host': HOST } });
    const displayHtml = await display.text();
    assert.strictEqual(display.status, 200, displayHtml.slice(0, 200));
    assert.ok(displayHtml.includes('queue') || displayHtml.includes('طابور') || displayHtml.includes('الدور'), 'display page');

    const scan = await fetch(BASE + '/queue/scan', { headers: { 'x-forwarded-host': HOST } });
    const scanHtml = await scan.text();
    assert.strictEqual(scan.status, 200);
    assert.ok(scanHtml.includes('queue') || scanHtml.includes('طابور') || scanHtml.includes('الدور'));

    const admin = await fetch(BASE + '/admin.html?tab=queue', { redirect: 'manual' });
    assert.ok(admin.status === 200, 'admin queue screen status ' + admin.status);
    const adminHtml = await admin.text();
    assert.ok(!adminHtml.includes('يتم التحويل إلى لوحة التحكم'), 'queue admin must not redirect away');

    const badLogin = await api('/api/v1/auth/admin-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { pin: 'not-the-pin' }
    });
    assert.strictEqual(badLogin.status, 401, JSON.stringify(badLogin.body));

    const legacyEmailLogin = await api('/api/v1/auth/admin-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { email: 'demo@mken.live', password: E2E_DEMO_PASSWORD }
    });
    assert.strictEqual(legacyEmailLogin.status, 410, JSON.stringify(legacyEmailLogin.body));

    const login = await fetch(BASE + '/api/admin/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-host': HOST,
        origin: 'https://' + HOST
      },
      body: JSON.stringify({ email: 'demo@mken.live', password: E2E_DEMO_PASSWORD })
    });
    const loginBody = await login.json();
    assert.strictEqual(login.status, 200, JSON.stringify(loginBody));
    assert.strictEqual(loginBody.clientSlug, 'demo');
    const cookie = cookieFrom(login);

    const denied = await api('/api/v1/queue?action=call-next', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { counterId: 'cnt-1-demo' }
    });
    assert.strictEqual(denied.status, 401, JSON.stringify(denied.body));
    assert.strictEqual(denied.body.code, 'AUTH_REQUIRED');

    const joined = await api('/api/v1/queue?action=join-queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { queueId: 'q-cs-demo', customerName: NAME, customerPhone: PHONE }
    });
    assert.strictEqual(joined.status, 200, JSON.stringify(joined.body));
    assert.ok(joined.body.tickets && joined.body.tickets.length === 1, JSON.stringify(joined.body));
    const ticket = joined.body.tickets[0];

    const board = await api('/api/v1/queue?action=list-queues');
    assert.strictEqual(board.status, 200, JSON.stringify(board.body));
    const published = JSON.stringify(board.body);
    assert.ok(!published.includes(PHONE), 'public board leaked a phone number');
    assert.ok(!published.includes(NAME), 'public board leaked a customer name');

    const called = await api('/api/v1/queue?action=call-next', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie },
      body: { counterId: 'cnt-1-demo' }
    });
    assert.strictEqual(called.status, 200, JSON.stringify(called.body));
    assert.ok(called.body.ticket, JSON.stringify(called.body));
    assert.strictEqual(called.body.ticket.id, ticket.id);

    const transferred = await api('/api/v1/queue?action=transfer-ticket', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie },
      body: {
        ticketId: ticket.id,
        toQueueId: 'q-contracts-demo',
        counterId: 'cnt-1-demo',
        priorityLevel: 'fair_fifo'
      }
    });
    assert.strictEqual(transferred.status, 200, JSON.stringify(transferred.body));

    const calledAgain = await api('/api/v1/queue?action=call-next', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie },
      body: { counterId: 'cnt-2-demo' }
    });
    assert.strictEqual(calledAgain.status, 200, JSON.stringify(calledAgain.body));
    assert.ok(calledAgain.body.ticket, JSON.stringify(calledAgain.body));

    const completed = await api('/api/v1/queue?action=complete-service', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie },
      body: { counterId: 'cnt-2-demo' }
    });
    assert.strictEqual(completed.status, 200, JSON.stringify(completed.body));

    const events = await fetch(BASE + '/api/v1/queue-events', {
      headers: { 'x-forwarded-host': HOST, origin: 'https://' + HOST }
    });
    assert.strictEqual(events.status, 200, 'queue SSE status');
    assert.ok(String(events.headers.get('content-type') || '').includes('text/event-stream'));
    const reader = events.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    const chunk = Buffer.from(first.value || []).toString('utf8');
    assert.ok(chunk.includes('connected'), chunk);

    console.log('mkn queue e2e passed: join, display, staff login, call, transfer, complete, auth, PII, SSE');
  } finally {
    handle.child.kill('SIGTERM');
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
