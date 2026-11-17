'use strict';

const { signStaffSession } = require('../api/_lib/queue-guard');

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
  if (options && options.staff && !(headers.cookie || headers.Cookie)) {
    const tenant = options.query && options.query.tenant;
    headers.cookie = staffCookie(tenant, options.staff === 'super' ? 'super' : 'client');
  }
  return headers;
}

function staffCookie(tenant, role) {
  const slug = String(tenant || '').toLowerCase();
  const asSuper = role === 'super';
  const token = signStaffSession({
    email: asSuper ? 'admin@mken.live' : slug + '@mken.live',
    role: asSuper ? 'super' : 'client',
    clientSlug: asSuper ? undefined : slug
  });
  return 'mkn_admin_session=' + token;
}

module.exports = {
  tenantHeaders: tenantHeaders,
  staffCookie: staffCookie
};
