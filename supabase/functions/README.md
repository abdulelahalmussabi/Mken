# Mken Trust Engine — Supabase Edge Functions

## Functions

| Function | Path | Role |
|----------|------|------|
| `trust-challenge` | `/functions/v1/trust-challenge` | Cookie+FP trust skip **or** Authentica WhatsApp OTP + 15s SMS fallback |
| `trust-verify` | `/functions/v1/trust-verify` | Verify OTP → bind `mken_device_trust` cookie → optional session |
| `authentica-fallback` | `/functions/v1/authentica-fallback` | Manual SMS/Email escalation |

## Prerequisites (SQL)

1. `db/device-trust-auth-schema.sql`
2. `db/otp-trust-runtime-schema.sql`

## Secrets

See `.env.example`. Set with:

```bash
supabase secrets set MKEN_SERVER_PEPPER="$(openssl rand -hex 32)"
supabase secrets set MKEN_HMAC_SECRET="$(openssl rand -hex 32)"
supabase secrets set AUTHENTICA_API_KEY="..."
supabase secrets set TURNSTILE_SECRET_KEY="..."
```

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected on hosted Edge.

## Deploy

```bash
supabase functions deploy trust-challenge --no-verify-jwt
supabase functions deploy trust-verify --no-verify-jwt
supabase functions deploy authentica-fallback --no-verify-jwt
```

`--no-verify-jwt` is required: callers are unauthenticated until OTP succeeds.

## Cookie / Vercel BFF (production)

Do **not** call Edge from the browser on `*.supabase.co` — the cookie will not stick.

| Layer | Path |
|-------|------|
| Browser | `POST /api/v1/trust/challenge\|verify\|fallback` |
| BFF | `api/v1/trust.js` → rewrites `Set-Cookie` to `Domain=.mken.live` |
| Edge | `trust-challenge` / `trust-verify` / `authentica-fallback` |

```js
MkenTrust.init({
  bffBaseUrl: '/api/v1/trust',
  turnstileSiteKey: '...',
  tenantSlug: 'salon'
});
```

Vercel env: `SUPABASE_URL`, `SUPABASE_KEY` (anon), optional `MKEN_COOKIE_DOMAIN=.mken.live`. Redeploy after env changes.

## Client contract (summary)

**Challenge**
```json
POST { "tenantSlug","phone","deviceFpHash","turnstileToken","rememberDevice":true }
```
`deviceFpHash` = `SHA-256(canonical_signals)` hex64 (server re-binds with pepper).

**Verify**
```json
POST { "tenantSlug","phone","otp","deviceFpHash","challengeId","challengeNonce","rememberDevice":true,"deviceLabel":"iPhone — Safari","approxCity":"الرياض" }
```
