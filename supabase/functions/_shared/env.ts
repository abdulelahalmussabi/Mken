import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AdminClient = SupabaseClient;

export function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

export function getEnvOptional(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

export function createAdminClient(): AdminClient {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function pepper(): string {
  return getEnv("MKEN_SERVER_PEPPER");
}

export function hmacSecret(): string {
  return getEnv("MKEN_HMAC_SECRET");
}

export function authenticaApiKey(): string {
  return getEnv("AUTHENTICA_API_KEY");
}

export function turnstileSecret(): string {
  return getEnv("TURNSTILE_SECRET_KEY");
}

export function cookieDomain(): string {
  // Requires custom domain under mken.live OR Vercel BFF that re-sets the cookie
  return getEnvOptional("MKEN_COOKIE_DOMAIN", ".mken.live");
}

export function deviceCookieName(): string {
  return getEnvOptional("MKEN_DEVICE_COOKIE_NAME", "mken_device_trust");
}

export const TRUST_MAX_AGE_SEC = 60 * 60 * 24 * 60; // 60 days
export const OTP_TTL_SEC = 5 * 60;
export const WA_TO_SMS_FALLBACK_MS = 15_000;
export const PHONE_OTP_LIMIT = 3;
export const PHONE_OTP_WINDOW_SEC = 10 * 60;
export const IP_OTP_LIMIT = 10;
export const IP_OTP_WINDOW_SEC = 60 * 60;
export const OTP_FAIL_LOCK_THRESHOLD = 5;
export const OTP_FAIL_LOCK_SEC = 60 * 60;
