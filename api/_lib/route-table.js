'use strict';

/**
 * Public URL → grouped serverless function.
 * `api/v1/queue.js` stays its own function (PR #7 owns that file).
 * Alias mounts were already rewrites onto another file, not extra functions.
 */

const ROUTES = [
  { id: 'auth', file: 'auth.js', group: 'auth', mount: '/api/v1/auth' },
  { id: 'trust', file: 'trust.js', group: 'auth', mount: '/api/v1/trust' },
  { id: 'license', file: 'license.js', group: 'auth', mount: '/api/license' },
  { id: 'license-checkout', file: 'license.js', group: 'auth', mount: '/api/license-checkout', alias: true },
  { id: 'seed', file: 'seed.js', group: 'auth', mount: '/api/seed' },

  { id: 'staff-availability', file: 'staff-availability.js', group: 'booking', mount: '/api/staff-availability' },
  { id: 'dispatch', file: 'dispatch.js', group: 'booking', mount: '/api/v1/dispatch' },

  { id: 'whatsapp-webhook', file: 'whatsapp-webhook.js', group: 'crm', mount: '/api/whatsapp-webhook', rawBody: true },
  { id: 'cron-whatsapp', file: 'cron-whatsapp.js', group: 'crm', mount: '/api/cron-whatsapp' },
  { id: 'webhook-proxy', file: 'webhook-proxy.js', group: 'crm', mount: '/api/webhook-proxy' },

  { id: 'moyasar-webhook', file: 'moyasar-webhook.js', group: 'payments', mount: '/api/moyasar-webhook' },
  { id: 'checkout', file: 'checkout.js', group: 'payments', mount: '/api/v1/checkout' },

  { id: 'zatca', file: 'zatca.js', group: 'invoices', mount: '/api/v1/zatca' },
  { id: 'erp-reports', file: 'erp-reports.js', group: 'invoices', mount: '/api/v1/erp-reports' },
  { id: 'procurement', file: 'procurement.js', group: 'invoices', mount: '/api/v1/procurement' },
  { id: 'governance', file: 'governance.js', group: 'invoices', mount: '/api/v1/governance' },

  { id: 'google-business', file: 'google-business.js', group: 'tenant', mount: '/api/google-business' },
  { id: 'instagram', file: 'instagram.js', group: 'tenant', mount: '/api/instagram' },
  { id: 'push', file: 'push.js', group: 'tenant', mount: '/api/v1/push' },
  { id: 'push-subscribe', file: 'push.js', group: 'tenant', mount: '/api/v1/push-subscribe', alias: true },
  { id: 'push-notify', file: 'push.js', group: 'tenant', mount: '/api/v1/push-notify', alias: true },
  { id: 'push-test', file: 'push.js', group: 'tenant', mount: '/api/v1/push-test', alias: true }
];

