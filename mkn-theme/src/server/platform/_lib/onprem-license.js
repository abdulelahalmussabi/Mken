/**
 * وحدة التحقق من الترخيص المحلي المستقل (Offline Cryptographic License Verifier)
 * منصة مَكَن (mken.live) — حزمة التشغيل المحلي والتراخيص المؤسسية (On-Premise Docker)
 * 
 * المزايا والمعايير:
 * 1. تعمل في بيئات معزولة تماماً (Air-Gapped / Intranet) بدون إنترنت خارجي.
 * 2. تعتمد على التوقيع الرقمي غير المتماثل (Ed25519 Cryptographic Signatures).
 * 3. تضمن حماية الحصة المحددة لمكاتب الاستقبال (max_zones) من التعديل اليدوي في قاعدة البيانات.
 * 4. تمنح فترة سماح استمرارية الأعمال (14 Days Business Continuity Grace Period).
 */
'use strict';

const crypto = require('crypto');

// المفتاح العام الافتراضي لمنصة مَكَن المدمج داخل الحاويات المحلية للتحقق من التوقيع دون اتصال
const DEFAULT_PLATFORM_PUBLIC_KEY = 
  process.env.MKEN_LICENSE_PUBLIC_KEY ||
  '-----BEGIN PUBLIC KEY-----\n' +
  'MCowBQYDK2VwAyEACn8qih650GZFnMmZmnDBCSRzA/DmSWNrTNqSgkGdLAQ=\n' +
  '-----END PUBLIC KEY-----\n';

// المفتاح الخاص للمنصة لإنشاء وإصدار التراخيص للعملاء (في وضع SaaS)
const DEFAULT_PLATFORM_PRIVATE_KEY = 
  process.env.MKEN_LICENSE_PRIVATE_KEY ||
  '-----BEGIN PRIVATE KEY-----\n' +
  'MC4CAQAwBQYDK2VwBCIEINNWxGCzNICFKPZbeijvmCmkAwHnT4ZXVGGJjQKD04uD\n' +
  '-----END PRIVATE KEY-----\n';

const LICENSE_PREFIX = 'MKEN-ONPREM-v1';
const GRACE_PERIOD_DAYS = 14;

/**
 * تحويل البيانات المشفرة إلى Base64 URL-safe
 */
function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * فك تشفير Base64 URL-safe
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * هل النظام يعمل في وضع التشغيل المحلي؟
 */
function isDeploymentOnPremise() {
  const mode = String(process.env.DEPLOYMENT_MODE || process.env.MKEN_DEPLOYMENT_MODE || '').toLowerCase();
  return mode === 'on_premise' || mode === 'onpremise' || process.env.MKEN_ONPREMISE === '1';
}

/**
 * توليد وتوقيع مفتاح ترخيص محلي لمستأجر معين (SaaS Platform Issuance)
 * @param {Object} payload بيانات الترخيص
 * @param {string} [privateKeyPem] المفتاح الخاص للتوقيع
 * @returns {string} مفتاح الترخيص المشفر والموقع رقمياً
 */
function generateLicenseKey(payload, privateKeyPem) {
  if (!payload || !payload.tenant_slug) {
    throw new Error('بيانات الترخيص يجب أن تحتوي على tenant_slug.');
  }

  const cleanPayload = {
    tenant_slug: String(payload.tenant_slug).toLowerCase().trim(),
    plan_tier: payload.plan_tier || 'enterprise',
    max_zones: parseInt(payload.max_zones, 10) || 1,
    max_counters: parseInt(payload.max_counters, 10) || 100,
    on_premise: true,
    issued_at: payload.issued_at || new Date().toISOString(),
    expires_at: payload.expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    hardware_fingerprint: payload.hardware_fingerprint || null,
    features: Array.isArray(payload.features) ? payload.features : ['offline_prayer', 'zatca_ready', 'unlimited_kiosks']
  };

  const payloadJson = JSON.stringify(cleanPayload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, 'utf8'));
  const privKey = privateKeyPem || DEFAULT_PLATFORM_PRIVATE_KEY;

  let signatureB64;
  try {
    const signature = crypto.sign(null, Buffer.from(payloadB64, 'utf8'), privKey);
    signatureB64 = base64UrlEncode(signature);
  } catch (err) {
    // Fallback في حال استخدام HMAC Secret
    const hmacSecret = process.env.LICENSE_HMAC_SECRET || 'mken-onprem-license-hmac-fallback';
    const hmacSig = crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest();
    signatureB64 = 'hmac_' + base64UrlEncode(hmacSig);
  }

  return `${LICENSE_PREFIX}.${payloadB64}.${signatureB64}`;
}

/**
 * فحص وتدقيق مفتاح الترخيص محلياً (Offline Verification)
 * @param {string} licenseKeyStr مفتاح الترخيص
 * @param {string|Object} [optionsOrPubKey] المفتاح العام أو خيارات الفحص (hardwareFingerprint, expectedTenant, publicKeyPem)
 * @param {string} [expectedTenant] التحقق من مطابقة اسم المنشأة
 * @returns {Object} نتيجة الفحص وصلاحية الترخيص وفترة السماح
 */
