/**
 * اختبارات متصفح — حضوري/عن بُعد + بوابة الهوكي
 * node scripts/test-tutor-coach.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // تفعيل tutoring + fitness في localStorage
  await page.goto(`${BASE}/book.html?activity=tutoring`);
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    var cfg = JSON.parse(localStorage.getItem('mken_platform_config') || '{}');
    if (!cfg.enabledActivities) cfg.enabledActivities = [];
    ['tutoring', 'fitness'].forEach(function (id) {
      if (cfg.enabledActivities.indexOf(id) === -1) cfg.enabledActivities.push(id);
    });
    if (!cfg.enabled) cfg.enabled = [];
    ['online-tutoring', 'exam-prep', 'personal-training', 'group-class'].forEach(function (id) {
      if (cfg.enabled.indexOf(id) === -1) cfg.enabled.push(id);
    });
    localStorage.setItem('mken_platform_config', JSON.stringify(cfg));
  });

  await page.reload();
  await page.waitForLoadState('networkidle');

  // online-tutoring — حقل الاجتماع ظاهر
  await page.locator('.booking-service').filter({ hasText: 'عن بُعد' }).first().click();
  await page.locator('#btnToDate').click();
  await page.locator('[data-date]').first().click();
  await page.locator('#btnToTime').click();
  await page.locator('.booking-slot').first().click();
  await page.locator('#btnToForm').click();

  const meetingVisible = await page.locator('#bookingMeetingBlock').isVisible();
  if (!meetingVisible) throw new Error('meeting block should be visible for online-tutoring');

  const deliveryHidden = await page.locator('#bookingDeliveryBlock').isHidden();
  if (!deliveryHidden) throw new Error('delivery choice should be hidden for remote-only service');

  console.log('✅ online-tutoring: حقل Zoom/Teams ظاهر');

  // exam-prep — 90 د في الشارة
  await page.goto(`${BASE}/book.html?activity=tutoring`);
  await page.waitForLoadState('networkidle');
  const examBadge = await page.locator('.booking-service').filter({ hasText: 'اختبارات' }).locator('small').textContent();
  if (!examBadge || !examBadge.includes('90')) throw new Error('exam-prep badge should show 90 min');
  console.log('✅ exam-prep: مدة 90 د في الواجهة');

  // hockey portal loads
  await page.goto(`${BASE}/coaching.html`);
  await page.waitForLoadState('networkidle');
  const hockeyTitle = await page.title();
  if (!hockeyTitle) throw new Error('coaching.html failed to load');
  console.log('✅ coaching.html: تحميل بوابة الهوكي');

  // football portal separate
  await page.goto(`${BASE}/football-coaching.html`);
  await page.waitForLoadState('networkidle');
  const footText = await page.locator('body').innerText();
  if (footText.indexOf('كرة') === -1 && footText.indexOf('⚽') === -1) {
    throw new Error('football-coaching should have football branding');
  }
  console.log('✅ football-coaching.html: بوابة منفصلة');

  await browser.close();
  console.log('✅ اختبارات المتصفح اكتملت');
}

run().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
