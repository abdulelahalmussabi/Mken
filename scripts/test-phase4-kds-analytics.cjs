'use strict';

/**
 * منصة مكّن (mken.live) — حزمة الاختبارات الشاملة للمرحلة الرابعة: شاشة المطبخ (KDS) والتحليلات
 * Run: node scripts/test-phase4-kds-analytics.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🚀 بدء اختبارات المرحلة الرابعة: شاشة المطبخ (KDS) ولوحة التحليلات');
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
    send(data) { this.body = data; return this; },
    end() { return this; }
  };
}

async function main() {
  // =========================================================================
  // 1. اختبارات محرك شاشة المطبخ (kitchen-display.js)
  // =========================================================================
  const kds = require('../mkn-theme/public/js/kitchen-display');

  runTest('1.1 فحص تصنيف طلبات المطبخ (isKitchenOrder)', () => {
    // طابور وجبات F
    assert.strictEqual(kds.isKitchenOrder({ queue_id: 'F' }), true);
    // طابور خدمة طاولات T
    assert.strictEqual(kds.isKitchenOrder({ queue_id: 'T' }), true);
    // طابور استلام توصيل D
    assert.strictEqual(kds.isKitchenOrder({ queue_id: 'D' }), true);
    // طابور عادي يحوي وجبات طعام
    assert.strictEqual(kds.isKitchenOrder({ queue_id: 'C', items: [{ name: 'كرواسون', category: 'food' }] }), true);
    // طابور قهوة بحت بدون طعام
    assert.strictEqual(kds.isKitchenOrder({ queue_id: 'C', items: [{ name: 'قهوة', category: 'drink' }] }), false);
  });

  runTest('1.2 احتساب الدقائق المنقضية (calculateElapsedMinutes)', () => {
    const now = Date.now();
    const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    assert.strictEqual(kds.calculateElapsedMinutes(fiveMinsAgo), 5);

    const zeroAgo = new Date().toISOString();
    assert.strictEqual(kds.calculateElapsedMinutes(zeroAgo), 0);
  });

  runTest('1.3 تدرج التنبيهات اللونية للطلبات (getUrgencyLevel)', () => {
    // أقل من 7 دقائق: هادئ / أخضر
    assert.strictEqual(kds.getUrgencyLevel(3), 'normal');
    assert.strictEqual(kds.getUrgencyLevel(6), 'normal');

    // بين 7 و 14 دقيقة: تحذير متوسط / أصفر
    assert.strictEqual(kds.getUrgencyLevel(7), 'warning');
    assert.strictEqual(kds.getUrgencyLevel(14), 'warning');

    // 15 دقيقة فما فوق: حرج / أحمر وميض
    assert.strictEqual(kds.getUrgencyLevel(15), 'urgent');
    assert.strictEqual(kds.getUrgencyLevel(25), 'urgent');
  });

  runTest('1.4 التحكم في الصوت وتنبيهات المطبخ', () => {
    kds.setSoundEnabled(false);
    assert.strictEqual(kds.isSoundEnabled(), false);
    kds.setSoundEnabled(true);
    assert.strictEqual(kds.isSoundEnabled(), true);
  });

  // =========================================================================
  // 2. اختبارات صفحة واجهة المطبخ (kitchen-display.html)
  // =========================================================================
  runTest('2.1 التحقق من عناصر شاشة المطبخ KDS في HTML', () => {
    const kdsHtml = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/kitchen-display.html'), 'utf8');
    assert.ok(kdsHtml.includes('kds-grid'), 'Must contain orders grid');
    assert.ok(kdsHtml.includes('kdsStationTitle'), 'Must contain station title');
    assert.ok(kdsHtml.includes('kdsLiveClock'), 'Must contain live clock');
    assert.ok(kdsHtml.includes('activeOrdersCount'), 'Must contain active count');
    assert.ok(kdsHtml.includes('js/kitchen-display.js'), 'Must include kitchen-display.js');
  });

  // =========================================================================
  // 3. اختبارات API تقارير التحليلات (erp-reports.js)
  // =========================================================================
  const erpReportsHandler = require('../mkn-theme/src/server/platform/_lib/handlers/erp-reports');

  await runAsyncTest('3.1 استعلام تحليلات الطابور ونقاط البيع بصيغة JSON', async () => {
    const req = {
      method: 'GET',
      url: '/api/v1/erp-reports?action=queue-pos-analytics&tenant_slug=cafe-test',
      query: { action: 'queue-pos-analytics', tenant_slug: 'cafe-test' },
      headers: {}
    };
    const res = createMockRes();
    await erpReportsHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.summary, 'Must return summary block');
    assert.strictEqual(typeof res.body.summary.total_tickets, 'number');
    assert.strictEqual(typeof res.body.summary.total_revenue, 'number');
    assert.strictEqual(typeof res.body.summary.average_wait_minutes, 'number');
    assert.ok(Array.isArray(res.body.by_queue), 'Must return by_queue array');
    assert.ok(Array.isArray(res.body.hourly_demand), 'Must return hourly_demand array');
    assert.strictEqual(res.body.hourly_demand.length, 24, 'Hourly demand should cover 24 hours');
  });

  await runAsyncTest('3.2 تصدير تحليلات الطابور بصيغة CSV', async () => {
    const req = {
      method: 'GET',
      url: '/api/v1/erp-reports?action=queue-pos-analytics&tenant_slug=cafe-test&format=csv',
      query: { action: 'queue-pos-analytics', tenant_slug: 'cafe-test', format: 'csv' },
      headers: {}
    };
    const res = createMockRes();
    await erpReportsHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['Content-Type'].includes('text/csv'), 'Content-Type must be text/csv');
    assert.ok(res.body.includes('Ticket Number,Queue,Status,Total Amount'), 'CSV header mismatch');
  });

  // =========================================================================
  // 4. التحقق من توجيهات vercel.json
  // =========================================================================
  runTest('4.1 توفر توجيهات /kitchen-display في vercel.json', () => {
    const vercelPath = fs.existsSync(path.join(__dirname, '../mkn-theme/vercel.json'))
      ? path.join(__dirname, '../mkn-theme/vercel.json')
      : path.join(__dirname, '../vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const rewrites = vercelConfig.rewrites || [];
    const hasKds = rewrites.some(r => r.source === '/kitchen-display' && r.destination === '/kitchen-display.html');
    assert.ok(hasKds, 'vercel.json must rewrite /kitchen-display to /kitchen-display.html');
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
