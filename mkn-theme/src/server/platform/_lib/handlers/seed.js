'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { isRateLimited } = require('../rate-limit');

function secretsEqual(a, b) {
  const aHash = crypto.createHash('sha256').update(String(a)).digest();
  const bHash = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
  return String(forwarded).split(',')[0].trim() || 'unknown';
}

/** Disabled unless SEED_ADMIN_SECRET and SEED_ADMIN_PASSWORD are set. */
function authorizeSeed(req) {
  const secret = process.env.SEED_ADMIN_SECRET || '';
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  const presented = String(req.headers['x-seed-secret'] || '');
  const configured = secret.length >= 16 && password.length >= 12;
  const matches = presented.length > 0 && secret.length > 0 && secretsEqual(presented, secret);
  if (!configured || !matches) return null;
  return password;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const ip = clientIp(req);
  const blocked = isRateLimited('seed_admin:' + ip, 5, 60000, false);
  if (blocked.limited) {
    res.setHeader('Retry-After', String(blocked.retryAfterSec));
    return res.status(429).json({ success: false, error: 'Forbidden' });
  }

  const defaultPassword = authorizeSeed(req);
  if (!defaultPassword) {
    isRateLimited('seed_admin:' + ip, 5, 60000, true);
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  try {
    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://wkcaakexzxqebwjyhtan.supabase.co'
    ).trim();

    const serviceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_KEY ||
      ''
    ).trim();

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on Vercel environment'
      });
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const accounts = [
      { email: 'admin@mken.live', slug: 'admin', name: 'الإدارة العامة (Super Admin)' },
      { email: 'almahrusa@mken.live', slug: 'almahrusa', name: 'مجموعة المحروسة' },
      { email: 'almahrosa@mken.live', slug: 'almahrosa', name: 'مجموعة المحروسة' },
      { email: 'almasabi@mken.live', slug: 'almasabi', name: 'مؤسسة المصعبي للتجارة' },
      { email: 'rewa@mken.live', slug: 'rewa', name: 'منتجع رواء الاستشفاء الرقمي' },
      { email: 'demo@mken.live', slug: 'demo', name: 'صالون النخبة' }
    ];

    const { data: usersData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      return res.status(500).json({ success: false, error: listErr.message });
    }

    const usersList = usersData.users || [];
    const results = [];

    for (const acc of accounts) {
      let userId;
      const existingUser = usersList.find((u) => {
        const e = (u.email || '').toLowerCase();
        return e === acc.email.toLowerCase() || (acc.slug === 'admin' && e === 'admin@mkem.live');
      });

      if (existingUser) {
        userId = existingUser.id;
        const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
          email: acc.email,
          password: defaultPassword,
          email_confirm: true
        });
        if (updErr) {
          console.error(`Failed to update Auth for ${acc.email}:`, updErr.message);
        }
      } else {
        const { data: newAuth, error: createErr } = await sb.auth.admin.createUser({
          email: acc.email,
          password: defaultPassword,
          email_confirm: true
        });
        if (createErr || !newAuth.user) {
          console.error(`Failed to create Auth for ${acc.email}:`, createErr?.message);
          continue;
        }
        userId = newAuth.user.id;
      }

      const { data: existingClient } = await sb
        .from('mken_saas_clients')
        .select('id')
        .eq('tenant_slug', acc.slug)
        .maybeSingle();

      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 10);

      if (existingClient) {
        await sb
          .from('mken_saas_clients')
          .update({
            owner_id: userId,
            email: acc.email,
            business_name: acc.name,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_slug', acc.slug);
      } else {
        await sb.from('mken_saas_clients').insert({
          tenant_slug: acc.slug,
          owner_id: userId,
          business_name: acc.name,
          email: acc.email,
          phone: '966543530333',
          subscription_end: oneYear.toISOString(),
          config_data: { brand: { name: acc.name } },
          subscription_status: 'active'
        });
      }

      results.push({ email: acc.email, slug: acc.slug, uuid: userId });
    }

    return res.status(200).json({
      success: true,
      message: '🎉 All admin accounts have been successfully seeded/updated in Supabase Auth & mken_saas_clients!',
      accounts: results
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};