/** Query injected by the pre-existing rewrites. Values must survive consolidation. */
const QUERY_REWRITES = [
  { source: '/api/v1/push-subscribe', query: { action: 'subscribe' } },
  { source: '/api/v1/push-notify', query: { action: 'notify' } },
  { source: '/api/v1/push-test', query: { action: 'test' } },
  { source: '/api/google-business/auth-url', query: { action: 'auth-url' } },
  { source: '/api/google-business/callback', query: { action: 'callback' } },
  { source: '/api/google-business/locations', query: { action: 'locations' } },
  { source: '/api/google-business/update-website', query: { action: 'update-website' } },
  { source: '/api/google-business/sync-services', query: { action: 'sync-services' } },
  { source: '/api/google-business/generate-post', query: { action: 'generate-post' } },
  { source: '/api/google-business/generate-reply', query: { action: 'generate-reply' } },
  { source: '/api/google-business/competitors', query: { action: 'competitors' } },
  { source: '/api/google-business/nap-audit', query: { action: 'nap-audit' } },
  { source: '/api/google-business/sync-nap', query: { action: 'sync-nap' } },
  { source: '/api/instagram/auth-url', query: { action: 'auth-url' } },
  { source: '/api/instagram/callback', query: { action: 'callback' } },
  { source: '/api/instagram/sync', query: { action: 'sync' } },
  { source: '/api/instagram/status', query: { action: 'status' } },
  { source: '/api/instagram/disconnect', query: { action: 'disconnect' } },
  { source: '/api/v1/checkout/create-session', query: { action: 'create-session' } },
  { source: '/api/v1/checkout/verify', query: { action: 'verify' } },
  { source: '/api/v1/auth/login-challenge', query: { type: 'login', step: 'challenge' } },
  { source: '/api/v1/auth/login-verify', query: { type: 'login', step: 'verify' } },
  { source: '/api/v1/auth/register-challenge', query: { type: 'register', step: 'challenge' } },
  { source: '/api/v1/auth/register-verify', query: { type: 'register', step: 'verify' } },
  { source: '/api/v1/auth/register-trial', query: { type: 'register-trial' } },
  { source: '/api/v1/auth/admin-login', query: { type: 'admin-login' } },
  { source: '/api/v1/auth/supabase-config', query: { type: 'supabase-config' } },
  { source: '/api/v1/trust/challenge', query: { action: 'challenge' } },
  { source: '/api/v1/trust/verify', query: { action: 'verify' } },
  { source: '/api/v1/trust/fallback', query: { action: 'fallback' } },
  { source: '/api/license/activate', query: { action: 'activate' } },
  { source: '/api/license/verify', query: { action: 'verify' } },
  { source: '/api/license/deactivate', query: { action: 'deactivate' } },
  { source: '/api/license/issue', query: { action: 'issue' } },
  { source: '/api/license/list', query: { action: 'list' } },
  { source: '/api/license/revoke', query: { action: 'revoke' } },
  { source: '/api/license/suspend', query: { action: 'suspend' } },
  { source: '/api/license/resume', query: { action: 'resume' } },
  { source: '/api/license-checkout/config', query: { action: 'checkout-config' } },
  { source: '/api/license-checkout/status', query: { action: 'checkout-status' } }
];

const GROUPS = {
  auth: { manualBody: false },
  booking: { manualBody: false },
  crm: { manualBody: true },
  payments: { manualBody: false },
  invoices: { manualBody: false },
  tenant: { manualBody: false }
};

const QUEUE_FUNCTION = 'api/v1/queue.js';
const QUEUE_MOUNT = '/api/v1/queue';
const LEGACY_FUNCTION_COUNT = 19;
const HOBBY_FUNCTION_CAP = 12;

function splitUrl(rawUrl) {
  const value = String(rawUrl || '/');
  const hash = value.indexOf('#');
  const clean = hash === -1 ? value : value.slice(0, hash);
  const q = clean.indexOf('?');
  let pathname = q === -1 ? clean : clean.slice(0, q);
  const search = q === -1 ? '' : clean.slice(q);
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return { pathname, search };
}

function matchMount(pathname) {
  const sorted = ROUTES.slice().sort((a, b) => b.mount.length - a.mount.length);
  for (let i = 0; i < sorted.length; i++) {
    const route = sorted[i];
    if (pathname === route.mount || pathname.startsWith(route.mount + '/')) return route;
  }
  return null;
}

function internalPath(publicPath) {
  const route = matchMount(publicPath);
  if (!route) return '';
  // This project's Node builder serves api/<group>/[...mken].js as exactly one
  // path segment. Nested public paths are packed into that segment with "__".
  const suffix = publicPath.slice('/api/'.length).split('/').join('__');
  return '/api/' + route.group + '/' + suffix;
}

function destinationFor(publicPath, query) {
  const path = internalPath(publicPath);
  if (!path) return '';
  const params = new URLSearchParams();
  const keys = query ? Object.keys(query) : [];
  for (let i = 0; i < keys.length; i++) params.set(keys[i], query[keys[i]]);
  const qs = params.toString();
  return qs ? path + '?' + qs : path;
}

module.exports = {
  ROUTES,
  QUERY_REWRITES,
  GROUPS,
  QUEUE_FUNCTION,
  QUEUE_MOUNT,
  LEGACY_FUNCTION_COUNT,
  HOBBY_FUNCTION_CAP,
  splitUrl,
  matchMount,
  internalPath,
  destinationFor
};
