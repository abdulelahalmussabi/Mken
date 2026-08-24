'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function run() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  console.log('Supabase URL:', sbEnv.supabaseUrl);
  console.log('Supabase Anon Key length:', sbEnv.supabaseKey ? sbEnv.supabaseKey.length : 0);

  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  console.log('Attempting to list users with anon key (should fail/return error):');
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    console.log('Data:', data);
    console.log('Error:', error);
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

run().catch(console.error);
