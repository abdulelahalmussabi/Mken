/**
 * Smoke tests for the Next.js App Router (mken).
 *
 * Prerequisites: Next.js running on port 3000 (production or dev).
 *
 * Local run:
 *   # terminal 1 — from repo root
 *   npm run build && npm start
 *   # or: npm run dev
 *
 *   # terminal 2
 *   cd scripts && npm install && npx playwright install chromium
 *   BASE_URL=http://127.0.0.1:3000 node smoke-test.mjs
 */

import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function assertRoute(page, path, label, checks) {
  console.log(`\n🔍 ${label} (${path})...`);
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  if (!response || !response.ok()) {
    throw new Error(`${path} returned HTTP ${response?.status() ?? 'no response'}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  for (const check of checks) {
    await check(page);
  }
  console.log(`   ✅ ${label}`);
}

async function runTests() {
  console.log(`🚀 Smoke tests against ${BASE_URL}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.error('❌ Could not launch Chromium. Run `npx playwright install chromium` in scripts/.');
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'ar-SA',
  });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    console.error(`   ❌ [page error] ${err.message}`);
  });

  // Quick reachability probe
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch {
    console.error(`❌ No server at ${BASE_URL}. Start Next.js first (npm run dev or npm start).`);
    await browser.close();
    process.exit(1);
  }

  try {
    await assertRoute(page, '/', 'Home page', [
      async (p) => {
        await p.getByText(/مكّن|mken/i).first().waitFor({ state: 'visible', timeout: 15_000 });
      },
    ]);

    await assertRoute(page, '/admin/login', 'Admin login', [
      async (p) => {
        await p.locator('#admin-email').waitFor({ state: 'visible' });
        await p.locator('#admin-password').waitFor({ state: 'visible' });
        await p.locator('#admin-login-btn').waitFor({ state: 'visible' });
        await p.getByRole('heading', { name: /لوحة تحكم مكّن/i }).waitFor({ state: 'visible' });
      },
    ]);

    await assertRoute(page, '/book', 'Booking page', [
      async (p) => {
        await p.getByRole('heading', { name: /احجز موعدك/i }).waitFor({ state: 'visible' });
        await p.locator('input[type="date"]').waitFor({ state: 'visible' });
        await p.getByPlaceholder('مثال: عبدالله الفهد').waitFor({ state: 'visible' });
        await p.getByRole('button', { name: /تأكيد حجز الموعد/i }).waitFor({ state: 'visible' });
      },
    ]);

    // Legacy .html rewrite should still land on /book
    await assertRoute(page, '/book.html', 'book.html → /book rewrite', [
      async (p) => {
        if (!p.url().includes('/book')) {
          throw new Error(`Expected /book rewrite, got ${p.url()}`);
        }
        await p.getByRole('heading', { name: /احجز موعدك/i }).waitFor({ state: 'visible' });
      },
    ]);

    console.log('\n🎉 All smoke tests passed.\n');
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failed:');
    console.error(error.stack || error.message);
    await browser.close();
    process.exit(1);
  }
}

runTests();
