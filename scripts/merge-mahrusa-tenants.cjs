'use strict';

/**
 * Consolidates the duplicate المحروسة tenants: keeps `almahrusa` (the row bound
 * to a Supabase Auth owner and to the live subdomain) and folds in config that
 * only exists on `almahrosa`, then deactivates the duplicate.
 *
 * Dry-run by default. Pass --apply with SUPABASE_SERVICE_ROLE_KEY set to write.
 *
 *   node scripts/merge-mahrusa-tenants.cjs
 *   node scripts/merge-mahrusa-tenants.cjs --apply
 */

const { createClient } = require('@supabase/supabase-js');

const KEEP = 'almahrusa';
const RETIRE = 'almahrosa';
const APPLY = process.argv.includes('--apply');

/** Adds only what is missing; existing values on the kept row always win. */
function fold(keep, retire) {
  const merged = { ...keep };
  const added = [];

  for (const [key, value] of Object.entries(retire)) {
    if (key === 'updatedAt') continue;
    const current = merged[key];
    const isEmpty =
      current === undefined ||
      current === null ||
      current === '' ||
      (Array.isArray(current) && current.length === 0) ||
      (typeof current === 'object' && !Array.isArray(current) && Object.keys(current).length === 0);
    if (isEmpty) {
      merged[key] = value;
      added.push(key);
    }
  }

  // Services/activities are additive: union keeps everything both rows offered.
  const union = (a = [], b = []) => Array.from(new Set([...a, ...b]));
  const servicesBefore = (keep.enabled || []).length;
  merged.enabled = union(keep.enabled, retire.enabled);
  merged.enabledActivities = union(keep.enabledActivities, retire.enabledActivities);

  return { merged, added, servicesBefore, servicesAfter: merged.enabled.length };
}

async function getClientFor(write) {
  if (write) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment');
    }
    return createClient(url, key, { auth: { persistSession: false } });
  }
  const res = await fetch('https://mken.live/api/v1/auth/supabase-config');
  const env = await res.json();
  return createClient(env.supabaseUrl, env.supabaseKey);
}

async function main() {
  const supabase = await getClientFor(APPLY);

  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, business_name, config_data')
    .in('tenant_slug', [KEEP, RETIRE]);

  if (error) throw new Error(`SELECT failed: ${error.message}`);

  const keepRow = data.find((r) => r.tenant_slug === KEEP);
  const retireRow = data.find((r) => r.tenant_slug === RETIRE);
  if (!keepRow || !retireRow) throw new Error('one of the tenant rows is missing');

  const { merged, added, servicesBefore, servicesAfter } = fold(
    keepRow.config_data || {},
    retireRow.config_data || {}
  );

  console.log(`keep   : ${KEEP} (${keepRow.business_name})`);
  console.log(`retire : ${RETIRE} (${retireRow.business_name})`);
  console.log(`config keys copied over : ${added.join(', ') || '(none)'}`);
  console.log(`enabled services        : ${servicesBefore} -> ${servicesAfter}`);
  console.log(`total config keys       : ${Object.keys(keepRow.config_data || {}).length} -> ${Object.keys(merged).length}`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
    return;
  }

  merged.updatedAt = new Date().toISOString();

  const update = await supabase
    .from('mken_saas_clients')
    .update({ config_data: merged, updated_at: new Date().toISOString() })
    .eq('tenant_slug', KEEP);
  if (update.error) throw new Error(`update ${KEEP} failed: ${update.error.message}`);

  // The duplicate is deactivated, never deleted, so history stays recoverable.
  const retire = await supabase
    .from('mken_saas_clients')
    .update({ subscription_status: 'inactive', updated_at: new Date().toISOString() })
    .eq('tenant_slug', RETIRE);
  if (retire.error) throw new Error(`deactivate ${RETIRE} failed: ${retire.error.message}`);

  console.log(`\napplied: ${KEEP} updated, ${RETIRE} marked inactive`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
