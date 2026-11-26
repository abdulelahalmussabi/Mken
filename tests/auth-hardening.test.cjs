'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    }
  };
}

async function run() {
  const legacyPass = Buffer.from('QWEjMzIxMzIx', 'base64').toString('utf8');
  const legacySecret = ['mken-saas-platform', 'secure-default-session-secret-2026'].join('-');

  // 1. Ensure production source files contain neither the legacy default password nor static session secret.
  const guardedFiles = [
    'mkn-theme/src/server/platform/_lib/handlers/auth.js',
    'mkn-theme/src/app/api/admin/login/route.ts',
    'mkn-theme/src/app/api/admin/seed/route.ts',
    'mkn-theme/src/server/platform/_lib/handlers/seed.js',
    'mkn-theme/src/lib/auth/session.ts',
    'mkn-theme/src/server/platform/_lib/queue-guard.js',
    'mkn-theme/src/context/AdminContext.tsx',
    'tests/queue-mkn-e2e.cjs'
  ];

  for (const rel of guardedFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!src.includes(legacyPass), `${rel} must not contain legacy default password`);
    assert.ok(!src.includes(legacySecret), `${rel} must not contain static session secret fallback`);
  }

  const adminCtx = fs.readFileSync(path.join(ROOT, 'mkn-theme/src/context/AdminContext.tsx'), 'utf8');
  assert.ok(!adminCtx.includes('/api/v1/auth/admin-login'), 'AdminContext must not fall back to legacy admin-login');

  // 2. Legacy auth handler rejects email/password login and create-super-admin.
  const prevPin = process.env.ADMIN_PIN;
  process.env.ADMIN_PIN = 'test-pin-' + crypto.randomBytes(6).toString('hex');
  try {
    const authHandler = require('../mkn-theme/src/server/platform/_lib/handlers/auth.js');

    const resEmail = mockRes();
    await authHandler({
      method: 'POST',
      url: '/api/v1/auth/admin-login',
      query: { type: 'admin-login' },
      headers: { 'x-forwarded-for': '198.51.100.201' },
      socket: { remoteAddress: '198.51.100.201' },
      body: { email: 'admin@mken.live', password: legacyPass }
    }, resEmail);
    assert.strictEqual(resEmail.statusCode, 410, JSON.stringify(resEmail.body));
    assert.ok(!resEmail.headers['Set-Cookie'], 'legacy email login must never issue a session cookie');

    const resCreateNoPin = mockRes();
    await authHandler({
      method: 'POST',
      url: '/api/v1/auth/admin-login',
      query: { type: 'admin-login', action: 'create-super-admin' },
      headers: { 'x-forwarded-for': '198.51.100.202' },
      socket: { remoteAddress: '198.51.100.202' },
      body: { action: 'create-super-admin', password: legacyPass }
    }, resCreateNoPin);
    assert.strictEqual(resCreateNoPin.statusCode, 401);

    const resCreateWithPin = mockRes();
    await authHandler({
      method: 'POST',
      url: '/api/v1/auth/admin-login',
      query: { type: 'admin-login', action: 'create-super-admin' },
      headers: { 'x-forwarded-for': '198.51.100.203', 'x-admin-pin': process.env.ADMIN_PIN },
      socket: { remoteAddress: '198.51.100.203' },
      body: { action: 'create-super-admin', pin: process.env.ADMIN_PIN }
    }, resCreateWithPin);
    assert.strictEqual(resCreateWithPin.statusCode, 410);
  } finally {
    if (prevPin === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = prevPin;
  }

  // 3. Legacy seed handler returns 410 Gone.
  const seedHandler = require('../mkn-theme/src/server/platform/_lib/handlers/seed.js');
  const resSeed = mockRes();
  await seedHandler({ method: 'GET' }, resSeed);
  assert.strictEqual(resSeed.statusCode, 410);

  // 4. queue-guard fails closed without ADMIN_SESSION_SECRET and rejects SUPABASE_KEY fallback.
  const prevSec = process.env.ADMIN_SESSION_SECRET;
  const prevSbKey = process.env.SUPABASE_KEY;
  const prevSrvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.SUPABASE_KEY = 'public-anon-key-that-must-never-sign-sessions';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-that-must-not-replace-session-secret';

    const queueGuard = require('../mkn-theme/src/server/platform/_lib/queue-guard.js');
    assert.throws(() => queueGuard.signStaffSession({ email: 'demo@mken.live', role: 'client', clientSlug: 'demo' }));
    assert.strictEqual(queueGuard.verifyStaffSession('abc.def'), null);

    process.env.ADMIN_SESSION_SECRET = 'valid-secret-' + crypto.randomBytes(16).toString('hex');
    const tok = queueGuard.signStaffSession({ email: 'demo@mken.live', role: 'client', clientSlug: 'demo' });
    const parsed = queueGuard.verifyStaffSession(tok);
    assert.ok(parsed && parsed.clientSlug === 'demo');
  } finally {
    if (prevSec === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSec;
    if (prevSbKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = prevSbKey;
    if (prevSrvKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSrvKey;
  }

  console.log('auth-hardening.test.cjs passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
