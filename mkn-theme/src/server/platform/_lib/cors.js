const sbEnv = require('./supabase-env');

const trustedPattern =
  /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https?:\/\/([a-zA-Z0-9-]+\.)*mken\.(live|app|com))$/;

const customOriginCache = new Map();
const CUSTOM_ORIGIN_TTL_MS = 60 * 1000;

async function isActiveCustomHost(hostname) {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  if (!host || host.indexOf('.') === -1) return false;
  const cached = customOriginCache.get(host);
  if (cached && cached.exp > Date.now()) return cached.ok;

  const url = sbEnv.getSupabaseUrl();
  const key = sbEnv.getSupabaseServiceKey();
  if (!url || !key) {
    customOriginCache.set(host, { ok: false, exp: Date.now() + CUSTOM_ORIGIN_TTL_MS });
    return false;
  }

  try {
    const res = await fetch(
      url.replace(/\/$/, '') +
        '/rest/v1/mken_tenant_domains?hostname=eq.' +
        encodeURIComponent(host) +
        '&status=eq.active&select=tenant_slug',
      {
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
        },
      }
    );
    const rows = await res.json();
    const ok = Array.isArray(rows) && rows.length > 0;
    customOriginCache.set(host, { ok: ok, exp: Date.now() + CUSTOM_ORIGIN_TTL_MS });
    return ok;
  } catch (e) {
    return false;
  }
}

async function getSafeCorsOrigin(req) {
  const origin = req.headers.origin || req.headers.Origin;
  if (!origin) return 'https://mken.live';

  if (trustedPattern.test(origin)) {
    return origin;
  }

  try {
    const host = new URL(origin).hostname;
    if (await isActiveCustomHost(host)) return origin;
  } catch (e) {
    /* ignore */
  }
  return 'https://mken.live';
}

async function handleCors(req, res, allowedMethods) {
  allowedMethods = allowedMethods || 'GET,OPTIONS,PATCH,DELETE,POST,PUT';
  const origin = await getSafeCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Pin, X-Turnstile-Token, X-Mken-Tenant'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  getSafeCorsOrigin: getSafeCorsOrigin,
  handleCors: handleCors,
  isActiveCustomHost: isActiveCustomHost,
};
