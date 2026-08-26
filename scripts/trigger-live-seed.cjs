'use strict';

const siteUrl = 'https://mken.live';
const defaultPin = 'mken2026';

async function run() {
  console.log(`📡 Sending request to live API: ${siteUrl}/api/v1/auth ...`);
  try {
    const res = await fetch(`${siteUrl}/api/v1/auth?type=admin-login&action=create-super-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin: defaultPin })
    });

    const status = res.status;
    const text = await res.text();
    console.log(`Response Status: ${status}`);
    console.log(`Response Text: ${text}`);

    if (status === 200) {
      console.log('✅ SUCCESS! Super Admin user has been created/seeded on the live database.');
    } else if (status === 401) {
      console.log('❌ Unauthorized: The default pin "mken2026" is incorrect. The user has set a custom ADMIN_PIN in Vercel.');
    } else {
      console.log('❌ Failed with unexpected status.');
    }
  } catch (err) {
    console.error('❌ Error calling live API:', err.message);
  }
}

run().catch(console.error);
