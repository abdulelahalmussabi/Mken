'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const sign = require('../api/_lib/license-sign');

// 1. Generate key pair
console.log('Generating ECDSA P-256 key pair...');
const { privateKeyPem, publicKeyPem } = sign.generateKeyPair();

// 2. Generate admin token
const adminToken = crypto.randomBytes(24).toString('hex');
console.log(`Generated Admin Token: ${adminToken}`);

// 3. Format keys for env values
// Vercel env values need to be escaped properly if they contain newlines
const envPrivateKey = privateKeyPem.trim();
const envPublicKey = publicKeyPem.trim();

// 4. Add env variables to Vercel using CLI
console.log('Adding LICENSE_PRIVATE_KEY to Vercel...');
execSync(`vercel env add LICENSE_PRIVATE_KEY production --value "${envPrivateKey.replace(/\n/g, '\\n')}" --yes`, { stdio: 'inherit' });

console.log('Adding LICENSE_PUBLIC_KEY to Vercel...');
execSync(`vercel env add LICENSE_PUBLIC_KEY production --value "${envPublicKey.replace(/\n/g, '\\n')}" --yes`, { stdio: 'inherit' });

console.log('Adding LICENSE_ADMIN_TOKEN to Vercel...');
execSync(`vercel env add LICENSE_ADMIN_TOKEN production --value "${adminToken}" --yes`, { stdio: 'inherit' });

// 5. Update mken-lite/js/license-config.js
const configPath = path.join(__dirname, '../../mken-lite/js/license-config.js');
console.log(`Updating license-config.js at: ${configPath}`);

if (fs.existsSync(configPath)) {
  let content = fs.readFileSync(configPath, 'utf8');
  
  // Replace: PUBLIC_KEY_PEM: '', or PUBLIC_KEY_PEM: `...`
  const publicPemPlaceholder = /PUBLIC_KEY_PEM:\s*['"`][\s\S]*?['"`],/g;
  const replacement = `PUBLIC_KEY_PEM: \`${envPublicKey}\`,`;
  
  if (content.match(publicPemPlaceholder)) {
    content = content.replace(publicPemPlaceholder, replacement);
  } else {
    // Fallback: replace just empty string
    content = content.replace("PUBLIC_KEY_PEM: '',", replacement);
  }
  
  fs.writeFileSync(configPath, content, 'utf8');
  console.log('Successfully updated license-config.js with the new public key!');
} else {
  console.error(`ERROR: config file not found at ${configPath}`);
}

console.log('\n=============================================');
console.log('SUCCESS: Setup complete!');
console.log(`Admin Token: ${adminToken}`);
console.log('Keep this token safe to access the admin panel.');
console.log('=============================================');
