'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.QUEUE_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/queue_test';
process.env.QUEUE_DATABASE_URL = DATABASE_URL;

const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const { tenantHeaders } = require('./queue-http.cjs');

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
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
  return { req: req, res: res };
}

async function invoke(options) {
  const call = mock(options);
  await queueHandler(call.req, call.res);
  return { status: call.res.statusCode, body: call.res.body };
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

async function withDb(fn) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ticketRows(tenant) {
  return withDb(function (client) {
    return client.query(
      "SELECT payload->>'ticket_number' AS ticket_number, payload->>'status' AS status, payload->>'counter_id' AS counter_id, payload->>'customer_name' AS customer_name FROM public.queue_runtime_records WHERE tenant_slug = $1 AND kind = 'ticket' ORDER BY (payload->>'daily_sequence')::int",
      [tenant]
    ).then(function (result) { return result.rows; });
  });
}

async function parallelJoins(tenant, count, invokeJoin) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const body = { queueId: 'q-cs-' + tenant };
    if (i !== 3) {
      body.customerName = 'زائر ' + i;
      body.customerPhone = '0500000' + String(i).padStart(3, '0');
    }
    tasks.push(invokeJoin(tenant, body, '203.0.113.' + (i + 1)));
  }
  const responses = await Promise.all(tasks);
  responses.forEach(function (res, index) {
    assert.strictEqual(res.status, 200, 'join ' + index + ' ' + JSON.stringify(res.body));
    assert.ok(res.body && res.body.tickets && res.body.tickets[0], 'join ' + index + ' returned no ticket');
  });
  const numbers = responses.map(function (res) { return res.body.tickets[0].ticket_number; });
  assert.strictEqual(new Set(numbers).size, count, 'duplicate numbers: ' + numbers.join(','));
  return numbers;
}

async function assertPersisted(tenant, numbers) {
  const rows = await ticketRows(tenant);
  const stored = rows.map(function (row) { return row.ticket_number; });
  assert.strictEqual(rows.length, numbers.length, 'persisted ' + stored.join(',') + ' expected ' + numbers.join(','));
  numbers.forEach(function (number) {
    assert.ok(stored.includes(number), number + ' missing from postgres: ' + stored.join(','));
  });
  const anonymous = rows.find(function (row) { return !row.customer_name; });
  assert.ok(anonymous, 'a join without a name was not stored');
  return rows;
}

async function assertIntake(tenant, numbers, readStatus) {
  for (let i = 0; i < numbers.length; i++) {
    const res = await readStatus(tenant, numbers[i], '198.51.100.' + ((i % 200) + 1));
    assert.strictEqual(res.status, 200, numbers[i] + ' intake ' + JSON.stringify(res.body));
    const blob = JSON.stringify(res.body);
    assert.ok(blob.includes(numbers[i]));
    assert.ok(!blob.includes('customer_name'));
    assert.ok(!blob.includes('customer_phone'));
    assert.ok(!blob.includes('زائر'));
  }
}

async function parallelCallNext(tenant, callNext) {
  const queueId = 'q-cs-' + tenant;
  const updated = await callNext(tenant, 'update-counter', {
    counterId: 'cnt-2-' + tenant,
    assignedQueueIds: [queueId],
    status: 'active'
  });
  assert.strictEqual(updated.status, 200, JSON.stringify(updated.body));

  const denied = await callNext(tenant, 'call-next', { counterId: 'cnt-1-' + tenant }, { staff: false });
  assert.strictEqual(denied.status, 401);
  assert.strictEqual(denied.body.code, 'AUTH_REQUIRED');

  const [left, right] = await Promise.all([
    callNext(tenant, 'call-next', { counterId: 'cnt-1-' + tenant }),
    callNext(tenant, 'call-next', { counterId: 'cnt-2-' + tenant })
  ]);
  assert.strictEqual(left.status, 200, JSON.stringify(left.body));
  assert.strictEqual(right.status, 200, JSON.stringify(right.body));
  assert.ok(left.body.ticket && left.body.ticket.ticket_number, JSON.stringify(left.body));
  assert.ok(right.body.ticket && right.body.ticket.ticket_number, JSON.stringify(right.body));
  assert.notStrictEqual(left.body.ticket.ticket_number, right.body.ticket.ticket_number);
  assert.notStrictEqual(left.body.ticket.id, right.body.ticket.id);

  const rows = await ticketRows(tenant);
  const called = rows.filter(function (row) { return row.status === 'called'; });
  const calledNumbers = called.map(function (row) { return row.ticket_number; });
  assert.ok(calledNumbers.includes(left.body.ticket.ticket_number));
  assert.ok(calledNumbers.includes(right.body.ticket.ticket_number));
  const counters = called.map(function (row) { return row.counter_id; }).filter(Boolean);
  assert.strictEqual(new Set(counters).size, 2, 'both calls landed on one counter: ' + JSON.stringify(called));
}

async function inProcess() {
  const tenant = 'concin' + Date.now();
  const numbers = await parallelJoins(tenant, 20, function (slug, body, ip) {
    return invoke({
      staff: false,
      headers: tenantHeaders({
        staff: false,
        query: { tenant: slug },
        headers: { 'x-forwarded-for': ip }
      }),
      query: { tenant: slug, action: 'join-queue' },
      body: body
    });
  });
  await assertPersisted(tenant, numbers);
  await assertIntake(tenant, numbers, function (slug, number, ip) {
    return invoke({
      method: 'GET',
      staff: false,
      headers: tenantHeaders({
        staff: false,
        query: { tenant: slug },
        headers: { 'x-forwarded-for': ip }
      }),
      query: { tenant: slug, action: 'intake-status', ticket_number: number }
    });
  });
  await parallelCallNext(tenant, function (slug, action, body, options) {
    const staff = !(options && options.staff === false);
    return invoke({
      staff: staff,
      headers: tenantHeaders({
        staff: staff,
        query: { tenant: slug },
        headers: { 'x-forwarded-for': '192.0.2.10' }
      }),
      query: { tenant: slug, action: action },
      body: body
    });
  });
}

async function separateProcesses() {
  const tenant = 'concps' + Date.now();
  const numbers = await parallelJoins(tenant, 20, function (slug, body, ip) {
    return runWorker('join-queue', slug, {
      staff: false,
      ip: ip,
      body: body
    }).then(function (result) {
      return { status: result.status, body: result.body };
    });
  });
  await assertPersisted(tenant, numbers);
  await assertIntake(tenant, numbers, function (slug, number, ip) {
    return runWorker('intake-status', slug, {
      method: 'GET',
      staff: false,
      ip: ip,
      query: { ticket_number: number }
    }).then(function (result) {
      return { status: result.status, body: result.body };
    });
  });
  await parallelCallNext(tenant, function (slug, action, body, options) {
    return runWorker(action, slug, {
      staff: !(options && options.staff === false),
      ip: '192.0.2.20',
      body: body
    }).then(function (result) {
      return { status: result.status, body: result.body };
    });
  });
}

async function ensureDatabase() {
  const admin = new Client({ connectionString: DATABASE_URL.replace(/\/[^/]+$/, '/postgres') });
  await admin.connect();
  const dbName = 'queue_test';
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) await admin.query('CREATE DATABASE ' + dbName);
  await admin.end();
}

async function main() {
  await ensureDatabase();
  await inProcess();
  await separateProcesses();
  console.log('queue concurrency: 20 parallel joins persisted and two call-next claims differed');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
