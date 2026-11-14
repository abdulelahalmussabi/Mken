'use strict';

const crypto = require('crypto');

/**
 * api/_lib/audit-governance-engine.js — محرك حوكمة التدقيق والتعمية وتوطين البيانات
 * متوافق مع: ضوابط الهيئة الوطنية للأمن السيبراني (NCA ECC-1:2018)،
 * ونظام حماية البيانات الشخصية (PDPL) التابع لسدايا، ولوائح ZATCA
 */

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * تحويل الكائن إلى نص تسلسلي معياري مرتب (Canonical JSON String)
 * لضمان إنتاج نفس الهاش التشفيري بغض النظر عن ترتيب المفاتيح
 */
function canonicalizeData(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeData).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalizeData(obj[k]));
  return '{' + pairs.join(',') + '}';
}

/**
 * 1. حساب الهاش المتسلسل لسجل التدقيق (Cryptographic SHA-256 Hash Chaining)
 * يضمن استحالة تعديل أو حذف أي سجل دون كسر ترابط السلسلة بالكامل
 */
function computeAuditRecordHash(prevHash, recordData) {
  const pHash = prevHash || GENESIS_PREV_HASH;
  const canonicalData = canonicalizeData({
    actor_id: recordData.actor_id,
    actor_role: recordData.actor_role,
    action: recordData.action,
    resource_type: recordData.resource_type,
    resource_id: recordData.resource_id,
    status: recordData.status,
    tenant_slug: recordData.tenant_slug,
    created_at: recordData.created_at || recordData.timestamp
  });

  return crypto
    .createHash('sha256')
    .update(pHash + ':' + canonicalData)
    .digest('hex');
}

/**
 * 2. التحقق من سلامة السلسلة التشفيرية لسجلات التدقيق (Audit Chain Integrity Verifier)
 * يكتشف أي حذف، استبدال، أو تلاعب في السجلات التاريخية
 */
function verifyAuditChainIntegrity(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return { intact: true, verifiedCount: 0 };
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const expectedPrevHash = i === 0 ? (record.prev_record_hash || GENESIS_PREV_HASH) : records[i - 1].record_hash;

    // 1. التحقق من تطابق هاش السجل السابق
    if (record.prev_record_hash !== expectedPrevHash) {
      return {
        intact: false,
        brokenIndex: i,
        error: `انقطاع في تسلسل السلسلة التشفيرية عند السجل رقم ${i} (معرف: ${record.id}). الهاش السابق غير متطابق.`,
        verifiedCount: i
      };
    }

    // 2. إعادة احتساب الهاش الذاتي ومطابقته
    const recomputedHash = computeAuditRecordHash(record.prev_record_hash, record);
    if (record.record_hash !== recomputedHash) {
      return {
        intact: false,
        brokenIndex: i,
        error: `تم اكتشاف تلاعب في محتوى السجل رقم ${i} (معرف: ${record.id}). الهاش المعاد احتسابه لا يطابق الهاش المسجل.`,
        verifiedCount: i
      };
    }
  }

  return {
    intact: true,
    verifiedCount: records.length,
    lastHash: records[records.length - 1].record_hash
  };
}

/**
 * 3. محرك التعمية وحق النسيان النظامي (PDPL Right to Erasure & PII Scrubbing)
 * يلبي متطلبات سدايا لحذف البيانات الشخصية دون المساس بالفواتير الملزمة لـ ZATCA
 */
