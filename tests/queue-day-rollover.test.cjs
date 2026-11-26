'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const queueDay = require('../mkn-theme/src/server/platform/_lib/queue-day.js');
const { tenantHeaders } = require('./queue-http.cjs');

function createMockReq(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || tenantHeaders(options),
    on: function () {}
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}

async function call(options) {
  const req = createMockReq(options);
  const res = createMockRes();
  await queueHandler(req, res);
  return res;
}

function queueByPrefix(body, prefix) {
  const queues = (body && body.queues) || [];
  const found = queues.find(function (queue) { return queue.prefix === prefix || queue.code === prefix; });
  assert.ok(found, 'missing queue ' + prefix + ' ' + JSON.stringify(body));
  return found;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 تدوير اليوم التشغيلي للطابور');
  console.log('====================================================\n');

  const root = path.join(__dirname, '..');
  const migrationName = '2026-11-24-queue-day-rollover.sql';
  const migration = fs.readFileSync(path.join(root, 'db/migrations', migrationName), 'utf8');
  assert.ok(migration.includes('queue_apply_day_rollover'));
  assert.ok(migration.includes('queue_call_next'));
  assert.ok(migration.includes('FOR UPDATE SKIP LOCKED'));
  assert.ok(migration.includes('queue_ticket_should_close(payload, v_norm, v_now, v_extended) IS NOT NULL'));
  assert.ok(migration.includes('انتهى اليوم التشغيلي'));
  assert.ok(migration.includes('first_arrived_at'));
  assert.ok(migration.includes('booked_at'));
  const previous = fs.readFileSync(path.join(root, 'db/migrations/2026-11-17-queue-delta-commit.sql'), 'utf8');
  assert.ok(!previous.includes('queue_apply_day_rollover'));

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'mkn-theme/vercel.json'), 'utf8'));
  const cron = (vercel.crons || []).find(function (item) { return item.path === '/api/cron/queue-rollover'; });
  assert.ok(cron, 'queue cron missing');
  assert.strictEqual(cron.schedule, '5 21 * * *');
  const cronRoute = fs.readFileSync(path.join(root, 'mkn-theme/src/app/api/cron/queue-rollover/route.ts'), 'utf8');
  assert.ok(cronRoute.includes('CRON_SECRET'));
  assert.ok(cronRoute.includes('Bearer'));
  const adminHtml = fs.readFileSync(path.join(root, 'mkn-theme/public/admin.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(root, 'mkn-theme/public/js/admin-queue.js'), 'utf8');
  assert.ok(adminHtml.includes('adminQueueOperatingMode'));
  assert.ok(adminHtml.includes('فرع على مدار الساعة'));
  assert.ok(adminJs.includes('restoreTicket'));
  assert.ok(adminJs.includes('btn-restore-ticket'));
  console.log('1️⃣ الهجرة والكرون وإعدادات الإدارة موجودة.\n');

  console.log('2️⃣ الإغلاق الثابت يُنهي تذاكر الأمس والانضمام الجديد يأخذ A-01...');
  const fixed = 'dayfix' + Date.now();
  const fixedQueue = 'q-cs-' + fixed;
  queueDay.setNowForTests('2026-11-18T07:00:00.000Z');
  let res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: fixed },
    body: { queueId: fixedQueue, customerName: 'زائر الأمس' }
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  const oldTicket = res.body.tickets[0];
  assert.strictEqual(oldTicket.ticket_number, 'A-01');
  assert.strictEqual(oldTicket.service_date, '2026-11-18');

  res = await call({ query: { action: 'staff-config', tenant: fixed } });
  const counterBefore = res.body.counters.find(function (counter) { return counter.id === 'cnt-1-' + fixed; });
  assert.strictEqual(counterBefore.completed_today_count, 14);
  assert.strictEqual(counterBefore.completed_today_service_date, '2026-11-18');

  queueDay.setNowForTests('2026-11-19T07:00:00.000Z');
  res = await call({ staff: false, query: { action: 'list-queues', tenant: fixed } });
  assert.strictEqual(res.statusCode, 200);
  let board = queueByPrefix(res.body, 'A');
  assert.strictEqual(board.waitingCount, 0);
  assert.ok(board.estimatedWaitMinutes < 20, 'ETW still counts yesterday: ' + board.estimatedWaitMinutes);
  assert.ok(!JSON.stringify(res.body).includes('زائر الأمس'));
  assert.ok(!res.body.queues.some(function (queue) { return queue.expiredTickets; }));

  res = await call({ query: { action: 'staff-board', tenant: fixed } });
  board = queueByPrefix(res.body, 'A');
  assert.strictEqual(board.waitingCount, 0);
  assert.strictEqual(board.expiredTickets.length, 1);
  assert.strictEqual(board.expiredTickets[0].id, oldTicket.id);
  assert.strictEqual(board.expiredTickets[0].close_reason, 'انتهى اليوم التشغيلي');

  res = await call({ query: { action: 'staff-config', tenant: fixed } });
  res.body.counters.forEach(function (counter) {
    assert.strictEqual(counter.completed_today_count, 0, counter.id);
    assert.strictEqual(counter.completed_today_service_date, '2026-11-19');
  });
  const again = await call({ query: { action: 'staff-config', tenant: fixed } });
  again.body.counters.forEach(function (counter) {
    assert.strictEqual(counter.completed_today_count, 0);
  });

  res = await call({
    method: 'POST',
    query: { action: 'call-next', tenant: fixed },
    body: { counterId: 'cnt-1-' + fixed }
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(!res.body.ticket);

  res = await call({
    query: { action: 'get-ticket-status', tenant: fixed, ticket_id: oldTicket.id }
  });
  assert.strictEqual(res.body.tickets[0].status, 'expired');

  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: fixed },
    body: { queueId: fixedQueue, customerName: 'زائر اليوم' }
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  const fresh = res.body.tickets[0];
  assert.strictEqual(fresh.ticket_number, 'A-01');
  assert.notStrictEqual(fresh.id, oldTicket.id);

  res = await call({
    method: 'POST',
    query: { action: 'call-next', tenant: fixed },
    body: { counterId: 'cnt-1-' + fixed }
  });
  assert.strictEqual(res.body.ticket.id, fresh.id);
  res = await call({
    query: { action: 'get-ticket-status', tenant: fixed, ticket_id: oldTicket.id }
  });
  assert.strictEqual(res.body.tickets[0].status, 'expired');
  console.log('   ✅ أمس expired، نداء التالي لا يأخذه، وتذكرة اليوم A-01.\n');

  console.log('3️⃣ الإعادة للموظف فقط، وتبقى في طابور اليوم...');
  const restoreTenant = 'dayback' + Date.now();
  queueDay.setNowForTests('2026-11-18T07:00:00.000Z');
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: restoreTenant },
    body: { queueId: 'q-cs-' + restoreTenant, customerName: 'يعود' }
  });
  const restoreId = res.body.tickets[0].id;
  queueDay.setNowForTests('2026-11-19T07:00:00.000Z');
  await call({ staff: false, query: { action: 'list-queues', tenant: restoreTenant } });
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'restore-ticket', tenant: restoreTenant },
    body: { ticketId: restoreId }
  });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
  res = await call({
    method: 'POST',
    query: { action: 'restore-ticket', tenant: restoreTenant },
    body: { ticketId: restoreId }
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.ticket.status, 'waiting');
  assert.strictEqual(res.body.ticket.ticket_number, 'A-01');
  assert.strictEqual(res.body.ticket.service_date, '2026-11-19');
  res = await call({ staff: false, query: { action: 'list-queues', tenant: restoreTenant } });
  assert.strictEqual(queueByPrefix(res.body, 'A').waitingCount, 1);
  res = await call({ staff: false, query: { action: 'list-queues', tenant: restoreTenant } });
  assert.strictEqual(queueByPrefix(res.body, 'A').waitingCount, 1);
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: restoreTenant },
    body: { queueId: 'q-cs-' + restoreTenant }
  });
  assert.strictEqual(res.body.tickets[0].ticket_number, 'A-02');
  res = await call({ query: { action: 'get-override-state', tenant: restoreTenant } });
  const restoreAudit = (res.body.recent_audit_logs || []).filter(function (row) {
    return row.action_type === 'QUEUE_TICKET_RESTORE';
  });
  assert.strictEqual(restoreAudit.length, 1);
  console.log('   ✅ بلا جلسة 401، ومع الموظف تعود A-01 والتالية A-02.\n');

  console.log('4️⃣ فرع 24 ساعة يُبقي تذكرة 23:55 عبر منتصف الليل...');
  const overnight = 'day24h' + Date.now();
  queueDay.setNowForTests('2026-11-18T20:55:00.000Z');
  res = await call({
    method: 'POST',
    query: { action: 'save-config', tenant: overnight },
    body: { settings: { operating_mode: 'always_open', max_wait_hours: 6, reset_hour: 4, closing_time: '16:00' } }
  });
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.settings.operating_mode, 'always_open');
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: overnight },
    body: { queueId: 'q-cs-' + overnight, customerName: 'آخر الليل' }
  });
  const nightTicket = res.body.tickets[0];
  assert.strictEqual(nightTicket.ticket_number, 'A-01');
  queueDay.setNowForTests('2026-11-18T21:10:00.000Z');
  res = await call({ query: { action: 'staff-board', tenant: overnight } });
  board = queueByPrefix(res.body, 'A');
  assert.strictEqual(board.waitingCount, 1);
  assert.strictEqual(board.waitingTickets[0].id, nightTicket.id);
  assert.strictEqual(board.waitingTickets[0].status, 'waiting');
  console.log('   ✅ التذكرة بقيت منتظرة وبنفس الترتيب.\n');

  console.log('5️⃣ فرع 24 ساعة يُنهي من تجاوز حد الانتظار...');
  const waited = 'daywait' + Date.now();
  queueDay.setNowForTests('2026-11-18T08:00:00.000Z');
  await call({
    method: 'POST',
    query: { action: 'save-config', tenant: waited },
    body: { settings: { operating_mode: 'always_open', max_wait_hours: 6, reset_hour: 4 } }
  });
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: waited },
    body: { queueId: 'q-cs-' + waited }
  });
  const waitedId = res.body.tickets[0].id;
  queueDay.setNowForTests('2026-11-18T14:01:00.000Z');
  res = await call({ query: { action: 'staff-board', tenant: waited } });
  board = queueByPrefix(res.body, 'A');
  assert.strictEqual(board.waitingCount, 0);
  assert.strictEqual(board.expiredTickets[0].id, waitedId);
  assert.strictEqual(board.expiredTickets[0].close_reason, 'تجاوز الحد الأقصى للانتظار');
  console.log('   ✅ أُغلقت بعد أكثر من 6 ساعات.\n');

  console.log('6️⃣ إعادة الترقيم تتخطى الرقم المفتوح...');
  const skip = 'dayskip' + Date.now();
  queueDay.setNowForTests('2026-11-18T23:00:00.000Z');
  await call({
    method: 'POST',
    query: { action: 'save-config', tenant: skip },
    body: { settings: { operating_mode: 'always_open', max_wait_hours: 6, reset_hour: 4 } }
  });
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: skip },
    body: { queueId: 'q-cs-' + skip }
  });
  assert.strictEqual(res.body.tickets[0].ticket_number, 'A-01');
  queueDay.setNowForTests('2026-11-19T01:10:00.000Z');
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: skip },
    body: { queueId: 'q-cs-' + skip }
  });
  assert.strictEqual(res.body.tickets[0].ticket_number, 'A-02');
  res = await call({ query: { action: 'staff-board', tenant: skip } });
  board = queueByPrefix(res.body, 'A');
  assert.strictEqual(board.waitingCount, 2);
  const numbers = board.waitingTickets.map(function (ticket) { return ticket.ticket_number; }).sort();
  assert.deepStrictEqual(numbers, ['A-01', 'A-02']);
  console.log('   ✅ A-01 ما زال مفتوحاً والتذكرة الجديدة A-02.\n');

  console.log('7️⃣ التدوير المتزامن لا يُغلق التذكرة مرتين...');
  const concurrent = 'dayrace' + Date.now();
  queueDay.setNowForTests('2026-11-17T07:00:00.000Z');
  res = await call({
    method: 'POST',
    staff: false,
    query: { action: 'join-queue', tenant: concurrent },
    body: { queueId: 'q-cs-' + concurrent, customerName: 'مرة واحدة' }
  });
  const raceId = res.body.tickets[0].id;
  queueDay.setNowForTests('2026-11-19T07:00:00.000Z');
  const wave = [];
  for (let i = 0; i < 8; i++) wave.push(call({ staff: false, query: { action: 'list-queues', tenant: concurrent } }));
  const firstWave = await Promise.all(wave);
  firstWave.forEach(function (item) {
    assert.strictEqual(item.statusCode, 200);
    assert.strictEqual(queueByPrefix(item.body, 'A').waitingCount, 0);
  });
  const secondWave = await Promise.all([
    call({ staff: false, query: { action: 'list-queues', tenant: concurrent } }),
    call({ query: { action: 'staff-board', tenant: concurrent } }),
    call({ query: { action: 'get-override-state', tenant: concurrent } })
  ]);
  assert.strictEqual(secondWave[1].statusCode, 200, JSON.stringify(secondWave[1].body));
  assert.strictEqual(queueByPrefix(secondWave[1].body, 'A').expiredTickets.length, 1);
  assert.strictEqual(queueByPrefix(secondWave[1].body, 'A').expiredTickets[0].id, raceId);
  const closeAudits = (secondWave[2].body.recent_audit_logs || []).filter(function (row) {
    return row.action_type === 'QUEUE_DAY_CLOSE';
  });
  assert.strictEqual(closeAudits.length, 1, JSON.stringify(secondWave[2].body.recent_audit_logs));
  console.log('   ✅ ثماني طلبات متزامنة أنتجت إغلاقاً واحداً.\n');

  queueDay.setNowForTests(null);
  console.log('✅ كل فحوصات تدوير اليوم التشغيلي نجحت. الهجرة: db/migrations/' + migrationName);
}

runTests().catch(function (err) {
  queueDay.setNowForTests(null);
  console.error(err);
  process.exit(1);
});
