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
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
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
}

function assertNoUndefinedToken(payload) {
  const blob = JSON.stringify(payload);
  assert.ok(!blob.includes('undefined'), 'الاستجابة لا يجوز أن تحتوي على النص undefined');
  assert.ok(!blob.includes('"null"'), 'الاسم أو الجوال لا يُخزَّنان كنص null');
}

async function join(tenant, body, extra) {
  const req = createMockReq(Object.assign({
    method: 'POST',
    query: { action: 'join-queue', tenant: tenant },
    body: body
  }, extra || {}));
  const res = createMockRes();
  await queueHandler(req, res);
  return res;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 الاسم والجوال اختياريان عند الانضمام للطابور');
  console.log('====================================================\n');

  const tenant = 'optid' + Date.now();
  const queueId = 'q-cs-' + tenant;

  console.log('1️⃣ انضمام بدون اسم وبدون جوال...');
  let res = await join(tenant, { queueIds: [queueId] });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.tickets.length, 1);
  assert.strictEqual(res.body.tickets[0].customer_name, '');
  assert.strictEqual(res.body.tickets[0].customer_phone, '');
  assert.ok(res.body.tickets[0].ticket_number);
  assertNoUndefinedToken(res.body);
  const bareTicketId = res.body.tickets[0].id;
  const bareNumber = res.body.tickets[0].ticket_number;
  console.log('   ✅ تذكرة ' + bareNumber + ' بلا اسم ولا جوال.\n');

  console.log('2️⃣ حقول فارغة أو مسافات أو null لا تُرفض...');
  res = await join(tenant, {
    queueIds: [queueId],
    customerName: '   ',
    customerPhone: ''
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.tickets[0].customer_name, '');
  assert.strictEqual(res.body.tickets[0].customer_phone, '');

  res = await join(tenant, {
    queueIds: [queueId],
    customerName: null,
    customerPhone: null
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.tickets[0].customer_name, '');
  assert.strictEqual(res.body.tickets[0].customer_phone, '');
  console.log('   ✅ القيم الفارغة مقبولة.\n');

  console.log('3️⃣ جوال مُدخَل يُطبَّع كما كان (أرقام فقط) والاسم يُحفظ...');
  res = await join(tenant, {
    queueIds: [queueId],
    customerName: ' نورة ',
    customerPhone: '05-5555-5555'
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.tickets[0].customer_name, 'نورة');
  assert.strictEqual(res.body.tickets[0].customer_phone, '0555555555');
  console.log('   ✅ الاسم مقصوص والجوال 0555555555.\n');

  console.log('4️⃣ نص بلا أرقام في الجوال لا يوقف الإصدار...');
  res = await join(tenant, {
    queueIds: [queueId],
    customerPhone: '---'
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.tickets[0].customer_name, '');
  assert.strictEqual(res.body.tickets[0].customer_phone, '');
  console.log('   ✅ لم يُرجع خطأ تحقق.\n');

  console.log('5️⃣ موظف يرى الاسم الفارغ كنص فارغ وليس undefined...');
  const staffReq = createMockReq({
    query: { action: 'get-ticket-status', tenant: tenant, ticket_id: bareTicketId }
  });
  const staffRes = createMockRes();
  await queueHandler(staffReq, staffRes);
  assert.strictEqual(staffRes.statusCode, 200);
  assert.strictEqual(staffRes.body.tickets[0].ticket_number, bareNumber);
  assert.strictEqual(staffRes.body.tickets[0].customer_name, '');
  assert.strictEqual(staffRes.body.tickets[0].customer_phone, '');
  assertNoUndefinedToken(staffRes.body);
  console.log('   ✅ شاشة الموظف ترى رقم التذكرة فقط.\n');

  console.log('6️⃣ تذكرة الاستقبال اليدوية تقبل الاسم والجوال الفارغين...');
  const manualReq = createMockReq({
    method: 'POST',
    query: { action: 'manual-ticket', tenant: tenant },
    body: { queueId: queueId, customerName: '', customerPhone: '' }
  });
  const manualRes = createMockRes();
  await queueHandler(manualReq, manualRes);
  assert.strictEqual(manualRes.statusCode, 200);
  assert.strictEqual(manualRes.body.ticket.customer_name, '');
  assert.strictEqual(manualRes.body.ticket.customer_phone, '');
  assert.ok(manualRes.body.ticket.ticket_number);
  assertNoUndefinedToken(manualRes.body);
  console.log('   ✅ التذكرة اليدوية صدرت بلا اسم.\n');

  console.log('7️⃣ نماذج الواجهة: الحقول اختيارية، وعبارة المسافة محذوفة من شاشة العرض...');
  const queueHtml = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'queue.html'), 'utf8');
  const nameInput = queueHtml.slice(queueHtml.indexOf('id="customerNameInput"'), queueHtml.indexOf('id="customerNameInput"') + 180);
  const phoneInput = queueHtml.slice(queueHtml.indexOf('id="customerPhoneInput"'), queueHtml.indexOf('id="customerPhoneInput"') + 220);
  assert.ok(queueHtml.includes('الاسم الكريم (اختياري)'));
  assert.ok(queueHtml.includes('رقم الجوال (واتساب للتنبيهات) (اختياري)'));
  assert.ok(!nameInput.includes('required'));
  assert.ok(!phoneInput.includes('required'));

  const clientJs = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'js', 'queue-client.js'), 'utf8');
  assert.ok(!clientJs.includes('يرجى إدخال الاسم ورقم الجوال'));

  const displayHtml = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'queue-display.html'), 'utf8');
  assert.ok(!displayHtml.includes('مسح فوري'));
  assert.ok(!displayHtml.includes('5 أمتار'));
  assert.ok(!displayHtml.includes('مسافة'));
  assert.ok(displayHtml.includes('id="qrDisplayImg"'));
  assert.ok(displayHtml.includes('300x300'));

  const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'admin.html'), 'utf8');
  const manualName = adminHtml.slice(adminHtml.indexOf('id="manualCustomerNameInput"'), adminHtml.indexOf('id="manualCustomerNameInput"') + 160);
  assert.ok(adminHtml.includes('اسم المراجع / العميل (اختياري)'));
  assert.ok(adminHtml.includes('رقم الجوال (اختياري)'));
  assert.ok(!manualName.includes('required'));

  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'mkn-theme', 'public', 'js', 'admin-queue.js'), 'utf8');
  assert.ok(adminJs.includes('function cleanCustomerName'));
  assert.ok(!adminJs.includes('textContent = ticket.customer_name'));
  console.log('   ✅ النماذج وشاشة العرض محدّثة.\n');

  console.log('======================================================================');
  console.log('🏆 الاسم والجوال اختياريان، وعبارة المسح من 5 أمتار غير موجودة.');
  console.log('======================================================================\n');
}

runTests().catch(function (err) {
  console.error('❌ فشل الفحص:', err);
  process.exit(1);
});
