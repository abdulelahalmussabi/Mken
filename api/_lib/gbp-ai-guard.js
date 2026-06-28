const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');

const rateBuckets = new Map();
const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

function normalizeTenantSlug(tenant) {
  return (tenant || 'default').trim() || 'default';
}

function isValidAdminPin(pin) {
  if (!pin || typeof pin !== 'string') return false;
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false;

  const crypto = require('crypto');
  const trimmed = pin.trim();
  const aHash = crypto.createHash('sha256').update(trimmed).digest();
  const bHash = crypto.createHash('sha256').update(expected.trim()).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return '';
  return authHeader.substring(7).trim();
}

async function verifyApiKeyForTenant(token, tenantSlug) {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseServiceKey || !token) return false;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('mken_api_keys')
    .select('tenant_slug, expires_at')
    .eq('api_key', token)
    .maybeSingle();

  if (error || !data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return normalizeTenantSlug(data.tenant_slug) === normalizeTenantSlug(tenantSlug);
}

async function verifySupabaseSessionForTenant(token, tenantSlug) {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseServiceKey || !token) return false;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData || !userData.user) return false;

  const slug = normalizeTenantSlug(tenantSlug);
  const { data: client, error: clientError } = await supabase
    .from('mken_saas_clients')
    .select('owner_id')
    .eq('tenant_slug', slug)
    .maybeSingle();

  if (clientError || !client || !client.owner_id) return false;
  return client.owner_id === userData.user.id;
}

function checkRateLimit(tenantSlug, action) {
  const limit = parseInt(process.env.GBP_AI_RATE_LIMIT || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const windowMs = parseInt(process.env.GBP_AI_RATE_WINDOW_MS || String(DEFAULT_WINDOW_MS), 10) || DEFAULT_WINDOW_MS;
  const key = normalizeTenantSlug(tenantSlug) + ':' + action;
  const now = Date.now();

  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfterSec: retryAfterSec > 0 ? retryAfterSec : 60 };
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return { allowed: true };
}

async function authorizeGbpAiRequest(req, res, action) {
  const body = req.body || {};
  const tenantSlug = normalizeTenantSlug(body.tenant || req.query.tenant);
  if (!tenantSlug) {
    res.status(400).json({ error: 'tenant is required' });
    return null;
  }

  const pin = req.headers['x-admin-pin'] || req.headers['X-Admin-Pin'];
  if (isValidAdminPin(pin)) {
    const rate = checkRateLimit(tenantSlug, action);
    if (!rate.allowed) {
      res.status(429).json({
        error: 'تم تجاوز حد طلبات الذكاء الاصطناعي. حاول بعد ' + rate.retryAfterSec + ' ثانية.',
        retryAfterSec: rate.retryAfterSec,
      });
      return null;
    }
    return { tenantSlug: tenantSlug, authMethod: 'admin-pin' };
  }

  const bearer = getBearerToken(req);
  if (bearer) {
    const apiOk = await verifyApiKeyForTenant(bearer, tenantSlug);
    const sessionOk = !apiOk && (await verifySupabaseSessionForTenant(bearer, tenantSlug));
    if (!apiOk && !sessionOk) {
      res.status(401).json({ error: 'غير مصرح — مفتاح API أو جلسة الدخول غير صالحة لهذا المستأجر.' });
      return null;
    }

    const rate = checkRateLimit(tenantSlug, action);
    if (!rate.allowed) {
      res.status(429).json({
        error: 'تم تجاوز حد طلبات الذكاء الاصطناعي. حاول بعد ' + rate.retryAfterSec + ' ثانية.',
        retryAfterSec: rate.retryAfterSec,
      });
      return null;
    }
    return { tenantSlug: tenantSlug, authMethod: apiOk ? 'api-key' : 'supabase-session' };
  }

  res.status(401).json({
    error: 'غير مصرح — سجّل الدخول للوحة الإدارة أو أرسل X-Admin-Pin / Bearer token صالح.',
  });
  return null;
}

module.exports = {
  authorizeGbpAiRequest,
  normalizeTenantSlug,
  checkRateLimit,
};
