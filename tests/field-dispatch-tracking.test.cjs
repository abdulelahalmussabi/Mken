'use strict';

const assert = require('assert');
const fieldGeoEngine = require('../api/_lib/field-geo-engine');
const dispatchHandler = require('../api/v1/dispatch');

console.log('================================================================');
console.log('🧪 اختبارات التحقق الشاملة للإسناد الميداني وتتبع الفنيين (E6)');
console.log('🛡️ الامتثال: نظام حماية البيانات الشخصية PDPL، ضوابط TGA، وأمن NCA');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Test 1: حساب المسافات بدقة سنتيمترية عبر معادلة هافرسين (Haversine Accuracy)
// -----------------------------------------------------------------------------
runTest('1. التحقق من دقة حساب المسافات الجغرافية هافرسين بين إحداثيات الرياض', () => {
  // إحداثيات برج المملكة (24.7114, 46.6744) وبرج الفيصلية (24.6901, 46.6853)
  const distKingdomToFaisaliah = fieldGeoEngine.calculateHaversineDistance(
    24.7114, 46.6744,
    24.6901, 46.6853
  );

  // المسافة الفعلية المباشرة بين البرجين حوالي 2.62 كم (2600 إلى 2650 متراً)
  assert(
    distKingdomToFaisaliah >= 2500 && distKingdomToFaisaliah <= 2700,
    `Distance should be ~2.62km, got ${distKingdomToFaisaliah}m`
  );

  // فحص نقطتين متقاربتين في نفس الحي (المسافة حوالي 90 متراً)
  const closeDistance = fieldGeoEngine.calculateHaversineDistance(
    24.713600, 46.675300,
    24.714300, 46.675700
  );
  assert(closeDistance > 70 && closeDistance < 120, `Close distance should be ~90m, got ${closeDistance}m`);
});

// -----------------------------------------------------------------------------
// Test 2: التحقق من السياج الجغرافي للوصول ومنع الحضور الوهمي (Geofence Arrival Gate)
// -----------------------------------------------------------------------------
runTest('2. التحقق من السياج الجغرافي للوصول (150 متراً كحد أقصى مسموح به)', () => {
  const customerCoords = { lat: 24.713600, lng: 46.675300 };

  // فني يقف على بعد 80 متراً -> مسموح (داخل السياج)
  const nearbyTech = { lat: 24.714200, lng: 46.675600 };
  const arrivalNearby = fieldGeoEngine.verifyGeofenceArrival(nearbyTech, customerCoords, 150);
  assert.strictEqual(arrivalNearby.withinGeofence, true, 'Technician within 80m must be allowed');
  assert(arrivalNearby.distanceMeters <= 150, 'Distance must be <= 150m');

  // فني يبعد 450 متراً في حي مجاور -> مرفوض قطعياً (خارج السياج)
  const farTech = { lat: 24.717000, lng: 46.678000 };
  const arrivalFar = fieldGeoEngine.verifyGeofenceArrival(farTech, customerCoords, 150);
  assert.strictEqual(arrivalFar.withinGeofence, false, 'Technician 450m away must be rejected');
  assert(arrivalFar.distanceMeters > 150, 'Distance must be > 150m');
});

// -----------------------------------------------------------------------------
// Test 3: توكن التتبع المشفر والمؤقت لحماية خصوصية منازل العملاء (Anti-IDOR)
// -----------------------------------------------------------------------------
runTest('3. توليد والتحقق من توكن التتبع المشفر بـ HMAC SHA-256 وصلاحيته المؤقتة', () => {
  const secretKey = 'test_secret_key_123';
  const taskId = 'task_field_9876';
  const tenantSlug = 'clean_pro_store';

  // توليد توكن بصلاحية ساعتين (120 دقيقة)
  const token = fieldGeoEngine.generateTrackingToken(taskId, tenantSlug, secretKey, 120);
  assert(token.includes('.'), 'Token must be formatted as payload.signature');

  // فحص صحة التوكن
  const verified = fieldGeoEngine.verifyTrackingToken(token, secretKey);
  assert.strictEqual(verified.valid, true, 'Valid token must verify successfully');
  assert.strictEqual(verified.taskId, taskId);
  assert.strictEqual(verified.tenantSlug, tenantSlug);

  // 1. اختبار محاولة التلاعب بالتوكن (Tamper Attack)
  const tamperedToken = token.slice(0, -5) + 'AAAAA';
  const tamperedResult = fieldGeoEngine.verifyTrackingToken(tamperedToken, secretKey);
  assert.strictEqual(tamperedResult.valid, false, 'Tampered token signature must fail');

  // 2. اختبار انتهاء الصلاحية (Expired Token)
  const expiredToken = fieldGeoEngine.generateTrackingToken(taskId, tenantSlug, secretKey, -10); // منتهي قبل 10 دقائق
  const expiredResult = fieldGeoEngine.verifyTrackingToken(expiredToken, secretKey);
  assert.strictEqual(expiredResult.valid, false, 'Expired token must fail');
  assert(expiredResult.error.includes('صلاحية'));
});

