/**
 * منصة مكِّن — وسيط حوكمة سياق المستأجر وحماية الصلاحيات (Zero-Trust Tenant Context Guard)
 * كود المهمة: E1-RLS-01
 * الامتثال: نظام حماية البيانات الشخصية (PDPL) المادة 31 وضوابط NCA ECC-1:2018 (AC-1/AC-2)
 */

function extractTenantContext(req) {
  // 1. استخراج التوكن من ترويسة الطلب
  const authHeader = req.headers.authorization || req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { authenticated: false, tenantSlug: null, role: 'anonymous' };
  }

  const token = authHeader.slice(7).trim();
  try {
    // 2. فحص هيكل الـ JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

    // 3. التحقق من صلاحية التوكن الزمنية
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('Token expired');
    }

    const resolvedTenant = payload.tenant_slug || payload.tenant_id || (payload.user_metadata && payload.user_metadata.tenant_slug) || null;
    const resolvedRole = payload.role || (payload.app_metadata && payload.app_metadata.role) || 'staff';

    return {
      authenticated: true,
      tenantSlug: resolvedTenant,
      userId: payload.sub || payload.id || null,
      role: resolvedRole
    };
  } catch (err) {
    return { authenticated: false, tenantSlug: null, role: 'anonymous', error: err.message };
  }
}

/**
 * فرض عزل المستأجر: منع أي مستخدم من الوصول لبيانات مستأجر آخر
 * @param {Object} req 
 * @param {Object} res 
 * @param {string} targetTenantSlug - المستأجر المطلوب الوصول لبياناته
 * @returns {boolean} true إذا كان مصرحاً له، false إذا تم حظر الطلب
 */
function enforceTenantIsolation(req, res, targetTenantSlug) {
  const context = extractTenantContext(req);

  // 1. صلاحيات المشرف العام (Super Admin / Service Role)
  if (context.role === 'super_admin' || context.role === 'service_role') {
    return true;
  }

  // 2. التحقق من وجود تسجيل دخول صالح
  if (!context.authenticated || !context.tenantSlug) {
    res.status(401).json({
      error: 'Unauthorized: Missing or invalid authentication token',
      code: 'AUTH_REQUIRED'
    });
    return false;
  }

  // 3. التحقق الصارم من تطابق هوية المستأجر لمنع تسرب البيانات والتعديل العابر (Cross-Tenant Guard)
  if (targetTenantSlug && context.tenantSlug !== targetTenantSlug) {
    console.warn(`[SECURITY ALERT] Cross-tenant violation attempted! Token tenant: [${context.tenantSlug}], Target tenant: [${targetTenantSlug}]`);
    res.status(403).json({
      error: 'Forbidden: You do not have permission to access another tenant data',
      code: 'CROSS_TENANT_VIOLATION'
    });
    return false;
  }

  return true;
}

module.exports = {
  extractTenantContext,
  enforceTenantIsolation
};
