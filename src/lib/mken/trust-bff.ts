import { NextResponse } from "next/server";

/** Trust Engine BFF — proxy Supabase Edge + rewrite cookies for *.mken.live */

export const DEVICE_COOKIE_NAME =
  process.env.MKEN_DEVICE_COOKIE_NAME?.trim() || "mken_device_trust";
export const COOKIE_DOMAIN = process.env.MKEN_COOKIE_DOMAIN?.trim() || ".mken.live";
export const TRUST_MAX_AGE = parseInt(
  process.env.MKEN_TRUST_MAX_AGE_SEC || String(60 * 60 * 24 * 60),
  10
);

const ALLOWED_ACTIONS = {
  challenge: "trust-challenge",
  verify: "trust-verify",
  fallback: "authentica-fallback",
} as const;

export type TrustAction = keyof typeof ALLOWED_ACTIONS;

const TRUSTED_ORIGIN_PATTERN =
  /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https?:\/\/([a-zA-Z0-9-]+\.)*mken\.(live|app|com))$/;

const customOriginCache = new Map<string, { ok: boolean; exp: number }>();
const CUSTOM_ORIGIN_TTL_MS = 60 * 1000;

function pickEnvValue(names: string[]): string {
  for (const name of names) {
    const val = process.env[name];
    if (!val) continue;
    const cleaned = String(val).trim().replace(/^['"]|['"]$/g, "").trim();
    if (cleaned && cleaned !== "undefined" && cleaned !== "null") return cleaned;
  }
  return "";
}

function pickByPrefix(prefix: string): string {
  const keys = Object.keys(process.env)
    .filter((k) => k.startsWith(prefix))
    .sort();
  for (const key of keys) {
    const val = process.env[key];
    if (val && String(val).trim()) return String(val).trim();
  }
  return "";
}

function getSupabaseUrl(): string {
  return pickEnvValue(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
}

function getSupabaseAnonKey(): string {
  return (
    pickEnvValue([
      "SUPABASE_KEY",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_KEY",
    ]) || pickByPrefix("sb_publishable_")
  );
}

function getSupabaseServiceKey(): string {
  return (
    pickEnvValue(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"]) ||
    pickByPrefix("sb_secret_")
  );
}

export function getFunctionsBase(): string {
  const base = (process.env.MKEN_TRUST_FUNCTIONS_BASE || "").trim().replace(/\/+$/, "");
  if (base) return base;
  const url = getSupabaseUrl();
  if (!url) return "";
  return `${String(url).replace(/\/+$/, "")}/functions/v1`;
}

export function getAnonKey(): string {
  return getSupabaseAnonKey();
}

function isPlausibleIp(ip: string): boolean {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((o) => {
      const n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) return true;
  return false;
}

/** Trusted client IP on Vercel (platform-controlled forwarding). */
export function getTrustedClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && isPlausibleIp(cf.trim())) return cf.trim();

  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim() || "";
    if (isPlausibleIp(first)) return first;
  }

  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const ip = xf.split(",")[0]?.trim() || "";
    if (isPlausibleIp(ip)) return ip;
  }

  return "0.0.0.0";
}

export function resolveTrustAction(raw: string | undefined | null): TrustAction | "" {
  const action = String(raw || "")
    .toLowerCase()
    .trim();
  if (action in ALLOWED_ACTIONS) return action as TrustAction;
  return "";
}

function edgeFunctionName(action: TrustAction): string {
  return ALLOWED_ACTIONS[action];
}

interface ParsedCookie {
  name: string;
  value: string;
  attrs: Record<string, string | boolean>;
}

function parseSetCookieHeaders(setCookieHeader: string | string[] | null | undefined): ParsedCookie[] {
  if (!setCookieHeader) return [];
  const rawList = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const out: ParsedCookie[] = [];

  for (const rawItem of rawList) {
    const raw = String(rawItem || "").trim();
    if (!raw) continue;
    const parts = raw.split(";");
    const nv = parts[0] || "";
    const eq = nv.indexOf("=");
    if (eq < 0) continue;
    const name = nv.slice(0, eq).trim();
    const value = nv.slice(eq + 1).trim();
    const attrs: Record<string, string | boolean> = {};
    for (let j = 1; j < parts.length; j++) {
      const p = parts[j]?.trim();
      if (!p) continue;
      const e = p.indexOf("=");
      if (e < 0) attrs[p.toLowerCase()] = true;
      else attrs[p.slice(0, e).trim().toLowerCase()] = p.slice(e + 1).trim();
    }
    out.push({ name, value, attrs });
  }
  return out;
}

function deviceCookieOptions(maxAge: number) {
  return {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "strict" as const,
    maxAge,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
}

function applyRewrittenCookies(
  response: NextResponse,
  upstreamSetCookie: string | string[] | null | undefined
): boolean {
  const cookies = parseSetCookieHeaders(upstreamSetCookie);
  let applied = false;

  for (const c of cookies) {
    if (c.name !== DEVICE_COOKIE_NAME) continue;
    let maxAge = TRUST_MAX_AGE;
    if (c.attrs["max-age"] != null) {
      const parsed = parseInt(String(c.attrs["max-age"]), 10);
      if (!isNaN(parsed)) maxAge = parsed;
    }
    let value = c.value;
    try {
      value = decodeURIComponent(c.value);
    } catch {
      /* keep raw */
    }

    if (!value || maxAge === 0) {
      response.cookies.set(DEVICE_COOKIE_NAME, "", deviceCookieOptions(0));
    } else {
      response.cookies.set(DEVICE_COOKIE_NAME, value, deviceCookieOptions(maxAge));
    }
    applied = true;
  }
  return applied;
}

async function isActiveCustomHost(hostname: string): Promise<boolean> {
  const host = String(hostname || "")
    .toLowerCase()
    .split(":")[0];
  if (!host || !host.includes(".")) return false;

  const cached = customOriginCache.get(host);
  if (cached && cached.exp > Date.now()) return cached.ok;

  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) {
    customOriginCache.set(host, { ok: false, exp: Date.now() + CUSTOM_ORIGIN_TTL_MS });
    return false;
  }

  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/mken_tenant_domains?hostname=eq.${encodeURIComponent(host)}&status=eq.active&select=tenant_slug`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );
    const rows = await res.json();
    const ok = Array.isArray(rows) && rows.length > 0;
    customOriginCache.set(host, { ok, exp: Date.now() + CUSTOM_ORIGIN_TTL_MS });
    return ok;
  } catch {
    return false;
  }
}

export async function getSafeCorsOrigin(request: Request): Promise<string> {
  const origin = request.headers.get("origin");
  if (!origin) return "https://mken.live";

  if (TRUSTED_ORIGIN_PATTERN.test(origin)) return origin;

  try {
    const host = new URL(origin).hostname;
    if (await isActiveCustomHost(host)) return origin;
  } catch {
    /* ignore */
  }
  return "https://mken.live";
}

const TRUST_CORS_HEADERS =
  "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Pin, X-Turnstile-Token, X-Mken-Tenant";

export async function withTrustCors(response: NextResponse, request: Request): Promise<NextResponse> {
  const origin = await getSafeCorsOrigin(request);
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", TRUST_CORS_HEADERS);
  return response;
}

export async function trustOptionsResponse(request: Request): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 200 });
  return withTrustCors(response, request);
}

export async function proxyTrustAction(
  request: Request,
  action: TrustAction
): Promise<NextResponse> {
  const fn = edgeFunctionName(action);
  const base = getFunctionsBase();
  const anon = getAnonKey();
  if (!base || !anon) {
    return withTrustCors(
      NextResponse.json({ error: "trust_bff_not_configured" }, { status: 500 }),
      request
    );
  }

  const clientIp = getTrustedClientIp(request);
  const incomingCookie = request.headers.get("cookie") || "";

  let body: unknown = {};
  try {
    const rawBody = await request.text();
    if (rawBody.trim()) body = JSON.parse(rawBody);
  } catch {
    return withTrustCors(NextResponse.json({ error: "invalid_json" }, { status: 400 }), request);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    "x-vercel-forwarded-for": clientIp,
    "x-mken-bff": "1",
  };

  const cfIp = request.headers.get("cf-connecting-ip");
  headers["cf-connecting-ip"] = cfIp || clientIp;
  if (incomingCookie) headers.Cookie = incomingCookie;

  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers["User-Agent"] = userAgent;

  const origin = request.headers.get("origin");
  if (origin) headers.Origin = origin;

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    console.error("trust_bff_upstream_fetch", err instanceof Error ? err.message : err);
    return withTrustCors(
      NextResponse.json({ error: "upstream_unreachable" }, { status: 502 }),
      request
    );
  }

  const text = await upstream.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    data = { error: "invalid_upstream_json", raw: text.slice(0, 500) };
  }

  let setCookie: string | string[] | null = null;
  const hdrs = upstream.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof hdrs.getSetCookie === "function") {
    const list = hdrs.getSetCookie();
    if (list?.length) setCookie = list;
  }
  if (!setCookie) {
    const single = upstream.headers.get("set-cookie");
    if (single) setCookie = single;
  }

  if (data && typeof data === "object" && data.cookieHint) {
    data.cookieHint = {
      name: DEVICE_COOKIE_NAME,
      domain: COOKIE_DOMAIN,
      setBy: "bff",
      maxAge: TRUST_MAX_AGE,
    };
  }

  const response = NextResponse.json(data ?? {}, { status: upstream.status });
  applyRewrittenCookies(response, setCookie);
  return withTrustCors(response, request);
}