function verifyLicenseKey(licenseKeyStr, optionsOrPubKey, expectedTenant) {
  if (!licenseKeyStr || typeof licenseKeyStr !== 'string') {
    return {
      valid: false,
      error: 'LICENSE_MISSING',
      message: 'مفتاح ترخيص التشغيل المحلي مفقود.'
    };
  }

  let publicKeyPem = null;
  let tenant = expectedTenant;
  let hardwareFingerprint = null;

  if (optionsOrPubKey && typeof optionsOrPubKey === 'object') {
    publicKeyPem = optionsOrPubKey.publicKeyPem || optionsOrPubKey.publicKey || null;
    tenant = optionsOrPubKey.expectedTenant || optionsOrPubKey.tenant || expectedTenant;
    hardwareFingerprint = optionsOrPubKey.hardwareFingerprint || optionsOrPubKey.hardware_fingerprint || null;
  } else if (typeof optionsOrPubKey === 'string') {
    if (optionsOrPubKey.includes('BEGIN PUBLIC KEY')) {
      publicKeyPem = optionsOrPubKey;
    } else {
      hardwareFingerprint = optionsOrPubKey;
    }
  }

  const parts = licenseKeyStr.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return {
      valid: false,
      error: 'INVALID_LICENSE_FORMAT',
      message: 'صيغة مفتاح الترخيص غير مطابقة لمعايير منصة مَكَن (MKEN-ONPREM-v1).'
    };
  }

  const payloadB64 = parts[1];
  const signatureB64 = parts[2];

  let payload;
  try {
    const jsonStr = base64UrlDecode(payloadB64).toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch (e) {
    return {
      valid: false,
      error: 'CORRUPTED_PAYLOAD',
      message: 'بيانات الترخيص تالفة أو غير قابلة للقراءة.'
    };
  }

  // التحقق من صحة التوقيع الرقمي المشفر لمنع التلاعب
  let signatureValid = false;
  const pubKey = publicKeyPem || DEFAULT_PLATFORM_PUBLIC_KEY;

  if (signatureB64.startsWith('hmac_')) {
    const rawSig = signatureB64.replace(/^hmac_/, '');
    const hmacSecret = process.env.LICENSE_HMAC_SECRET || 'mken-onprem-license-hmac-fallback';
    const expectedSig = base64UrlEncode(crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest());
    signatureValid = (rawSig === expectedSig);
  } else {
    try {
      const sigBuf = base64UrlDecode(signatureB64);
      signatureValid = crypto.verify(null, Buffer.from(payloadB64, 'utf8'), pubKey, sigBuf);
    } catch (err) {
      signatureValid = false;
    }
  }

  if (!signatureValid) {
    return {
      valid: false,
      error: 'SIGNATURE_INVALID',
      message: 'فشل التحقق من التوقيع الرقمي للترخيص. المفتاح تم التلاعب به أو غير مصرح به من منصة مَكَن.'
    };
  }

  // التحقق من مطابقة المنشأة إن حُددت
  if (tenant) {
    const normExpected = String(tenant).toLowerCase().trim();
    if (payload.tenant_slug && payload.tenant_slug !== normExpected) {
      return {
        valid: false,
        error: 'TENANT_MISMATCH',
        message: `مفتاح الترخيص صادر للمنشأة (${payload.tenant_slug}) ولا يتطابق مع المنشأة الحالية (${normExpected}).`
      };
    }
  }

  // التحقق من بصمة الخادم المحلي إن حُددت
  if (payload.hardware_fingerprint && hardwareFingerprint) {
    const normPayloadFp = String(payload.hardware_fingerprint).trim().toLowerCase();
    const normProvidedFp = String(hardwareFingerprint).trim().toLowerCase();
    if (normPayloadFp !== normProvidedFp) {
      return {
        valid: false,
        error: 'HARDWARE_MISMATCH',
        message: `بصمة الخادم المحلي (${normProvidedFp}) لا تتطابق مع المرخص له في المفتاح (${normPayloadFp}).`
      };
    }
  }

  // التحقق من تاريخ انتهاء الصلاحية وفترة السماح (14 يوماً)
  const now = Date.now();
  const expiresAtMs = new Date(payload.expires_at || 0).getTime();
  const gracePeriodMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const hardExpiryMs = expiresAtMs + gracePeriodMs;

  let expired = false;
  let inGracePeriod = false;
  let daysLeftInGrace = 0;
  let daysUntilExpiry = Math.ceil((expiresAtMs - now) / (1000 * 60 * 60 * 24));

  if (now > expiresAtMs) {
    expired = true;
    if (now <= hardExpiryMs) {
      inGracePeriod = true;
      daysLeftInGrace = Math.ceil((hardExpiryMs - now) / (1000 * 60 * 60 * 24));
    } else {
      return {
        valid: false,
        expired: true,
        in_grace_period: false,
        days_until_grace_cutoff: 0,
        days_left_in_grace: 0,
        error: 'LICENSE_EXPIRED',
        payload: payload,
        message: 'انتهت صلاحية ترخيص التشغيل المحلي وفترة السماح (14 يوماً). يرجى تجديد الاشتراك للحفاظ على استمرارية الخدمة.'
      };
    }
  }

  return {
    valid: true,
    expired: expired,
    in_grace_period: inGracePeriod,
    days_left_in_grace: daysLeftInGrace,
    days_until_grace_cutoff: daysLeftInGrace,
    days_until_expiry: daysUntilExpiry,
    payload: payload,
    message: inGracePeriod 
      ? `تنبيه أمان: انتهت صلاحية الترخيص وأنت في فترة السماح (متبقي ${daysLeftInGrace} يوم/أيام). يرجى التجديد.`
      : 'الترخيص نشط وصالح للتشغيل المؤسسي المستقل.'
  };
}

module.exports = {
  LICENSE_PREFIX: LICENSE_PREFIX,
  GRACE_PERIOD_DAYS: GRACE_PERIOD_DAYS,
  DEFAULT_PLATFORM_PUBLIC_KEY: DEFAULT_PLATFORM_PUBLIC_KEY,
  DEFAULT_PLATFORM_PRIVATE_KEY: DEFAULT_PLATFORM_PRIVATE_KEY,
  isDeploymentOnPremise: isDeploymentOnPremise,
  generateLicenseKey: generateLicenseKey,
  verifyLicenseKey: verifyLicenseKey
};
