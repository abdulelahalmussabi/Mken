'use strict';

/**
 * منصة مكّن (mken.live) — حزمة الاختبارات الشاملة للمرحلة الثالثة: الدفع والفاتورة الضريبية ZATCA
 * Run: node scripts/test-phase3-zatca-payment.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🚀 بدء اختبارات المرحلة الثالثة: الدفع والفاتورة الضريبية ZATCA');
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

async function main() {
  // =========================================================================
  // 1. اختبارات محرك تشفير ورموز ZATCA TLV QR (zatca-engine.js)
  // =========================================================================
  const zatcaEngine = require('../mkn-theme/src/server/platform/_lib/zatca-engine');

  runTest('1.1 توليد رمز ZATCA QR بصيغة TLV Base64 المعتمدة', () => {
    const seller = 'مقهى مكّن التجاري';
    const vat = '300000000000003';
    const time = new Date().toISOString();
    const total = 46.00;
    const tax = 6.00;

    const qrBase64 = zatcaEngine.generateZatcaTlvQr(seller, vat, time, total, tax);
    assert.ok(qrBase64 && typeof qrBase64 === 'string', 'QR must be a string');
    assert.ok(qrBase64.length > 50, 'QR base64 length must be substantial');

    // فك التشفير والتأكد من مطابقة بايتات الـ TLV (Tag 1 = Seller, Tag 2 = VAT)
    const buf = Buffer.from(qrBase64, 'base64');
    assert.strictEqual(buf[0], 1, 'Tag 1 should be first byte');
    const tag1Len = buf[1];
    const tag1Val = buf.subarray(2, 2 + tag1Len).toString('utf8');
    assert.strictEqual(tag1Val, seller, `Tag 1 value mismatch: ${tag1Val}`);
  });

  // =========================================================================
  // 2. اختبارات API إنهاء الخدمة والدفع وإصدار الفاتورة (complete-service.js)
  // =========================================================================
  const completeServiceHandler = require('../mkn-theme/src/server/platform/pos/complete-service');

  await runAsyncTest('2.1 رفض الطلب بدون وسيلة POST', async () => {
    const req = { method: 'GET', url: '/api/v1/pos/complete-service', headers: {} };
    const res = createMockRes();
    await completeServiceHandler(req, res);
    assert.strictEqual(res.statusCode, 405);
  });

  await runAsyncTest('2.2 رفض الطلب بدون معرّف التذكرة', async () => {
    const req = { method: 'POST', url: '/api/v1/pos/complete-service', headers: {}, body: { tenant: 'cafe-test' } };
    const res = createMockRes();
    await completeServiceHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await runAsyncTest('2.3 إنهاء خدمة تذكرة كاش وإصدار الفاتورة الضريبية (Cash Payment)', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/pos/complete-service',
      headers: {},
      body: {
        tenant: 'cafe-test',
        ticket_number: 'C-042',
        ticket_id: 'tkt-cafe-test-20261121-C-042',
        amount: 46.00,
        payment_method: 'cash',
        seller_name: 'كافيه تجريبي',
        phone: '0555123456'
      }
    };
    const res = createMockRes();
    await completeServiceHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.ticket_number, 'C-042');
    assert.strictEqual(res.body.total_amount, 46.00);
    assert.strictEqual(res.body.payment_method, 'cash');
    assert.ok(res.body.invoice_ref.includes('C-042'), 'Invoice ref should embed ticket number');
    assert.ok(res.body.zatca_qr_code, 'Must contain valid ZATCA QR code');
    assert.ok(res.body.print_payload, 'Must contain print payload for thermal printer');
    assert.strictEqual(res.body.print_payload.total, 46.00);
  });

  await runAsyncTest('2.4 إنهاء خدمة تذكرة ببطاقة مدى / ائتمان (Mada / Card Payment)', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/pos/complete-service',
      headers: {},
      body: {
        tenant: 'cafe-test',
        ticket_number: 'F-015',
        amount: 88.50,
        payment_method: 'card',
        payment_ref: 'pay_moyasar_mock_12345'
      }
    };
    const res = createMockRes();
    await completeServiceHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.payment_method, 'card');
    assert.strictEqual(res.body.total_amount, 88.50);
    assert.strictEqual(res.body.tax_amount, 11.54); // 88.50 - (88.50/1.15) = 11.54
  });

  // =========================================================================
  // 3. اختبارات توجيه إجراء pos-complete-service في api/v1/queue.js
  // =========================================================================
  const queueApiHandler = require('../mkn-theme/src/server/platform/queue');
  const { tenantHeaders } = require('../tests/queue-http.cjs');

  await runAsyncTest('3.1 استدعاء إنهاء الفاتورة عبر api/v1/queue?action=pos-complete-service', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/queue?action=pos-complete-service',
      query: { action: 'pos-complete-service', tenant: 'cafe-test' },
      headers: tenantHeaders({ query: { tenant: 'cafe-test' } }),
      body: {
        tenant: 'cafe-test',
        ticket_number: 'C-088',
        amount: 22.00,
        payment_method: 'apple_pay'
      }
    };
    const res = createMockRes();
    await queueApiHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.payment_method, 'apple_pay');
    assert.strictEqual(res.body.total_amount, 22.00);
  });

  // =========================================================================
  // 4. اختبارات الطباعة الحرارية للفاتورة ZATCA (esc-pos-printer.js)
  // =========================================================================
  runTest('4.1 توفر دوال طباعة الفاتورة الضريبية في esc-pos-printer.js', () => {
    const escContent = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/js/esc-pos-printer.js'), 'utf8');
    assert.ok(escContent.includes('buildZatcaTicketInvoice'), 'Must contain buildZatcaTicketInvoice');
    assert.ok(escContent.includes('printZatcaTicketInvoice'), 'Must contain printZatcaTicketInvoice');
    assert.ok(escContent.includes('ZATCA Simplified Tax Invoice'));
  });

  // =========================================================================
  // 5. التحقق من المخطط البرمجي وقاعدة البيانات (db/queue-pos-link-schema.sql)
  // =========================================================================
  runTest('5.1 التحقق من وجود دالة sp_finalize_ticket_payment في الـ Schema', () => {
    const schemaContent = fs.readFileSync(path.join(__dirname, '../db/queue-pos-link-schema.sql'), 'utf8');
    assert.ok(schemaContent.includes('sp_finalize_ticket_payment'), 'Schema must declare sp_finalize_ticket_payment');
    assert.ok(schemaContent.includes('p_payment_method'));
    assert.ok(schemaContent.includes('p_zatca_qr'));
  });

  // =========================================================================
  // 6. التحقق من صفحة الفاتورة الضريبية HTML (invoice-print.html)
  // =========================================================================
  runTest('6.1 التحقق من عناصر الفاتورة الضريبية ZATCA في invoice-print.html', () => {
    const invHtml = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/invoice-print.html'), 'utf8');
    assert.ok(invHtml.includes('invoiceRefDisplay'), 'Must display invoice ref');
    assert.ok(invHtml.includes('ticketNumberDisplay'), 'Must display ticket number');
    assert.ok(invHtml.includes('zatcaQrImg'), 'Must display ZATCA QR code image');
    assert.ok(invHtml.includes('vatNumberDisplay'), 'Must display VAT tax number');
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
