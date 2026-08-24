'use strict';

/**
 * Trust Engine BFF helpers — proxy Supabase Edge + rewrite cookies for *.mken.live
 */

const sbEnv = require('./supabase-env');

var DEVICE_COOKIE_NAME = process.env.MKEN_DEVICE_COOKIE_NAME || 'mken_device_trust';
var COOKIE_DOMAIN = process.env.MKEN_COOKIE_DOMAIN || '.mken.live';
var TRUST_MAX_AGE = parseInt(process.env.MKEN_TRUST_MAX_AGE_SEC || String(60 * 60 * 24 * 60), 10);
var ALLOWED_ACTIONS = { challenge: 'trust-challenge', verify: 'trust-verify', fallback: 'authentica-fallback' };

function getFunctionsBase() {
  var base = (process.env.MKEN_TRUST_FUNCTIONS_BASE || '').trim().replace(/\/+$/, '');
  if (base) return base;
  var url = sbEnv.getSupabaseUrl();
  if (!url) return '';
  return String(url).replace(/\/+$/, '') + '/functions/v1';
}

function getAnonKey() {
  return sbEnv.getSupabaseAnonKey();
}

/**
 * Trusted client IP on Vercel (platform-controlled forwarding).
 * Prefer CF when the project sits behind Cloudflare → Vercel.
 */
function getTrustedClientIp(req) {
  var cf = req.headers['cf-connecting-ip'];
  if (cf && isPlausibleIp(String(cf).trim())) return String(cf).trim();

  var vercel = req.headers['x-vercel-forwarded-for'];
  if (vercel) {
    var first = String(vercel).split(',')[0].trim();
    if (isPlausibleIp(first)) return first;
  }

  // On Vercel, x-forwarded-for is set by the platform (left-most = client)
  var xf = req.headers['x-forwarded-for'];
  if (xf) {
    var ip = String(xf).split(',')[0].trim();
    if (isPlausibleIp(ip)) return ip;
  }

  if (req.socket && req.socket.remoteAddress) return String(req.socket.remoteAddress);
  return '0.0.0.0';
}

function isPlausibleIp(ip) {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split('.').every(function (o) {
      var n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  if (/^[0-9a-f:]+$/i.test(ip) && ip.indexOf(':') !== -1) return true;
  return false;
}

function resolveAction(req) {
  var q = req.query || {};
  var action = String(q.action || q.step || '').toLowerCase();
  if (ALLOWED_ACTIONS[action]) return action;

  var url = String(req.url || '');
  if (url.indexOf('/challenge') !== -1) return 'challenge';
  if (url.indexOf('/verify') !== -1) return 'verify';
  if (url.indexOf('/fallback') !== -1) return 'fallback';
  return '';
}

function edgeFunctionName(action) {
  return ALLOWED_ACTIONS[action] || '';
}

/**
 * Parse Set-Cookie header(s) from upstream fetch Response.
 * @returns {{ name: string, value: string, attrs: object }[]}
 */
function parseSetCookieHeaders(setCookieHeader) {
  if (!setCookieHeader) return [];
  var rawList = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  var out = [];

  for (var i = 0; i < rawList.length; i++) {
    var raw = String(rawList[i] || '').trim();
    if (!raw) continue;
    var parts = raw.split(';');
    var nv = parts[0];
    var eq = nv.indexOf('=');
    if (eq < 0) continue;
    var name = nv.slice(0, eq).trim();
    var value = nv.slice(eq + 1).trim();
    var attrs = {};
    for (var j = 1; j < parts.length; j++) {
      var p = parts[j].trim();
      if (!p) continue;
      var e = p.indexOf('=');
      if (e < 0) attrs[p.toLowerCase()] = true;
      else attrs[p.slice(0, e).trim().toLowerCase()] = p.slice(e + 1).trim();
    }
    out.push({ name: name, value: value, attrs: attrs });
  }
  return out;
}

function buildMkenDeviceCookie(rawToken, maxAge) {
  var age = typeof maxAge === 'number' && maxAge >= 0 ? maxAge : TRUST_MAX_AGE;
  var parts = [
    DEVICE_COOKIE_NAME + '=' + encodeURIComponent(rawToken),
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + age,
  ];
  if (COOKIE_DOMAIN) parts.push('Domain=' + COOKIE_DOMAIN);
  return parts.join('; ');
}

function buildClearDeviceCookie() {
  return buildMkenDeviceCookie('', 0);
}

/**
 * Apply rewritten device trust cookie onto the Vercel response.
 * Reads upstream Set-Cookie for mken_device_trust (value only; Domain rewritten).
 */
function applyRewrittenCookies(res, upstreamSetCookie) {
  var cookies = parseSetCookieHeaders(upstreamSetCookie);
  var applied = false;

  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i];
    if (c.name !== DEVICE_COOKIE_NAME) continue;
    var maxAge = TRUST_MAX_AGE;
    if (c.attrs['max-age'] != null) {
      var parsed = parseInt(c.attrs['max-age'], 10);
      if (!isNaN(parsed)) maxAge = parsed;
    }
    var value = c.value;
    try {
      value = decodeURIComponent(c.value);
    } catch (e) { /* keep raw */ }

    if (!value || maxAge === 0) {
      res.setHeader('Set-Cookie', buildClearDeviceCookie());
    } else {
      res.setHeader('Set-Cookie', buildMkenDeviceCookie(value, maxAge));
    }
    applied = true;
  }
  return applied;
}

