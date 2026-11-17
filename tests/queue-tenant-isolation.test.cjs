'use strict';

const assert = require('assert');
const queueHandler = require('../api/v1/queue.js');
const ticketsRoute = require('../api/queue/tickets.js');
const intakeRoute = require('../api/queue/intake/status.js');
const { staffCookie } = require('./queue-http.cjs');

function mock(options) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: Object.assign({ origin: 'https://rewa.mken.live' }, options.headers || {})
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
  return { req, res };
}

async function run() {
  const phone = '0550001122';
  const name = 'نورة العتيبي';

  const joined = mock({
    method: 'POST',
    url: '/queue/scan',
    query: { action: 'join-queue', tenant: 'default' },
    headers: { host: 'rewa.mken.live' },
    body: { queueId: 'q-cs-rewa', customerName: name, customerPhone: phone, tenantSlug: 'saj' }
  });
  await queueHandler(joined.req, joined.res);
  assert.strictEqual(joined.res.statusCode, 200);
  assert.ok(joined.res.body.sessionToken);
  assert.strictEqual(joined.res.body.tickets[0].customer_name, undefined);
  assert.strictEqual(joined.res.body.tickets[0].customer_phone, undefined);
  assert.strictEqual(joined.res.body.tickets[0].tenant_slug, 'rewa');
  const ticketNumber = joined.res.body.tickets[0].ticket_number;
  const sessionToken = joined.res.body.sessionToken;

  const listed = mock({
    url: '/api/queue/tickets',
    headers: { host: 'rewa.mken.live', 'x-admin-authenticated': '1' }
  });
  await ticketsRoute(listed.req, listed.res);
  assert.strictEqual(listed.res.statusCode, 401, 'قائمة التذاكر بلا جلسة يجب أن تُرفض');

  const staffList = mock({
    url: '/api/queue/tickets',
    headers: { host: 'rewa.mken.live', cookie: staffCookie('rewa') }
  });
  await ticketsRoute(staffList.req, staffList.res);
  assert.strictEqual(staffList.res.statusCode, 200);
  const staffTicket = staffList.res.body.tickets.find(function (t) { return t.ticket_number === ticketNumber; });
  assert.ok(staffTicket);
  assert.strictEqual(staffTicket.customer_name, name);
  assert.strictEqual(staffTicket.customer_phone, phone);
  assert.strictEqual(staffTicket.session_token, undefined);

  const otherHost = mock({
    url: '/api/queue/tickets',
    query: { tenant: 'rewa' },
    headers: { host: 'saj.mken.live', cookie: staffCookie('saj') }
  });
  await ticketsRoute(otherHost.req, otherHost.res);
  assert.strictEqual(otherHost.res.statusCode, 200);
  assert.ok(!(otherHost.res.body.tickets || []).some(function (t) { return t.ticket_number === ticketNumber && t.customer_phone === phone; }));

  const ignoredQuery = mock({
    query: { action: 'list-queues', tenant: 'default' },
    headers: { host: 'rewa.mken.live' }
  });
  await queueHandler(ignoredQuery.req, ignoredQuery.res);
  assert.strictEqual(ignoredQuery.res.statusCode, 200);
  const publicQueue = ignoredQuery.res.body.queues.find(function (q) { return q.id === 'q-cs-rewa'; });
  assert.ok(publicQueue.waitingTickets.some(function (t) { return t.ticket_number === ticketNumber; }));
  assert.strictEqual(publicQueue.waitingTickets[0].customer_name, undefined);
  assert.ok(!JSON.stringify(ignoredQuery.res.body).includes(phone));
  assert.ok(!JSON.stringify(ignoredQuery.res.body).includes(name));

  const apex = mock({
    query: { action: 'list-queues', tenant: 'rewa' },
    headers: { host: 'mken.live' }
  });
  await queueHandler(apex.req, apex.res);
  assert.strictEqual(apex.res.statusCode, 400);
  assert.strictEqual(apex.res.body.code, 'TENANT_REQUIRED');

  const apexStaff = mock({
    url: '/api/queue/tickets',
    query: { tenant: 'saj' },
    headers: { host: 'mken.live', cookie: staffCookie('rewa') }
  });
  await ticketsRoute(apexStaff.req, apexStaff.res);
  assert.strictEqual(apexStaff.res.statusCode, 200);
  assert.strictEqual(apexStaff.res.body.tenant, 'rewa');
  assert.ok(apexStaff.res.body.tickets.some(function (t) { return t.customer_phone === phone; }));

  const intake = mock({
    url: '/api/queue/intake/status',
    query: { session_token: sessionToken, tenant: 'default' },
    headers: { host: 'rewa.mken.live' }
  });
  await intakeRoute(intake.req, intake.res);
  assert.strictEqual(intake.res.statusCode, 200);
  assert.deepStrictEqual(Object.keys(intake.res.body.tickets[0]).sort(), ['counter', 'status', 'ticket_number']);
  assert.strictEqual(intake.res.body.tickets[0].ticket_number, ticketNumber);
  assert.ok(!JSON.stringify(intake.res.body).includes(phone));
  assert.ok(!JSON.stringify(intake.res.body).includes(name));

  const config = mock({
    query: { action: 'get-config', tenant: 'default' },
    headers: { host: 'rewa.mken.live' }
  });
  await queueHandler(config.req, config.res);
  assert.strictEqual(config.res.statusCode, 200);
  assert.strictEqual(config.res.body.users, undefined);
  assert.ok(!JSON.stringify(config.res.body).includes('1111'));
  assert.ok(!JSON.stringify(config.res.body).includes('د. أحمد'));

  let blocked = null;
  for (let i = 0; i < 9; i++) {
    const attempt = mock({
      method: 'POST',
      query: { action: 'join-queue' },
      headers: { host: 'rewa.mken.live', 'x-forwarded-for': '203.0.113.10' },
      body: { queueId: 'q-cs-rewa', customerName: 'زائر', customerPhone: '0500000000' }
    });
    await queueHandler(attempt.req, attempt.res);
    blocked = attempt.res;
  }
  assert.strictEqual(blocked.statusCode, 429);
  assert.strictEqual(blocked.body.code, 'RATE_LIMITED');

  console.log('queue tenant isolation and public redaction checks passed');
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
