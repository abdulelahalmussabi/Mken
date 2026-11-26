'use strict';

/**
 * The legacy admin-login route must not mint mkn_admin_session from an
 * email/password body, and the public seed route stays closed unless
 * SEED_ADMIN_SECRET is configured. Passwords used here are generated
 * per run and are not repository secrets.
 */

const assert = require('assert');
const crypto = require('crypto');

delete process.env.SEED_ADMIN_SECRET;
delete process.env.SEED_ADMIN_PASSWORD;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.SUPABASE_KEY;

process.env.ADMIN_PIN = 'unit-test-pin-' + crypto.randomBytes(8).toString('hex');

const authHandler = require('../mkn-theme/src/server/platform/_lib/handlers/auth.js');
const seedHandler = require('../mkn-theme/src/server/platform/_lib/handlers/seed.js');

function invoke(handler, body, extra) {
  const headers = Object.assign({
    origin: 'https://mken.live',
    'x-forwarded-for': (extra && extra.ip) || '198.51.100.20'
  }, extra && extra.headers);
  const req = {
    method: (extra && extra.method) || 'POST',
    url: (extra && extra.url) || '/api/v1/auth/admin-login',
    query: (extra && extra.query) || { type: 'admin-login' },
    body: body || {},
    headers: headers,
    socket: { remoteAddress: headers['x-forwarded-for'] }
  };
  const res = {
    statusCode: 200,
    headersOut: {},
    body: null,
    setHeader: function (key, value) {
      this.headersOut[String(key).toLowerCase()] = value;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (payload) {
      this.body = payload;
      return this;
    },
    end: function () {
      return this;
    }
  };
  return handler(req, res).then(function () { return res; });
}

async function main() {
  const password = 'generated-' + crypto.randomBytes(18).toString('base64url');
  const denied = await invoke(authHandler, {
    email: 'admin@mken.live',
    password: password
  }, { ip: '198.51.100.21' });

  assert.strictEqual(denied.statusCode, 401, JSON.stringify(denied.body));
  assert.strictEqual(denied.body.success, false);
  assert.ok(!JSON.stringify(denied.body).includes('admin@mken.live'), 'failure leaked the account');
  assert.ok(!String(denied.headersOut['set-cookie'] || '').includes('mkn_admin_session'));

  const unauthenticatedSeed = await invoke(authHandler, {
    action: 'create-super-admin',
    password: password
  }, { ip: '198.51.100.22' });
  assert.strictEqual(unauthenticatedSeed.statusCode, 401, JSON.stringify(unauthenticatedSeed.body));
  assert.ok(!String(unauthenticatedSeed.headersOut['set-cookie'] || '').includes('mkn_admin_session'));

  const pinLogin = await invoke(authHandler, {
    pin: process.env.ADMIN_PIN,
    action: 'login'
  }, { ip: '198.51.100.23' });
  assert.strictEqual(pinLogin.statusCode, 200, JSON.stringify(pinLogin.body));
  assert.strictEqual(pinLogin.body.success, true);
  assert.ok(!String(pinLogin.headersOut['set-cookie'] || '').includes('mkn_admin_session'));

  const ip = '198.51.100.24';
  let last = null;
  for (let i = 0; i < 5; i += 1) {
    last = await invoke(authHandler, {
      email: 'demo@mken.live',
      password: password
    }, { ip: ip });
    assert.strictEqual(last.statusCode, 401, 'attempt ' + (i + 1));
  }
  const limited = await invoke(authHandler, {
    email: 'demo@mken.live',
    password: password
  }, { ip: ip });
  assert.strictEqual(limited.statusCode, 429, JSON.stringify(limited.body));
  assert.ok(limited.headersOut['retry-after']);

  const seed = await invoke(seedHandler, {}, {
    ip: '198.51.100.25',
    url: '/api/seed',
    query: {}
  });
  assert.strictEqual(seed.statusCode, 403, JSON.stringify(seed.body));
  assert.strictEqual(seed.body.success, false);

  console.log('admin-login backdoor checks passed');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
