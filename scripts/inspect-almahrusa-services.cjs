'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function main() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, business_name, email, phone, config_data')
    .eq('tenant_slug', 'almahrusa')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Services:', JSON.stringify(data.config_data.services, null, 2));
  console.log('Brand:', JSON.stringify(data.config_data.brand, null, 2));
  console.log('ServiceArea:', JSON.stringify(data.config_data.serviceArea, null, 2));
  console.log('Booking:', JSON.stringify(data.config_data.booking, null, 2));
}

main().catch(console.error);
