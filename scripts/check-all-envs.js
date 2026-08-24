'use strict';

const fs = require('fs');
const path = require('path');

const envFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.production.decrypted',
  '.env.production.pull',
  '.env.development.local',
  '.env.vercel.pull',
  '.env.vercel.new.pull',
  '.env.vercel.production.pull',
  '.env.vercel.production.new.pull',
  '.env.vercel.development.pull'
];

console.log('=== Checking Env Files ===');
for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    let hasUrl = false;
    let urlVal = '';
    let hasKey = false;
    let keyLen = 0;
    let hasServiceKey = false;
    let serviceKeyLen = 0;
    let hasAdminPin = false;
    let adminPinVal = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key === 'SUPABASE_URL') {
          hasUrl = true;
          urlVal = value;
        } else if (key === 'SUPABASE_KEY' || key === 'SUPABASE_ANON_KEY') {
          if (value) {
            hasKey = true;
            keyLen = value.length;
          }
        } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          if (value) {
            hasServiceKey = true;
            serviceKeyLen = value.length;
          }
        } else if (key === 'ADMIN_PIN') {
          if (value) {
            hasAdminPin = true;
            adminPinVal = value;
          }
        }
      }
    }
    console.log(`File: ${file}`);
    console.log(`  SUPABASE_URL: ${hasUrl ? urlVal : 'NOT FOUND'}`);
    console.log(`  SUPABASE_KEY: ${hasKey ? `FOUND (len: ${keyLen})` : 'NOT FOUND/EMPTY'}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${hasServiceKey ? `FOUND (len: ${serviceKeyLen})` : 'NOT FOUND/EMPTY'}`);
    console.log(`  ADMIN_PIN: ${hasAdminPin ? adminPinVal : 'NOT FOUND/EMPTY'}`);
    console.log('-------------------');
  } else {
    // console.log(`File: ${file} (does not exist)`);
  }
}
