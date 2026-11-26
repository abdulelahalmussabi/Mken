'use strict';

const siteUrl = process.env.MKEN_SITE_URL || 'https://mken.live';
const pin = process.env.ADMIN_PIN || '';
const password = process.env.MKEN_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';

async function run() {
  if (pin.length < 4 || password.length < 12) {
    console.error('Set ADMIN_PIN and MKEN_ADMIN_PASSWORD (12+ characters). create-super-admin is no longer callable without them.');
    process.exit(1);
  }

  console.log(`Sending create-super-admin to ${siteUrl} ...`);
  try {
    const res = await fetch(`${siteUrl}/api/v1/auth?type=admin-login&action=create-super-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': pin
      },
      body: JSON.stringify({ pin: pin, password: password, action: 'create-super-admin' })
    });

    const status = res.status;
    const text = await res.text();
    console.log(`Response Status: ${status}`);
    console.log(`Response Text: ${text}`);

    if (status === 200) {
      console.log('Super Admin user has been created or updated.');
    } else {
      console.log('Failed to trigger user creation.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error calling API:', err.message);
    process.exitCode = 1;
  }
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
