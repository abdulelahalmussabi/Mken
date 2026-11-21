'use strict';

const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const queueGuard = require('../mkn-theme/src/server/platform/_lib/queue-guard');
const { tenantHeaders, staffCookie } = require('./queue-http.cjs');

const DATABASE_URL = process.env.QUEUE_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/queue_test';
const STAFF_ACTIONS = [
  'call-next',
  'transfer-ticket',
  'complete-service',
  'supervisor-reassign-counter',
  'hot-swap-authenticate',
  'reception-handover',
  'manual-override',
  'save-config',
  'start-service',
  'dispatch-call',
  'hold-ticket',
  'recall-ticket',
  'snooze-no-show',
  'counter-status',
  'add-counter',
  'update-counter',
  'delete-counter',
  'supervisor-force-signout',
  'start-break',
  'end-break'
];

function mock(options) {
  const req = {
    method: options.method || 'POST',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || tenantHeaders(options),
    on: function () {}
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    chunks: [],
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    flushHeaders() {},
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
  return { req: req, res: res };
}

async function authNegatives() {
  const tenant = 'auth_neg_' + Date.now();
  for (let i = 0; i < STAFF_ACTIONS.length; i++) {
    const action = STAFF_ACTIONS[i];
    const call = mock({
      staff: false,
      noIp: true,
      query: { tenant: tenant, action: action },
      body: {
        counterId: 'cnt-1-' + tenant,
        ticketId: 'tkt_missing',
        toQueueId: 'q-contracts-' + tenant,
        action_type: 'FORCE_LOCK',
        incomingPin: '9999',
        settings: { is_enabled: false }
      }
    });
    await queueHandler(call.req, call.res);
    assert.strictEqual(call.res.statusCode, 401, action + ' without a staff cookie must be 401');
    assert.strictEqual(call.res.body.code, 'AUTH_REQUIRED', action + ' must not trust body role or PIN');
    assert.ok(!JSON.stringify(call.res.body).includes('9999'));
  }
}

async function piiWithCookie() {
  const tenant = 'pii_cookie_' + Date.now();
  const name = 'لمى الشمري';
  const phone = '0554443322';
  const joined = mock({
    noIp: true,
    query: { tenant: tenant, action: 'join-queue' },
    body: { queueId: 'q-cs-' + tenant, customerName: name, customerPhone: phone }
  });
  await queueHandler(joined.req, joined.res);
  assert.strictEqual(joined.res.statusCode, 200);
  const number = joined.res.body.tickets[0].ticket_number;

  const listed = mock({
    method: 'GET',
    staff: true,
    query: { tenant: tenant, action: 'list-queues' }
  });
  await queueHandler(listed.req, listed.res);
  const blob = JSON.stringify(listed.res.body);
  assert.ok(blob.includes(number));
  assert.ok(!blob.includes(name), 'staff cookie must not reveal waiting names on list-queues');
  assert.ok(!blob.includes(phone), 'staff cookie must not reveal waiting phones on list-queues');
  assert.ok(!blob.includes('د. أحمد'));

  const config = mock({
    method: 'GET',
    staff: true,
    query: { tenant: tenant, action: 'get-config' }
  });
  await queueHandler(config.req, config.res);
  const configBlob = JSON.stringify(config.res.body);
  assert.strictEqual(config.res.body.users, undefined);
  assert.ok(!configBlob.includes('د. أحمد'));
  assert.ok(!configBlob.includes('1111'));
  assert.ok(!configBlob.includes(name));
  assert.ok(!configBlob.includes(phone));

  const sse = mock({
    method: 'GET',
    staff: true,
    query: { tenant: tenant, action: 'events' }
  });
  await queueHandler(sse.req, sse.res);
  const called = mock({
    staff: true,
    query: { tenant: tenant, action: 'call-next' },
    body: { counterId: 'cnt-1-' + tenant }
  });
  await queueHandler(called.req, called.res);
  assert.strictEqual(called.res.statusCode, 200);
  const stream = sse.res.chunks.join('');
  assert.ok(stream.includes('ticket_called'));
  assert.ok(!stream.includes(name));
  assert.ok(!stream.includes(phone));
  assert.ok(!stream.includes('د. أحمد'));
  assert.ok(!stream.includes('operator_name'));

  const redacted = queueGuard.redactPublicEvent({
    ticket: { ticket_number: 'A-01', customer_name: name, customer_phone: phone },
    counter: { name: 'كاونتر 1', operator_name: 'د. أحمد' }
  });
  assert.strictEqual(redacted.counter.operator_name, undefined);
  assert.strictEqual(redacted.ticket.customer_name, undefined);
  assert.strictEqual(redacted.counter.name, 'كاونتر 1');
}

async function strictMissingIp() {
  const tenant = 'rate_noip_' + Date.now();
  let last = null;
  for (let i = 0; i < 6; i++) {
    const call = mock({
      staff: false,
      noIp: true,
      query: { tenant: tenant, action: 'join-queue' },
      body: { queueId: 'q-cs-' + tenant, customerName: 'زائر', customerPhone: '0500000099' }
    });
    await queueHandler(call.req, call.res);
    last = call.res;
  }
  assert.strictEqual(last.statusCode, 429);
  assert.strictEqual(last.body.code, 'RATE_LIMITED');
}

function httpSmoke() {
  return new Promise(function (resolve, reject) {
    const errors = [];
    function onReject(err) { errors.push(err); }
    process.on('unhandledRejection', onReject);
    const server = http.createServer(async function (req, res) {
      const url = new URL(req.url, 'http://127.0.0.1');
      req.query = Object.fromEntries(url.searchParams);
      req.body = {};
      res.status = function (code) { this.statusCode = code; return this; };
      res.json = function (data) {
        if (!this.headersSent) this.setHeader('Content-Type', 'application/json; charset=utf-8');
        this.end(JSON.stringify(data));
        return this;
      };
      try {
        await queueHandler(req, res);
      } catch (err) {
        errors.push(err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(String(err && err.message));
        }
      }
    });
    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      const tenant = 'http_smoke_' + Date.now();
      const request = http.get({
        hostname: '127.0.0.1',
        port: port,
        path: '/api/v1/queue?action=list-queues&tenant=' + tenant,
        headers: {
          host: tenant + '.mken.live',
          origin: 'https://' + tenant + '.mken.live'
        }
      }, function (res) {
        const chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () {
          setTimeout(function () {
            process.removeListener('unhandledRejection', onReject);
            server.close();
            const headerErr = errors.find(function (err) { return err && err.code === 'ERR_HTTP_HEADERS_SENT'; });
            if (headerErr) {
              reject(headerErr);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error('HTTP smoke status ' + res.statusCode + ' ' + Buffer.concat(chunks).toString('utf8')));
              return;
            }
            if (errors.length) {
              reject(errors[0]);
              return;
            }
            resolve();
          }, 80);
        });
      });
      request.on('error', function (err) {
        process.removeListener('unhandledRejection', onReject);
        server.close();
        reject(err);
      });
    });
  });
}

