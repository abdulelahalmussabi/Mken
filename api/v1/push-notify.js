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
  const tenantSlug = (body.tenantSlug || body.tenant_slug || 'default').trim() || 'default';
  const title = typeof body.title === 'string' ? body.title.slice(0, 120) : 'مكِّن';
  const text = typeof body.body === 'string' ? body.body.slice(0, 500) : '';
  const url = typeof body.url === 'string' ? body.url.slice(0, 200) : './admin.html';

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const result = await pushLib.sendPushToTenant(supabase, tenantSlug, title, text, url);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[push-notify]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to send push' });
  }
};
