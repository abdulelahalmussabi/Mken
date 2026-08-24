'use strict';

/**
 * Checks that mkn-theme's tenant bridge matches the real `mken_saas_clients`
 * shape: the selected columns exist and the config_data paths the mapping
 * reads are resolvable. Prints structure only, never credentials.
 */

const { createClient } = require('@supabase/supabase-js');

const COLUMNS =
  'tenant_slug, business_name, email, phone, subscription_status, subscription_start, subscription_end, config_data, created_at';

const MAPPED_PATHS = [
  'brand.name',
  'brand.tagline',
  'phone',
  'social.whatsapp.value',
  'emails.inquiries.value',
  'heroImage',
  'featuredActivity',
  'occasionPack.forceId',
  'occasionPack.promo.code',
  'location',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

async function main() {
  const res = await fetch('https://mken.live/api/v1/auth/supabase-config');
  const env = await res.json();
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error('Live site did not return Supabase config');
  }
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);

  const probe = await supabase.from('mken_saas_clients').select('*').limit(1);
  if (probe.error) {
    console.error('probe failed:', probe.error.message);
    process.exit(1);
  }
  const actualColumns = probe.data.length ? Object.keys(probe.data[0]).sort() : [];
  console.log(`actual table columns: ${actualColumns.join(', ')}\n`);

  const requested = COLUMNS.split(',').map((c) => c.trim());
  const missing = requested.filter((c) => !actualColumns.includes(c));
  if (missing.length) {
    console.log(`MISSING from table: ${missing.join(', ')}\n`);
  }

  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select(requested.filter((c) => actualColumns.includes(c)).join(', '));
  if (error) {
    console.error('SELECT failed:', error.message);
    process.exit(1);
  }
  console.log(`rows visible: ${data.length}\n`);

  for (const row of data) {
    const config = row.config_data || {};
    console.log(`── ${row.tenant_slug} | ${row.business_name} | ${row.subscription_status}`);
    console.log(`   config keys: ${Object.keys(config).sort().join(', ') || '(empty)'}`);
    const resolved = MAPPED_PATHS.map((p) => {
      const value = get(config, p);
      return `${p}=${value === undefined || value === '' ? '—' : 'set'}`;
    });
    console.log(`   mapped: ${resolved.join('  ')}\n`);
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
