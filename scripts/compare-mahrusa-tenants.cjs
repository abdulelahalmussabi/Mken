'use strict';

/**
 * Compares the duplicate المحروسة tenant rows (almahrusa vs almahrosa) to decide
 * which one carries real operational data. Prints counts and structure only.
 */

const { createClient } = require('@supabase/supabase-js');

const SLUGS = ['almahrusa', 'almahrosa'];
const OPERATIONAL_TABLES = [
  'mken_appointments',
  'mken_orders',
  'mken_invoices',
  'mken_customers',
  'mken_whatsapp_logs',
  'mken_staff',
  'mken_inventory_items',
];

async function main() {
  const res = await fetch('https://mken.live/api/v1/auth/supabase-config');
  const env = await res.json();
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);

  const { data: rows, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, business_name, owner_id, email, subscription_status, subscription_start, subscription_end, created_at, updated_at, config_data')
    .in('tenant_slug', SLUGS);

  if (error) {
    console.error('tenant SELECT failed:', error.message);
    process.exit(1);
  }

  for (const row of rows) {
    const config = row.config_data || {};
    console.log(`══ ${row.tenant_slug}`);
    console.log(`   business_name : ${row.business_name}`);
    console.log(`   owner_id      : ${row.owner_id ? 'set' : '— (no owner)'}`);
    console.log(`   status        : ${row.subscription_status} | end: ${row.subscription_end || '—'}`);
    console.log(`   created_at    : ${row.created_at || '—'}`);
    console.log(`   updated_at    : ${row.updated_at || '—'}`);
    console.log(`   config.updatedAt: ${config.updatedAt || '—'}`);
    console.log(`   config keys   : ${Object.keys(config).length}`);
    console.log(`   activities    : ${(config.enabledActivities || []).join(', ') || '—'}`);
    console.log(`   services      : ${(config.enabled || []).length} enabled`);
    console.log(`   mapsListingUrl: ${config.mapsListingUrl ? 'set' : '—'}`);

    for (const table of OPERATIONAL_TABLES) {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_slug', row.tenant_slug);
      console.log(`   ${table.padEnd(24)}: ${countError ? `n/a (${countError.code || countError.message})` : count}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
