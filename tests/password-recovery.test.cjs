'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('../mkn-theme/node_modules/typescript');

const ROOT = path.join(__dirname, '..');

function loadTsModule(relPath, mocks) {
  const fullPath = path.join(ROOT, relPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  }).outputText;

  const mod = { exports: {} };
  const localRequire = (id) => {
    if (mocks && Object.prototype.hasOwnProperty.call(mocks, id)) {
      return mocks[id];
    }
    return require(id);
  };
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled);
  fn(localRequire, mod, mod.exports, fullPath, path.dirname(fullPath));
  return mod.exports;
}

async function run() {
  // 1. Both recovery routes must be reserved so proxy.ts never treats them as tenant slugs.
  const reserved = loadTsModule('mkn-theme/src/lib/mken/reserved-slugs.ts');
  assert.strictEqual(reserved.isReservedSlug('forgot-password'), true);
  assert.strictEqual(reserved.isReservedSlug('reset-password'), true);

  // 2. Pages must wire real Supabase password reset flows (no mock setTimeout left in forgot-password).
  const forgotSrc = fs.readFileSync(
    path.join(ROOT, 'mkn-theme/src/app/forgot-password/page.tsx'),
    'utf8'
  );
  assert.ok(!forgotSrc.includes('setTimeout('), 'forgot-password must not keep mock setTimeout');
  assert.ok(forgotSrc.includes('requestPasswordReset'), 'forgot-password must use requestPasswordReset');

  const resetSrc = fs.readFileSync(
    path.join(ROOT, 'mkn-theme/src/app/reset-password/page.tsx'),
    'utf8'
  );
  assert.ok(resetSrc.includes('completeRecoverySessionFromUrl'));
  assert.ok(resetSrc.includes('updateRecoveredPassword'));

  const adminLoginSrc = fs.readFileSync(
    path.join(ROOT, 'mkn-theme/src/app/admin/login/page.tsx'),
    'utf8'
  );
  assert.ok(adminLoginSrc.includes('/forgot-password'), 'admin login should link to forgot-password');

  // 3. Recovery helper unit tests with mocked Supabase client.
  const calls = { reset: [], exchange: [], verifyOtp: [], update: [], signOut: 0 };
  let sessionState = null;
  let nextResetError = null;
  let nextUpdateError = null;

  const helper = loadTsModule('mkn-theme/src/lib/auth/password-recovery.ts', {
    '@/lib/supabase/public-env': {
      publicSupabaseEnv: () => ({ url: 'https://wkcaakexzxqebwjyhtan.supabase.co', anon: 'anon-key' }),
    },
    '@/lib/supabase/client': {
      supabase: {
        auth: {
          resetPasswordForEmail: async (email, opts) => {
            calls.reset.push({ email, opts });
            return { error: nextResetError };
          },
          getSession: async () => ({ data: { session: sessionState } }),
          exchangeCodeForSession: async (code) => {
            calls.exchange.push(code);
            sessionState = { access_token: 'tok-' + code };
            return { error: null };
          },
          verifyOtp: async (opts) => {
            calls.verifyOtp.push(opts);
            sessionState = { access_token: 'tok-otp' };
            return { error: null };
          },
          updateUser: async (attrs) => {
            calls.update.push(attrs);
            return { error: nextUpdateError };
          },
          signOut: async () => {
            calls.signOut++;
            sessionState = null;
          },
        },
      },
    },
  });

  assert.strictEqual(
    helper.buildPasswordResetRedirectUrl('https://www.mken.live/'),
    'https://www.mken.live/reset-password'
  );
  assert.strictEqual(helper.resolveRecoveryLoginTarget('admin'), '/admin/login');
  assert.strictEqual(helper.resolveRecoveryLoginTarget('unknown'), '/login');

  assert.deepStrictEqual(
    helper.extractRecoveryUrlState('?code=abc123', ''),
    { code: 'abc123', tokenHash: null, type: null, hasHashToken: false, error: null }
  );
  assert.deepStrictEqual(
    helper.extractRecoveryUrlState('?token_hash=th_1&type=recovery', ''),
    { code: null, tokenHash: 'th_1', type: 'recovery', hasHashToken: false, error: null }
  );
  assert.deepStrictEqual(
    helper.extractRecoveryUrlState('', '#access_token=at_1&type=recovery'),
    { code: null, tokenHash: null, type: 'recovery', hasHashToken: true, error: null }
  );
  assert.strictEqual(
    helper.extractRecoveryUrlState('', '#error=access_denied&error_description=otp_expired').error,
    'otp_expired'
  );

  // Non-existent account errors are masked (anti-enumeration), while rate limits are surfaced.
  nextResetError = { message: 'User not found' };
  const hiddenNotFound = await helper.requestPasswordReset('Nobody@Mken.Live', 'https://www.mken.live');
  assert.strictEqual(hiddenNotFound.ok, true);
  assert.strictEqual(calls.reset[0].email, 'nobody@mken.live');
  assert.strictEqual(calls.reset[0].opts.redirectTo, 'https://www.mken.live/reset-password');

  nextResetError = { message: 'For security purposes, you can only request this after 60 seconds' };
  const rateLimited = await helper.requestPasswordReset('user@mken.live', 'https://www.mken.live');
  assert.strictEqual(rateLimited.ok, false);
  assert.ok(rateLimited.error && rateLimited.error.includes('الانتظار'));

  // Concurrent strict-mode code exchange deduplicates to one call.
  sessionState = null;
  const [res1, res2] = await Promise.all([
    helper.completeRecoverySessionFromUrl('?code=pkce_once', ''),
    helper.completeRecoverySessionFromUrl('?code=pkce_once', ''),
  ]);
  assert.strictEqual(res1.ready, true);
  assert.strictEqual(res2.ready, true);
  assert.strictEqual(calls.exchange.length, 1);

  // OTP token_hash recovery works cleanly.
  sessionState = null;
  const otpRes = await helper.completeRecoverySessionFromUrl('?token_hash=hash_xyz&type=recovery', '');
  assert.strictEqual(otpRes.ready, true);
  assert.strictEqual(calls.verifyOtp.length, 1);

  // Password update clears local session afterwards.
  nextUpdateError = null;
  const updOk = await helper.updateRecoveredPassword('StrongPass#2026');
  assert.strictEqual(updOk.ok, true);
  assert.strictEqual(calls.update[0].password, 'StrongPass#2026');
  assert.strictEqual(calls.signOut, 1);

  console.log('password-recovery.test.cjs passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