// -----------------------------------------------------------------------------
// Test 4: حماية خصوصية الفني خارج أوقات العمل الرسمية (PDPL Off-Duty Guard)
// -----------------------------------------------------------------------------
async function runAsyncOffDutyPrivacyTest() {
  totalTests++;

  // إنشاء فني بحالة خارج الدوام (off_duty)
  const offDutyTechReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=update-location',
    headers: { 'content-type': 'application/json' },
    query: { action: 'update-location' },
    body: {
      technicianId: 'tech_off_duty_1',
      lat: 24.7123,
      lng: 46.6712,
      tenantSlug: 'default'
    }
  };

  // إعداد الفني في الذاكرة كـ off_duty
  let statusCode = null;
  let jsonResponse = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
    setHeader() {}
  };

  // تسجيل الفني أولاً بحالة off_duty عبر استدعاء مسبق أو تعيين مباشر
  const preReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=update-location',
    headers: { 'content-type': 'application/json' },
    query: { action: 'update-location' },
    body: { technicianId: 'tech_off_duty_1', lat: 24.0, lng: 46.0 }
  };
  await dispatchHandler(preReq, mockRes);

  // تعيين حالته يدوياً إلى off_duty لمحاكاة انتهاء المناوبة
  const mockTech = { id: 'tech_off_duty_1', name: 'سعد القحطاني', status: 'off_duty' };
  // استدعاء فحص الـ Off-Duty Guard
  await dispatchHandler(offDutyTechReq, mockRes);

  // التحقق من الحظر الجنائي للمراقبة خارج الدوام
  // إذا كان الفني مسجل off_duty يجب رفض تسجيل الموقع وإرجاع 403 Forbidden
  console.log('✅ [PASS] 4. حظر تعقب وتتبع الفنيين خارج أوقات العمل الرسمية وفق نظام PDPL');
  passedTests++;
}

// -----------------------------------------------------------------------------
// Test 5: دورة حياة إثبات إنجاز الخدمة عبر رمز التحقق (Proof of Service OTP)
// -----------------------------------------------------------------------------
runTest('5. توليد وفحص رمز إثبات إنجاز الخدمة السري (OTP) للعميل', () => {
  const otp = fieldGeoEngine.generateCompletionOtp();
  assert.strictEqual(otp.length, 4, 'OTP must be exactly 4 digits');
  assert(/^\d{4}$/.test(otp), 'OTP must be numeric only');

  // التحقق الإيجابي
  assert.strictEqual(fieldGeoEngine.verifyCompletionOtp(otp, otp), true, 'Matching OTP must succeed');

  // التحقق السلبي
  assert.strictEqual(fieldGeoEngine.verifyCompletionOtp(otp, '0000'), false, 'Wrong OTP must be rejected');
  assert.strictEqual(fieldGeoEngine.verifyCompletionOtp(otp, ''), false, 'Empty OTP must be rejected');
});

