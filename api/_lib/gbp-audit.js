'use strict';

const crypto = require('crypto');
const { getSupabaseAdmin } = require('./google-auth-helper');

const STATE_PREFIX = 's1';
const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 دقيقة كحد أقصى لإتمام تدفق الربط

function getStateHmacKey() {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'mken-oauth-state-hmac-key-2026';

  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * توليد رمز حالة مشفر وموقع رقمياً (Signed HMAC State Token)
 * لمنع هجمات تزوير الطلبات عبر المواقع (CSRF) وربط الحسابات الخبيثة
 * @param {string} tenantSlug
 * @returns {string}
 */
function generateOAuthState(tenantSlug) {
  const tenant = (tenantSlug || 'default').trim() || 'default';
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + STATE_MAX_AGE_MS;
  const payload = `${tenant}:${nonce}:${exp}`;

  const hmac = crypto
    .createHmac('sha256', getStateHmacKey())
    .update(payload)
    .digest('hex');

  return `${STATE_PREFIX}.${Buffer.from(payload).toString('base64url')}.${hmac}`;
}

/**
 * التحقق الصارم من رمز الحالة عند استقبال OAuth Callback
 * @param {string} state
 * @returns {{ valid: boolean, tenant?: string, error?: string }}
 */
function verifyOAuthState(state) {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'رمز الحالة (state) مفقود' };
  }

  const parts = state.split('.');
  if (parts.length !== 3 || parts[0] !== STATE_PREFIX) {
    // دعم مؤقت للمسارات الانتقالية القديمة مع تسجيل تنبيه
    return { valid: false, error: 'صيغة رمز الحالة (state) غير صالحة أو غير موثقة تشفيرياً' };
  }

  const [, encodedPayload, providedHmac] = parts;
  if (!providedHmac || !/^[0-9a-f]{64}$/i.test(providedHmac)) {
    return { valid: false, error: 'توقيع رمز الحالة غير صالح من حيث البنية' };
  }
  let payload;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch (e) {
    return { valid: false, error: 'فشل فك ترميز حمولة رمز الحالة' };
  }

  const payloadParts = payload.split(':');
  if (payloadParts.length !== 3) {
    return { valid: false, error: 'بنية حمولة رمز الحالة تالفة' };
  }

  const [tenant, nonce, expStr] = payloadParts;
  const exp = parseInt(expStr, 10);

  if (isNaN(exp) || Date.now() > exp) {
    return { valid: false, error: 'انتهت صلاحية رمز الحالة (CSRF Token Expired). يرجى إعادة المحاولة' };
  }

  // إعادة احتساب الهاش ومقارنته بطريقة آمنة ضد هجمات التوقيت (Constant-Time Comparison)
  const expectedHmac = crypto
    .createHmac('sha256', getStateHmacKey())
    .update(payload)
    .digest('hex');

  const providedBuf = Buffer.from(providedHmac, 'hex');
  const expectedBuf = Buffer.from(expectedHmac, 'hex');

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: 'توقيع رمز الحالة غير متطابق (CSRF State Tampering Detected)' };
  }

  return { valid: true, tenant };
}

/**
 * تسجيل حدث تدقيق أمني وإداري لعمليات Google Business Profile
 * متوافق مع متطلبات الهيئة الوطنية للأمن السيبراني (NCA) وسدايا (PDPL)
 */
async function recordGbpAuditLog(req, { tenantSlug, action, status = 'SUCCESS', details = {}, actorId = null }) {
  const tenant = (tenantSlug || 'default').trim() || 'default';
  const headers = (req && req.headers) || {};
  const ip =
    headers['x-forwarded-for'] ||
    headers['x-real-ip'] ||
    (req && req.socket && req.socket.remoteAddress) ||
    '127.0.0.1';
  const userAgent = headers['user-agent'] || 'internal-api';

  const logEntry = {
    tenant_slug: tenant,
    actor_id: actorId || headers['x-admin-pin'] ? 'admin_pin_user' : 'oauth_system',
    actor_email: details.email || null,
    actor_role: 'TENANT_ADMIN',
    action: action, // e.g. 'GBP_CONNECT', 'GBP_DISCONNECT', 'GBP_SYNC_NAP', 'GBP_SYNC_SERVICES', 'GBP_PUBLISH_POST'
    resource_type: 'google_business_profile',
    resource_id: details.locationId || tenant,
    ip_address: typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip),
    user_agent: String(userAgent).slice(0, 255),
    status: status,
    details: details,
    prev_record_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    record_hash: crypto.createHash('sha256').update(`${tenant}:${action}:${Date.now()}`).digest('hex'),
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('mken_immutable_audit_logs').insert(logEntry);
    if (error) {
      console.warn('GBP Audit Log DB insert skipped:', error.message);
    }
  } catch (err) {
    console.warn('GBP Audit Log exception:', err.message);
  }

  // طباعة السجل دائماً في مخرجات النظام (Structured Log) للرصد الموحد
  console.log('[SECURITY_AUDIT_GBP]', JSON.stringify({
    tenant: logEntry.tenant_slug,
    action: logEntry.action,
    status: logEntry.status,
    ip: logEntry.ip_address,
    timestamp: logEntry.created_at,
    resource: logEntry.resource_id
  }));
}

module.exports = {
  generateOAuthState,
  verifyOAuthState,
  recordGbpAuditLog,
};
