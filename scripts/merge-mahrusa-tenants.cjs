const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== [TENANT MERGE] Merge Duplicated Almahrusa Tenants Script ===');

// 1. Load .env.local safely
const envPath = path.join(__dirname, '..', '.env.local');
let envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      envVars[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

const applyFlag = process.argv.includes('--apply');

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('anon') || serviceRoleKey === 'your-anon-key-here') {
  console.log('   - [NOTICE] Real SUPABASE_SERVICE_ROLE_KEY is required for merging tenant records across RLS tables.');
  console.log('   - Skipping merge execution until real service role key is set in production environment.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function mergeTenants() {
  const primarySlug = 'almahrusa';
  const duplicateSlugs = ['al-mahrusa', 'almahrusa-hotel', 'mahrusa'];

  console.log(`Target Primary Slug: "${primarySlug}"`);
  console.log(`Duplicate Slugs to Merge: ${JSON.stringify(duplicateSlugs)}`);
  console.log(`Execution Mode: ${applyFlag ? 'APPLY (Mutations Enabled)' : 'DRY RUN (Simulated)'}`);

  const tablesToUpdate = [
    'mken_appointments',
    'mken_orders',
    'mken_invoices',
    'mken_inventory_items',
    'mken_inventory_transactions',
    'mken_vendors',
    'mken_purchase_invoices',
    'mken_customers',
    'mken_staff',
    'mken_api_keys',
    'mken_whatsapp_logs',
  ];

  for (const slug of duplicateSlugs) {
    console.log(`\nProcessing duplicate tenant: "${slug}"`);

    for (const table of tablesToUpdate) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('tenant_slug', slug);

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
            console.log(`  - Table ${table}: (Not created yet)`);
            continue;
          }
          console.log(`  - Table ${table}: Error checking - ${error.message}`);
          continue;
        }

        const count = data ? data.length : 0;
        console.log(`  - Table ${table}: ${count} record(s) found for "${slug}"`);

        if (count > 0 && applyFlag) {
          const { error: updateErr } = await supabase
            .from(table)
            .update({ tenant_slug: primarySlug })
            .eq('tenant_slug', slug);

          if (updateErr) {
            console.log(`    ❌ Failed to update table ${table}: ${updateErr.message}`);
          } else {
            console.log(`    ✓ Migrated ${count} row(s) to "${primarySlug}"`);
          }
        }
      } catch (err) {
        console.log(`  - Table ${table}: Exception - ${err.message}`);
      }
    }

    if (applyFlag) {
      // Remove duplicate client record if exists
      const { error: deleteErr } = await supabase
        .from('mken_saas_clients')
        .delete()
        .eq('tenant_slug', slug);

      if (!deleteErr) {
        console.log(`  ✓ Removed duplicate client entry "${slug}" from mken_saas_clients.`);
      }
    }
  }

  console.log('\n=== Tenant Merge Task Finished Successfully ===');
  process.exit(0);
}

mergeTenants();