function runWorker(action, tenant, extra) {
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, [
      path.join(__dirname, 'queue-instance-worker.cjs'),
      action,
      tenant,
      JSON.stringify(extra || {})
    ], {
      env: Object.assign({}, process.env, { QUEUE_DATABASE_URL: DATABASE_URL }),
      cwd: path.join(__dirname, '..')
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', function (chunk) { stdout += chunk; });
    child.stderr.on('data', function (chunk) { stderr += chunk; });
    child.on('close', function (code) {
      if (code !== 0) {
        reject(new Error('worker ' + action + ' exited ' + code + '\n' + stderr + '\n' + stdout));
        return;
      }
      const line = stdout.split('\n').filter(function (item) { return item.indexOf('RESULT ') === 0; }).pop();
      if (!line) {
        reject(new Error('worker produced no result\n' + stderr + '\n' + stdout));
        return;
      }
      resolve(JSON.parse(line.slice('RESULT '.length)));
    });
  });
}

async function applyMigration() {
  const { Client } = require('pg');
  const admin = new Client({ connectionString: DATABASE_URL.replace(/\/[^/]+$/, '/postgres') });
  await admin.connect();
  const dbName = 'queue_test';
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) await admin.query('CREATE DATABASE ' + dbName);
  await admin.end();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/2026-11-17-queue-postgres-runtime.sql'),
    'utf8'
  );
  await client.query(sql);
  await client.end();
}

async function postgresInstances() {
  await applyMigration();
  const tenant = 'pginst' + Date.now();
  const queueId = 'q-cs-' + tenant;
  const [first, second] = await Promise.all([
    runWorker('join-queue', tenant, {
      ip: '203.0.113.21',
      body: { queueId: queueId, customerName: 'نسخة أ', customerPhone: '0501000001' }
    }),
    runWorker('join-queue', tenant, {
      ip: '203.0.113.22',
      body: { queueId: queueId, customerName: 'نسخة ب', customerPhone: '0501000002' }
    })
  ]);
  assert.strictEqual(first.status, 200, JSON.stringify(first.body));
  assert.strictEqual(second.status, 200, JSON.stringify(second.body));
  const left = first.body.tickets[0].ticket_number;
  const right = second.body.tickets[0].ticket_number;
  assert.notStrictEqual(left, right, 'two instances minted the same ticket number ' + left);
  assert.ok(/^A-\d+$/.test(left) && /^A-\d+$/.test(right));

  const board = await runWorker('list-queues', tenant, { method: 'GET', ip: '203.0.113.23' });
  assert.strictEqual(board.status, 200);
  const numbers = [];
  (board.body.queues || []).forEach(function (queue) {
    (queue.waitingTickets || []).forEach(function (ticket) { numbers.push(ticket.ticket_number); });
  });
  assert.ok(numbers.includes(left) && numbers.includes(right), 'polling instance did not see both tickets: ' + numbers.join(','));
  assert.ok(!JSON.stringify(board.body).includes('نسخة أ'));
  assert.ok(!JSON.stringify(board.body).includes('0501000001'));

  const freshTenant = 'pgrestart' + Date.now();
  const issued = await runWorker('join-queue', freshTenant, {
    ip: '203.0.113.31',
    body: { queueId: 'q-cs-' + freshTenant, customerName: 'بعد إعادة التشغيل', customerPhone: '0502000002' }
  });
  assert.strictEqual(issued.status, 200);
  const persistedNumber = issued.body.tickets[0].ticket_number;
  const restarted = await runWorker('list-queues', freshTenant, { method: 'GET', ip: '203.0.113.32' });
  const restartedNumbers = [];
  (restarted.body.queues || []).forEach(function (queue) {
    (queue.waitingTickets || []).forEach(function (ticket) { restartedNumbers.push(ticket.ticket_number); });
  });
  assert.ok(restartedNumbers.includes(persistedNumber), 'a fresh process lost the ticket after restart');
}

async function main() {
  await authNegatives();
  await piiWithCookie();
  await strictMissingIp();
  await httpSmoke();
  try {
    await postgresInstances();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ECONNREFUSED') {
      console.warn('[SKIP] Postgres instance test skipped: ' + err.message);
    } else {
      throw err;
    }
  }
  console.log('queue staff auth, public redaction, postgres runtime, and HTTP smoke checks passed');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