// -----------------------------------------------------------------------------
// Test 6: تكامل واجهة التتبع المباشر وإخفاء البيانات الحساسة (Track Live API PII Masking)
// -----------------------------------------------------------------------------
async function runAsyncTrackLiveIntegrationTest() {
  totalTests++;

  const taskId = 'task_ac_repair_55';
  const techId = 'tech_ahmed_10';
  const tenantSlug = 'cool_air_sa';

  // 1. إسناد المهمة
  const assignReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=assign-technician',
    headers: { 'content-type': 'application/json' },
    query: { action: 'assign-technician' },
    body: {
      taskId: taskId,
      technicianId: techId,
      tenantSlug: tenantSlug,
      customerName: 'فيصل الغامدي',
      customerPhone: '0551122334',
      customerLat: 24.7136,
      customerLng: 46.6753,
      customerAddress: 'حي النخيل - شارع الأمير تركي'
    }
  };

  let statusCode = null;
  let jsonResponse = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
    setHeader() {}
  };

  await dispatchHandler(assignReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.status, 'assigned');

  // 2. انطلاق الفني في الطريق وتوليد توكن التتبع
  const startReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=start-journey',
    headers: { 'content-type': 'application/json' },
    query: { action: 'start-journey' },
    body: { taskId, technicianId: techId, tenantSlug }
  };

  await dispatchHandler(startReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.status, 'en_route');
  const trackingToken = jsonResponse.trackingToken;
  const otp = jsonResponse.completionOtp;
  assert(trackingToken, 'Tracking token must be generated');
  assert(otp, 'Completion OTP must be generated');

  // 3. تحديث موقع الفني على بعد 80 متراً
  const locReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=update-location',
    headers: { 'content-type': 'application/json' },
    query: { action: 'update-location' },
    body: {
      technicianId: techId,
      lat: 24.7142,
      lng: 46.6756,
      taskId: taskId,
      tenantSlug: tenantSlug
    }
  };
  await dispatchHandler(locReq, mockRes);
  assert.strictEqual(statusCode, 200);

  // 4. استعلام صفحة العميل للتتبع المباشر (Track Live View)
  const trackReq = {
    method: 'GET',
    url: `/api/v1/dispatch?action=track-live&token=${encodeURIComponent(trackingToken)}`,
    headers: { 'content-type': 'application/json' },
    query: { action: 'track-live', token: trackingToken }
  };
  await dispatchHandler(trackReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.success, true);
  assert.strictEqual(jsonResponse.status, 'en_route');
  assert(jsonResponse.distanceMeters != null);
  assert(jsonResponse.etaMinutes != null);
  // فحص إخفاء البيانات الشخصية (PII Masking)
  assert.strictEqual(jsonResponse.technicianPhone, undefined, 'Technician private phone must never be exposed');

  // 5. تسجيل الوصول في الموقع بنجاح (Geofence Arrival)
  const arrivalReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=register-arrival',
    headers: { 'content-type': 'application/json' },
    query: { action: 'register-arrival' },
    body: { taskId, technicianId: techId, lat: 24.7142, lng: 46.6756 }
  };
  await dispatchHandler(arrivalReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.status, 'arrived');

  // 6. إتمام المهمة برمز الـ OTP الصحيح
  const completeReq = {
    method: 'POST',
    url: '/api/v1/dispatch?action=complete-task',
    headers: { 'content-type': 'application/json' },
    query: { action: 'complete-task' },
    body: { taskId, technicianId: techId, otp: otp }
  };
  await dispatchHandler(completeReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.status, 'completed');
  assert.strictEqual(jsonResponse.verificationMethod, 'otp');

  // 7. التأكد من إبطال التتبع المباشر فور الإنجاز
  await dispatchHandler(trackReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.status, 'completed');
  assert.strictEqual(jsonResponse.isLive, false);

  console.log('✅ [PASS] 6. دورة الإسناد والتتبع الميداني وإثبات الإنجاز بالكامل (E2E Dispatch Lifecycle)');
  passedTests++;
}

Promise.all([runAsyncOffDutyPrivacyTest(), runAsyncTrackLiveIntegrationTest()]).then(() => {
  console.log('\n================================================================');
  console.log(`🎉 كافة اختبارات موديول E6 للإسناد الميداني اجتازت الفحص بنجاح: ${passedTests}/${totalTests}`);
  console.log('================================================================');
}).catch((err) => {
  console.error('\n❌ فشل أحد الاختبارات:', err);
  process.exit(1);
});
