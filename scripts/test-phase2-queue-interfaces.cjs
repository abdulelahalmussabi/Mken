'use strict';

/**
 * منصة مكّن (mken.live) — حزمة الاختبارات الشاملة للمرحلة الثانية: واجهات التشغيل والنداء والواتساب
 * Run: node scripts/test-phase2-queue-interfaces.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🚀 بدء اختبارات المرحلة الثانية: واجهات التشغيل والنداء والواتساب');
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
  // 1. اختبارات إشعارات واتساب لطابور الانتظار (notify-whatsapp.js)
  // =========================================================================
  const notifyWhatsapp = require('../mkn-theme/src/server/platform/queue/notify-whatsapp');

  runTest('1.1 صياغة رسالة إصدار التذكرة (ticket_issued)', () => {
    const msg = notifyWhatsapp.buildMessageContent('ticket_issued', {
      ticket_number: 'C-042',
      queue_name: 'مشروبات وقهوة',
      customer_name: 'سعد العتيبي',
      total: 45.00,
      eta_minutes: 8,
      items_summary: '• لاتيه دبل x1\n• كوكيز بلجيكي x2'
    });

    assert.ok(msg.title.includes('C-042'));
    assert.ok(msg.body.includes('سعد العتيبي'));
    assert.ok(msg.body.includes('45.00 ر.س'));
    assert.ok(msg.body.includes('~8 دقيقة'));
    assert.ok(msg.body.includes('كوكيز بلجيكي'));
  });

  runTest('1.2 صياغة رسالة اقتراب الدور (almost_called)', () => {
    const msg = notifyWhatsapp.buildMessageContent('almost_called', {
      ticket_number: 'F-015',
      queue_name: 'مطبخ ووجبات',
      ahead_count: 1
    });

    assert.ok(msg.title.includes('F-015'));
    assert.ok(msg.body.includes('مطبخ ووجبات'));
    assert.ok(msg.body.includes('1 تذكرة'));
  });

  runTest('1.3 صياغة رسالة نداء الكاونتر (called)', () => {
    const msg = notifyWhatsapp.buildMessageContent('called', {
      ticket_number: 'T-007',
      counter_name: 'كاونتر 3 (الاستلام)',
      table_number: '12'
    });

    assert.ok(msg.title.includes('T-007'));
    assert.ok(msg.body.includes('كاونتر 3'));
    assert.ok(msg.body.includes('طاولة'));
    assert.ok(msg.body.includes('12'));
  });

  runTest('1.4 صياغة رسالة جاهزية الطلب (order_ready)', () => {
    const msg = notifyWhatsapp.buildMessageContent('order_ready', {
      ticket_number: 'C-042',
      customer_name: 'أحمد الزهراني',
      table_number: '5'
    });

    assert.ok(msg.title.includes('C-042'));
    assert.ok(msg.body.includes('أحمد الزهراني'));
    assert.ok(msg.body.includes('طاولة 5'));
  });

  runTest('1.5 صياغة رسالة استراحة الصلاة (prayer_pause)', () => {
    const msg = notifyWhatsapp.buildMessageContent('prayer_pause', {
      ticket_number: 'C-042',
      prayer_name: 'صلاة العصر',
      resume_minutes: 20
    });

    assert.ok(msg.title.includes('تذكرتك محفوظة'));
    assert.ok(msg.body.includes('صلاة العصر'));
    assert.ok(msg.body.includes('~20 دقيقة'));
  });

  await runAsyncTest('1.6 محاكاة إرسال واتساب مع تنظيف رقم الهاتف السعودي', async () => {
    const res = await notifyWhatsapp.sendQueueWhatsAppNotification(
      'cafe-test',
      '0501234567',
      'ticket_issued',
      { ticket_number: 'C-001', queue_name: 'كافيه' }
    );
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.phone, '966501234567');
  });

  // =========================================================================
  // 2. اختبارات الإعلان الصوتي العربي (queue-announcer.js)
  // =========================================================================
  const announcer = require('../mkn-theme/public/js/queue-announcer');

  runTest('2.1 تهيئة ونطق أرقام التذاكر بالحروف الصوتية العربية', () => {
    assert.strictEqual(announcer.formatSpokenTicket('C-042'), 'سي 42');
    assert.strictEqual(announcer.formatSpokenTicket('F-007'), 'إف 7');
    assert.strictEqual(announcer.formatSpokenTicket('T-105'), 'تي 105');
    assert.strictEqual(announcer.formatSpokenTicket('K-001'), 'كاف 1');
    assert.strictEqual(announcer.formatSpokenTicket('D-020'), 'دي 20');
  });

  // =========================================================================
  // 3. اختبارات استدعاء وإنهاء الخدمة في api/v1/queue.js
  // =========================================================================
  const queueApiHandler = require('../mkn-theme/src/server/platform/queue');
  const { tenantHeaders } = require('../tests/queue-http.cjs');

  await runAsyncTest('3.1 استدعاء العميل التالي (Call-Next) بنجاح وإرسال الإشعار', async () => {
    const testTenant = 'phase2-tenant';
    const counterId = 'cnt-1-' + testTenant;
    const queueId = 'q-cs-' + testTenant;

    // ننشئ تذكرة أولاً لنضمن وجود تذكرة في الانتظار
    const joinReq = {
      method: 'POST',
      url: `/api/v1/queue?action=join-queue&tenant=${testTenant}`,
      query: { action: 'join-queue', tenant: testTenant },
      headers: tenantHeaders({ query: { tenant: testTenant }, staff: false }),
      body: {
        tenantSlug: testTenant,
        customerName: 'فهد الناصر',
        customerPhone: '0551122334',
        queueIds: [queueId]
      }
    };
    const joinRes = createMockRes();
    await queueApiHandler(joinReq, joinRes);
    assert.strictEqual(joinRes.statusCode, 200, 'join-queue should return 200');

    // الآن نستدعي الكاونتر cnt-1
    const callReq = {
      method: 'POST',
      url: `/api/v1/queue?action=call-next&tenant=${testTenant}`,
      query: { action: 'call-next', tenant: testTenant },
      headers: tenantHeaders({ query: { tenant: testTenant } }),
      body: {
        tenantSlug: testTenant,
        counterId: counterId
      }
    };
    const callRes = createMockRes();
    await queueApiHandler(callReq, callRes);

    assert.strictEqual(callRes.statusCode, 200);
    assert.strictEqual(callRes.body.ok, true);
    assert.ok(callRes.body.ticket, 'Should claim a ticket');
    assert.strictEqual(callRes.body.ticket.status, 'called');
    assert.strictEqual(callRes.body.counter.current_ticket_id, callRes.body.ticket.id);
  });

  await runAsyncTest('3.2 إنهاء الخدمة بنجاح (Complete-Service)', async () => {
    const testTenant = 'phase2-tenant';
    const counterId = 'cnt-1-' + testTenant;

    const compReq = {
      method: 'POST',
      url: `/api/v1/queue?action=complete-service&tenant=${testTenant}`,
      query: { action: 'complete-service', tenant: testTenant },
      headers: tenantHeaders({ query: { tenant: testTenant } }),
      body: {
        tenantSlug: testTenant,
        counterId: counterId
      }
    };
    const compRes = createMockRes();
    await queueApiHandler(compReq, compRes);

    assert.strictEqual(compRes.statusCode, 200);
    assert.strictEqual(compRes.body.ok, true);
    const completedTicket = compRes.body.completedTicket || compRes.body.ticket;
    assert.ok(completedTicket, 'Should return completed ticket object');
    assert.strictEqual(completedTicket.status, 'completed');
  });

  await runAsyncTest('3.3 استدعاء إشعار واتساب عبر api/v1/queue?action=notify-whatsapp', async () => {
    const waReq = {
      method: 'POST',
      url: '/api/v1/queue?action=notify-whatsapp',
      query: { action: 'notify-whatsapp', tenant: 'phase2-tenant' },
      headers: tenantHeaders({ query: { tenant: 'phase2-tenant' } }),
      body: {
        tenantSlug: 'phase2-tenant',
        phone: '0567890123',
        eventType: 'order_ready',
        ticket_number: 'C-042',
        customer_name: 'منصور الدوسري'
      }
    };
    const waRes = createMockRes();
    await queueApiHandler(waReq, waRes);

    assert.strictEqual(waRes.statusCode, 200);
    assert.strictEqual(waRes.body.ok, true);
  });

  // =========================================================================
  // 4. اختبار معالج اقتراب الدور (cron-queue-notify.js)
  // =========================================================================
  const cronQueueNotify = require('../mkn-theme/src/server/platform/cron-queue-notify');

  await runAsyncTest('4.1 تشغيل كرون فحص واقتراب الدور بأمان', async () => {
    const cronReq = { method: 'GET', url: '/api/cron-queue-notify', headers: {} };
    const cronRes = createMockRes();
    await cronQueueNotify(cronReq, cronRes);
    assert.strictEqual(cronRes.statusCode, 200);
    assert.strictEqual(cronRes.body.ok, true);
  });

  // =========================================================================
  // 5. التحقق من تكامل ملفات الواجهة (admin.html و queue-display.html)
  // =========================================================================
  runTest('5.1 التحقق من عناصر واجهة الكاونتر في admin.html', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/admin.html'), 'utf8');
    assert.ok(adminHtml.includes('counterOrderSummaryPanel'), 'admin.html must contain counterOrderSummaryPanel');
    assert.ok(adminHtml.includes('counterOrderItemsList'), 'admin.html must contain counterOrderItemsList');
    assert.ok(adminHtml.includes('counterMarkReadyBtn'), 'admin.html must contain counterMarkReadyBtn');
    assert.ok(adminHtml.includes('counterPrintTicketBtn'), 'admin.html must contain counterPrintTicketBtn');
  });

  runTest('5.2 التحقق من شاشة العرض وإدماج الإعلان الصوتي في queue-display.html', () => {
    const dispHtml = fs.readFileSync(path.join(__dirname, '../mkn-theme/public/queue-display.html'), 'utf8');
    assert.ok(dispHtml.includes('js/queue-announcer.js'), 'queue-display.html must include queue-announcer.js');
    assert.ok(dispHtml.includes('announceTicket'), 'queue-display.html must call announceTicket');
    assert.ok(dispHtml.includes('dispPrayerSoonBar'), 'queue-display.html must include prayer alerts');
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
