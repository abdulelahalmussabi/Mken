const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');

async function getValidAccessToken(tenantSlug) {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch client tokens from DB
  const { data: client, error: fetchError } = await supabase
    .from('mken_saas_clients')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('tenant_slug', tenantSlug)
    .single();

  if (fetchError || !client) {
    throw new Error('Tenant client not found in database');
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
    .eq('tenant_slug', tenantSlug);

  if (updateError) {
    throw new Error(`Failed to save refreshed access token: ${updateError.message}`);
  }

  return newAccessToken;
}

module.exports = {
  getValidAccessToken,
};
