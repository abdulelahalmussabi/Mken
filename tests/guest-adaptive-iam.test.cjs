#!/usr/bin/env node
/**
 * منصة مكّن — اختبارات الهوية التكيفية والشراء كضيف وحماية الصلاحيات (Adaptive IAM & Guest Checkout)
 * كود المهمة: IAM-ADAPTIVE-01
 * الامتثال: نظام حماية البيانات الشخصية (PDPL)، نظام التجارة الإلكترونية (م/126)، ولائحة ZATCA
 */

const assert = require('assert');
const adaptiveIam = require('../api/_lib/adaptive-iam');
const tenantContext = require('../api/_lib/tenant-context');
const checkoutHandler = require('../api/v1/checkout');

async function runTests() {
  console.log('='.repeat(80));
  console.log('  🧪 فحص معمارية الهوية التكيفية والطلب كضيف (Adaptive IAM Test Suite)');
  console.log('  🛡️ الامتثال: نظام حماية البيانات الشخصية (PDPL)، التجارة الإلكترونية، وZATCA');
  console.log('='.repeat(80));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. تصنيف مخاطر الأنشطة وقواعد الهوية (Risk-Profile Classification)
  // -------------------------------------------------------------------------
  test('1.1 تصنيف التجزئة والتجارة العامة يسمح بالشراء كضيف ولا يفرض هوية وطنية (PDPL Data Minimization)', () => {
    const retailPolicy = adaptiveIam.classifyActivity('retail');
    assert.strictEqual(retailPolicy.allowGuestCheckout, true);
    assert.strictEqual(retailPolicy.requiresNationalId, false);
    assert.strictEqual(retailPolicy.requiresNafath, false);

    const commPolicy = adaptiveIam.classifyActivity('commerce');
    assert.strictEqual(commPolicy.allowGuestCheckout, true);
  });

  test('1.2 تصنيف الفنادق ومرافق الإيواء يقيد تسليم الغرفة بالتحقق ونفاذ نظاماً', () => {
    const hotelPolicy = adaptiveIam.classifyActivity('hotel');
    assert.strictEqual(hotelPolicy.allowGuestCheckout, false);
    assert.strictEqual(hotelPolicy.requiresNationalId, true);
    assert.strictEqual(hotelPolicy.requiresNafath, true);
    assert.strictEqual(hotelPolicy.category, 'HOSPITALITY');
  });

  test('1.3 تصنيف الخدمات المالية والتقسيط يحظر الشراء كضيف ويفرض KYC كامل', () => {
    const fintechPolicy = adaptiveIam.classifyActivity('fintech');
    assert.strictEqual(fintechPolicy.allowGuestCheckout, false);
    assert.strictEqual(fintechPolicy.requiresNafath, true);
  });

  // -------------------------------------------------------------------------
  // 2. فحص متطلبات التحقق عند الشروع في الطلب (Checkout IAM Gate)
  // -------------------------------------------------------------------------
  test('2.1 السماح لطلب التجزئة بالمرور كضيف ببيانات الاتصال فقط دون حساب مسبق', () => {
    const res = adaptiveIam.validateCheckoutRequirements({
      activityId: 'commerce',
      isGuest: true,
      customerPhone: '0501234567'
    });
    assert.strictEqual(res.allowed, true);
  });

  test('2.2 حظر طلب فندق كضيف بدون توثيق أو هوية وإرجاع كود KYC_REQUIRED_HOTEL', () => {
    const res = adaptiveIam.validateCheckoutRequirements({
      activityId: 'hotel',
      isGuest: true,
      customerPhone: '0501234567'
    });
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 'KYC_REQUIRED_HOTEL');
    assert.ok(res.error.includes('وزارة السياحة') || res.error.includes('نفاذ'));
  });

  // -------------------------------------------------------------------------
  // 3. توليد والتحقق من رموز الصلاحية المشفرة (Signed Capability Tokens)
  // -------------------------------------------------------------------------
  test('3.1 توليد رمز تتبع مشفر للطلب بصيغة URL-Safe صالحة', () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_test_9981',
      phone: '0501234567',
      ttlDays: 7
    });

    assert.ok(cap.token);
    assert.ok(cap.tokenHash);
    assert.ok(cap.trackingUrl.includes('token='));
    assert.ok(cap.token.includes('.'));
  });

  test('3.2 فحص صحة الرمز والبيانات المستخرجة بنجاح', () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_verified_123',
      phone: '0501234567'
    });

    const check = adaptiveIam.verifyTrackingCapabilityToken(cap.token, 'almahrusa');
    assert.strictEqual(check.valid, true);
    assert.strictEqual(check.tenantSlug, 'almahrusa');
    assert.strictEqual(check.orderId, 'ord_verified_123');
    assert.strictEqual(check.phoneSuffix, '4567');
  });

  test('3.3 الحماية ضد التلاعب بالتوقيع والـ Anti-Tampering', () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_real',
      phone: '0501234567'
    });

    // التلاعب بالحمولة
    const [payload, sig] = cap.token.split('.');
    const tamperedToken = `${payload}X.${sig}`;
    const check = adaptiveIam.verifyTrackingCapabilityToken(tamperedToken, 'almahrusa');
    assert.strictEqual(check.valid, false);
    assert.ok(check.error.includes('غير صحيح') || check.error.includes('تلاعب'));
  });

  // -------------------------------------------------------------------------
  // 4. الحماية الصارمة ضد تسرب البيانات بين الشركات (Anti-Cross-Tenant Leakage)
  // -------------------------------------------------------------------------
  test('4.1 منع استخدام توكن مستأجر (almahrusa) للوصول لبيانات مستأجر آخر (rewa)', () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_secret_77',
      phone: '0501234567'
    });

    // محاولة التحقق مع تحديد متجر مختلف
    const check = adaptiveIam.verifyTrackingCapabilityToken(cap.token, 'rewa');
    assert.strictEqual(check.valid, false);
    assert.strictEqual(check.code, 'CROSS_TENANT_VIOLATION');
  });

  test('4.2 وسيط حوكمة المستأجر (tenant-context) يقبل توكن الضيف الصالح لنفس المستأجر ويحظر التداخل', () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_secure_44',
      phone: '0501234567'
    });

    const mockReq = {
      headers: { 'x-capability-token': cap.token },
      query: {}
    };

    const ctx = tenantContext.extractTenantContext(mockReq);
    assert.strictEqual(ctx.isGuestCapability, true);
    assert.strictEqual(ctx.tenantSlug, 'almahrusa');
    assert.strictEqual(ctx.capabilityOrderId, 'ord_secure_44');
    assert.strictEqual(ctx.role, 'guest_tracked');

    // فحص فرض العزل
    let mockResBlocked = false;
    const mockRes = {
      status: (code) => {
        if (code === 403) mockResBlocked = true;
        return { json: () => {} };
      }
    };

    // 1. وصول صحيح لنفس المستأجر
    const allowed = tenantContext.enforceTenantIsolation(mockReq, mockRes, 'almahrusa');
    assert.strictEqual(allowed, true);

    // 2. محاولة اختراق عابر لمستأجر آخر
    const forbidden = tenantContext.enforceTenantIsolation(mockReq, mockRes, 'rewa');
    assert.strictEqual(forbidden, false);
    assert.strictEqual(mockResBlocked, true);
  });

  // -------------------------------------------------------------------------
  // 5. الفهرس الأعمى لحماية الخصوصية (PDPL Blind Index)
  // -------------------------------------------------------------------------
  test('5.1 توليد فهرس أعمى حتمي ومحمي بالـ Salt لكل مستأجر لرقم الجوال', () => {
    const hash1 = adaptiveIam.computePhoneBlindIndex('0501234567', 'almahrusa');
    const hash2 = adaptiveIam.computePhoneBlindIndex('0501234567', 'almahrusa');
    const hashOtherTenant = adaptiveIam.computePhoneBlindIndex('0501234567', 'rewa');

    assert.strictEqual(hash1, hash2, 'يجب أن يكون الفهرس حتمياً لنفس المستأجر لتسهيل البحث');
    assert.notStrictEqual(hash1, hashOtherTenant, 'يجب أن يختلف الهاش بين المستأجرين لمنع الارتباط العابر');
  });

  // -------------------------------------------------------------------------
  // 6. تكامل واجهة الشراء API مع تجربة الشراء كضيف (Checkout End-to-End)
  // -------------------------------------------------------------------------
  await asyncTest('6.1 إنشاء جلسة شراء كضيف بنجاح واستلام رمز التتبع المشفر', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      method: 'POST',
      url: '/api/v1/checkout?action=create-session',
      query: { action: 'create-session' },
      headers: {},
      body: {
        tenantSlug: 'almahrusa',
        customerName: 'أبو فهد العتيبي',
        customerPhone: '0555551234',
        shippingAddress: { district: 'الياسمين', address: 'شارع أنس بن مالك' },
        items: [{ serviceId: 'srv_perfume', serviceTitle: 'عطر الفخامة', quantity: 1, unitPrice: 150 }],
        activityId: 'commerce',
        isGuest: true
      }
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => { responseBody = data; }
        };
      }
    };

    await checkoutHandler(mockReq, mockRes);
    assert.strictEqual(responseStatus, 200);
    assert.ok(responseBody.success);
    assert.strictEqual(responseBody.isGuestOrder, true);
    assert.ok(responseBody.trackingToken);
    assert.ok(responseBody.trackingUrl.includes('token='));
    assert.strictEqual(responseBody.totalAmount, 172.5); // 150 + 15% VAT
  });

  await asyncTest('6.2 تتبع والتحقق من حالة الطلب كضيف برمز التتبع المشفر بنجاح', async () => {
    const cap = adaptiveIam.generateTrackingCapabilityToken({
      tenantSlug: 'almahrusa',
      orderId: 'ord_guest_909',
      phone: '0555551234'
    });

    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      method: 'GET',
      url: `/api/v1/checkout?action=track&token=${cap.token}&tenant_slug=almahrusa`,
      query: { action: 'track', token: cap.token, tenant_slug: 'almahrusa' },
      headers: {},
      body: {}
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => { responseBody = data; }
        };
      }
    };

    await checkoutHandler(mockReq, mockRes);
    assert.strictEqual(responseStatus, 200);
    assert.ok(responseBody.success);
    assert.strictEqual(responseBody.orderId, 'ord_guest_909');
    assert.strictEqual(responseBody.isGuestOrder, true);
    assert.ok(responseBody.zatcaQr);
  });

  await asyncTest('6.3 حظر التتبع عند تزوير التوكن وإرجاع 403 Forbidden', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      method: 'GET',
      url: `/api/v1/checkout?action=track&token=invalid.token.here&tenant_slug=almahrusa`,
      query: { action: 'track', token: 'invalid.token.here', tenant_slug: 'almahrusa' },
      headers: {},
      body: {}
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => { responseBody = data; }
        };
      }
    };

    await checkoutHandler(mockReq, mockRes);
    assert.strictEqual(responseStatus, 403);
    assert.strictEqual(responseBody.code, 'INVALID_CAPABILITY_TOKEN');
  });

  await asyncTest('6.4 اختبار ترقية ودمج طلبات الضيف السابقة للحساب المسجل (Account Promotion)', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      method: 'POST',
      url: '/api/v1/checkout?action=link-guest-orders',
      query: { action: 'link-guest-orders' },
      headers: {},
      body: {
        tenantSlug: 'almahrusa',
        phone: '0555551234',
        customerName: 'أبو فهد العتيبي'
      }
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        responseStatus = code;
        return {
          json: (data) => { responseBody = data; }
        };
      }
    };

    await checkoutHandler(mockReq, mockRes);
    assert.strictEqual(responseStatus, 200);
    assert.ok(responseBody.success);
    assert.ok(responseBody.linkedOrdersCount >= 0);
  });

  console.log('='.repeat(80));
  console.log(`  🎉 النتيجة النهائية: ${passed} من أصل ${total} اختبارات اجتازت بنجاح تام!`);
  console.log('='.repeat(80));

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
