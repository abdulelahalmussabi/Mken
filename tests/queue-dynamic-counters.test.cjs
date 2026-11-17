'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const { tenantHeaders } = require('./queue-http.cjs');

function createMockReq(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: tenantHeaders(options)
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

async function runDynamicCountersTests() {
  console.log('======================================================================');
  console.log('🧪 فحص إدارة وتحرير عدد وأسماء الكاونترات والباركود العملاق (E2.2)');
  console.log('🇸🇦 معايير المرونة التشغيلية وضمان وضوح الرؤية البصرية في الصالات');
  console.log('======================================================================\n');

  const testTenant = 'dynamic_cnt_' + Date.now();

  // 1. اختبار جلب التكوين الافتراضي للكاونترات
  console.log('1️⃣ جلب التكوين المبدئي والتأكد من عدد الكاونترات الافتراضي...');
  let req = createMockReq({ query: { action: 'get-config', tenant: testTenant } });
  let res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.counters));
  const initialCount = res.body.counters.length;
  console.log(`   ✅ نجاح: عدد الكاونترات المبدئي: ${initialCount} كاونترات.\n`);

  // 2. اختبار إضافة كاونتر جديد ديناميكياً (Add Counter)
  console.log('2️⃣ اختبار إضافة كاونتر جديد بمسمى مخصص ومسارات مخصصة...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'add-counter', tenant: testTenant },
    body: {
      tenantSlug: testTenant,
      name: 'كاونتر الرعاية الخاصة وخدمة كبار السن',
      counterNumber: 5,
      assignedQueueIds: ['q-cs-' + testTenant]
    }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 201, 'يجب إعادة كود 201 Created');
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.counter.name, 'كاونتر الرعاية الخاصة وخدمة كبار السن');
  assert.strictEqual(res.body.counter.counter_number, 5);
  const newCounterId = res.body.counter.id;
  assert.strictEqual(res.body.counters.length, initialCount + 1, 'يجب زيادة عدد الكاونترات بواحد');
  console.log(`   ✅ نجاح الإضافة: تم إنشاء [${res.body.counter.name}] بالرقم [5] والمعرّف [${newCounterId}].\n`);

  // 3. اختبار تحرير اسم الكاونتر وتعديل إعداداته (Update Counter Name)
  console.log('3️⃣ اختبار تحرير اسم الكاونتر وتخصيصه لعيادة أو قسم محدد...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'update-counter', tenant: testTenant },
    body: {
      counterId: newCounterId,
      name: 'شباك العقود والتوثيق الفوري (VIP)'
    }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.counter.name, 'شباك العقود والتوثيق الفوري (VIP)');
  console.log(`   ✅ نجاح التحرير: تم تعديل مسمى الكاونتر فورياً إلى: [${res.body.counter.name}].\n`);

  // 4. اختبار حماية الكاونتر من الحذف أثناء وجود مراجع قيد الخدمة
  console.log('4️⃣ اختبار حظر حذف الكاونتر أثناء وجود تذكرة مستدعاة أو قيد الخدمة...');
  // محاكاة وضع تذكرة على الكاونتر
  queueHandler._memory.counters[testTenant].find(function (c) { return c.id === newCounterId; }).current_ticket_id = 'tkt_mock_active';
  req = createMockReq({
    method: 'POST',
    query: { action: 'delete-counter', tenant: testTenant },
    body: { counterId: newCounterId }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 400, 'يجب رفض الحذف بكود 400 لحماية المعاملة النشطة');
  console.log('   ✅ نجاح الحماية الأمنية: تم منع حذف الكاونتر لأن عليه مراجع قيد الخدمة.\n');

  // 5. تحرير الكاونتر وحذفه بنجاح (Delete Counter)
  console.log('5️⃣ اختبار حذف الكاونتر بعد خلوه وتحديث السعة...');
  // تصفير التذكرة الوهمية
  let cfgReq = createMockReq({ query: { action: 'get-config', tenant: testTenant } });
  let cfgRes = createMockRes();
  await queueHandler(cfgReq, cfgRes);
  const targetCnt = queueHandler._memory.counters[testTenant].find(c => c.id === newCounterId);
  targetCnt.current_ticket_id = null;

  req = createMockReq({
    method: 'POST',
    query: { action: 'delete-counter', tenant: testTenant },
    body: { counterId: newCounterId }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.counters.length, initialCount, 'يجب أن يعود عدد الكاونترات للعدد الأصلي');
  console.log(`   ✅ نجاح الحذف: تم حذف الكاونتر وعاد الإجمالي إلى [${res.body.counters.length}] كاونترات.\n`);

  // 6. فحص معايير وضوح الباركود في queue-display.html
  console.log('6️⃣ فحص كود شاشة العرض للتأكد من وجود الباركود العملاق عالي التباين...');
  const displayHtml = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'queue-display.html'), 'utf8');
  assert.ok(displayHtml.includes('qr-scanner-frame'), 'يجب تضمين إطار المسح qr-scanner-frame');
  assert.ok(displayHtml.includes('250px'), 'يجب أن يكون حجم إطار الباركود 250px على الأقل للمسح من 5 أمتار');
  assert.ok(displayHtml.includes('300x300'), 'يجب طلب حجم الباركود بدقة 300x300 بدلاً من الحجم المجهري');
  assert.ok(displayHtml.includes('config_updated'), 'يجب الاستماع لحدث config_updated لتحديث الكاونترات اللحظي');
  console.log('   ✅ نجاح فحص واجهة العرض: الباركود مخصص بحجم عملاق 250×250px مع استجابة لحظية لأي تعديل في الكاونترات.\n');

  console.log('======================================================================');
  console.log('🎉 تم اجتياز كافة اختبارات إدارة الكاونترات والباركود بنجاح 100%!');
  console.log('======================================================================\n');
}

runDynamicCountersTests().catch(err => {
  console.error('❌ خطأ في فحص الاختبارات:', err);
  process.exit(1);
});
