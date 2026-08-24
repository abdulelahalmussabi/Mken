const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function run() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  console.log('Querying tenant "almahrusa" using anon key...');
  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, business_name, email, config_data')
    .eq('tenant_slug', 'almahrusa')
    .maybeSingle();

  if (error) {
    console.error('Error:', error.message);
  } else {
    // Sanitize values to print to console securely (e.g. only print token lengths if present)
    if (data && data.config_data && data.config_data.whatsappApi) {
      const wa = data.config_data.whatsappApi;
      console.log('WhatsApp API Enabled:', wa.enabled);
      console.log('Provider:', wa.provider);
      console.log('Phone Number ID:', wa.phoneNumberId);
      console.log('Token exists:', !!wa.token);
      if (wa.token) {
        console.log('Token length:', wa.token.length);
        console.log('Token first 4 chars:', wa.token.slice(0, 4));
      }
    } else {
      console.log('Result config_data.whatsappApi is empty or not found');
    }
    console.log('Full config_data keys:', data ? Object.keys(data.config_data) : 'null');
  }
}

run().catch(console.error);
