'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFiles = [
  '.env.production.local',
  '.env.local',
  '.env.vercel.production.new.pull',
  '.env.vercel.production.pull',
  '.env.vercel.new.pull',
  '.env.vercel.pull',
  '.env.development.local',
  '.env'
];

let supabaseUrl = process.env.SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      result[key] = value;
    }
  }
  return result;
}

for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const parsed = parseEnvFile(fullPath);
    if (!supabaseUrl && parsed.SUPABASE_URL) supabaseUrl = parsed.SUPABASE_URL;
    if (!serviceKey && parsed.SUPABASE_SERVICE_ROLE_KEY) serviceKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
  }
}

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: clients, error } = await supabase
    .from('mken_saas_clients')
    .select('id, tenant_slug, owner_id, business_name, email, phone, subscription_status, subscription_tier, subscription_end, created_at');

  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }

  console.log('=== SaaS Clients in DB ===');
  console.table(clients);
}

main().catch(console.error);
