/**
 * منصة مَكَن (mken.live) — فحص ترقية معمارية تعدد المناطق ومكاتب الاستقبال
 * (Multi-Zone / Multi-Reception Enterprise Architecture Test Suite)
 * التحقق من:
 * 1. عمليات إدارة المناطق (Zone CRUD: list-zones, upsert-zone, delete-zone).
 * 2. ربط الخدمات والكاونترات بالمناطق (Zone-Service & Counter Binding).
 * 3. وراثة التذكرة التلقائية لمنطقة الخدمة (Auto-Inheritance of zone_id).
 * 4. عزل وتصفية شاشات العرض ولوحات التحكم حسب المنطقة (Display & Dispatch Scoping).
 * 5. عزل قنوات البث اللحظي (Scoped SSE Channel Routing).
 * 6. التحويل الذكي بين المناطق مع تحديث zone_id وإشعار المنطقتين معاً.
 * 7. التوافق العكسي التام (100% Backward Compatibility) للمنشآت الفردية غير المقسمة.
 */
const assert = require('assert');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const { tenantHeaders } = require('./queue-http.cjs');

function createMockReq(options = {}) {
  const query = Object.assign({}, options.query || {});
  if (options.tenant && !query.tenant) {
    query.tenant = options.tenant;
  }
  const opts = Object.assign({}, options, { query: query });
  const headers = tenantHeaders(opts);
  if (!headers.host && options.tenant) {
    headers.host = options.tenant.toLowerCase() + '.mken.live';
  }
  if (!headers.origin) {
    headers.origin = 'https://' + headers.host;
  }
  return {
    method: opts.method || 'GET',
    url: opts.url || '/api/v1/queue',
    query: query,
    body: opts.body || {},
    headers: Object.assign(headers, options.headers || {}),
    on(event, handler) {}
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

function createMockSseRes() {
  const events = [];
  return {
    statusCode: 200,
    headers: {},
    events: events,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    flushHeaders() {},
    write(chunk) {
      events.push(chunk);
    },
    on(event, handler) {}
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('🏢 بدء الفحص المعماري لنظام الطوابير متعدد المناطق (Multi-Zone QMS)');
  console.log('====================================================\n');

  const testTenant = 'enterprise_hospital_' + Date.now();
  const staffHeaders = Object.assign(tenantHeaders({ tenant: testTenant }), {
    'x-is-super-admin': '1',
    'x-admin-authenticated': '1',
    'x-queue-staff-token': 'staff-secret'
  });

  // -----------------------------------------------------------------
  // 1. اختبار إدارة مناطق الاستقبال (Zone CRUD Operations)
  // -----------------------------------------------------------------
  console.log('1️⃣ اختبار إنشاء مناطق الاستقبال والتحقق من الحقول (Zone CRUD)...');

  // إنشاء منطقة 1 (استقبال الباطنية)
  let req = createMockReq({
    method: 'POST',
    body: {
      action: 'upsert-zone',
      code: 'REC-01',
      name: 'استقبال العيادات الباطنية',
      floor_or_building: 'البرج الطبي - الدور الأول',
      branchId: 'default'
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  let res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  const zone1 = res.body.zone;
  assert.ok(zone1.id, 'يجب توليد معرّف ID للمنطقة');
  assert.strictEqual(zone1.code, 'REC-01');
  assert.strictEqual(zone1.name, 'استقبال العيادات الباطنية');
  console.log('   ✅ تم إنشاء المنطقة الأولى بنجاح: [REC-01] ' + zone1.name);

  // ترقية سعة مكاتب الاستقبال للمنشأة لدعم المنشآت الكبرى متعددة المناطق
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'purchase-extra-zones',
      quantity: 5
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);

  // إنشاء منطقة 2 (استقبال العظام)
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'upsert-zone',
      code: 'REC-02',
      name: 'استقبال عيادات العظام والمفاصل',
      floor_or_building: 'البرج الطبي - الدور الثاني',
      branchId: 'default'
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const zone2 = res.body.zone;
  assert.strictEqual(zone2.code, 'REC-02');
  console.log('   ✅ تم إنشاء المنطقة الثانية بنجاح: [REC-02] ' + zone2.name);

  // جلب قائمة المناطق (list-zones)
  req = createMockReq({
    query: { action: 'list-zones' },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.zones.length, 2);
  console.log('   ✅ نجح: استرجاع قائمة المناطق بنجاح (العدد: 2).');

  // -----------------------------------------------------------------
  // 2. اختبار ربط العيادات (Services) والكاونترات بالمناطق
  // -----------------------------------------------------------------
  console.log('\n2️⃣ اختبار ربط الخدمات والكاونترات بمنطقة الاستقبال...');

  // إنشاء عيادة باطنية في المنطقة 1
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'create-queue',
      name: 'عيادة الباطنية العامة',
      code: 'INT',
      targetServiceMinutes: 10,
      zoneId: zone1.id
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 201);
  const queueInternal = res.body.queue;
  assert.strictEqual(queueInternal.zone_id, zone1.id);
  console.log('   ✅ تم ربط عيادة الباطنية بالمنطقة [REC-01].');

  // إنشاء عيادة عظام في المنطقة 2
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'create-queue',
      name: 'عيادة جراحة العظام',
      code: 'ORT',
      targetServiceMinutes: 15,
      zoneId: zone2.id
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 201);
  const queueOrtho = res.body.queue;
  assert.strictEqual(queueOrtho.zone_id, zone2.id);
  console.log('   ✅ تم ربط عيادة العظام بالمنطقة [REC-02].');

  // إنشاء كاونتر 101 للمنطقة 1
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'add-counter',
      name: 'كاونتر باطنية 101',
      counterNumber: 101,
      zoneId: zone1.id,
      assignedQueueIds: [queueInternal.id]
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 201);
  const counter101 = res.body.counter;
  assert.strictEqual(counter101.zone_id, zone1.id);

  // إنشاء كاونتر 201 للمنطقة 2
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'add-counter',
      name: 'كاونتر عظام 201',
      counterNumber: 201,
      zoneId: zone2.id,
      assignedQueueIds: [queueOrtho.id]
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 201);
  const counter201 = res.body.counter;
  assert.strictEqual(counter201.zone_id, zone2.id);
  console.log('   ✅ تم تهيئة الكاونترات وتوزيعها على المناطق بدقة.');

  // -----------------------------------------------------------------
  // 3. اختبار تصفية شاشات العرض والـ Scoped Config
  // -----------------------------------------------------------------
  console.log('\n3️⃣ اختبار تصفية شاشة الاستقبال بحسب المنطقة (Display Scoping)...');

  // استعلام شاشة استقبال المنطقة 1 (zoneId = zone1.id أو كود REC-01)
  req = createMockReq({
    query: { action: 'get-config', zone: 'REC-01' },
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.zone, 'يجب إرجاع بيانات المنطقة');
  assert.strictEqual(res.body.zone.code, 'REC-01');
  // التحقق من أن الكاونترات تقتصر على المنطقة 1
  const cIds = res.body.counters.map(c => c.id);
  assert.ok(cIds.includes(counter101.id), 'يجب وجود كاونتر 101 في المنطقة 1');
  assert.ok(!cIds.includes(counter201.id), 'يجب حجب كاونتر 201 الخاص بالمنطقة 2');
  console.log('   ✅ نجح العزل: شاشة [REC-01] تعرض فقط كاونترات وعيادات الباطنية وتحجب بقية المناطق.');

  // -----------------------------------------------------------------
  // 4. اختبار وراثة التذكرة للمنطقة (Zone Inheritance on Ticket Issue)
  // -----------------------------------------------------------------
  console.log('\n4️⃣ اختبار إصدار التذاكر والوراثة التلقائية لـ zone_id...');

  // تذكرة مريض باطنية (المنطقة 1)
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'join-queue',
      queueIds: [queueInternal.id],
      customerName: 'فهد الأحمد',
      customerPhone: '0551112233'
    },
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const ticket1 = res.body.tickets[0];
  assert.strictEqual(ticket1.zone_id, zone1.id, 'يجب أن ترث التذكرة zone_id من قسم الباطنية تلقائياً');
  console.log('   ✅ التذكرة (' + ticket1.ticket_number + ') ورثت تلقائياً المنطقة: ' + zone1.name);

  // تذكرة يدوية عظام (المنطقة 2) عبر الاستقبال
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'manual-ticket',
      queueId: queueOrtho.id,
      customerName: 'سارة خالد'
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const ticket2 = res.body.ticket;
  assert.strictEqual(ticket2.zone_id, zone2.id, 'يجب أن ترث التذكرة اليدوية zone_id من قسم العظام');
  console.log('   ✅ التذكرة اليدوية (' + ticket2.ticket_number + ') ورثت تلقائياً المنطقة: ' + zone2.name);

  // استعلام تذاكر المنطقة 1 فقط عبر list-tickets
  req = createMockReq({
    query: { action: 'list-tickets', zoneId: zone1.id },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const tktIds = res.body.tickets.map(t => t.id);
  assert.ok(tktIds.includes(ticket1.id));
  assert.ok(!tktIds.includes(ticket2.id), 'تذكرة العظام يجب ألا تظهر في قائمة تذاكر الباطنية');
  console.log('   ✅ نجح: تصفية التذاكر بحسب المنطقة (Zone Scoped Tickets).');

  // -----------------------------------------------------------------
  // 5. اختبار عزل قنوات البث اللحظي (Scoped SSE Channels)
  // -----------------------------------------------------------------
  console.log('\n5️⃣ اختبار عزل قنوات البث اللحظي (SSE Channel Isolation)...');

  // اتصال شاشة المنطقة 1
  const sseResZone1 = createMockSseRes();
  const reqSSE1 = createMockReq({
    query: { action: 'events', zoneId: zone1.id },
    tenant: testTenant
  });
  await queueHandler(reqSSE1, sseResZone1);

  // اتصال شاشة المنطقة 2
  const sseResZone2 = createMockSseRes();
  const reqSSE2 = createMockReq({
    query: { action: 'events', zoneId: zone2.id },
    tenant: testTenant
  });
  await queueHandler(reqSSE2, sseResZone2);

  // اتصال هاتف المريض الأول (Session Token)
  const sseResPatient = createMockSseRes();
  const reqSSEPatient = createMockReq({
    query: { action: 'events', sessionToken: ticket1.session_token },
    tenant: testTenant
  });
  await queueHandler(reqSSEPatient, sseResPatient);

  // اتصال المشرف العام (All Channel)
  const sseResAdmin = createMockSseRes();
  const reqSSEAdmin = createMockReq({
    query: { action: 'events' },
    tenant: testTenant
  });
  await queueHandler(reqSSEAdmin, sseResAdmin);

  // استدعاء تذكرة الباطنية (كاونتر 101 يستدعي تذكرة فهد في المنطقة 1)
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'call-next',
      counterId: counter101.id
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);

  // فحص وصول الحدث لقناة المنطقة 1
  const zone1CalledEvent = sseResZone1.events.some(e => e.includes('ticket_called') && e.includes(ticket1.ticket_number));
  assert.ok(zone1CalledEvent, 'شاشة المنطقة 1 يجب أن تستقبل نداء تذكرتها');

  // فحص حجب الحدث عن شاشة المنطقة 2 (العزل الشبكي)
  const zone2CalledEvent = sseResZone2.events.some(e => e.includes('ticket_called') && e.includes(ticket1.ticket_number));
  assert.ok(!zone2CalledEvent, 'شاشة المنطقة 2 يجب ألا تستقبل أحداث المنطقة 1 (Channel Isolation)');

  // فحص وصول الحدث للمشرف العام
  const adminCalledEvent = sseResAdmin.events.some(e => e.includes('ticket_called') && e.includes(ticket1.ticket_number));
  assert.ok(adminCalledEvent, 'المشرف العام يستقبل كافة الأحداث');

  // فحص وصول الحدث لهاتف المريض المعني
  const patientCalledEvent = sseResPatient.events.some(e => e.includes('ticket_called') && e.includes(ticket1.ticket_number));
  assert.ok(patientCalledEvent, 'هاتف المريض يستقبل إشعار ندائه عبر التوكن');
  console.log('   ✅ نجح العزل اللحظي (SSE Scoping): وصلت الرسالة للمنطقة 1 والمريض والمشرف، وحُجبت عن المنطقة 2!');

  // -----------------------------------------------------------------
  // 6. اختبار التحويل بين المناطق وتحديث zone_id وبث الإشعار للمنطقتين
  // -----------------------------------------------------------------
  console.log('\n6️⃣ اختبار التحويل العابر للمناطق (Cross-Zone Ticket Transfer)...');

  // بدء الخدمة أولاً عند كاونتر 101 لتمكين التحويل
  req = createMockReq({
    method: 'POST',
    body: { action: 'start-service', counterId: counter101.id },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);

  // تحويل المريض فهد من عيادة الباطنية (Zone 1) إلى عيادة العظام (Zone 2)
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'transfer-ticket',
      ticketId: ticket1.id,
      counterId: counter101.id,
      toQueueId: queueOrtho.id,
      priorityLevel: 'immediate_next',
      transferNotes: 'فحص باطني سليم، يحال لجراحة العظام'
    },
    headers: staffHeaders,
    tenant: testTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const transferredTicket = res.body.ticket;

  // التحقق من تحديث zone_id التذكرة تلقائياً لمنطقة العظام الجديدة
  assert.strictEqual(transferredTicket.zone_id, zone2.id, 'يجب تحديث zone_id التذكرة للمنطقة الجديدة [REC-02]');
  assert.strictEqual(transferredTicket.queue_id, queueOrtho.id);
  console.log('   ✅ تم تحديث التذكرة: انتقلت ملكيتها فورياً إلى: ' + zone2.name);

  // التحقق من أن شاشة المنطقة 1 (السابقة) وشاشة المنطقة 2 (الجديدة) استقبلتا إشعار التحويل
  const zone1Transferred = sseResZone1.events.some(e => e.includes('ticket_transferred') && e.includes(ticket1.ticket_number));
  const zone2Transferred = sseResZone2.events.some(e => e.includes('ticket_transferred') && e.includes(ticket1.ticket_number));
  assert.ok(zone1Transferred, 'شاشة المنطقة السابقة يجب أن تستقبل التحويل لتفريغ التذكرة من شاشتها');
  assert.ok(zone2Transferred, 'شاشة المنطقة الجديدة يجب أن تستقبل التحويل لإظهار التذكرة فوراً');
  console.log('   ✅ نجح إرسال حدث التحويل لكلتا المنطقتين (oldZoneId & newZoneId) في وقت واحد!');

  // -----------------------------------------------------------------
  // 7. اختبار التوافق العكسي التام (100% Backward Compatibility)
  // -----------------------------------------------------------------
  console.log('\n7️⃣ اختبار التوافق العكسي للمنشآت الفردية غير المحددة لمنطقة...');
  const legacyTenant = 'single_facility_' + Date.now();

  req = createMockReq({
    query: { action: 'list-queues' },
    tenant: legacyTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.queues.length >= 3, 'يجب ظهور كافة الطوابير الافتراضية بدون أي منطقة');

  // حجز تذكرة تقليدية بدون تحديد zone
  req = createMockReq({
    method: 'POST',
    body: {
      action: 'join-queue',
      queueIds: [res.body.queues[0].id],
      customerName: 'عميل عادي'
    },
    tenant: legacyTenant
  });
  res = createMockRes();
  await queueHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.tickets[0].zone_id, null, 'التذكرة التقليدية zone_id لها null بتوافق تام');
  console.log('   ✅ نجح التوافق العكسي التام للمنشآت العادية بدون أي تعديل!');

  console.log('\n====================================================');
  console.log('🎉 اكتملت جميع اختبارات الترقية المعمارية للمناطق المتعددة بنجاح 100%!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ فشل الاختبار المعماري:', err);
  process.exit(1);
});
