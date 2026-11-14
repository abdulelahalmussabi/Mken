#!/usr/bin/env node
/**
 * منصة مكِّن — فحص معالج إعداد الامتثال وبريك الصلاة ونظام العمل (Prayer & Labor Onboarding Test)
 * الامتثال: نظام العمل السعودي (المادتان 98 و101)، مواقيت تقويم أم القرى، ولائحة إشعار المستهلك
 */

const assert = require('assert');
const queueHandler = require('../api/v1/queue.js');

// Mock Request / Response Helpers
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

async function runQueuePrayerOnboardingTests() {
  console.log("================================================================================");
  console.log("  🕌 فحص إعداد بريك الصلاة ونظام العمل في الطابور (Prayer & Labor Onboarding)");
  console.log("  🇸🇦 الامتثال: نظام العمل السعودي (المادتان 98 و101) وتقويم أم القرى");
  console.log("================================================================================\n");

  const testTenant = 'tenant_prayer_test_' + Date.now();

  // ─── 1. اختبار معالج الإعداد الأولي السريع (Zero-Friction Onboarding) ───
  console.log("1️⃣ اختبار حفظ إعدادات معالج الامتثال السعودي الأولي بنقرة واحدة...");
  const onboardReq = createMockReq({
    method: 'POST',
    query: { action: 'save-onboarding-compliance', tenant: testTenant },
    body: {
      enabled: true,
      city: 'Riyadh',
      prayer_breaks: {
        enabled: true,
        break_duration_minutes: 20,
        show_spiritual_display: true
      },
      labor_law_compliance: {
        max_continuous_work_hours: 5,
        mandatory_rest_minutes: 30,
        max_daily_shift_hours: 8
      }
    }
  });
  const onboardRes = createMockRes();
  await queueHandler(onboardReq, onboardRes);

  assert.strictEqual(onboardRes.statusCode, 200);
  assert.strictEqual(onboardRes.body.ok, true);
  assert.strictEqual(onboardRes.body.settings.city, 'Riyadh');
  assert.strictEqual(onboardRes.body.settings.saudi_compliance_enabled, true);
  assert.strictEqual(onboardRes.body.settings.prayer_breaks.break_duration_minutes, 20);
  assert.strictEqual(onboardRes.body.settings.labor_law_compliance.max_continuous_work_hours, 5);
  console.log("   ✅ نجاح: تم تفعيل حزمة الامتثال السعودي في الإعداد الأولي بنجاح.\n");

  // ─── 2. اختبار فحص حالة الطابور خارج وقت الصلاة ───
  console.log("2️⃣ اختبار حالة الطابور خارج أوقات الصلاة (Active Service State)...");
  const outsideReq = createMockReq({
    method: 'GET',
    query: {
      action: 'get-prayer-status',
      tenant: testTenant,
      city: 'Riyadh',
      minuteOfDay: '600' // الساعة 10:00 صباحاً (خارج وقت الصلاة)
    }
  });
  const outsideRes = createMockRes();
  await queueHandler(outsideReq, outsideRes);

  assert.strictEqual(outsideRes.statusCode, 200);
  assert.strictEqual(outsideRes.body.in_prayer_break, false);
  assert.strictEqual(outsideRes.body.next_prayer, 'الظهر');
  assert.strictEqual(outsideRes.body.next_prayer_time, '11:45');
  console.log(`   ✅ نجاح: الطابور نشط، الصلاة القادمة: [${outsideRes.body.next_prayer}] الساعة ${outsideRes.body.next_prayer_time}\n`);

  // ─── 3. اختبار دخول وقت صلاة المغرب وتجميد الطابور تلقائياً ───
  console.log("3️⃣ محاكاة حلول وقت صلاة المغرب (17:20) وتفعيل نمط الصلاة التلقائي...");
  const maghribReq = createMockReq({
    method: 'GET',
    query: {
      action: 'get-prayer-status',
      tenant: testTenant,
      city: 'Riyadh',
      minuteOfDay: '1040' // الساعة 17:20 مساءً (داخل نافذة صلاة المغرب 17:15 - 17:35)
    }
  });
  const maghribRes = createMockRes();
  await queueHandler(maghribReq, maghribRes);

  assert.strictEqual(maghribRes.statusCode, 200);
  assert.strictEqual(maghribRes.body.in_prayer_break, true);
  assert.strictEqual(maghribRes.body.current_prayer, 'المغرب');
  assert.strictEqual(maghribRes.body.freeze_ewma, true, "يجب تجميد مؤقت الـ EWMA أثناء الصلاة لمنع الأوقات السالبة");
  assert.ok(maghribRes.body.resume_minutes_remaining > 0);
  assert.ok(maghribRes.body.spiritual_message_ar.includes('استراحة صلاة'));
  console.log(`   ✅ نجاح تام: تحول الطابور تلقائياً لنمط [استراحة صلاة المغرب].`);
  console.log(`   ✅ تم تجميد مؤقت الانتظار: ${maghribRes.body.freeze_ewma}`);
  console.log(`   ✅ موعد الاستئناف: ${maghribRes.body.resume_time_str} (المتبقي: ${maghribRes.body.resume_minutes_remaining} دقيقة).\n`);

  // ─── 4. اختبار صلاة الجمعة (فترة أطول 45 دقيقة) ───
  console.log("4️⃣ اختبار نافذة صلاة الجمعة الممتدة (Friday Prayer 45 Minutes)...");
  const fridayReq = createMockReq({
    method: 'GET',
    query: {
      action: 'get-prayer-status',
      tenant: testTenant,
      city: 'Riyadh',
      minuteOfDay: '735', // 12:15 م (تجاوزت الظهر العادي ولكن داخل صلاة الجمعة)
      isFriday: 'true'
    }
  });
  const fridayRes = createMockRes();
  await queueHandler(fridayReq, fridayRes);

  assert.strictEqual(fridayRes.statusCode, 200);
  assert.strictEqual(fridayRes.body.in_prayer_break, true, "يجب أن تستمر استراحة صلاة الجمعة حتى 12:30 م");
  console.log("   ✅ نجاح: صلاة الجمعة تطبق النافذة الموسعة (45 دقيقة) باحترافية.\n");

  // ─── 5. اختبار حماية نظام العمل السعودي للورديات (المادة 101) ───
  console.log("5️⃣ اختبار رقابة نظام العمل السعودي (المادة 101 - حظر العمل المتواصل 5 ساعات)...");
  const laborReq = createMockReq({
    method: 'GET',
    query: { action: 'check-labor-compliance', tenant: testTenant }
  });
  const laborRes = createMockRes();
  await queueHandler(laborReq, laborRes);

  assert.strictEqual(laborRes.statusCode, 200);
  assert.strictEqual(laborRes.body.ok, true);
  assert.strictEqual(laborRes.body.max_continuous_work_hours, 5);
  console.log(`   ✅ نجاح: فاحص نظام العمل يعمل ويراقب سقف الـ 5 ساعات الإلزامية للموظفين.\n`);

  console.log("================================================================================");
  console.log("🎉 تم اجتياز كافة اختبارات بريك الصلاة ونظام العمل بنسبة 100%!");
  console.log("================================================================================\n");
}

runQueuePrayerOnboardingTests().catch(err => {
  console.error("❌ فشل اختبار بريك الصلاة ونظام العمل:", err);
  process.exit(1);
});
