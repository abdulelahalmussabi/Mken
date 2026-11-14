'use strict';

/**
 * منصة مكّن — محرك الهوية التكيفية وعزل المستأجر للطلبات كضيف (Adaptive IAM & Capability Engine)
 * الامتثال: نظام حماية البيانات الشخصية (PDPL) المادتان 3 و 10 (مبدأ تقليل جمع البيانات)
 * نظام التجارة الإلكترونية السعودي (المرسوم م/126) ولائحة الفوترة الإلكترونية (ZATCA)
 * ضوابط الأمن السيبراني للأنظمة السحابية (NCA CCC-2:2024 / ECC-2:2024)
 */

const crypto = require('crypto');
const sbEnv = require('./supabase-env');

// مفتاح التوقيع السري الداخلي المشتق لتوليد روابط الصلاحية الموقعة (Capability Tokens)
function getSecretPepper() {
  const s = sbEnv.getSupabaseServiceKey() || process.env.SUPABASE_SERVICE_ROLE_KEY || 'MKEN_SAUDI_SECURE_CAPABILITY_PEPPER_2026';
  return crypto.createHash('sha256').update('MKEN_ADAPTIVE_IAM_PEPPER:' + s).digest();
}

/**
 * دليل تصنيف الأنشطة التجارية ومحددات الهوية والامتثال في المملكة
 */
const ACTIVITY_POLICIES = {
  commerce: {
    category: 'RETAIL',
    nameAr: 'تجارة عامة وتجزئة',
    allowGuestCheckout: true,
    requiresNationalId: false,
    requiresNafath: false,
    pdplRetentionDays: 730,
    zatcaInvoiceType: 'SIMPLIFIED'
  },
  retail: {
    category: 'RETAIL',
    nameAr: 'متاجر البضائع الاستهلاكية',
    allowGuestCheckout: true,
    requiresNationalId: false,
    requiresNafath: false,
    pdplRetentionDays: 730,
    zatcaInvoiceType: 'SIMPLIFIED'
  },
  restaurant: {
    category: 'RETAIL',
    nameAr: 'المطاعم والمقاهي والأغذية',
    allowGuestCheckout: true,
    requiresNationalId: false,
    requiresNafath: false,
    pdplRetentionDays: 365,
    zatcaInvoiceType: 'SIMPLIFIED'
  },
  services: {
    category: 'SERVICES',
    nameAr: 'الخدمات العامة والصيانة الميدانية',
    allowGuestCheckout: true,
    requiresNationalId: false,
    requiresNafath: false,
    pdplRetentionDays: 365,
    zatcaInvoiceType: 'SIMPLIFIED'
  },
  events: {
    category: 'SERVICES',
    nameAr: 'حجوزات الفعاليات والترفيه',
    allowGuestCheckout: true,
    requiresNationalId: false,
    requiresNafath: false,
    pdplRetentionDays: 365,
    zatcaInvoiceType: 'SIMPLIFIED'
  },
  hotel: {
    category: 'HOSPITALITY',
    nameAr: 'الفنادق ومرافق الإيواء السياحي',
    allowGuestCheckout: false, // استلام الغرفة الرقمية مقيد نظاماً ببيانات النزيل وشموس
    requiresNationalId: true,
    requiresNafath: true,
    pdplRetentionDays: 1825,
    zatcaInvoiceType: 'STANDARD'
  },
  telecom: {
    category: 'TELECOM',
    nameAr: 'شرائح واتصالات سحابية',
    allowGuestCheckout: false,
    requiresNationalId: true,
    requiresNafath: true,
    pdplRetentionDays: 1825,
    zatcaInvoiceType: 'STANDARD'
  },
  fintech: {
    category: 'FINTECH',
    nameAr: 'التقسيط والخدمات المالية الميسرة',
    allowGuestCheckout: false,
    requiresNationalId: true,
    requiresNafath: true,
    pdplRetentionDays: 3650,
    zatcaInvoiceType: 'STANDARD'
  }
};

/**
 * تصنيف مخاطر النشاط واشتراطات الهوية
 * @param {string} activityId 
 * @returns {Object}
 */
function classifyActivity(activityId) {
  const act = String(activityId || 'commerce').toLowerCase().trim();
  if (ACTIVITY_POLICIES[act]) {
    return Object.assign({ activityId: act }, ACTIVITY_POLICIES[act]);
  }
  // الافتراضي للأنشطة غير المصنفة: تجارة عامة ممتثلة لمبدأ تقليل البيانات
  return Object.assign({ activityId: act }, ACTIVITY_POLICIES.commerce);
}

/**
 * التحقق من متطلبات الهوية عند الشروع في الطلب
 */
