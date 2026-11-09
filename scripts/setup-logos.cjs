const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mknPublicLogos = path.join(rootDir, 'mkn-theme', 'public', 'logos');
const mknActivitiesLogos = path.join(mknPublicLogos, 'activities');

if (!fs.existsSync(mknPublicLogos)) fs.mkdirSync(mknPublicLogos, { recursive: true });
if (!fs.existsSync(mknActivitiesLogos)) fs.mkdirSync(mknActivitiesLogos, { recursive: true });

// 1. Copy platform logos from public/logos to mkn-theme/public/logos
const publicLogosDir = path.join(rootDir, 'public', 'logos');
if (fs.existsSync(publicLogosDir)) {
  const files = fs.readdirSync(publicLogosDir);
  for (const file of files) {
    const src = path.join(publicLogosDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(mknPublicLogos, file));
    }
  }
}

// 2. Copy Rewa Logo
const rewaSrc = path.join(rootDir, 'rewa_logo_assets', 'rewa_logo_cropped_transparent.png');
if (fs.existsSync(rewaSrc)) {
  fs.copyFileSync(rewaSrc, path.join(mknPublicLogos, 'rewa-logo.png'));
  fs.copyFileSync(rewaSrc, path.join(publicLogosDir, 'rewa-logo.png'));
}

// 3. Extract Almahrusa Logo from JSON
const almahrusaJson = path.join(rootDir, 'data', 'tenants', 'almahrusa.json');
if (fs.existsSync(almahrusaJson)) {
  const data = JSON.parse(fs.readFileSync(almahrusaJson, 'utf-8'));
  if (data.brand && data.brand.logo && data.brand.logo.startsWith('data:image/png;base64,')) {
    const base64Data = data.brand.logo.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(mknPublicLogos, 'almahrusa-logo.png'), Buffer.from(base64Data, 'base64'));
    fs.writeFileSync(path.join(publicLogosDir, 'almahrusa-logo.png'), Buffer.from(base64Data, 'base64'));
  }
}

