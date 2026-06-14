const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const pushLib = require('../_lib/web-push');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pushLib.isPushConfigured()) {
    return res.status(503).json({
      error: 'VAPID keys missing on server. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.',
    });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const body = req.body || {};
  const tenantSlug = (body.tenantSlug || body.tenant_slug || 'default').trim() || 'default';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const result = await pushLib.sendPushToTenant(
      supabase,
      tenantSlug,
      'اختبار Push — مكِّن',
      'تم إعداد التنبيهات بنجاح. ستصلك إشعارات الحجوزات والتذكيرات هنا.',
      './admin.html'
    );

    if (result.skipped === 'no-subscriptions') {
      return res.status(404).json({
        error: 'لا توجد اشتراكات. اضغط «اشتراك هذا الجهاز» أولاً.',
        ...result,
      });
    }

    if (result.skipped) {
      return res.status(400).json({ error: result.skipped, ...result });
    }

    return res.status(200).json({ ok: true, message: 'تم إرسال إشعار الاختبار', ...result });
  } catch (err) {
    console.error('[push-test]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to send test push' });
  }
};
