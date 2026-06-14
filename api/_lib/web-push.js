'use strict';

const webpush = require('web-push');
const sbEnv = require('./supabase-env');

function getVapidConfig() {
  return {
    publicKey: (process.env.VAPID_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
    subject: (process.env.VAPID_SUBJECT || 'mailto:admin@mken.live').trim(),
  };
}

function isPushConfigured() {
  const cfg = getVapidConfig();
  return !!(cfg.publicKey && cfg.privateKey);
}

async function fetchTenantSubscriptions(supabase, tenantSlug) {
  const slug = tenantSlug || 'default';
  const { data, error } = await supabase
    .from('mken_push_subscriptions')
    .select('endpoint, keys')
    .eq('tenant_slug', slug);

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

async function isPushEnabledForTenant(supabase, tenantSlug) {
  const slug = tenantSlug || 'default';
  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('config_data')
    .eq('tenant_slug', slug)
    .maybeSingle();

  if (error || !data) {
    const { data: legacy } = await supabase
      .from('mken_config')
      .select('config_data')
      .eq('tenant_slug', slug)
      .maybeSingle();
    const cfg = legacy && legacy.config_data ? legacy.config_data : {};
    return !!(cfg.push && cfg.push.enabled && cfg.push.vapidPublicKey);
  }

  const cfg = data.config_data || {};
  return !!(cfg.push && cfg.push.enabled && cfg.push.vapidPublicKey);
}

async function sendPushToTenant(supabase, tenantSlug, title, body, url) {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, skipped: 'vapid-not-configured' };
  }

  const enabled = await isPushEnabledForTenant(supabase, tenantSlug);
  if (!enabled) {
    return { sent: 0, failed: 0, skipped: 'push-disabled' };
  }

  const subs = await fetchTenantSubscriptions(supabase, tenantSlug);
  if (!subs.length) {
    return { sent: 0, failed: 0, skipped: 'no-subscriptions' };
  }

  const vapid = getVapidConfig();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const payload = JSON.stringify({
    title: title || 'مكِّن',
    body: body || '',
    url: url || './admin.html',
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('mken_push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }

  return { sent, failed };
}

module.exports = {
  getVapidConfig,
  isPushConfigured,
  isPushEnabledForTenant,
  fetchTenantSubscriptions,
  sendPushToTenant,
};
