const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { getValidAccessToken } = require('../_lib/google-auth-helper');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tenant } = req.query;
  if (!tenant) {
    return res.status(400).json({ error: 'Tenant parameter is required' });
  }

  try {
    // 1. Get valid access token (refreshes if needed)
    let accessToken;
    try {
      accessToken = await getValidAccessToken(tenant);
    } catch (authErr) {
      if (authErr.message.includes('not connected')) {
        return res.status(200).json({ connected: false, locations: [] });
      }
      throw authErr;
    }

    // 2. Fetch the client's saved configuration (selected location ID)
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: client, error: fetchError } = await supabase
      .from('mken_saas_clients')
      .select('google_business_location_id')
      .eq('tenant_slug', tenant)
      .single();

    const selectedLocationId = client ? client.google_business_location_id : null;

    // 3. Fetch Google Business Accounts
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsRes.ok) {
      const errText = await accountsRes.text();
      throw new Error(`Failed to fetch Google accounts: ${errText}`);
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];

    let allLocations = [];

    // 4. Fetch Locations for each Account
    for (const account of accounts) {
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,websiteUri`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        const locations = locationsData.locations || [];
        allLocations = allLocations.concat(
          locations.map((loc) => ({
            id: loc.name, // Format: locations/{locationId}
            title: loc.title,
            websiteUri: loc.websiteUri || '',
          }))
        );
      } else {
        console.error(`Failed to fetch locations for account ${account.name}`);
      }
    }

    return res.status(200).json({
      connected: true,
      selectedLocationId: selectedLocationId,
      locations: allLocations,
    });
  } catch (err) {
    console.error('Fetch Locations Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
