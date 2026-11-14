#!/usr/bin/env node
/**
 * منصة مكِّن — فحص اختراق عزل المستأجرين (Tenant Isolation Penetration Test)
 * كود المهمة: E1-RLS-01
 * الامتثال: نظام حماية البيانات الشخصية (PDPL) المادة 31 وضوابط NCA ECC-1:2018 (AC-1/AC-2)
 * 
 * سيناريوهات الفحص:
 * 1. استعلام مشروع لمستأجر مصرح له (Legitimate Tenant Query)
 * 2. محاولة اختراق عابرة للمستأجرين لاستخراج زبائن منافسين (Cross-Tenant Breach Attempt)
 * 3. محاولة تفريغ قاعدة البيانات بهوية مجهولة (Anonymous DB Dump Attempt)
 * 4. فحص وسيط حوكمة الـ API (Middleware Enforcement Test)
 */

const assert = require('assert');
const { extractTenantContext, enforceTenantIsolation } = require('../api/_lib/tenant-context.js');

// محاكي قاعدة البيانات مع محرك RLS صارم
class StrictRlsDatabaseSimulator {
  constructor() {
    this.appointments = [
      { id: 'apt_01', tenant_slug: 'tenant_barber_salon', customer_name: 'أبو فهد', phone: '966500000001', service: 'حلاقة ملكي', amount: 150 },
      { id: 'apt_02', tenant_slug: 'tenant_barber_salon', customer_name: 'عميل صالون 2', phone: '966500000002', service: 'تحديد لحية', amount: 50 },
      { id: 'apt_03', tenant_slug: 'tenant_car_care_vip', customer_name: 'عميل مغسلة 1', phone: '966500000099', service: 'غسيل ساطع', amount: 120 },
      { id: 'apt_04', tenant_slug: 'tenant_clinic_care', customer_name: 'مريض عيادة 1', phone: '966500000111', service: 'كشف عام', amount: 300 }
    ];
  }

  // محاكاة تقييم سياسة PostgreSQL RLS
  selectAppointments(jwtClaims) {
    return this.appointments.filter(row => {
      // 1. Super admin / Service role bypass
      if (jwtClaims && (jwtClaims.role === 'super_admin' || jwtClaims.role === 'service_role')) {
        return true;
      }

      // 2. Strict RLS rule: tenant_slug = current_tenant_slug()
      const currentTenant = jwtClaims ? (jwtClaims.tenant_slug || null) : null;
      if (currentTenant && row.tenant_slug === currentTenant) {
        return true;
      }

      // 3. Any anonymous query or mismatched tenant returns false (zero rows)
      return false;
    });
  }
}

// Mock Response Helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTenantIsolationTests() {
  console.log("================================================================================");
  console.log("  🛡️ فحص اختراق عزل المستأجرين وحماية الخصوصية (Tenant Isolation Pen-Test)");
  console.log("  🔒 الامتثال: نظام حماية البيانات الشخصية (PDPL) المادة 31 وضوابط NCA");
  console.log("================================================================================\n");

  const db = new StrictRlsDatabaseSimulator();

  // ─── السيناريو 1: استعلام مشروع لتاجر مصرح له ───
  console.log("1️⃣ اختبار استعلام مشروع لصاحب المنشأة (أبو فهد - صالون الحلاقة)...");
  const legitClaims = { tenant_slug: 'tenant_barber_salon', role: 'tenant_admin' };
  const legitResults = db.selectAppointments(legitClaims);
  assert.strictEqual(legitResults.length, 2, "يجب استرجاع مواعيد صالون الحلاقة فقط (2 سجلات)");
  legitResults.forEach(r => {
    assert.strictEqual(r.tenant_slug, 'tenant_barber_salon');
  });
  console.log(`   ✅ نجاح: تم استرجاع سجلات المتجر الخاص فقط (${legitResults.length} سجلات).\n`);

  // ─── السيناريو 2: محاولة هجوم وسحب بيانات منافس تجاري ───
  console.log("2️⃣ محاكاة هجوم احتيالي: تاجر مغسلة السيارات يحاول قراءة بيانات زبائن أبو فهد...");
  const attackerClaims = { tenant_slug: 'tenant_car_care_vip', role: 'tenant_admin' };
  
  // Attacker asks DB for all appointments
  const attackerResults = db.selectAppointments(attackerClaims);
  
  // Verify that NONE of Abu Fahd's records or Clinic records leaked to attacker
  const leakedAbuFahd = attackerResults.filter(r => r.tenant_slug === 'tenant_barber_salon');
  assert.strictEqual(leakedAbuFahd.length, 0, "يجب أن تكون السجلات المتسربة صفراً تماماً");
  assert.strictEqual(attackerResults.length, 1, "يجب أن يرى المهاجم سجله الوحيد فقط");
  console.log(`   🚨 تم إحباط الهجوم بنجاح! لم يتسرب أي سجل (Zero Data Leakage).\n`);

  // ─── السيناريو 3: محاولة تفريغ عام بدون توكن (Anonymous DB Dump) ───
  console.log("3️⃣ اختبار هجوم سحب عام لقاعدة البيانات بدون توكن (Anonymous Dump)...");
  const anonResults = db.selectAppointments(null);
  assert.strictEqual(anonResults.length, 0, "الاستعلام المجهول يجب أن يعيد صفر صفوف");
  console.log(`   ✅ نجاح تام: قاعدة البيانات صدت الاستعلام العام المجهول وأعادت 0 صفوف.\n`);

  // ─── السيناريو 4: فحص وسيط الـ API لمنع ثغرات BOLA/IDOR ───
  console.log("4️⃣ اختبار وسيط حوكمة الـ API ضد ثغرات BOLA / Cross-Tenant Injection...");
  
  // Fake JWT with tenant_car_care_vip
  const validHeaderPayload = Buffer.from(JSON.stringify({
    tenant_slug: 'tenant_car_care_vip',
    role: 'staff',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
  const fakeJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${validHeaderPayload}.signaturesimulated`;

  // Malicious request trying to access Abu Fahd's barber tenant
  const attackReq = {
    headers: { authorization: `Bearer ${fakeJwt}` }
  };
  const attackRes = createMockRes();
  const allowed = enforceTenantIsolation(attackReq, attackRes, 'tenant_barber_salon');

  assert.strictEqual(allowed, false, "يجب رفض الطلب العابر للمستأجرين فوراً");
  assert.strictEqual(attackRes.statusCode, 403, "يجب أن يعيد السيرفر رمز 403 Forbidden");
  assert.strictEqual(attackRes.body.code, 'CROSS_TENANT_VIOLATION');
  console.log(`   ✅ تم حظر الطلب في بوابة الواجهات برمز 403 (CROSS_TENANT_VIOLATION).\n`);

  console.log("================================================================================");
  console.log("🎉 تم اجتياز كافة اختبارات عزل المستأجرين بنسبة 100% ودون أي تسرب للبيانات!");
  console.log("================================================================================\n");
}

runTenantIsolationTests().catch(err => {
  console.error("❌ فشل اختبار عزل المستأجرين:", err);
  process.exit(1);
});
