'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function run() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  console.log('Querying tenant "admin" using anon key...');
  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, owner_id, business_name, email')
    .eq('tenant_slug', 'admin')
    .maybeSingle();

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Result:', data);
  }
}

run().catch(console.error);
