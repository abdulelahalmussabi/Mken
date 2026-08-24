'use strict';

/**
 * Mken Trust Engine — Vercel BFF
 *
 * Proxies Supabase Edge Functions and rewrites mken_device_trust
 * for Domain=.mken.live (HttpOnly; Secure; SameSite=Strict).
 *
 * Routes (via vercel.json rewrites):
 *   POST /api/v1/trust/challenge  → action=challenge
 *   POST /api/v1/trust/verify     → action=verify
 *   POST /api/v1/trust/fallback   → action=fallback
 */

const { handleCors } = require('../_lib/cors');
const trustBff = require('../_lib/trust-bff');

module.exports = async function handler(req, res) {
  // Allow Turnstile / trust headers on preflight
  if (handleCors(req, res, 'POST,OPTIONS')) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  var action = trustBff.resolveAction(req);
  if (!action) {
    return res.status(400).json({
      error: 'unknown_action',
      hint: 'Use /api/v1/trust/challenge|verify|fallback',
    });
  }

  try {
    await trustBff.proxyTrustAction(req, res, action);
  } catch (err) {
    console.error('trust_bff_handler', err && err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'internal_error' });
    }
  }
};
