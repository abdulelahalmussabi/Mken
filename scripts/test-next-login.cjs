'use strict';

const siteUrl = 'https://mken.live';

const testAccounts = [
  'admin@mken.live',
  'almahrusa@mken.live',
  'almahrosa@mken.live',
  'almasabi@mken.live',
  'demo@mken.live'
];

async function testNextLogin() {
  console.log(`📡 Testing Next.js login endpoint: ${siteUrl}/api/admin/login ...\n`);

  for (const email of testAccounts) {
    try {
      const res = await fetch(`${siteUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Aa#321321' })
      });

      const status = res.status;
      const data = await res.json();

      if (status === 200 && data.success) {
        console.log(`✅ SUCCESS for ${email}:`, data.message || 'Login OK');
      } else {
        console.error(`❌ FAILED for ${email} (Status ${status}):`, data.message || data.error || JSON.stringify(data));
      }
    } catch (err) {
      console.error(`❌ ERROR for ${email}:`, err.message);
    }
  }
}

testNextLogin().catch(console.error);
