'use strict';

/**
 * Vercel project `mken` expects the static Output Directory `public`.
 * The site itself lives at the repo root (html, css, js, assets).
 * Serverless functions stay in /api and are not copied into the output.
 */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'public');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copyFile(rel) {
  const from = path.join(root, rel);
  const to = path.join(out, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(rel) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(out, rel), { recursive: true });
}

for (const name of fs.readdirSync(root)) {
  if (name.endsWith('.html')) copyFile(name);
}

for (const name of ['sw.js', 'manifest.webmanifest']) {
  if (fs.existsSync(path.join(root, name))) copyFile(name);
}

for (const dir of ['css', 'js', 'assets', 'data', '.well-known']) {
  copyDir(dir);
}

const index = path.join(out, 'index.html');
const landing = path.join(out, 'landing.html');
if (!fs.existsSync(index) && !fs.existsSync(landing)) {
  console.error('build-static: public/ has no index.html or landing.html');
  process.exit(1);
}
if (fs.existsSync(path.join(out, 'api'))) {
  console.error('build-static: refusing to publish api/ as static files');
  process.exit(1);
}

const htmlCount = fs.readdirSync(out).filter((name) => name.endsWith('.html')).length;
console.log('Static output written to public/ (' + htmlCount + ' html files)');
