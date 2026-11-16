'use strict';

const assert = require('assert');
const queueHandler = require('../api/_lib/handlers/queue.js');

function mockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {}
  };

  let statusCode = 200;
  let responseData = null;
  let headersSent = {};

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, val) {
      headersSent[key] = val;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    write(data) {
      return this;
    },
    flushHeaders() {},
    on(event, cb) {}
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🧪 حزمة اختبارات التدخل البشري السريع ومكافحة ارتداد الحالة (Manual Override & Anti-Snapback)');
  console.log('================================================================');

  const tenant = 'test_override_' + Date.now();

  // 1. اختبار زيادة السعة (+10)
  await runTest('1. إجراء زيادة السعة (ADD_CAPACITY) وزيادة الإصدار التصاعدي', async () => {
    const { req, res, getStatus, getData } = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'ADD_CAPACITY',
        delta_value: 10,
        reason: 'ضغط استثنائي في الصالة',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-cap-001'
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.override.capacity_override_delta, 10);
    assert.ok(data.revision >= 2);
    assert.strictEqual(data.audit_log.action_type, 'ADD_CAPACITY');
    assert.strictEqual(data.audit_log.performed_by_name, 'أبو فهد المشرف');
  });

  // 2. اختبار عدم التكرار (Idempotency Protection)
  await runTest('2. حماية النقر المزدوج ومنع تكرار الإجراء (Idempotency Guarantee)', async () => {
    const { req, res, getStatus, getData } = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'ADD_CAPACITY',
        delta_value: 10,
        reason: 'ضغط استثنائي في الصالة',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-cap-001' // نفس المفتاح السابق!
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.idempotent_replay, true);
    // السعة يجب ألا تتضاعف إلى 20!
    assert.strictEqual(data.override.capacity_override_delta, 10);
  });

  // 3. اختبار تمديد الوقت (+30 دقيقة)
  await runTest('3. تمديد وردية العمل (EXTEND_TIME)', async () => {
    const { req, res, getStatus, getData } = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'EXTEND_TIME',
        delta_value: 30,
        reason: 'إنهاء المعاملات المتبقية في الصالة',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-time-002'
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.override.extended_closing_minutes, 30);
  });

  // 4. اختبار الإيقاف المؤقت (15 دقيقة) وتأثيره على إصدار التذاكر
  await runTest('4. تعليق إصدار التذاكر مؤقتاً (PAUSE_QUEUE) ورفض الـ QR الجديد مع حفظ حقوق الانتظار', async () => {
    const pauseReq = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'PAUSE_QUEUE',
        delta_value: 15,
        reason: 'اجتماع تنسيقي عاجل 15 دقيقة',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-pause-003'
      }
    });
    await queueHandler(pauseReq.req, pauseReq.res);
    assert.strictEqual(pauseReq.getStatus(), 200);

    // محاولة عميل مسح QR وحجز تذكرة أثناء الإيقاف
    const joinReq = mockReqRes({
      query: { action: 'join-queue', tenant },
      body: {
        queueId: 'q-cs-' + tenant,
        customerName: 'سعد العتيبي',
        customerPhone: '0555555555'
      }
    });
    await queueHandler(joinReq.req, joinReq.res);
    assert.strictEqual(joinReq.getStatus(), 423); // 423 Locked
    const joinData = joinReq.getData();
    assert.strictEqual(joinData.is_paused, true);
    assert.ok(joinData.error.includes('مؤقتاً'));
  });

  // 5. اختبار القفل الإجباري لليوم (FORCE_LOCK)
  await runTest('5. القفل الإجباري لليوم (FORCE_LOCK) وتوثيق السبب في سجل الـ NCA', async () => {
    const lockReq = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'FORCE_LOCK',
        reason: 'انتهاء الطاقة الاستيعابية القصوى المسموحة نظامياً',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-lock-004'
      }
    });
    await queueHandler(lockReq.req, lockReq.res);
    assert.strictEqual(lockReq.getStatus(), 200);
    const lockData = lockReq.getData();
    assert.strictEqual(lockData.override.is_force_locked_today, true);

    // محاولة حجز جديدة
    const joinReq = mockReqRes({
      query: { action: 'join-queue', tenant },
      body: {
        queueId: 'q-cs-' + tenant,
        customerName: 'فهد الدوسري',
        customerPhone: '0544444444'
      }
    });
    await queueHandler(joinReq.req, joinReq.res);
    assert.strictEqual(joinReq.getStatus(), 423);
    const joinData = joinReq.getData();
    assert.strictEqual(joinData.is_locked, true);
    assert.ok(joinData.error.includes('إغلاق استقبال التذاكر'));
  });

  // 6. اختبار استئناف التشغيل (RESUME_OR_UNLOCK)
  await runTest('6. فك القفل واستئناف العمل الفوري (RESUME_OR_UNLOCK)', async () => {
    const resumeReq = mockReqRes({
      query: { action: 'manual-override', tenant },
      body: {
        action_type: 'RESUME_OR_UNLOCK',
        reason: 'إعادة فتح الصالة واستئناف الاستقبال',
        user_id: 'usr-admin-1',
        user_name: 'أبو فهد المشرف',
        idempotency_key: 'idemp-resume-005'
      }
    });
    await queueHandler(resumeReq.req, resumeReq.res);
    assert.strictEqual(resumeReq.getStatus(), 200);
    const resumeData = resumeReq.getData();
    assert.strictEqual(resumeData.override.is_force_locked_today, false);
    assert.strictEqual(resumeData.override.paused_until, null);

    // التحقق من إمكانية حجز تذكرة الآن
    const joinReq = mockReqRes({
      query: { action: 'join-queue', tenant },
      body: {
        queueId: 'q-cs-' + tenant,
        customerName: 'فهد الدوسري',
        customerPhone: '0544444444'
      }
    });
    await queueHandler(joinReq.req, joinReq.res);
    assert.strictEqual(joinReq.getStatus(), 200);
    const joinData = joinReq.getData();
    assert.ok(joinData.tickets && joinData.tickets.length > 0);
  });

  // 7. اختبار جلب الحالة وقراءة سجل التدقيق الأمني (Audit Trail)
  await runTest('7. استعلام حالة التدخل البشري وسجل التدقيق للامتثال السيبراني (NCA Audit)', async () => {
    const getReq = mockReqRes({
      query: { action: 'get-override-state', tenant },
      method: 'GET'
    });
    await queueHandler(getReq.req, getReq.res);
    assert.strictEqual(getReq.getStatus(), 200);
    const data = getReq.getData();
    assert.ok(data.revision >= 5);
    assert.ok(Array.isArray(data.recent_audit_logs));
    assert.strictEqual(data.recent_audit_logs.length, 5);
    assert.strictEqual(data.recent_audit_logs[0].action_type, 'ADD_CAPACITY');
    assert.strictEqual(data.recent_audit_logs[4].action_type, 'RESUME_OR_UNLOCK');
  });

  // 8. اختبار تضمين الـ Override والإصدار في list-queues
  await runTest('8. تضمين الحالة ورقم الإصدار التصاعدي في استعلام الطوابير (list-queues)', async () => {
    const listReq = mockReqRes({
      query: { action: 'list-queues', tenant },
      method: 'GET'
    });
    await queueHandler(listReq.req, listReq.res);
    assert.strictEqual(listReq.getStatus(), 200);
    const data = listReq.getData();
    assert.ok(data.override);
    assert.ok(data.state_revision >= 5);
  });

  console.log('================================================================');
  console.log('🎉 جميع اختبارات التدخل البشري والامتثال ومكافحة الارتداد اجتازت بنجاح 100%!');
  console.log('================================================================');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
