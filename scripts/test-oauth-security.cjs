const assert = require('assert');
const { generateOAuthState, verifyOAuthState, revokeGoogleToken } = require('../api/_lib/google-auth-helper.js');
const googleAuthHandler = require('../api/google-business.js');

async function runOAuthTests() {
  console.log('🧪 Starting Google OAuth 2.0 Security & Compliance Tests...\n');

  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-12345';
  process.env.GOOGLE_REDIRECT_URI = 'https://mken.live/api/google-business/callback';
  process.env.ADMIN_PIN = '123456';

  // 1. Test state generation and verification
  console.log('1️⃣ Testing OAuth State HMAC Signing and CSRF Protection...');
  const state = generateOAuthState('rewa');
  assert(state && typeof state === 'string', 'State should be a valid string');
  assert(state.includes('.'), 'State should have payload.signature structure');

  const verifiedTenant = verifyOAuthState(state);
  assert.strictEqual(verifiedTenant, 'rewa', 'Verified tenant must match original tenant');
  console.log('   ✅ Valid signed state successfully generated and verified for tenant: ' + verifiedTenant);

  // 2. Test tampered state detection
  const tamperedState = state.slice(0, -4) + 'abcd';
  const tamperedResult = verifyOAuthState(tamperedState);
  assert.strictEqual(tamperedResult, null, 'Tampered state must be rejected');
  console.log('   ✅ Tampered state successfully detected and rejected (CSRF safe).');

  // 3. Test handleAuthUrl endpoint output
  console.log('\n2️⃣ Testing Google Auth URL Generation...');
  let responseData = null;
  let responseStatus = 200;
  const mockReq = {
    method: 'GET',
    url: '/api/google-business/auth-url?tenant=rewa',
    query: { tenant: 'rewa', action: 'auth-url' },
    headers: { host: 'mken.live', 'x-admin-pin': '123456' }
  };
  const mockRes = {
    status(c) { responseStatus = c; return this; },
    json(data) { responseData = data; return this; },
    setHeader() {}
  };

  await googleAuthHandler(mockReq, mockRes);
  assert.strictEqual(responseStatus, 200, 'Auth URL endpoint must return 200');
  assert(responseData && responseData.url, 'Response must contain auth url');

  const generatedUrl = new URL(responseData.url);
  assert.strictEqual(generatedUrl.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.strictEqual(generatedUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/business.manage');
  assert.strictEqual(generatedUrl.searchParams.get('access_type'), 'offline');
  assert.strictEqual(generatedUrl.searchParams.get('prompt'), 'consent');
  assert.strictEqual(generatedUrl.searchParams.get('response_type'), 'code');

  const stateInUrl = generatedUrl.searchParams.get('state');
  assert.strictEqual(verifyOAuthState(stateInUrl), 'rewa');
  console.log('   ✅ Auth URL contains all mandatory Google parameters (client_id, scope, access_type=offline, prompt=consent, signed state).');

  // 4. Test handleCallback with invalid state (CSRF simulation)
  console.log('\n3️⃣ Testing Callback with Invalid / Fake State...');
  let redirectUrl = '';
  const mockCallbackReq = {
    method: 'GET',
    url: '/api/google-business/callback?code=mock-code&state=forged.invalid_signature',
    query: { code: 'mock-code', state: 'forged.invalid_signature', action: 'callback' },
    headers: { host: 'mken.live' }
  };
  const mockCallbackRes = {
    redirect(url) { redirectUrl = url; return this; },
    setHeader() {}
  };

  await googleAuthHandler(mockCallbackReq, mockCallbackRes);
  assert(redirectUrl.includes('google_connect=error'), 'Should redirect with error on bad state');
  console.log('   ✅ Callback correctly blocked invalid CSRF state and redirected with error.');

  // 5. Test token revocation helper
  console.log('\n4️⃣ Testing Token Revocation API helper...');
  const originalFetch = global.fetch;
  let revokeCalled = false;
  let revokeUrl = '';
  global.fetch = async (url, opts) => {
    if (String(url).includes('oauth2.googleapis.com/revoke')) {
      revokeCalled = true;
      revokeUrl = String(url);
      return { ok: true, status: 200, text: async () => '' };
    }
    return originalFetch ? originalFetch(url, opts) : { ok: true };
  };

  try {
    const revokeRes = await revokeGoogleToken('test-refresh-token-xyz');
    assert.strictEqual(revokeRes.success, true);
    assert(revokeCalled, 'Revoke endpoint should be invoked');
    assert(revokeUrl.includes('token=test-refresh-token-xyz'), 'Revoke URL should contain token');
    console.log('   ✅ Google Token Revocation endpoint invoked successfully with standard format.');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n🎉 ALL GOOGLE OAUTH 2.0 SECURITY & COMPLIANCE TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runOAuthTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