/**
 * Proxy POST to Supabase Edge Function and rewrite trust cookie for *.mken.live
 */
async function proxyTrustAction(req, res, action) {
  var fn = edgeFunctionName(action);
  if (!fn) {
    res.status(400).json({ error: 'unknown_action' });
    return;
  }

  var base = getFunctionsBase();
  var anon = getAnonKey();
  if (!base || !anon) {
    res.status(500).json({ error: 'trust_bff_not_configured' });
    return;
  }

  var clientIp = getTrustedClientIp(req);
  var incomingCookie = req.headers.cookie || req.headers.Cookie || '';
  var body = req.body;
  if (body == null) body = {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (e) {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
  }

  var headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    apikey: anon,
    Authorization: 'Bearer ' + anon,
    // Forward identity for Edge IP extraction (ip.ts prefers these)
    'x-vercel-forwarded-for': clientIp,
    'x-mken-bff': '1',
  };
  if (req.headers['cf-connecting-ip']) {
    headers['cf-connecting-ip'] = String(req.headers['cf-connecting-ip']);
  } else {
    // Present real client IP to Edge as CF-Connecting-IP when CF sits in front of Vercel only;
    // when not, still pass via x-vercel-forwarded-for (trusted by our Edge ip.ts).
    headers['cf-connecting-ip'] = clientIp;
  }
  if (incomingCookie) headers.Cookie = incomingCookie;
  if (req.headers['user-agent']) headers['User-Agent'] = String(req.headers['user-agent']);
  if (req.headers.origin) headers.Origin = String(req.headers.origin);

  var upstream;
  try {
    upstream = await fetch(base + '/' + fn, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('trust_bff_upstream_fetch', err && err.message);
    res.status(502).json({ error: 'upstream_unreachable' });
    return;
  }

  var text = await upstream.text();
  var data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { error: 'invalid_upstream_json', raw: text.slice(0, 500) };
  }

  // Node fetch may expose getSetCookie(); fall back to single header
  var setCookie = null;
  if (typeof upstream.headers.getSetCookie === 'function') {
    var list = upstream.headers.getSetCookie();
    if (list && list.length) setCookie = list;
  }
  if (!setCookie) {
    var single = upstream.headers.get('set-cookie');
    if (single) setCookie = single;
  }

  applyRewrittenCookies(res, setCookie);

  // Strip cookieHint secrets from client payload if any (token never in body by design)
  if (data && typeof data === 'object' && data.cookieHint) {
    data.cookieHint = {
      name: DEVICE_COOKIE_NAME,
      domain: COOKIE_DOMAIN,
      setBy: 'bff',
      maxAge: TRUST_MAX_AGE,
    };
  }

  res.status(upstream.status).json(data == null ? {} : data);
}

module.exports = {
  DEVICE_COOKIE_NAME: DEVICE_COOKIE_NAME,
  COOKIE_DOMAIN: COOKIE_DOMAIN,
  resolveAction: resolveAction,
  getTrustedClientIp: getTrustedClientIp,
  proxyTrustAction: proxyTrustAction,
  buildMkenDeviceCookie: buildMkenDeviceCookie,
  applyRewrittenCookies: applyRewrittenCookies,
};
