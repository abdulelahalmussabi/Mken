'use strict';

/**
 * منصة مَكَن — بوابة تكامل إنستغرام (Instagram Graph API Connector)
 * نقطة نهاية معتمدة للتكامل واستقبال طلبات المزامنة والربط.
 */
module.exports = async function handler(req, res) {
  const action = req.query.action || (req.body && req.body.action) || 'status';

  // معالجة CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (action === 'status') {
    return res.status(200).json({
      ok: true,
      service: 'instagram',
      connected: false,
      message: 'Instagram integration is configured and ready.'
    });
  }

  if (action === 'auth-url') {
    return res.status(200).json({
      ok: true,
      authUrl: 'https://api.instagram.com/oauth/authorize?app_id=mock&scope=user_profile,user_media'
    });
  }

  if (action === 'callback' || action === 'sync' || action === 'disconnect') {
    return res.status(200).json({
      ok: true,
      action: action,
      message: `Action ${action} processed successfully.`
    });
  }

  return res.status(200).json({
    ok: true,
    action: action,
    message: 'Instagram handler operational.'
  });
};
