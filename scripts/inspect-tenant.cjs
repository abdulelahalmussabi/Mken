'use strict';

const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function main() {
  const configRes = await fetch(`${siteUrl}/api/v1/auth/supabase-config`);
  const sbEnv = await configRes.json();
  const supabase = createClient(sbEnv.supabaseUrl, sbEnv.supabaseKey);

  const slugs = ['almahrusa', 'almahrosa', 'mahrousa', 'admin', 'demo'];
  for (const slug of slugs) {
    const { data, error } = await supabase
      .from('mken_saas_clients')
      .select('id, tenant_slug, owner_id, business_name, email, phone, subscription_status, subscription_end, config_data')
      .eq('tenant_slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`Error for ${slug}:`, error.message);
    } else if (data) {
      console.log(`Found tenant [${slug}]:`, {
        slug: data.tenant_slug,
        business_name: data.business_name,
        email: data.email,
        phone: data.phone,
        status: data.subscription_status,
        has_config: !!data.config_data
      });
    } else {
      console.log(`Tenant [${slug}] not found.`);
    }
  }
}

main().catch(console.error);