// 4. Create Activity SVGs
const activities = {
  'salon-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="salonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#18181b"/>
  <circle cx="60" cy="60" r="44" stroke="url(#salonGrad)" stroke-width="3" stroke-dasharray="6 4" opacity="0.4"/>
  <path d="M42 40 L60 58 M78 40 L60 58" stroke="url(#salonGrad)" stroke-width="4" stroke-linecap="round"/>
  <circle cx="38" cy="36" r="6" stroke="url(#salonGrad)" stroke-width="3" fill="none"/>
  <circle cx="82" cy="36" r="6" stroke="url(#salonGrad)" stroke-width="3" fill="none"/>
  <path d="M60 58 L60 84" stroke="url(#salonGrad)" stroke-width="4" stroke-linecap="round"/>
  <path d="M46 76 Q60 88 74 76" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle cx="60" cy="92" r="3" fill="#fbbf24"/>
</svg>`,

  'commerce-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="commGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#0f172a"/>
  <rect x="34" y="44" width="52" height="46" rx="8" stroke="url(#commGrad)" stroke-width="3.5" fill="#1e293b" fill-opacity="0.6"/>
  <path d="M46 44 C46 32 74 32 74 44" stroke="#60a5fa" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M50 62 L70 62 M60 52 L60 72" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>
  <circle cx="44" cy="98" r="4" fill="#3b82f6"/>
  <circle cx="76" cy="98" r="4" fill="#3b82f6"/>
</svg>`,

  'hotel-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="hotelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#06251b"/>
  <path d="M38 90 L38 42 L82 42 L82 90 Z" stroke="url(#hotelGrad)" stroke-width="3.5" fill="#064e3b" fill-opacity="0.5"/>
  <rect x="48" y="50" width="8" height="8" rx="1.5" fill="#34d399"/>
  <rect x="64" y="50" width="8" height="8" rx="1.5" fill="#34d399"/>
  <rect x="48" y="64" width="8" height="8" rx="1.5" fill="#34d399"/>
  <rect x="64" y="64" width="8" height="8" rx="1.5" fill="#34d399"/>
  <path d="M54 90 L54 78 L66 78 L66 90 Z" fill="#6ee7b7"/>
  <path d="M60 22 L62 28 L68 28 L63 32 L65 38 L60 34 L55 38 L57 32 L52 28 L58 28 Z" fill="#fbbf24"/>
</svg>`,

  'legal-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="legalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#1c1917"/>
  <path d="M60 28 L60 90 M40 90 L80 90" stroke="url(#legalGrad)" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 42 L88 42" stroke="url(#legalGrad)" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 42 L24 62 L40 62 Z" stroke="#fde047" stroke-width="2.5" fill="#78350f" fill-opacity="0.5"/>
  <path d="M88 42 L80 62 L96 62 Z" stroke="#fde047" stroke-width="2.5" fill="#78350f" fill-opacity="0.5"/>
  <circle cx="60" cy="28" r="4" fill="#fde047"/>
</svg>`,

  'tech-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="techGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0e7490"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#082f49"/>
  <rect x="30" y="32" width="60" height="44" rx="6" stroke="url(#techGrad)" stroke-width="3.5" fill="#0c4a6e" fill-opacity="0.6"/>
  <path d="M48 84 L72 84 M60 76 L60 84" stroke="url(#techGrad)" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M46 50 L40 54 L46 58 M74 50 L80 54 L74 58 M56 62 L64 46" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,

  'healthcare-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14b8a6"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#042f2e"/>
  <circle cx="60" cy="60" r="40" stroke="url(#healthGrad)" stroke-width="3" fill="#115e59" fill-opacity="0.3"/>
  <path d="M60 40 L60 80 M40 60 L80 60" stroke="#2dd4bf" stroke-width="6" stroke-linecap="round"/>
  <circle cx="60" cy="60" r="6" fill="#f0fdfa"/>
</svg>`,

  'maintenance-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="maintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#1c1917"/>
  <path d="M42 36 C36 42 36 50 42 56 L76 90 C80 94 86 94 90 90 C94 86 94 80 90 76 L56 42 C50 36 42 36 36 42 Z" stroke="url(#maintGrad)" stroke-width="3" fill="#7c2d12" fill-opacity="0.4"/>
  <circle cx="82" cy="82" r="3" fill="#fb923c"/>
</svg>`,

  'cleaning-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="cleanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#082f49"/>
  <path d="M60 28 C60 28 40 52 40 68 C40 79 49 88 60 88 C71 88 80 79 80 68 C80 52 60 28 60 28 Z" stroke="url(#cleanGrad)" stroke-width="3.5" fill="#0369a1" fill-opacity="0.4"/>
  <path d="M30 38 L34 38 M32 36 L32 40" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
  <path d="M88 44 L94 44 M91 41 L91 47" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"/>
  <circle cx="54" cy="70" r="4" fill="#bae6fd"/>
</svg>`,

  'car-care-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#18181b"/>
  <path d="M28 68 L36 50 C38 46 44 44 50 44 L70 44 C76 44 82 46 84 50 L92 68 C96 68 98 72 98 76 L98 84 L90 84 M28 68 C24 68 22 72 22 76 L22 84 L30 84" stroke="url(#carGrad)" stroke-width="3.5" fill="#450a0a" fill-opacity="0.4"/>
  <circle cx="38" cy="84" r="7" stroke="#f87171" stroke-width="3" fill="#18181b"/>
  <circle cx="82" cy="84" r="7" stroke="#f87171" stroke-width="3" fill="#18181b"/>
  <path d="M72 32 L76 32 M74 30 L74 34" stroke="#fca5a5" stroke-width="2" stroke-linecap="round"/>
</svg>`
};

for (const [filename, svg] of Object.entries(activities)) {
  fs.writeFileSync(path.join(mknActivitiesLogos, filename), svg, 'utf-8');
  const rootActivitiesDir = path.join(publicLogosDir, 'activities');
  if (!fs.existsSync(rootActivitiesDir)) fs.mkdirSync(rootActivitiesDir, { recursive: true });
  fs.writeFileSync(path.join(rootActivitiesDir, filename), svg, 'utf-8');
}

// 5. Copy official emblem/icon as favicon.ico
const officialIconSrc = path.join(rootDir, 'public', 'logos', 'mken-official-icon.png');
const appFaviconPath = path.join(rootDir, 'mkn-theme', 'src', 'app', 'favicon.ico');
if (fs.existsSync(officialIconSrc)) {
  fs.copyFileSync(officialIconSrc, appFaviconPath);
}

console.log('✅ Logos & Activity assets setup successfully.');
