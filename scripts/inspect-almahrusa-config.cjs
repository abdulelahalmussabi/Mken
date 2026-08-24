'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function main() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('*')
    .eq('tenant_slug', 'almahrusa')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== Tenant almahrusa DB Record ===');
  console.log('ID:', data.id);
  console.log('Tenant Slug:', data.tenant_slug);
  console.log('Owner ID:', data.owner_id);
  console.log('Business Name:', data.business_name);
  console.log('Email:', data.email);
  console.log('Phone:', data.phone);
  console.log('Google Access Token:', !!data.google_access_token);
  console.log('Google Business Location ID:', data.google_business_location_id);
  console.log('Config Data:', JSON.stringify(data.config_data, null, 2));
}

main().catch(console.error);