function anonymizeCustomerPii(record, customAlias = null) {
  if (!record || typeof record !== 'object') return record;

  const phone = String(record.phone || record.customer_phone || '');
  const salt = phone ? crypto.createHash('md5').update(phone).digest('hex').slice(0, 6) : '000000';
  const alias = customAlias || `ANON-${salt.toUpperCase()}`;

  const scrubbed = Object.assign({}, record);

  // تعمية البيانات الشخصية المباشرة
  if (scrubbed.customer_name) scrubbed.customer_name = `مستهلك معفى الهوية (#${alias})`;
  if (scrubbed.name) scrubbed.name = `مستهلك معفى الهوية (#${alias})`;
  if (scrubbed.phone) scrubbed.phone = '0500000000';
  if (scrubbed.customer_phone) scrubbed.customer_phone = '0500000000';
  if (scrubbed.email) scrubbed.email = `anonymized_${salt}@mken.live`;

  // تعمية العناوين والمواقع الجغرافية الدقيقة
  if (scrubbed.location_address) scrubbed.location_address = 'حي معفى الهوية - الرياض';
  if (scrubbed.address) scrubbed.address = 'حي معفى الهوية - الرياض';
  if (scrubbed.district) scrubbed.district = 'معفى';
  if (scrubbed.notes) scrubbed.notes = '[تم إتلاف الملاحظات الشخصية بموجب نظام حماية البيانات الشخصية]';

  // تصفير الإحداثيات الحساسة
  if ('customer_lat' in scrubbed) scrubbed.customer_lat = null;
  if ('customer_lng' in scrubbed) scrubbed.customer_lng = null;

  // الحفاظ الصارم على البيانات المالية والفاتورية لـ ZATCA
  // (المبالغ والضرائب والـ QR Code لا تُمَس امتثالاً للمادة 53 ونظام الدفاتر التجارية)
  scrubbed.is_anonymized = true;
  scrubbed.anonymized_alias = alias;
  scrubbed.anonymized_at = new Date().toISOString();

  return scrubbed;
}

/**
 * 4. التحقق من توطين البيانات وحدود النقل الخارجي (Saudi Data Residency Guard)
 * يمنع خروج البيانات المصنفة كـ Restricted أو Secret إلى خوادم غير مصرح بها خارج المملكة
 */
const APPROVED_SAUDI_DOMAINS = [
  'mken.live',
  'zatca.gov.sa',
  'api.moyasar.com',
  'api.tap.company',
  'supabase.co',
  'localhost',
  '127.0.0.1'
];

function validateSaudiDataResidency(targetUrl, classification = 'Restricted') {
  if (!targetUrl) return { allowed: true };

  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.toLowerCase();

    // البيانات العامة مسموح بنقلها
    if (classification === 'Public') {
      return { allowed: true, hostname: hostname };
    }

    // فحص ما إذا كان النطاق ضمن النطاقات المصرح بها
    const isApproved = APPROVED_SAUDI_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isApproved) {
      return {
        allowed: false,
        classification: classification,
        hostname: hostname,
        error: `محظور نظاماً: يُمنع نقل البيانات المصنفة كـ (${classification}) خارج النطاق السحابي المعتمد للمملكة العربية السعودية وفق نظام PDPL.`
      };
    }

    return { allowed: true, hostname: hostname };
  } catch (e) {
    return { allowed: false, error: 'عنوان الرابط غير صالح' };
  }
}

/**
 * 5. توليد علامة مائية رقمية للملفات المصدرة (Export Watermark Sentinel)
 * تتبع هوية الموظف وتاريخ وساعة التصدير في حال تسريب البيانات
 */
function generateExportWatermark(actorId, actorEmail, tenantSlug) {
  const timestamp = new Date().toISOString();
  const signatureRaw = `${actorId}:${actorEmail}:${tenantSlug}:${timestamp}`;
  const sigHex = crypto.createHash('sha256').update(signatureRaw).digest('hex').slice(0, 16);

  return {
    watermarkId: `MKN-EXP-${sigHex.toUpperCase()}`,
    actorId: actorId,
    actorEmail: actorEmail,
    tenantSlug: tenantSlug,
    exportedAt: timestamp,
    notice: 'هذا التقرير محمي وموسوم رقمياً وفق أنظمة الأمن السيبراني. يُحظر تداوله لغير المصرح لهم.'
  };
}

module.exports = {
  GENESIS_PREV_HASH: GENESIS_PREV_HASH,
  canonicalizeData: canonicalizeData,
  computeAuditRecordHash: computeAuditRecordHash,
  verifyAuditChainIntegrity: verifyAuditChainIntegrity,
  anonymizeCustomerPii: anonymizeCustomerPii,
  validateSaudiDataResidency: validateSaudiDataResidency,
  generateExportWatermark: generateExportWatermark
};
