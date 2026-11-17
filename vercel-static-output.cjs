'use strict';

/**
 * The root Vercel project serves this repo as a static site and expects
 * the build output in `public/`. HTML, JS, and assets live at the repo root;
 * `/api` stays outside `public` so it is deployed as serverless functions.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'public');
const skip = new Set([
  'node_modules',
  'public',
  'api',
  'mkn-theme',
  'tests',
  'scripts',
  'db',
  '_experimental-api',
  'examples',
  'supabase',
  '.git',
  '.github',
  '.cursor',
  '.agents'
]);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (skip.has(name) || name.startsWith('.')) continue;
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true, dereference: true });
}

console.log('Mken static output ready in public/');
