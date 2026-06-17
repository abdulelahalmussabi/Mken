const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');

function getSupabaseAdmin() {
  return createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey());
}

async function ensureTenantClient(supabase, tenantSlug) {
  const slug = (tenantSlug || 'default').trim() || 'default';
  const { data: client, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug')
    .eq('tenant_slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (client) return client;

  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);
  const { error: insertError } = await supabase
    .from('mken_saas_clients')
    .insert({
      tenant_slug: slug,
      business_name: slug === 'default' ? 'المنصة الافتراضية' : slug,
      email: slug + '@mken.com',
      phone: '966543530333',
      subscription_end: oneYear.toISOString(),
      config_data: {},
      subscription_status: 'active',
    });

  if (insertError) throw insertError;
  return { tenant_slug: slug };
}

async function getValidAccessToken(tenantSlug) {
  const supabase = getSupabaseAdmin();
  const slug = (tenantSlug || 'default').trim() || 'default';

  // 1. Fetch client tokens from DB
  const { data: client, error: fetchError } = await supabase
    .from('mken_saas_clients')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('tenant_slug', slug)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!client) {
    throw new Error('Google Business account is not connected');
  }

  const { google_access_token: accessToken, google_refresh_token: refreshToken, google_token_expiry: tokenExpiry } = client;

  if (!refreshToken) {
    throw new Error('Google Business account is not connected');
  }

  // 2. Check if access token is still valid (with a 60-second buffer)
  const isExpired = !accessToken || !tokenExpiry || new Date(tokenExpiry).getTime() - Date.now() < 60 * 1000;

  if (!isExpired) {
    return accessToken;
  }

  // 3. Token is expired, refresh it
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured on the server');
  }

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    throw new Error(`Google token refresh failed: ${errText}`);
  }

  const tokenData = await refreshRes.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;
  const newExpiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Save new token to database
  const { error: updateError } = await supabase
    .from('mken_saas_clients')
    .update({
      google_access_token: newAccessToken,
      google_token_expiry: newExpiryDate,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_slug', slug);

  if (updateError) {
    throw new Error(`Failed to save refreshed access token: ${updateError.message}`);
  }

  return newAccessToken;
}

module.exports = {
  getValidAccessToken,
  ensureTenantClient,
  getSupabaseAdmin,
};
