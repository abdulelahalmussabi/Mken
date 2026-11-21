/**
 * منصة مَكَن (mken.live) — فحص حزمة التشغيل المحلي والتراخيص وإدارة رسوم مكاتب الاستقبال
 * (Queue Enterprise Licensing, On-Premise Air-Gapped Package & Zone Add-on Billing)
 *
 * المحاور المختبرة:
 * 1. وحدة التراخيص المشفرة رقمياً (Ed25519 Offline License Verifier & Grace Period).
 * 2. قيود باقة Starter (مكتب استقبال 1 مجاني) وفرض كود HTTP 402 ZONE_QUOTA_EXCEEDED.
 * 3. آلية ترقية وشراء مكاتب استقبال إضافية واحتساب ضريبة القيمة المضافة 15% ZATCA.
 * 4. استعلام ملخص الفوترة والاشتراك (billing-summary).
 * 5. طلب وتفعيل حزمة التشغيل المحلي (enable-on-premise-addon) وإصدار المفتاح الرقمي.
 * 6. فرض قيود الترخيص في بيئة التشغيل المحلي المستقلة (DEPLOYMENT_MODE=on_premise).
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const onpremLicense = require('../mkn-theme/src/server/platform/_lib/onprem-license.js');
const { tenantHeaders } = require('./queue-http.cjs');

const TEST_TENANT = 'licensing-clinic-' + Date.now().toString(36);

function createMockReq(options = {}) {
  const query = Object.assign({}, options.query || {});
  if (options.tenant && !query.tenant) {
    query.tenant = options.tenant;
  }
  const opts = Object.assign({}, options, { query: query });
  const headers = tenantHeaders(opts);
  if (!headers.host && options.tenant) {
    headers.host = options.tenant.toLowerCase() + '.mken.live';
  }
  if (!headers.origin) {
    headers.origin = 'https://' + headers.host;
  }
  if (options.staff) {
    headers['x-is-super-admin'] = '1';
    headers['x-admin-authenticated'] = '1';
    headers['x-queue-staff-token'] = 'staff-secret';
  }
  return {
    method: opts.method || 'GET',
    url: opts.url || '/api/v1/queue',
    query: query,
    body: opts.body || {},
    headers: Object.assign(headers, options.headers || {}),
    on(event, handler) {}
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

async function runQueueAction(action, { method = 'POST', body = {}, query = {}, staff = 'admin', headers = {}, tenant = TEST_TENANT } = {}) {
  const reqBody = Object.assign({ action: action }, body);
  const req = createMockReq({
    tenant: tenant,
    method: method,
    query: Object.assign({ action: action }, query),
    body: reqBody,
    staff: staff,
    headers: headers
  });
  const res = createMockRes();
  await queueHandler(req, res);
  return { status: res.statusCode, body: res.body };
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 بدء اختبارات التراخيص وحزمة التشغيل المحلي ورسوم المناطق...');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // اختبار 1: وحدة التحقق من الترخيص المشفر (onprem-license.js)
  // -------------------------------------------------------------
  console.log('🔹 1. اختبار التشفير الرقمي والتحقق بدون إنترنت (Ed25519 & Offline Verifier)...');

  const validPayload = {
    tenant_slug: TEST_TENANT,
    plan_tier: 'enterprise',
    max_zones: 5,
    max_counters: 50,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    hardware_fingerprint: 'SRV-HOSP-01'
  };

  const licenseKey = onpremLicense.generateLicenseKey(validPayload);
  assert(licenseKey && typeof licenseKey === 'string', 'يجب توليد مفتاح ترخيص بصيغة نصية base64url');

  const verifyResult = onpremLicense.verifyLicenseKey(licenseKey, 'SRV-HOSP-01', TEST_TENANT);
  assert.strictEqual(verifyResult.valid, true, 'يجب أن يكون المفتاح صالحاً للتحقق');
  assert.strictEqual(verifyResult.in_grace_period, false, 'يجب ألا يكون في فترة سماح طالما لم ينتهِ');
  assert.strictEqual(verifyResult.payload.max_zones, 5, 'يجب مطابقة عدد المناطق في الحمولة');

  // تزوير المفتاح
  const tamperedKey = licenseKey.slice(0, -6) + 'XXXXXX';
  const tamperedResult = onpremLicense.verifyLicenseKey(tamperedKey, null, TEST_TENANT);
  assert.strictEqual(tamperedResult.valid, false, 'المفتاح المزور يجب أن يُرفض فوراً');
  assert.strictEqual(tamperedResult.error, 'SIGNATURE_INVALID');

  // عدم تطابق المنشأة (Tenant Mismatch)
  const wrongTenantResult = onpremLicense.verifyLicenseKey(licenseKey, null, 'other-hospital');
  assert.strictEqual(wrongTenantResult.valid, false, 'يجب رفض المفتاح عند اختلاف المنشأة');
  assert.strictEqual(wrongTenantResult.error, 'TENANT_MISMATCH');

  // اختبار فترة السماح (Grace Period - 14 يوماً)
  const expiredPayload = {
    tenant_slug: TEST_TENANT,
    plan_tier: 'enterprise',
    max_zones: 3,
    max_counters: 20,
    // انتهى قبل 5 أيام
    expires_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  };
  const graceKey = onpremLicense.generateLicenseKey(expiredPayload);
  const graceResult = onpremLicense.verifyLicenseKey(graceKey, null, TEST_TENANT);
  assert.strictEqual(graceResult.valid, true, 'يجب استمرار العمل إذا كان ضمن فترة السماح الـ 14 يوماً');
  assert.strictEqual(graceResult.in_grace_period, true, 'يجب تفعيل راية in_grace_period');
  assert.strictEqual(graceResult.days_until_grace_cutoff, 9, 'الأيام المتبقية في فترة السماح يجب أن تكون 9');

  // اختبار انتهاء الترخيص وفترة السماح معاً (أكثر من 14 يوماً)
  const ancientPayload = {
    tenant_slug: TEST_TENANT,
    plan_tier: 'enterprise',
    max_zones: 3,
    max_counters: 20,
    // انتهى قبل 20 يوماً
    expires_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  };
  const ancientKey = onpremLicense.generateLicenseKey(ancientPayload);
  const ancientResult = onpremLicense.verifyLicenseKey(ancientKey, null, TEST_TENANT);
  assert.strictEqual(ancientResult.valid, false, 'يجب رفض المفتاح بعد انتهاء فترة السماح الـ 14 يوماً');
  assert.strictEqual(ancientResult.error, 'LICENSE_EXPIRED');

  console.log('   ✅ نجح فحص التوقيع الرقمي وفترة السماح وحماية التزوير.');

  // -------------------------------------------------------------
  // اختبار 2: باقة Starter الأساسية وفرض كود HTTP 402 عند تجاوز الحصة
  // -------------------------------------------------------------
  console.log('\n🔹 2. اختبار قيود الباقة الأساسية (Starter Quota = 1 Zone) وفرض HTTP 402...');

  // إنشاء المنطقة الأولى (مشمولة مجاناً في باقة Starter)
  const createZone1 = await runQueueAction('upsert-zone', {
    body: {
      name: 'استقبال العيادات العامة',
      code: 'REC-GEN-01',
      floor_or_building: 'الدور الأرضي'
    }
  });
  assert.strictEqual(createZone1.status, 200, 'المنطقة الأولى مشمولة مجاناً في الباقة الأساسية');
  assert.strictEqual(createZone1.body.ok, true);
  assert(createZone1.body.zone && createZone1.body.zone.id);

  // محاولة إنشاء منطقة ثانية دون شراء مكاتب إضافية -> يجب أن تُرفض بكود HTTP 402
  const createZone2Blocked = await runQueueAction('upsert-zone', {
    body: {
      name: 'استقبال العيادات التخصصية',
      code: 'REC-SPEC-02',
      floor_or_building: 'الدور الأول'
    }
  });
  assert.strictEqual(createZone2Blocked.status, 402, 'يجب الرفض بكود 402 Payment Required عند تجاوز الحصة');
  assert.strictEqual(createZone2Blocked.body.ok, false);
  assert.strictEqual(createZone2Blocked.body.code, 'ZONE_QUOTA_EXCEEDED');
  assert.strictEqual(createZone2Blocked.body.current_zones, 1);
  assert.strictEqual(createZone2Blocked.body.max_allowed, 1);
  assert.strictEqual(createZone2Blocked.body.extra_zone_price_sar, 149.00);
  assert.strictEqual(createZone2Blocked.body.upgrade_required, true);

  console.log('   ✅ نجح حظر إضافة مكاتب إضافية وإرجاع 402 مع تفاصيل التسعير والترقية.');

  // -------------------------------------------------------------
  // اختبار 3: شراء مكاتب استقبال إضافية مع احتساب ضريبة 15% ZATCA
  // -------------------------------------------------------------
  console.log('\n🔹 3. اختبار شراء مكاتب استقبال إضافية وإصدار فاتورة ZATCA (15% VAT)...');

  const purchaseRes = await runQueueAction('purchase-extra-zones', {
    body: { quantity: 2 }
  });
  assert.strictEqual(purchaseRes.status, 200, 'شراء المكاتب الإضافية يجب أن ينجح');
  assert.strictEqual(purchaseRes.body.ok, true);
  assert.strictEqual(purchaseRes.body.purchased_quantity, 2);
  assert.strictEqual(purchaseRes.body.max_allowed_zones, 3, 'السعة الجديدة يجب أن تصبح 3 (1 مشمول + 2 إضافي)');

  const invoice = purchaseRes.body.invoice;
  assert(invoice, 'يجب إصدار فاتورة');
  assert.strictEqual(invoice.unit_price_sar, 149.00);
  assert.strictEqual(invoice.subtotal_sar, 298.00, 'المجموع قبل الضريبة لـ 2 مكاتب = 298.00 ر.س');
  assert.strictEqual(invoice.tax_sar, 44.70, 'ضريبة 15% على 298 ر.س = 44.70 ر.س');
  assert.strictEqual(invoice.total_sar, 342.70, 'الإجمالي بعد الضريبة = 342.70 ر.س');
  assert.strictEqual(invoice.status, 'paid');
  assert(invoice.zatca_qr_payload, 'يجب وجود حمولة رمز الاستجابة السريعة لهيئة الزكاة ZATCA');

  // الآن بعد الترقية، إنشاء المنطقة الثانية والثالثة يجب أن ينجح
  const createZone2Allowed = await runQueueAction('upsert-zone', {
    body: {
      name: 'استقبال العيادات التخصصية',
      code: 'REC-SPEC-02',
      floor_or_building: 'الدور الأول'
    }
  });
  assert.strictEqual(createZone2Allowed.status, 200, 'إنشاء المنطقة الثانية يجب أن ينجح بعد الترقية');
  assert.strictEqual(createZone2Allowed.body.ok, true);

  const createZone3Allowed = await runQueueAction('upsert-zone', {
    body: {
      name: 'استقبال المختبر والأشعة',
      code: 'REC-LAB-03',
      floor_or_building: 'الدور الثاني'
    }
  });
  assert.strictEqual(createZone3Allowed.status, 200, 'إنشاء المنطقة الثالثة يجب أن ينجح بعد الترقية');
  assert.strictEqual(createZone3Allowed.body.ok, true);

  // محاولة إنشاء منطقة رابعة (تتجاوز الـ 3 المسموحة) -> يجب أن تُرفض بكود 402 مجدداً
  const createZone4Blocked = await runQueueAction('upsert-zone', {
    body: {
      name: 'استقبال الطوارئ',
      code: 'REC-ER-04'
    }
  });
  assert.strictEqual(createZone4Blocked.status, 402, 'المنطقة الرابعة يجب أن تُرفض لتجاوز الحصة 3');
  assert.strictEqual(createZone4Blocked.body.code, 'ZONE_QUOTA_EXCEEDED');
  assert.strictEqual(createZone4Blocked.body.current_zones, 3);
  assert.strictEqual(createZone4Blocked.body.max_allowed, 3);

  console.log('   ✅ نجح احتساب الرسوم والضريبة 15% وتمكين إنشاء المكاتب المشتراة بدقة.');

  // -------------------------------------------------------------
  // اختبار 4: استعلام ملخص الفوترة والاشتراك (billing-summary)
  // -------------------------------------------------------------
  console.log('\n🔹 4. اختبار استعلام ملخص الفوترة والاشتراك (billing-summary)...');

  const summaryRes = await runQueueAction('billing-summary', { method: 'GET' });
  assert.strictEqual(summaryRes.status, 200);
  assert.strictEqual(summaryRes.body.ok, true);

  const ent = summaryRes.body.entitlement;
  assert.strictEqual(ent.plan_tier, 'starter');
  assert.strictEqual(ent.included_zones_quota, 1);
  assert.strictEqual(ent.extra_zones_purchased, 2);
  assert.strictEqual(ent.max_allowed_zones, 3);
  assert.strictEqual(ent.active_zones_count, 3);
  assert.strictEqual(ent.available_zones_remaining, 0);
  assert.strictEqual(ent.monthly_extra_subtotal_sar, 298.00);
  assert.strictEqual(ent.monthly_extra_vat_sar, 44.70);
  assert.strictEqual(ent.monthly_extra_total_sar, 342.70);
  assert.strictEqual(ent.on_premise_addon_enabled, false);

  assert(Array.isArray(summaryRes.body.invoices), 'يجب إرجاع سجل الفواتير');
  assert.strictEqual(summaryRes.body.invoices.length, 1);
  assert.strictEqual(summaryRes.body.invoices[0].addon_type, 'extra_zone');

  console.log('   ✅ نجح إرجاع ملخص الفوترة الدقيق مع الحصص والرسوم الشهرية وسجل الفواتير.');

  // -------------------------------------------------------------
  // اختبار 5: طلب وتفعيل حزمة التشغيل المحلي (enable-on-premise-addon)
  // -------------------------------------------------------------
  console.log('\n🔹 5. اختبار تفعيل حزمة التشغيل المحلي (On-Premise Docker Add-on)...');

  const enableOnpremRes = await runQueueAction('enable-on-premise-addon', {
    body: { hardwareFingerprint: 'SRV-HOSP-MADINAH-01' }
  });
  assert.strictEqual(enableOnpremRes.status, 200);
  assert.strictEqual(enableOnpremRes.body.ok, true);
  assert(enableOnpremRes.body.license_key, 'يجب إصدار مفتاح ترخيص On-Premise');
  assert(enableOnpremRes.body.license_expires_at, 'يجب تحديد تاريخ انتهاء الترخيص (سنة)');

  // التحقق من صحة المفتاح الصادر وتشفيره
  const checkGeneratedKey = onpremLicense.verifyLicenseKey(
    enableOnpremRes.body.license_key,
    'SRV-HOSP-MADINAH-01',
    TEST_TENANT
  );
  assert.strictEqual(checkGeneratedKey.valid, true, 'المفتاح الصادر يجب أن يكون صالحاً رقمياً');
  assert.strictEqual(checkGeneratedKey.payload.max_zones, 3, 'المفتاح يجب أن يحتوي على حصة المناطق 3');

  // التحقق من فاتورة الحزمة السنوية (4,999 ر.س + 15% ضريبة = 5,748.85 ر.س)
  const onpremInvoice = enableOnpremRes.body.invoice;
  assert.strictEqual(onpremInvoice.addon_type, 'on_premise_package');
  assert.strictEqual(onpremInvoice.unit_price_sar, 4999.00);
  assert.strictEqual(onpremInvoice.tax_sar, 749.85);
  assert.strictEqual(onpremInvoice.total_sar, 5748.85);

  // استعلام billing-summary مجدداً للتأكد من حالة on_premise_addon_enabled
  const summaryAfterOnprem = await runQueueAction('billing-summary', { method: 'GET' });
  assert.strictEqual(summaryAfterOnprem.body.entitlement.on_premise_addon_enabled, true);
  assert.strictEqual(summaryAfterOnprem.body.entitlement.on_premise_license_key, enableOnpremRes.body.license_key);
  assert.strictEqual(summaryAfterOnprem.body.invoices.length, 2);

  console.log('   ✅ نجح تفعيل حزمة التشغيل المحلي وتوليد مفتاح Ed25519 وفاتورة الحزمة.');

  // -------------------------------------------------------------
  // اختبار 6: فرض قيود الترخيص في بيئة التشغيل المحلي (DEPLOYMENT_MODE=on_premise)
  // -------------------------------------------------------------
  console.log('\n🔹 6. اختبار وضع التشغيل المحلي المعزول (Air-Gapped DEPLOYMENT_MODE=on_premise)...');

  const ONPREM_TENANT = 'hospital-local-onprem';
  const onpremLocalKey = onpremLicense.generateLicenseKey({
    tenant_slug: ONPREM_TENANT,
    plan_tier: 'enterprise',
    max_zones: 2, // مسموح منطقتين فقط في هذه الرخصة
    max_counters: 20,
    expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
  });

  const origDeploymentMode = process.env.DEPLOYMENT_MODE;
  const origLicenseKey = process.env.ONPREM_LICENSE_KEY;

  try {
    process.env.DEPLOYMENT_MODE = 'on_premise';
    process.env.ONPREM_LICENSE_KEY = onpremLocalKey;

    // إنشاء المنطقة 1 في وضع On-Premise -> يجب أن ينجح
    const localZone1 = await runQueueAction('upsert-zone', {
      tenant: ONPREM_TENANT,
      body: { name: 'استقبال العيادات النهارية', code: 'DAY-01' }
    });
    assert.strictEqual(localZone1.status, 200, 'المنطقة الأولى يجب أن تنجح ضمن رخصة On-Premise');
    assert.strictEqual(localZone1.body.ok, true);

    // إنشاء المنطقة 2 في وضع On-Premise -> يجب أن ينجح
    const localZone2 = await runQueueAction('upsert-zone', {
      tenant: ONPREM_TENANT,
      body: { name: 'استقبال جراحة اليوم الواحد', code: 'SURG-02' }
    });
    assert.strictEqual(localZone2.status, 200, 'المنطقة الثانية يجب أن تنجح ضمن رخصة On-Premise');
    assert.strictEqual(localZone2.body.ok, true);

    // محاولة إنشاء منطقة ثالثة تتجاوز max_zones (2) الموجودة في الرخصة المحلية
    const localZone3Blocked = await runQueueAction('upsert-zone', {
      tenant: ONPREM_TENANT,
      body: { name: 'استقبال المختبر المحلي', code: 'LAB-03' }
    });
    assert.strictEqual(localZone3Blocked.status, 402, 'يجب حظر المنطقة الثالثة لتجاوز سعة رخصة On-Premise');
    assert.strictEqual(localZone3Blocked.body.code, 'ZONE_QUOTA_EXCEEDED');
    assert.strictEqual(localZone3Blocked.body.current_zones, 2);
    assert.strictEqual(localZone3Blocked.body.max_allowed, 2);

    // استعلام billing-summary في وضع On-Premise
    const localBillingSummary = await runQueueAction('billing-summary', {
      tenant: ONPREM_TENANT,
      method: 'GET'
    });
    assert.strictEqual(localBillingSummary.status, 200);
    assert.strictEqual(localBillingSummary.body.entitlement.max_allowed_zones, 2);
    assert.strictEqual(localBillingSummary.body.entitlement.active_zones_count, 2);
    assert.strictEqual(localBillingSummary.body.entitlement.available_zones_remaining, 0);
    assert(localBillingSummary.body.entitlement.license_status.valid);

    console.log('   ✅ نجح فحص قيود رخصة On-Premise المعزولة بنجاح تام.');
  } finally {
    process.env.DEPLOYMENT_MODE = origDeploymentMode;
    process.env.ONPREM_LICENSE_KEY = origLicenseKey;
  }

  console.log('\n===============================================================');
  console.log('🎉 اكتملت كافة اختبارات التراخيص وحزمة On-Premise بنجاح 100%!');
  console.log('===============================================================\n');
}

runTests().catch(function (err) {
  console.error('❌ خطأ أثناء تنفيذ الاختبارات:', err);
  process.exit(1);
});
