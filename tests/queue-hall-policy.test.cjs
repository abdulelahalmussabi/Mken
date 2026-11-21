'use strict';

const assert = require('assert');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const queueGate = require('../mkn-theme/src/server/platform/_lib/queue-gate');

function createMockReq(options = {}) {
  const t = (options.query && options.query.tenant) || 'default';
  return {
    method: options.method || 'GET',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: Object.assign({ origin: 'http://localhost', host: t + '.mken.live' }, options.headers || {})
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function run() {
  console.log('====================================================');
  console.log('سياسة الصالة + بوابة الدوام/السعة/جوجل/المناسبات');
  console.log('====================================================\n');

  const tenant = 'hall_policy_' + Date.now();

  async function staffHeadersFor(slug) {
    await queueHandler(createMockReq({ query: { action: 'public-gate', tenant: slug } }), createMockRes());
    const loginReq = createMockReq({
      method: 'POST',
      query: { action: 'staff-login', tenant: slug },
      body: { pin: '1111' }
    });
    const loginRes = createMockRes();
    await queueHandler(loginReq, loginRes);
    assert.strictEqual(loginRes.statusCode, 200, 'staff-login');
    return { 'x-queue-staff-token': loginRes.body.token };
  }

  console.log('1️⃣ تحويل أيام جوجل (الأحد=0) دون قلب الإجازة...');
  const weekly = queueGate.googlePeriodsToWeeklyHours([
    { openDay: 0, openTime: { hours: 16, minutes: 0 }, closeTime: { hours: 23, minutes: 0 } },
    { openDay: 'FRIDAY', openTime: '16:00', closeTime: '23:00' }
  ]);
  assert.strictEqual(weekly['0'].closed, false);
  assert.strictEqual(weekly['0'].open, '16:00');
  assert.strictEqual(weekly['5'].closed, false);
  assert.strictEqual(weekly['1'].closed, true);
  const fromDetails = queueGate.googlePeriodsToWeeklyHours([
    { open: { day: 4, time: '1600' }, close: { day: 4, time: '2300' } }
  ]);
  assert.strictEqual(fromDetails['4'].closed, false);
  assert.strictEqual(fromDetails['4'].open, '16:00');
  assert.strictEqual(fromDetails['4'].close, '23:00');
  console.log('   نجح\n');

  console.log('2️⃣ public-gate افتراضي مفتوح...');
  let req = createMockReq({ query: { action: 'public-gate', tenant } });
  let res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.allows_issue, true);
  assert.ok(['open', 'prayer_soon', 'prayer_now'].indexOf(res.body.gate_state) !== -1);
  assert.strictEqual(res.body.prayer_source_label, 'تقديري');
  console.log('   نجح\n');

  console.log('3️⃣ حفظ السياسة بلا مشرف = 401...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'save-hall-policy', tenant },
    body: { reason: 'تجربة', policy: { daily_issue_cap: 1 } }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 401);
  console.log('   نجح\n');

  console.log('3️⃣ب ترويسة الإدارة وحدها لا تكفي لحفظ السياسة...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'save-hall-policy', tenant },
    headers: { 'x-admin-authenticated': '1' },
    body: { reason: 'تجربة ترويسة', policy: { daily_issue_cap: 1 } }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 401);
  console.log('   نجح\n');

  const staffHeaders = await staffHeadersFor(tenant);

  console.log('4️⃣ سقف يومي 0 يرفض الإصدار برسالة عربية...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'save-hall-policy', tenant },
    headers: staffHeaders,
    body: { reason: 'اكتمال تجريبي', policy: { daily_issue_cap: 0 } }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.gate.gate_state, 'capacity_full');

  req = createMockReq({
    method: 'POST',
    query: { action: 'join-queue', tenant },
    body: { queueId: 'q-cs-' + tenant }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.ok, false);
  assert.ok(res.body.message_ar);
  console.log('   نجح\n');

  console.log('5️⃣ ربط مكان جوجل لا يكتب weekly_hours إلا مع apply+سبب...');
  const tenant2 = 'hall_bind_' + Date.now();
  req = createMockReq({
    method: 'POST',
    query: { action: 'bind-place', tenant: tenant2 },
    headers: await staffHeadersFor(tenant2),
    body: {
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=place_id:ChIJtest',
      placeId: 'ChIJtest',
      city: 'Jeddah',
      openingPeriods: [{ openDay: 6, openTime: '09:00', closeTime: '13:00' }]
    }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.applied, false);
  assert.strictEqual(res.body.policy.google_place_id, 'ChIJtest');
  assert.strictEqual(res.body.policy.city, 'Jeddah');
  assert.ok(res.body.policy.suggested_weekly_hours['6']);
  assert.strictEqual(res.body.policy.suggested_weekly_hours['6'].open, '09:00');
  assert.notStrictEqual(res.body.policy.weekly_hours['6'].open, '09:00');

  req = createMockReq({
    method: 'POST',
    query: { action: 'bind-place', tenant: tenant2 },
    headers: await staffHeadersFor(tenant2),
    body: {
      placeId: 'ChIJtest',
      openingPeriods: [{ openDay: 6, openTime: '09:00', closeTime: '13:00' }],
      apply: true,
      reason: 'اعتماد دوام السبت من الملف'
    }
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.body.applied, true);
  assert.strictEqual(res.body.policy.weekly_hours['6'].open, '09:00');
  console.log('   نجح\n');

  console.log('6️⃣ staff-config لا يعيد PIN...');
  req = createMockReq({ query: { action: 'staff-config', tenant }, headers: staffHeaders });
  res = createMockRes();
  await queueHandler(req, res);
  assert.ok(Array.isArray(res.body.users));
  res.body.users.forEach((u) => {
    assert.strictEqual(u.pin_code, undefined);
    assert.strictEqual(u.pin_hash, undefined);
  });
  console.log('   نجح\n');

  console.log('7️⃣ الصلاة تُعلن ولا توقف إصدار التذاكر...');
  const duringPrayer = queueGate.evaluateGate({
    policy: queueGate.defaultHallPolicy({
      announce_prayer_on_display: true,
      pause_new_issues_during_prayer: true
    }),
    override: {},
    prayer: {
      in_prayer_break: true,
      current_prayer: 'المغرب',
      prayer_time: '17:20'
    },
    issuedToday: 0,
    waitingNow: 2,
    now: new Date('2026-11-16T17:22:00+03:00')
  });
  assert.strictEqual(duringPrayer.gate_state, 'prayer_now');
  assert.strictEqual(duringPrayer.allows_issue, true);
  assert.strictEqual(duringPrayer.allows_call_next, true);
  assert.strictEqual(duringPrayer.in_prayer, true);
  console.log('   نجح\n');

  console.log('8️⃣ إجازة رسمية تُغلق البوابة دون Maps...');
  const hol = queueGate.evaluateGate({
    policy: queueGate.defaultHallPolicy({ apply_national_holidays: true }),
    override: {},
    prayer: { in_prayer_break: false },
    issuedToday: 0,
    waitingNow: 0,
    now: new Date('2026-09-23T10:00:00+03:00'),
    holidays: queueGate.KSA_OFFICIAL_HOLIDAYS
  });
  assert.strictEqual(hol.gate_state, 'official_holiday');
  assert.strictEqual(hol.allows_issue, false);
  console.log('   نجح\n');

  console.log('====================================================');
  console.log('اكتملت فحوصات سياسة الصالة');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
