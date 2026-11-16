'use strict';

/**
 * Hobby allows 1 concurrent deployment. Two Git-connected projects (mken + mkn)
 * both fire on every push and both fail. Skip the legacy root "mken" project so
 * only "mkn" (Next.js / mkn-theme) consumes the build slot.
 *
 * exit 0 → skip deployment
 * exit 1 → continue deployment
 */
const name = String(process.env.VERCEL_PROJECT_NAME || '').toLowerCase();
const id = String(process.env.VERCEL_PROJECT_ID || '');

const skip =
  name === 'mken' ||
  id === 'prj_6eUFvlK6F6KDw3dvlsCwSjHD3xcG';

if (skip) {
  console.log('[vercel-ignore] Skipping legacy mken project deploy');
  process.exit(0);
}

console.log('[vercel-ignore] Continuing deploy for', name || id || 'unknown');
process.exit(1);
