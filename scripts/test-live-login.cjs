'use strict';

const { createClient } = require('@supabase/supabase-js');

// We will fetch the configuration from the live website to get the supabase url and anon key
const siteUrl = 'https://mken.live';

async function testLiveLogin() {
  console.log(`📡 Fetching Supabase configuration from ${siteUrl}...`);
  try {
    const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
    if (!configRes.ok) {
      throw new Error(`Failed to fetch supabase-config: Status ${configRes.status}`);
    }
    const sbEnv = await configRes.json();
    console.log('✅ Configuration retrieved successfully.');
    console.log(`Supabase URL: ${sbEnv.supabaseUrl}`);
    console.log(`Supabase Enabled: ${sbEnv.enabled}`);

    if (!sbEnv.enabled || !sbEnv.supabaseUrl || !sbEnv.supabaseKey) {
      console.error('❌ Supabase is not configured on the live server.');
      return;
    }

    const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const email = 'admin@mken.live';
    const password = 'Aa#321321';

    console.log(`⏳ Attempting direct Supabase sign-in for ${email}...`);
    const { data: authRes, error: authErr } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authErr) {
      console.error('❌ Login failed in Supabase Auth:', authErr.message);
      return;
    }

    console.log('✅ Supabase Auth sign-in successful!');
    console.log('User UUID:', authRes.user.id);

    console.log('⏳ Querying tenant_slug associated with this owner_id...');
    const { data: tenantRes, error: tenantErr } = await supabase
      .from('mken_saas_clients')
      .select('tenant_slug')
      .eq('owner_id', authRes.user.id)
      .maybeSingle();

    if (tenantErr) {
      console.error('❌ Database query failed for mken_saas_clients:', tenantErr.message);
      return;
    }

    if (!tenantRes) {
      console.error('❌ No tenant slug found associated with this user in mken_saas_clients.');
      return;
    }

    console.log(`✅ Success! Tenant slug found: "${tenantRes.tenant_slug}"`);
  } catch (err) {
    console.error('❌ Unexpected error during test:', err.message);
  }
}

testLiveLogin().catch(console.error);
