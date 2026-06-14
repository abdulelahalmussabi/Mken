const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');

module.exports = async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state; // This is the tenant slug
  const error = req.query.error;

  const host = req.headers.host || 'mken.live';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseRedirectUrl = `${protocol}://${host}/admin.html`;

  if (error) {
    return res.redirect(`${baseRedirectUrl}?google_connect=error&error_desc=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${baseRedirectUrl}?google_connect=error&error_desc=${encodeURIComponent('Missing code or state parameter')}`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth credentials not configured on the server');
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token; // may be undefined if prompt=consent wasn't forced or if already consented
    const expiresIn = tokenData.expires_in || 3600;
    const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Connect to Supabase
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the client to check if they exist and to retain previous refresh token if new one is missing
    const { data: clientData, error: fetchError } = await supabase
      .from('mken_saas_clients')
      .select('google_refresh_token')
      .eq('tenant_slug', state)
      .single();

    if (fetchError || !clientData) {
      throw new Error(`Tenant client not found in database: ${state}`);
    }

    // Update tokens in Supabase
    const updateData = {
      google_access_token: accessToken,
      google_token_expiry: expiryDate,
      updated_at: new Date().toISOString(),
    };

    // Only update refresh token if we received a new one from Google
    if (refreshToken) {
      updateData.google_refresh_token = refreshToken;
    }

    const { error: updateError } = await supabase
      .from('mken_saas_clients')
      .update(updateData)
      .eq('tenant_slug', state);

    if (updateError) {
      throw updateError;
    }

    // Redirect back to admin dashboard
    return res.redirect(`${baseRedirectUrl}?tenant=${encodeURIComponent(state)}&google_connect=success`);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    return res.redirect(`${baseRedirectUrl}?tenant=${encodeURIComponent(state)}&google_connect=error&error_desc=${encodeURIComponent(err.message)}`);
  }
};
