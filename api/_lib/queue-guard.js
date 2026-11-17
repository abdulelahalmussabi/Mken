'use strict';

const crypto = require('crypto');

/**
 * Queue access guard.
 * Tenant comes from the request host or a verified staff session.
 * The `tenant` query/body field is ignored on purpose.
 */

const SKIP_SUBDOMAINS = new Set(['www', 'admin', 'mken', 'license', 'licenses', 'api']);
const PLATFORM_HOSTS = new Set(['mken.live', 'www.mken.live', 'localhost', '127.0.0.1', '']);
const IDENTITY_KEYS = new Set([
  'customer_name',
  'customer_phone',
  'phone_number',
  'pin_code',
  'push_subscription',
  'session_token'
]);
const SECRET_KEYS = new Set(['pin_code', 'push_subscription', 'session_token']);
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    'mken-saas-platform-secure-default-session-secret-2026'
  );
}

function b64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signStaffSession(session) {
  const payload = {
    email: session.email,
    role: session.role,
    clientSlug: session.clientSlug,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', sessionSecret()).update(body).digest());
  return body + '.' + sig;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyStaffSession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const body = parts[0];
  const signature = parts[1];
  const expected = b64url(crypto.createHmac('sha256', sessionSecret()).update(body).digest());
  if (!safeEqual(signature, expected)) return null;
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!payload || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'super' && payload.role !== 'client') return null;
    if (!payload.email) return null;
    return {
      email: payload.email,
      role: payload.role,
      clientSlug: payload.clientSlug ? String(payload.clientSlug).toLowerCase() : null
    };
  } catch (err) {
    return null;
  }
}

function headerValue(req, name) {
  const headers = (req && req.headers) || {};
  const direct = headers[name] || headers[name.toLowerCase()] || '';
  return Array.isArray(direct) ? direct[0] : String(direct || '');
}

function readCookie(req, name) {
  const raw = headerValue(req, 'cookie');
  const bits = raw.split(';');
  for (let i = 0; i < bits.length; i++) {
    const piece = bits[i].trim();
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    if (piece.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(piece.slice(eq + 1).trim());
      } catch (err) {
        return piece.slice(eq + 1).trim();
      }
    }
  }
  return '';
}

function readStaffSession(req) {
  const cookie = readCookie(req, 'mkn_admin_session');
  if (cookie) {
    const fromCookie = verifyStaffSession(cookie);
    if (fromCookie) return fromCookie;
  }
  const auth = headerValue(req, 'authorization');
  if (auth.toLowerCase().indexOf('bearer ') === 0) {
    return verifyStaffSession(auth.slice(7).trim());
  }
  return null;
}

function hostnameOf(req) {
  const forwarded = headerValue(req, 'x-forwarded-host') || headerValue(req, 'host');
  return forwarded.split(',')[0].trim().split(':')[0].toLowerCase();
}

function validSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  if (SKIP_SUBDOMAINS.has(slug)) return null;
  return slug;
}

function tenantSlugFromHost(hostname) {
  const host = String(hostname || '').split(',')[0].trim().split(':')[0].toLowerCase();
  if (!host || PLATFORM_HOSTS.has(host) || host.endsWith('.vercel.app')) return null;
  if (host === 'rewa.care' || host === 'www.rewa.care') return 'rewa';
  if (host.endsWith('.localhost')) {
    const head = host.slice(0, -'.localhost'.length).split('.').filter(Boolean).pop();
    return validSlug(head);
  }
  if (host.endsWith('.mken.live')) {
    const parts = host.slice(0, -'.mken.live'.length).split('.').filter(Boolean);
    let head = parts[0] || '';
    if (head === 'www' && parts.length > 1) head = parts[1];
    return validSlug(head);
  }
  return null;
}

function isStaffForTenant(session, slug) {
  if (!session || !slug) return false;
  if (session.role === 'super') return true;
  return session.role === 'client' && session.clientSlug === slug;
}

