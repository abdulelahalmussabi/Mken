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

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const body = req.body || {};
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const keys = body.keys;
  const tenantSlug = (body.tenantSlug || body.tenant_slug || 'default').trim() || 'default';

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Missing endpoint or keys' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const enabled = await pushLib.isPushEnabledForTenant(supabase, tenantSlug);
    if (!enabled) {
      return res.status(400).json({ error: 'Push not enabled for this tenant' });
    }

    const row = {
      tenant_slug: tenantSlug,
      endpoint,
      keys,
      label: typeof body.label === 'string' ? body.label.slice(0, 40) : 'admin',
      user_agent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('mken_push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });

    if (error) throw error;

    return res.status(200).json({ ok: true, tenantSlug });
  } catch (err) {
    console.error('[push-subscribe]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to save subscription' });
  }
};
