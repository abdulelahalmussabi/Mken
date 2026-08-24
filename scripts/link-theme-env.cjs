/**
 * Copies the مكّن Supabase credentials from the repo-root .env.local into
 * mkn-theme/.env.local so the theme can read real tenant data locally.
 * Values are never printed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['.env.local', '.env.production.local', '.env.development.local'].map((f) =>
  path.join(ROOT, f)
);
const THEME_ENV = path.join(ROOT, 'mkn-theme', '.env.local');
const WANTED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_KEY'];

function parse(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// Take the first non-empty value found across the local env files.
const source = {};
for (const file of SOURCES) {
  const parsed = parse(file);
  for (const key of WANTED) {
    if (!source[key] && parsed[key]) source[key] = parsed[key];
  }
}

const ALL_KEYS = [...WANTED, 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function main() {
  // Vercel withholds values of variables marked Sensitive, so those come back
  // empty. Fall back to the public config the live site already exposes, which
  // is enough to exercise read paths locally.
  if (!source.SUPABASE_URL || !source.SUPABASE_KEY) {
    const res = await fetch('https://mken.live/api/v1/auth/supabase-config');
    const publicConfig = await res.json();
    source.SUPABASE_URL = source.SUPABASE_URL || publicConfig.supabaseUrl;
    source.SUPABASE_KEY = source.SUPABASE_KEY || publicConfig.supabaseKey;
    console.log('used public config from mken.live for URL + anon key');
  }

  if (!source.SUPABASE_URL || !source.SUPABASE_KEY) {
    console.error('could not resolve Supabase URL / anon key');
    process.exit(1);
  }

  const readOnly = !source.SUPABASE_SERVICE_ROLE_KEY;
  if (readOnly) {
    // Anon key in the service slot: reads work, writes are refused by RLS.
    source.SUPABASE_SERVICE_ROLE_KEY = source.SUPABASE_KEY;
    console.log('NOTE: no service-role key available locally -> reads only, writes will fail');
  }

  const existing = fs.existsSync(THEME_ENV) ? fs.readFileSync(THEME_ENV, 'utf8').trimEnd() : '';
  const kept = existing
    .split(/\r?\n/)
    .filter((line) => !ALL_KEYS.some((k) => line.startsWith(`${k}=`)))
    .join('\n')
    .trimEnd();

  const added = [
    `SUPABASE_URL="${source.SUPABASE_URL}"`,
    `SUPABASE_SERVICE_ROLE_KEY="${source.SUPABASE_SERVICE_ROLE_KEY}"`,
    `NEXT_PUBLIC_SUPABASE_URL="${source.SUPABASE_URL}"`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY="${source.SUPABASE_KEY}"`,
  ];

  fs.writeFileSync(THEME_ENV, `${kept}\n${added.join('\n')}\n`);
  console.log(`wrote ${added.length} keys to mkn-theme/.env.local`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