function validateCheckoutRequirements({ activityId, isGuest = true, customerPhone, nationalId, userAuth }) {
  const policy = classifyActivity(activityId);

  // إذا كان النشاط مقيداً نظاماً ولا يسمح بالشراء المجهول
  if (!policy.allowGuestCheckout && isGuest && !userAuth) {
    if (policy.category === 'HOSPITALITY') {
      return {
        allowed: false,
        code: 'KYC_REQUIRED_HOTEL',
        error: 'وفقاً للائحة مرافق الضيافة السياحية بالمملكة، يلزم توثيق هوية النزيل عبر نفاذ أو إبراز الجواز قبل تأكيد تسليم الغرفة.'
      };
    }
    if (policy.category === 'FINTECH' || policy.category === 'TELECOM') {
      return {
        allowed: false,
        code: 'KYC_REQUIRED_REGULATED',
        error: `النشاط المحدد (${policy.nameAr}) خاضع لاشتراطات رقابية سيادية تلزم بالتحقق البيومتري من الهوية.`
      };
    }
  }

  // في الأنشطة التجارية العادية: حظر طلب الهوية الوطنية طبقاً للمادة 10 من نظام PDPL
  if (policy.allowGuestCheckout && nationalId && isGuest) {
    console.warn(`[PDPL GUARD] التنبيه: تلقي رقم هوية وطنية لنشاط تجزئة عامة (${activityId}). سيتم استبعاده فوراً التزاماً بمبدأ تقليل البيانات.`);
  }

  return {
    allowed: true,
    policy: policy
  };
}

/**
 * توليد رمز صلاحية التتبع المشفر الذاتي (Signed Capability Token)
 * يضمن وصول العميل لطلبه حصراً بدون تسجيل دخول وبدون تعريض المتجر لثغرة IDOR
 */
function generateTrackingCapabilityToken({ tenantSlug, orderId, phone = '', ttlDays = 14 }) {
  if (!tenantSlug || !orderId) {
    throw new Error('Tenant slug and order ID are required to generate capability token');
  }

  const exp = Math.floor(Date.now() / 1000) + (ttlDays * 86400);
  const pfx = String(phone || '').slice(-4); // آخر 4 أرقام للمطابقة الإضافية
  const payload = {
    tid: String(tenantSlug).trim(),
    oid: String(orderId).trim(),
    exp: exp,
    pfx: pfx,
    v: 1
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecretPepper())
    .update(serialized)
    .digest('base64url');

  const token = `${serialized}.${signature}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return {
    token: token,
    tokenHash: tokenHash,
    expiresAt: new Date(exp * 1000).toISOString(),
    trackingUrl: `/track.html?token=${token}&order_id=${encodeURIComponent(orderId)}`
  };
}

/**
 * فحص والتحقق من صحة توكن التتبع المشفر
 */
function verifyTrackingCapabilityToken(token, expectedTenantSlug = null) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'رمز التتبع مفقود أو غير صالح' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'هيكل رمز التتبع غير سليم' };
  }

  const [serialized, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', getSecretPepper())
    .update(serialized)
    .digest('base64url');

  // فحص التوقيع مع الحماية ضد التوقيت (Constant Time Comparison)
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'توقيع رمز التتبع غير صحيح أو تم التلاعب به' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8'));
  } catch (err) {
    return { valid: false, error: 'فشل تفكيك بيانات رمز التتبع' };
  }

  // فحص تاريخ الصلاحية
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    return { valid: false, error: 'انتهت صلاحية رمز التتبع المؤقت' };
  }

  // فحص عزل المستأجر الصارم (Cross-Tenant Token Isolation)
  if (expectedTenantSlug && payload.tid !== expectedTenantSlug) {
    return {
      valid: false,
      error: 'رمز التتبع لا ينتمي لهذا المتجر المصرح به (مخالفة عزل المستأجر)',
      code: 'CROSS_TENANT_VIOLATION'
    };
  }

  return {
    valid: true,
    tenantSlug: payload.tid,
    orderId: payload.oid,
    phoneSuffix: payload.pfx,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

/**
 * توليد الفهرس الأعمى لرقم الجوال (Blind Index)
 * لحماية خصوصية المستهلكين وفق PDPL وتمكين البحث دون تخزين رقم الهاتف الصريح
 */
function computePhoneBlindIndex(phone, tenantSlug = 'global') {
  if (!phone) return null;
  const normalized = String(phone).replace(/\D/g, '');
  const salt = `MKEN_TENANT_SALT_${tenantSlug}`;
  return crypto.createHmac('sha256', getSecretPepper())
    .update(`${salt}:${normalized}`)
    .digest('hex');
}

module.exports = {
  ACTIVITY_POLICIES,
  classifyActivity,
  validateCheckoutRequirements,
  generateTrackingCapabilityToken,
  verifyTrackingCapabilityToken,
  computePhoneBlindIndex
};
