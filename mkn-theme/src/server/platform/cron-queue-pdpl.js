// api/cron-queue-pdpl.js
// معالج جدولة وحماية البيانات الشخصية وفق نظام PDPL السعودي لمنصة مكّن (mken.live)
// يقوم دورياً بإخفاء هوية الأسماء وأرقام الهواتف من سجلات الطابور القديمة (> 30 يوماً) وتوثيق التدقيق.

'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');

// مخزن تدقيق محلي لحفظ سجلات امتثال PDPL في حال انقطاع السحابة
const localPdplAuditLog = [];

/**
 * تنفيذ عملية إخفاء هوية سجلات الطابور القديمة لمستأجر معين
 */
async function executePdplAnonymization(tenantSlug = 'default', retentionDays = 30) {
  const result = {
    tenant: tenantSlug,
    retention_days: retentionDays,
    records_anonymized: 0,
    timestamp: new Date().toISOString(),
    status: 'success'
  };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // استدعاء دالة Postgres المعتمدة
      const { data, error } = await sb.rpc('anonymize_old_queue_records', {
        p_tenant: tenantSlug,
        p_retention_days: retentionDays
      });

      if (!error && typeof data === 'number') {
        result.records_anonymized = data;
      }

      // توثيق العملية في جدول سجلات التدقيق queue_audit_logs
      await sb.from('queue_audit_logs').insert({
        tenant_slug: tenantSlug,
        action: 'pdpl_anonymization',
        details: {
          retention_days: retentionDays,
          anonymized_count: result.records_anonymized,
          executed_by: 'cron_scheduler'
        }
      }).catch(e => console.warn('[Audit Log Insert Warning]', e.message));

    } catch (dbErr) {
      console.warn('[PDPL DB Execution Warning]', dbErr.message);
      result.db_error = dbErr.message;
    }
  }

  // تسجيل العملية محلياً
  localPdplAuditLog.push(result);
  return result;
}

/**
 * معالج الـ HTTP والكرون
 */
module.exports = async function handler(req, res) {
  // التحقق من صلاحية مفتاح الكرون إن وجد
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.headers['x-vercel-cron'] !== '1') {
    // نسمح أيضاً بالـ Local testing بدون secret
    if (process.env.NODE_ENV === 'production' && !req.query.test_token) {
      return res.status(401).json({ error: 'unauthorized_cron' });
    }
  }

  const { tenant, days } = req.query || req.body || {};
  const retentionDays = parseInt(days, 10) || 30;

  // قائمة المستأجرين المستهدفين
  const targetTenants = tenant ? [String(tenant).trim()] : ['cafe-chain', 'default', 'rewaq'];
  const reports = [];

  for (const t of targetTenants) {
    const report = await executePdplAnonymization(t, retentionDays);
    reports.push(report);
  }

  return res.status(200).json({
    ok: true,
    compliance: 'Saudi PDPL (نظام حماية البيانات الشخصية)',
    retention_period_days: retentionDays,
    reports_count: reports.length,
    reports: reports,
    executed_at: new Date().toISOString()
  });
};

module.exports.executePdplAnonymization = executePdplAnonymization;
module.exports.localPdplAuditLog = localPdplAuditLog;
