'use strict';

const crypto = require('crypto');

if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.trim().length < 16) {
  process.env.ADMIN_SESSION_SECRET = 'test-' + crypto.randomBytes(24).toString('hex');
}

const { signStaffSession } = require('../mkn-theme/src/server/platform/_lib/queue-guard');

function tenantHeaders(options) {
  const headers = Object.assign({}, (options && options.headers) || {});
  const explicitHost = options && options.headers && (
    Object.prototype.hasOwnProperty.call(options.headers, 'host') ||
    options.headers['x-forwarded-host']
  );
  if (!explicitHost) {
    const tenant = options && options.query && options.query.tenant;
    if (tenant) headers.host = String(tenant).toLowerCase() + '.mken.live';
  }
  if (!headers.origin) {
    headers.origin = 'https://' + (headers.host || 'localhost');
  }
  const hasForward = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || headers['x-real-ip'];
  if (!hasForward && !(options && options.noIp)) {
    tenantHeaders._seq = (tenantHeaders._seq || 0) + 1;
    headers['x-forwarded-for'] = '198.51.100.' + ((tenantHeaders._seq % 250) + 1);
  }
  if (options && options.staff !== false && !(headers.cookie || headers.Cookie)) {
    const tenant = options && options.query && options.query.tenant;
    if (tenant) {
      let role = 'client';
      let queueRole = 'receptionist';
      if (options.staff === 'super') {
        role = 'super';
        queueRole = 'admin';
      } else if (options.staff === 'counter') {
        queueRole = 'counter_agent';
      } else if (options.staff === 'admin') {
        queueRole = 'admin';
      }
      headers.cookie = staffCookie(tenant, role, queueRole);
    }
  }
  return headers;
}

function staffCookie(tenant, role, queueRole) {
  const slug = String(tenant || '').toLowerCase();
  const asSuper = role === 'super';
  const token = signStaffSession({
    email: asSuper ? 'admin@mken.live' : slug + '@mken.live',
    role: asSuper ? 'super' : 'client',
    clientSlug: asSuper ? undefined : slug,
    queueRole: queueRole || (asSuper ? 'admin' : 'receptionist')
  });
  return 'mkn_admin_session=' + token;
}

module.exports = {
  tenantHeaders: tenantHeaders,
  staffCookie: staffCookie
};
