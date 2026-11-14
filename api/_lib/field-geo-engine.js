'use strict';

const crypto = require('crypto');

/**
 * api/_lib/field-geo-engine.js — محرك الإسناد الجغرافي والتحقق من السياج والتشفير
 * متوافق مع: أنظمة حماية البيانات الشخصية PDPL، وضوابط الهيئة الوطنية للأمن السيبراني NCA
 */

const EARTH_RADIUS_METERS = 6371000; // نصف قطر الأرض التقريبي بالمتر

/**
 * 1. حساب المسافة الجغرافية الدقيقة بين نقطتين باستخدام معادلة هافرسين (Haversine Formula)
 * النتيجة بالأمتار
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (Number(deg) * Math.PI) / 180.0;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(Number(lat2) - Number(lat1));
  const Δλ = toRad(Number(lon2) - Number(lon1));

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = EARTH_RADIUS_METERS * c;

  return Math.round(distanceMeters * 100) / 100; // تقريب لأقرب سنتيمتر
}

/**
 * 2. التحقق من السياج الجغرافي للوصول (Geofence Arrival Verification)
 * الحد الافتراضي المعتمد للوصول هو 150 متراً من موقع العميل
 */
function verifyGeofenceArrival(techCoords, custCoords, thresholdMeters = 150) {
  if (!techCoords || !custCoords) {
    return { withinGeofence: false, distanceMeters: null, error: 'إحداثيات غير مكتملة' };
  }

  const distance = calculateHaversineDistance(
    techCoords.lat,
    techCoords.lng,
    custCoords.lat,
    custCoords.lng
  );

  return {
    withinGeofence: distance <= thresholdMeters,
    distanceMeters: distance,
    thresholdMeters: thresholdMeters
  };
}

/**
 * 3. توليد توكن تتبع مشفر ومؤقت (Signed Ephemeral Tracking Token)
 * يمنع هجمات الـ IDOR وكشط إحداثيات منازل العملاء
 */
function getSigningSecret(customSecret) {
  return customSecret || process.env.DISPATCH_SIGNING_SECRET || 'mken_dispatch_secret_key_2026';
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function generateTrackingToken(taskId, tenantSlug, customSecret = null, ttlMinutes = 120) {
  const secret = getSigningSecret(customSecret);
  const now = Date.now();
  const exp = now + ttlMinutes * 60 * 1000;

  const payload = {
    taskId: String(taskId),
    tenantSlug: String(tenantSlug || 'default'),
    iat: now,
    exp: exp
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${payloadEncoded}.${signature}`;
}

/**
 * 4. التحقق الصارم من توكن التتبع المشفر وصلاحيته الزمنية
 */
function verifyTrackingToken(token, customSecret = null) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'توكن التتبع مفقود' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'صيغة توكن التتبع غير صالحة' };
  }

  const [payloadEncoded, signature] = parts;
  const secret = getSigningSecret(customSecret);

  // حساب التوقيع المتوقع
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // مقارنة آمنة ضد هجمات التوقيت Timing Attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'رمز التوقيع الرقمي للتوكن غير صالح' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded));
    const now = Date.now();

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'انتهت صلاحية رابط التتبع' };
    }

    return {
      valid: true,
      taskId: payload.taskId,
      tenantSlug: payload.tenantSlug,
      exp: payload.exp
    };
  } catch (err) {
    return { valid: false, error: 'تعذر قراءة بيانات التوكن' };
  }
}

/**
 * 5. توليد رمز إثبات الخدمة السري (Proof of Service OTP)
 * كود رقمي عشوائي من 4 أرقام
 */
function generateCompletionOtp() {
  const randomInt = crypto.randomInt(1000, 9999);
  return String(randomInt);
}

/**
 * 6. التحقق الحتمي من رمز الـ OTP
 */
function verifyCompletionOtp(actualOtp, inputOtp) {
  if (!actualOtp || !inputOtp) return false;
  const actBuf = Buffer.from(String(actualOtp).trim());
  const inBuf = Buffer.from(String(inputOtp).trim());
  if (actBuf.length !== inBuf.length) return false;
  return crypto.timingSafeEqual(actBuf, inBuf);
}

/**
 * 7. حساب وقت الوصول التقريبي (ETA Calculation)
 * متوسط سرعة القيادة داخل المدن السعودية 30 - 35 كم/ساعة
 */
function calculateEtaMinutes(distanceMeters, avgSpeedKmh = 35) {
  const distanceKm = Math.max(0, Number(distanceMeters || 0)) / 1000.0;
  if (distanceKm <= 0.05) return 1; // إذا وصل تقريباً
  const hours = distanceKm / avgSpeedKmh;
  const minutes = Math.round(hours * 60);
  return Math.max(1, minutes);
}

module.exports = {
  EARTH_RADIUS_METERS: EARTH_RADIUS_METERS,
  calculateHaversineDistance: calculateHaversineDistance,
  verifyGeofenceArrival: verifyGeofenceArrival,
  generateTrackingToken: generateTrackingToken,
  verifyTrackingToken: verifyTrackingToken,
  generateCompletionOtp: generateCompletionOtp,
  verifyCompletionOtp: verifyCompletionOtp,
  calculateEtaMinutes: calculateEtaMinutes
};
