'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function inspectAllUsersAndTenants() {
  console.log('📡 Fetching Supabase configuration...');
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  
  console.log('Supabase URL:', sbEnv.supabaseUrl);
  
  // We need service role key to inspect auth users and all tenants
  // Let's check if we can query mken_saas_clients with anon key first
  const supabaseAnon = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);
  
  console.log('\n--- Querying mken_saas_clients (Anon Key) ---');
  const { data: clients, error: clientsErr } = await supabaseAnon
    .from('mken_saas_clients')
    .select('tenant_slug, owner_id, email, business_name, subscription_status');
    
  if (clientsErr) {
    console.error('Error fetching clients:', clientsErr.message);
  } else {
    console.log(`Found ${clients.length} tenants in mken_saas_clients:`);
    clients.forEach(c => console.log(`  - slug: "${c.tenant_slug}", email: "${c.email}", owner_id: "${c.owner_id}", name: "${c.business_name}"`));
  }
}

inspectAllUsersAndTenants().catch(console.error);
