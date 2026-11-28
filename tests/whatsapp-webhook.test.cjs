'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { EventEmitter } = require('events');
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

class MockNextResponse {
  constructor(body, init = {}) {
    this.status = init.status || 200;
    this.body = body;
  }
  static json(data, init = {}) {
    return new MockNextResponse(data, init);
  }
}

function mockNodeReq(method, url, bodyStr, headers = {}) {
  const req = new EventEmitter();
  const parsed = new URL(url, 'https://www.mken.live');
  req.method = method;
  req.url = parsed.pathname + parsed.search;
  req.query = Object.fromEntries(parsed.searchParams.entries());
  req.headers = headers;
  process.nextTick(() => {
    if (bodyStr) req.emit('data', Buffer.from(bodyStr, 'utf8'));
    req.emit('end');
  });
  return req;
}

function mockNodeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.body = d; return this; },
    send(d) { this.body = d; return this; },
  };
}

function signMeta(rawBody, appSecret) {
  return 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
}

async function run() {
  // 1. Ensure hardcoded default verify token is gone and callback URI avoids 308 apex redirect.
  const inboundSrc = fs.readFileSync(path.join(ROOT, 'mkn-theme/src/lib/mken/whatsapp-inbound.ts'), 'utf8');
  const legacySrc = fs.readFileSync(path.join(ROOT, 'mkn-theme/src/server/platform/_lib/handlers/whatsapp-webhook.js'), 'utf8');
  const waSrc = fs.readFileSync(path.join(ROOT, 'mkn-theme/src/lib/mken/whatsapp.ts'), 'utf8');

  assert.ok(!inboundSrc.includes('mken_verify_token_2026'), 'inbound TS must not contain default verify token');
  assert.ok(!legacySrc.includes('mken_verify_token_2026'), 'legacy JS webhook must not contain default verify token');
  assert.ok(waSrc.includes('https://www.mken.live/api/whatsapp-webhook'), 'callback URL must use canonical www host');
  assert.ok(!waSrc.includes('https://mken.live/api/whatsapp-webhook'), 'callback URL must not point to 308 apex host');

  const inbound = loadTsModule('mkn-theme/src/lib/mken/whatsapp-inbound.ts', {
    'next/server': { NextResponse: MockNextResponse },
    '@/lib/mken/appointments': { createPublicAppointment: async () => ({}) },
    '@/lib/mken/review-funnel': { handleReviewRatingReply: async () => ({ handled: false }) },
    '@/lib/mken/slots': { listOpenSlots: async () => [] },
    '@/lib/mken/tenant': { fetchTenantRow: async () => null, getServiceRoleDb: () => null, TENANT_TABLE: 'mken_saas_clients' },
    '@/lib/mken/whatsapp-ai-agent': { generateAIReply: async () => '', resolveSiteDomain: async () => 'www.mken.live' },
    '@/lib/mken/whatsapp-canned-replies': { matchCannedReply: () => null },
    '@/lib/mken/whatsapp': {
      logInboundWhatsapp: async () => {},
      normalizeWaPhone: (p) => p,
      sendOutboundWhatsapp: async () => {},
      whatsappApiIsReady: () => false,
    },
  });

  const legacyHandler = require('../mkn-theme/src/server/platform/_lib/handlers/whatsapp-webhook.js');

  const prevVerify = process.env.WHATSAPP_VERIFY_TOKEN;
  const prevSecret = process.env.WHATSAPP_APP_SECRET;
  const metaBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  try {
    // 2. GET verification fails closed when WHATSAPP_VERIFY_TOKEN is unset.
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    const unconfiguredTs = inbound.whatsappVerifyResponse(
      new Request('https://www.mken.live/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=mken_verify_token_2026&hub.challenge=123')
    );
    assert.strictEqual(unconfiguredTs.status, 500);

    const legacyUnconfiguredRes = mockNodeRes();
    await legacyHandler(
      mockNodeReq('GET', '/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=mken_verify_token_2026&hub.challenge=123'),
      legacyUnconfiguredRes
    );
    assert.strictEqual(legacyUnconfiguredRes.statusCode, 500);

    // 3. GET verification rejects mismatch and accepts exact token.
    process.env.WHATSAPP_VERIFY_TOKEN = 'random_verify_tok_' + crypto.randomBytes(6).toString('hex');
    const badTs = inbound.whatsappVerifyResponse(
      new Request('https://www.mken.live/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=ch1')
    );
    assert.strictEqual(badTs.status, 403);

    const goodTs = inbound.whatsappVerifyResponse(
      new Request(`https://www.mken.live/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=ch_ok`)
    );
    assert.strictEqual(goodTs.status, 200);
    assert.strictEqual(goodTs.body, 'ch_ok');

    // 4. POST Meta payload fails closed without WHATSAPP_APP_SECRET or without valid HMAC signature.
    delete process.env.WHATSAPP_APP_SECRET;
    const noSecretTs = await inbound.handleWhatsappInbound(
      new Request('https://www.mken.live/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: metaBody,
      })
    );
    assert.strictEqual(noSecretTs.status, 500);

    const noSecretLegacyRes = mockNodeRes();
    await legacyHandler(
      mockNodeReq('POST', '/api/whatsapp-webhook', metaBody, { 'content-type': 'application/json' }),
      noSecretLegacyRes
    );
    assert.strictEqual(noSecretLegacyRes.statusCode, 500);

    process.env.WHATSAPP_APP_SECRET = 'meta_secret_' + crypto.randomBytes(12).toString('hex');

    // Missing x-hub-signature-256 must be rejected with 403 (never bypassed).
    const missingSigTs = await inbound.handleWhatsappInbound(
      new Request('https://www.mken.live/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: metaBody,
      })
    );
    assert.strictEqual(missingSigTs.status, 403);

    const missingSigLegacyRes = mockNodeRes();
    await legacyHandler(
      mockNodeReq('POST', '/api/whatsapp-webhook', metaBody, { 'content-type': 'application/json' }),
      missingSigLegacyRes
    );
    assert.strictEqual(missingSigLegacyRes.statusCode, 403);

    // Invalid signature rejected with 403.
    const badSigTs = await inbound.handleWhatsappInbound(
      new Request('https://www.mken.live/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' },
        body: metaBody,
      })
    );
    assert.strictEqual(badSigTs.status, 403);

    // Valid signature passes signature gate and reaches downstream DB check (mocked null -> 500 Supabase missing).
    const validSig = signMeta(metaBody, process.env.WHATSAPP_APP_SECRET);
    const validSigTs = await inbound.handleWhatsappInbound(
      new Request('https://www.mken.live/api/whatsapp-webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': validSig },
        body: metaBody,
      })
    );
    assert.strictEqual(validSigTs.status, 500);
    assert.strictEqual(validSigTs.body.error, 'Supabase credentials missing');
  } finally {
    if (prevVerify === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = prevVerify;
    if (prevSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = prevSecret;
  }

  console.log('whatsapp-webhook.test.cjs passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
