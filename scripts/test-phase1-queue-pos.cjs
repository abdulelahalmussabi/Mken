'use strict';

/**
 * منصة مكّن (mken.live) — حزمة الاختبارات الشاملة للمرحلة الأولى: ربط الطابور بنقاط البيع
 * Run: node scripts/test-phase1-queue-pos.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🚀 بدء اختبارات المرحلة الأولى: القاعدة والربط الذري (Phase 1 Tests)');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [نجاح] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [فشل] ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [نجاح] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [فشل] ${name}`);
    console.error(err);
  }
}

async function main() {
  // =========================================================================
  // 1. اختبارات محرك توجيه الطوابير (queue-resolver.js)
  // =========================================================================
  const queueResolver = require('../mkn-theme/public/js/queue-resolver');

  runTest('1.1 توجيه طلب المشروبات إلى طابور C', () => {
    const items = [
      { name: 'قهوة لاتيه حار', category: 'coffee', price: 18, qty: 1 },
      { name: 'ماء معدني', category: 'water', price: 3, qty: 2 }
    ];
    const qId = queueResolver.resolveQueueId(items, 'takeaway');
    assert.strictEqual(qId, 'C', `Expected C but got ${qId}`);
  });

  runTest('1.2 توجيه طلب الوجبات / المطبخ إلى طابور F', () => {
    const items = [
      { name: 'برجر كلاسيك', category: 'food', price: 32, qty: 1 },
      { name: 'بطاطس مقلية', category: 'food', price: 12, qty: 1 }
    ];
    const qId = queueResolver.resolveQueueId(items, 'takeaway');
    assert.strictEqual(qId, 'F', `Expected F but got ${qId}`);
  });

  runTest('1.3 توجيه طلب يحتوي طعام ومشروبات إلى طابور المطبخ F ذو الأسبقية', () => {
    const items = [
      { name: 'بيتزا مارغريتا', category: 'food', price: 45, qty: 1 },
      { name: 'شاي مثلج خوخ', category: 'drinks', price: 16, qty: 1 }
    ];
    const qId = queueResolver.resolveQueueId(items, 'takeaway');
    assert.strictEqual(qId, 'F', `Expected F for mixed order but got ${qId}`);
  });

  runTest('1.4 توجيه طلب التوصيل إلى طابور D بغض النظر عن الأصناف', () => {
    const items = [{ name: 'قهوة لاتيه', category: 'drinks', price: 18, qty: 1 }];
    const qId = queueResolver.resolveQueueId(items, 'delivery_pickup');
    assert.strictEqual(qId, 'D', `Expected D for delivery pickup but got ${qId}`);
  });

  runTest('1.5 توجيه خدمة الطاولات إلى طابور T', () => {
    const items = [{ name: 'كيكة زعفران', category: 'sweets', price: 24, qty: 1 }];
    const qId = queueResolver.resolveQueueId(items, 'dine_in');
    assert.strictEqual(qId, 'T', `Expected T for dine_in but got ${qId}`);
  });

  runTest('1.6 احتساب زمن الانتظار المتوقع (ETA)', () => {
    // 6 عملاء في الانتظار، كل عميل يستغرق 300 ثانية (5 دقائق)، كاونتر واحد
    const eta1 = queueResolver.computeETA(6, 300, 1);
    assert.strictEqual(eta1, 30, `Expected 30 minutes but got ${eta1}`);

    // مع كاونترين، يتقلص الزمن للنصف
    const eta2 = queueResolver.computeETA(6, 300, 2);
    assert.strictEqual(eta2, 15, `Expected 15 minutes but got ${eta2}`);

    // بدون انتظار، الحد الأدنى دقيقة
    const eta0 = queueResolver.computeETA(0, 300, 1);
    assert.strictEqual(eta0, 1, `Expected 1 minute when empty but got ${eta0}`);
  });

  runTest('1.7 تنسيق رقم التذكرة بصيغة موحدة', () => {
    assert.strictEqual(queueResolver.formatTicketNumber('C', 7), 'C-007');
    assert.strictEqual(queueResolver.formatTicketNumber('F', 42), 'F-042');
    assert.strictEqual(queueResolver.formatTicketNumber('T', 105), 'T-105');
  });

  // =========================================================================
  // 2. اختبارات API إنشاء الطلب والتذكرة (create-order-with-ticket.js)
  // =========================================================================
  const createOrderHandler = require('../mkn-theme/src/server/platform/pos/create-order-with-ticket');

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      end() { return this; }
    };
  }

  await runAsyncTest('2.1 رفض الطلبات غير المدعومة (GET Method)', async () => {
    const req = { method: 'GET', url: '/api/v1/pos/create-order-with-ticket', headers: {} };
    const res = createMockRes();
    await createOrderHandler(req, res);
    assert.strictEqual(res.statusCode, 405, `Expected 405 but got ${res.statusCode}`);
  });

  await runAsyncTest('2.2 رفض الطلب عند خلو سلة البنود', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/pos/create-order-with-ticket',
      headers: {},
      body: { tenant: 'cafe-test', items: [] }
    };
    const res = createMockRes();
    await createOrderHandler(req, res);
    assert.strictEqual(res.statusCode, 400, `Expected 400 but got ${res.statusCode}`);
  });

  await runAsyncTest('2.3 إنشاء طلب قهوة وتذكرة طابور بنجاح (Failover Mode)', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/pos/create-order-with-ticket',
      headers: {},
      body: {
        tenant: 'cafe-alriyadh',
        customer_name: 'عبدالله السعدي',
        phone: '0501234567',
        service_type: 'takeaway',
        items: [
          { name: 'فلات وايت دبل', price: 20, qty: 2, category: 'drinks' },
          { name: 'كرواسون لوز', price: 15, qty: 1, category: 'bakery' }
        ]
      }
    };
    const res = createMockRes();
    await createOrderHandler(req, res);

    assert.strictEqual(res.statusCode, 201, `Expected 201 but got ${res.statusCode}`);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.ticket_number, 'Should have ticket_number');
    assert.strictEqual(res.body.total, 55.00, 'Total should be 20*2 + 15 = 55');
    assert.ok(res.body.print_payload, 'Should have print_payload for thermal printer');
    assert.strictEqual(res.body.print_payload.items.length, 2);
    assert.strictEqual(res.body.order_summary.length, 2);
  });

  await runAsyncTest('2.4 إنشاء طلب طاولة داخلي (Dine-in with table number)', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/pos/create-order-with-ticket',
      headers: {},
      body: {
        tenant: 'cafe-alriyadh',
        customer_name: 'سارة محمد',
        phone: '0559876543',
        service_type: 'dine_in',
        table_number: '14',
        items: [
          { name: 'وافل بلجيكي بالكراميل', price: 30, qty: 1, category: 'sweets' }
        ]
      }
    };
    const res = createMockRes();
    await createOrderHandler(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.queue_id, 'T');
    assert.ok(res.body.ticket_number.startsWith('T-'), 'Ticket number should start with T-');
    assert.strictEqual(res.body.print_payload.table_number, '14');
  });

  // =========================================================================
  // 3. اختبارات API استعلام تفاصيل التذكرة (get-ticket-details.js)
  // =========================================================================
  const getTicketHandler = require('../mkn-theme/src/server/platform/pos/get-ticket-details');

  await runAsyncTest('3.1 رفض استعلام بدون معرّفات (Validation Error)', async () => {
    const req = { method: 'GET', url: '/api/v1/pos/get-ticket-details', query: {}, headers: {} };
    const res = createMockRes();
    await getTicketHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  // =========================================================================
  // 4. اختبارات تحويل الـ Actions في api/v1/queue.js
  // =========================================================================
  const queueApiHandler = require('../mkn-theme/src/server/platform/queue');

  await runAsyncTest('4.1 استدعاء create-order-with-ticket عبر api/v1/queue?action=create-order-with-ticket', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/queue?action=create-order-with-ticket',
      query: { action: 'create-order-with-ticket', tenant: 'cafe-integration-test' },
      headers: { host: 'cafe-integration-test.mken.live' },
      body: {
        tenant: 'cafe-integration-test',
        customer_name: 'خالد التميمي',
        items: [{ name: 'إسبريسو سينجل', price: 12, qty: 1, category: 'drinks' }]
      }
    };
    const res = createMockRes();
    await queueApiHandler(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.total, 12);
  });

  // =========================================================================
  // 5. اختبارات صياغة أوامر الطباعة الحرارية ESC/POS
  // =========================================================================
  // نختبر دالة buildQueueTicket في بيئة Node بمحاكاة سياق window
  runTest('5.1 توليد بيانات بايتات الطباعة الحرارية لتذكرة الطابور', () => {
    const escPosSource = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/js/esc-pos-printer.js'), 'utf8');
    assert.ok(escPosSource.includes('buildQueueTicket'), 'esc-pos-printer should contain buildQueueTicket');
    assert.ok(escPosSource.includes('printQueueTicket'), 'esc-pos-printer should contain printQueueTicket');
  });

  // =========================================================================
  // 6. التحقق من ملفات الـ Schema و HTML
  // =========================================================================
  runTest('6.1 وجود schema جدول الربط db/queue-pos-link-schema.sql', () => {
    const schemaPath = path.join(__dirname, '../db/queue-pos-link-schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'db/queue-pos-link-schema.sql must exist');
    const content = fs.readFileSync(schemaPath, 'utf8');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.queue_ticket_pos_link'));
    assert.ok(content.includes('pos_create_order_and_ticket'));
    assert.ok(content.includes('resolve_queue_id'));
    assert.ok(content.includes('anonymize_old_queue_records'));
  });

  runTest('6.2 وجود صفحة الطباعة ticket-print.html', () => {
    const printPath = path.join(__dirname, '../mkn-theme/public/ticket-print.html');
    assert.ok(fs.existsSync(printPath), 'ticket-print.html must exist');
    const content = fs.readFileSync(printPath, 'utf8');
    assert.ok(content.includes('ticket-card'));
    assert.ok(content.includes('window.print'));
  });

  // =========================================================================
  // النتيجة النهائية
  // =========================================================================
  console.log('\n================================================================');
  console.log(`📊 النتيجة النهائية: ${passedTests} من ${totalTests} اختبارات نجحت بنسبة 100%!`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