function resolveQueueTenant(req) {
  const session = readStaffSession(req);
  const hostSlug = tenantSlugFromHost(hostnameOf(req));

  if (hostSlug) {
    const sessionMatches = !session || session.role === 'super' || session.clientSlug === hostSlug;
    const boundSession = sessionMatches ? session : null;
    return {
      slug: hostSlug,
      session: boundSession,
      staff: isStaffForTenant(boundSession, hostSlug)
    };
  }

  if (session && session.role === 'client' && session.clientSlug) {
    return {
      slug: session.clientSlug,
      session: session,
      staff: true
    };
  }

  return {
    error: 'تعذر تحديد المنشأة من نطاق الطلب. افتح شاشة الطابور من النطاق الفرعي للمنشأة.',
    status: 400,
    code: 'TENANT_REQUIRED'
  };
}

function clientIp(req) {
  const forwarded = headerValue(req, 'x-forwarded-for') || headerValue(req, 'x-real-ip');
  const ip = forwarded.split(',')[0].trim();
  return ip || '';
}

function redact(value, keys, keepSessionToken) {
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return redact(item, keys, false);
    });
  }
  if (!value || typeof value !== 'object') return value;
  const out = {};
  const names = Object.keys(value);
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if (keepSessionToken && key === 'sessionToken') {
      out[key] = value[key];
      continue;
    }
    if (keys.has(key)) continue;
    out[key] = redact(value[key], keys, false);
  }
  return out;
}

function redactIdentity(value) {
  return redact(value, IDENTITY_KEYS, true);
}

function redactSecrets(value) {
  return redact(value, SECRET_KEYS, true);
}

function publicCounter(counter) {
  return {
    id: counter.id,
    tenant_slug: counter.tenant_slug,
    counter_number: counter.counter_number,
    name: counter.name,
    status: counter.status,
    assigned_queue_ids: counter.assigned_queue_ids,
    current_ticket_id: counter.current_ticket_id,
    current_ticket_number: counter.current_ticket_number || null,
    ewma_service_seconds: counter.ewma_service_seconds,
    completed_today_count: counter.completed_today_count
  };
}

function publicSession(session) {
  return {
    id: session.id,
    counter_id: session.counter_id,
    session_status: session.session_status,
    started_at: session.started_at,
    ended_at: session.ended_at,
    total_served_tickets: session.total_served_tickets
  };
}

function shapeConfig(data, staff) {
  if (!data || data.ok !== true) return redactSecrets(data);
  const counters = Array.isArray(data.counters) ? data.counters : [];
  const sessions = Array.isArray(data.counterSessions) ? data.counterSessions : [];
  const body = {
    ok: true,
    settings: data.settings,
    queues: data.queues,
    counters: staff ? counters.map(function (counter) {
      const copy = Object.assign({}, counter);
      return copy;
    }) : counters.map(publicCounter),
    counterSessions: staff ? sessions.map(function (session) {
      return Object.assign({}, session);
    }) : sessions.map(publicSession)
  };
  if (staff) {
    body.users = (data.users || []).map(function (user) {
      const copy = Object.assign({}, user);
      delete copy.pin_code;
      return copy;
    });
    body.agentBreaks = data.agentBreaks || [];
    body.receptionHandovers = data.receptionHandovers || [];
  }
  return body;
}

function present(data, ctx) {
  const action = ctx && ctx.action;
  const staff = Boolean(ctx && ctx.staff);
  if (!data || typeof data !== 'object') return data;
  if (action === 'intake-status') return data;
  if (action === 'get-config') return shapeConfig(data, staff);
  const customerStatus = action === 'get-ticket-status' && !(ctx.byTicketId && staff && !ctx.byToken);
  if (staff && !customerStatus) return redactSecrets(data);
  return redactIdentity(data);
}

function minimalTicket(ticket) {
  return {
    ticket_number: ticket.ticket_number,
    status: ticket.status,
    counter: ticket.called_counter_number || null
  };
}

module.exports = {
  signStaffSession: signStaffSession,
  verifyStaffSession: verifyStaffSession,
  readStaffSession: readStaffSession,
  resolveQueueTenant: resolveQueueTenant,
  tenantSlugFromHost: tenantSlugFromHost,
  clientIp: clientIp,
  redactIdentity: redactIdentity,
  redactSecrets: redactSecrets,
  present: present,
  minimalTicket: minimalTicket
};
