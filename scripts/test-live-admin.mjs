import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[Browser Page Error]:', err.stack || err.message);
  });

  const url = 'https://almahrusa.mken.live/admin.html';
  console.log(`Loading URL: ${url}`);

  try {
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    console.log('Logging in...');
    await page.selectOption('#loginAuthType', 'local');
    await page.fill('#pinInput', 'mken2026');
    await page.click('#loginSubmitBtn');
    await page.waitForSelector('#adminView:not([hidden])', { timeout: 10000 });
    console.log('Login successful!');

    // Wait for page to render
    await page.waitForTimeout(2000);

    const nestingReport = await page.evaluate(() => {
      const panels = document.querySelectorAll('.admin-tab-panel');
      return Array.from(panels).map(p => {
        const chain = [];
        let curr = p.parentElement;
        while (curr) {
          chain.push(`${curr.tagName}${curr.id ? '#' + curr.id : ''}${curr.className ? '.' + curr.className.split(' ').join('.') : ''}${curr.getAttribute('data-panel') ? '[data-panel="' + curr.getAttribute('data-panel') + '"]' : ''}`);
          curr = curr.parentElement;
        }
        return {
          panel: p.getAttribute('data-panel'),
          hidden: p.hidden,
          display: window.getComputedStyle(p).display,
          parentChain: chain
        };
      });
    });

    console.log('Live nesting report of all panels:');
    console.log(JSON.stringify(nestingReport, null, 2));

  } catch (err) {
    console.error('Test run failed:', err.stack || err.message);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test script crashed:', err);
});
