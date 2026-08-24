'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function main() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  const { data } = await supabase
    .from('mken_saas_clients')
    .select('config_data')
    .eq('tenant_slug', 'almahrusa')
    .single();

  const services = data.config_data.services;
  console.log('Services count:', Object.keys(services).length);
  for (const [id, s] of Object.entries(services)) {
    console.log(`Key: ${id} => Title: "${s.title}", Category: "${s.category}", Count: ${s.roomCount}, Units:`, s.units || s.rooms || 'N/A');
  }
}

main().catch(console.error);
