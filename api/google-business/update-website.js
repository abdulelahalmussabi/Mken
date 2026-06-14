const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { getValidAccessToken } = require('../_lib/google-auth-helper');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tenant, locationId, websiteUrl, action } = req.body;

  if (!tenant) {
    return res.status(400).json({ error: 'Tenant parameter is required' });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Handle disconnect action
    if (action === 'disconnect') {
      const { error: updateError } = await supabase
        .from('mken_saas_clients')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
          google_business_location_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', tenant);

      if (updateError) throw updateError;
      return res.status(200).json({ success: true, message: 'Disconnected Google account successfully' });
    }

    if (!locationId || !websiteUrl) {
      return res.status(400).json({ error: 'locationId and websiteUrl are required for update action' });
    }

    // 1. Get valid access token
    const accessToken = await getValidAccessToken(tenant);

    // 2. Send PATCH request to Google Business Profile API to update website
    // URL format: https://mybusinessbusinessinformation.googleapis.com/v1/{name}?updateMask=websiteUri
    // where name is "locations/{locationId}"
    const googleApiUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=websiteUri`;

    const updateRes = await fetch(googleApiUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        websiteUri: websiteUrl,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Google API update failed: ${errText}`);
    }

    // 3. Save selected location ID in Supabase
    const { error: dbError } = await supabase
      .from('mken_saas_clients')
      .update({
        google_business_location_id: locationId,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_slug', tenant);

    if (dbError) throw dbError;

    return res.status(200).json({ success: true, message: 'Website URL updated successfully on Google Business Profile' });
  } catch (err) {
    console.error('Update Google Business Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
