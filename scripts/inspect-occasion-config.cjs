'use strict';

/** Prints the structure (not values) of occasion-theme keys already stored in مكّن config_data. */

const { createClient } = require('@supabase/supabase-js');

function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `array[${value.length}]${value.length && depth < 2 ? ` of ${shape(value[0], depth + 1)}` : ''}`;
  }
  if (typeof value === 'object') {
    if (depth >= 2) return 'object';
    return `{ ${Object.keys(value)
      .map((k) => `${k}: ${shape(value[k], depth + 1)}`)
      .join(', ')} }`;
  }
  return typeof value;
}

async function main() {
  const res = await fetch('https://mken.live/api/v1/auth/supabase-config');
  const env = await res.json();
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);

  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, config_data')
    .in('tenant_slug', ['admin', 'almahrusa']);

  if (error) {
    console.error('SELECT failed:', error.message);
    process.exit(1);
  }

  for (const row of data) {
    const config = row.config_data || {};
    console.log(`── ${row.tenant_slug}`);
    for (const key of ['occasionThemes', 'occasionPack', 'themeLock', 'theme']) {
      if (key in config) console.log(`   ${key}: ${shape(config[key])}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
