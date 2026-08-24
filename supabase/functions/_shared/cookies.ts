import { cookieDomain, deviceCookieName, TRUST_MAX_AGE_SEC } from "./env.ts";

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readDeviceToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.get("Cookie"));
  const name = deviceCookieName();
  const raw = cookies[name];
  return raw && raw.length >= 16 ? raw : null;
}

/**
 * Set trust cookie.
 * Note: Domain=.mken.live only works if the Edge Function is served under *.mken.live
 * (custom domain) or a Vercel BFF re-applies this Set-Cookie on mken.live.
 */
export function buildDeviceCookieHeader(rawToken: string, maxAge = TRUST_MAX_AGE_SEC): string {
  const name = deviceCookieName();
  const domain = cookieDomain();
  const parts = [
    `${name}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

export function clearDeviceCookieHeader(): string {
  const name = deviceCookieName();
  const domain = cookieDomain();
  const parts = [
    `${name}=`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}
