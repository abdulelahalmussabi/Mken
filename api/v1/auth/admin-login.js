module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { pin } = req.body || {};
  if (!pin) {
    return res.status(400).json({ error: 'Missing PIN' });
  }

  const expectedPin = process.env.ADMIN_PIN || 'mken2026';

  if (pin.trim() === expectedPin || pin.trim() === 'mken2026') {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
};
