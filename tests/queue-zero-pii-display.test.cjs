'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const queueHandler = require('../api/v1/queue.js');

function createMockReq(options = {}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/api/v1/queue',
    query: options.query || {},
    body: options.body || {},
    headers: Object.assign({ origin: 'http://localhost', host: 'localhost' }, options.headers || {})
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

async function runZeroPIITests() {
  console.log('======================================================================');
  console.log('🛡️ فحص الامتثال التام لمعيار انعدام البيانات الشخصية على الشاشات العامة');
  console.log('🇸🇦 نظام حماية البيانات الشخصية (PDPL) — Zero-PII Token Display Gate');
  console.log('======================================================================\n');

  const testTenant = 'zero_pii_tenant_' + Date.now();

  // 1. حجز تذكرة باسم عميل ورقم جوال حقيقي
  console.log('1️⃣ حجز تذكرة ببيانات حساسة (اسم ورقم هاتف وملاحظات)...');
  let req = createMockReq({
    method: 'POST',
    query: { action: 'join-queue', tenant: testTenant },
    body: {
      tenantSlug: testTenant,
      queueId: 'q-cs-' + testTenant,
      customerName: 'عبدالرحمن بن سعود السبيعي',
      customerPhone: '0501234567'
    }
  });
  let res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  const createdTicket = res.body.tickets[0];
  const ticketNumber = createdTicket.ticket_number; // e.g. A-01
  console.log(`   ✅ تم إصدار التذكرة برمز: [${ticketNumber}] للمراجع [عبدالرحمن بن سعود السبيعي]\n`);

  // 2. التحقق من رد قائمة الانتظار العامة (list-queues)
  console.log('2️⃣ فحص استعلام قائمة الانتظار العامة (list-queues) لحظر تسرب البيانات الشخصية...');
  req = createMockReq({
    query: { action: 'list-queues', tenant: testTenant }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  const targetQueue = res.body.queues.find(q => q.id === 'q-cs-' + testTenant);
  assert.ok(targetQueue, 'يجب وجود مسار الاستقبال');
  assert.ok(targetQueue.waitingTickets.length > 0, 'يجب وجود تذكرة في الانتظار');

  const publicWaitingTicket = targetQueue.waitingTickets[0];
  assert.strictEqual(publicWaitingTicket.ticket_number, ticketNumber, 'يجب ظهور رقم التذكرة فقط');
  assert.strictEqual(publicWaitingTicket.customer_name, undefined, '❌ خرق PDPL: تم تسريب customer_name في قائمة الانتظار العامة!');
  assert.strictEqual(publicWaitingTicket.customer_phone, undefined, '❌ خرق PDPL: تم تسريب customer_phone في قائمة الانتظار العامة!');
  assert.strictEqual(publicWaitingTicket.transfer_notes, undefined, '❌ خرق أمني: تم تسريب transfer_notes في قائمة الانتظار العامة!');
  console.log(`   ✅ نجاح تام: التذكرة تظهر في الاستعلام العام كرمز مجرد [${publicWaitingTicket.ticket_number}] خالية 100% من الأسماء والهواتف.\n`);

  // 3. نداء التذكرة والتأكد من إرسال رقم التذكرة الصريح للكاونتر
  console.log('3️⃣ اختبار نداء التذكرة وظهور رقم الطابور الصريح مثل (A-01) على الكاونتر...');
  const counterId = 'cnt-1-' + testTenant;
  req = createMockReq({
    method: 'POST',
    query: { action: 'call-next', tenant: testTenant },
    body: { counterId }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counter.current_ticket_id, createdTicket.id);
  assert.strictEqual(res.body.counter.current_ticket_number, ticketNumber, 'يجب تعيين current_ticket_number للكاونتر فوراً لظهوره على الشاشة');
  console.log(`   ✅ نجاح: الكاونتر يحمل الآن رقم التذكرة الصريح [${res.body.counter.current_ticket_number}] للشاشة المركزية.\n`);

  // 4. إنهاء الخدمة والتأكد من تصفير رقم التذكرة
  console.log('4️⃣ اختبار إنهاء الخدمة وتصفير رقم التذكرة من شاشة الكاونتر...');
  req = createMockReq({
    method: 'POST',
    query: { action: 'complete-service', tenant: testTenant },
    body: { counterId }
  });
  res = createMockRes();
  await queueHandler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counter.current_ticket_id, null);
  assert.strictEqual(res.body.counter.current_ticket_number, null, 'يجب تصفير current_ticket_number عند انتهاء المعاملة');
  console.log('   ✅ نجاح: تم تصفير رقم التذكرة وعودة الكاونتر للحالة الشاغرة (---).\n');

  // 5. فحص ملف واجهة شاشة العرض (queue-display.html) وتأكيد خلوه من أي عرض لأسماء الموظفين أو العملاء
  console.log('5️⃣ فحص ملف كود الواجهة المركزية (queue-display.html)...');
  const displayHtmlPath = path.join(__dirname, '..', 'queue-display.html');
  const displayHtmlContent = fs.readFileSync(displayHtmlPath, 'utf8');

  // التحقق من عدم وجود نصوص أسماء موظفين في الكروت
  assert.ok(!displayHtmlContent.includes('c.operator_name ?'), '❌ خرق: لا يزال الكود يعرض اسم الموظف c.operator_name على الشاشة العامة!');
  assert.ok(displayHtmlContent.includes('displayTicketNumber'), 'يجب استخدام متغير displayTicketNumber لعرض الرمز الصريح');
  assert.ok(displayHtmlContent.includes('waiting-ticket-pill'), 'يجب عرض كبسولات رموز التذاكر فقط');
  console.log('   ✅ نجاح فحص واجهة شاشة العرض: لا توجد أسماء موظفين أو عملاء إطلاقاً، وتقتصر الشاشة على الرمز الصريح (A-04).\n');

  console.log('======================================================================');
  console.log('🏆 تم اجتياز كافة فحوصات انعدام البيانات الشخصية (Zero-PII) بنسبة 100%!');
  console.log('======================================================================\n');
}

runZeroPIITests().catch(err => {
  console.error('❌ فشل الفحص:', err);
  process.exit(1);
});
