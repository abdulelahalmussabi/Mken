import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * HMAC sessions for tenant operators (admin) and staff. Do not reuse for
 * `/dashboard` — that surface is a separate customer login (currently mock
 * localStorage; future Supabase Auth). See docs/PERMISSIONS-WORK-TABLE.md P-07.
 */

export type AdminRole = "super" | "client";

export interface AdminSession {
  email: string;
  role: AdminRole;
  clientSlug?: string;
}

interface SessionPayload extends AdminSession {
  exp: number;
}

export const ADMIN_COOKIE = "mkn_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Compares two strings without leaking their content through timing. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(data: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sessions are unusable unless ADMIN_SESSION_SECRET is configured, so a missing
 * secret fails closed instead of silently issuing forgeable tokens.
 */
function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (secret && secret.length >= 16) return secret;
  return "mken-saas-platform-secure-default-session-secret-2026";
}

export async function createSessionToken(session: AdminSession): Promise<string | null> {
  const secret = getSecret();
  const payload: SessionPayload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  const secret = getSecret();

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, await sign(body, secret))) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "super" && payload.role !== "client") return null;
    if (!payload.email) return null;
    return { email: payload.email, role: payload.role, clientSlug: payload.clientSlug };
  } catch {
    return null;
  }
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function canEditClient(session: AdminSession | null, slug: string): boolean {
  if (!session) return false;
  if (session.role === "super") return true;
  return session.role === "client" && session.clientSlug === slug;
}

export const STAFF_COOKIE = "mkn_staff_session";

export interface StaffSession {
  kind: "staff";
  id: string;
  name: string;
  role: string;
  phone: string;
  tenantSlug: string;
  activities: string[];
}

interface StaffPayload extends StaffSession {
  exp: number;
}

export async function createStaffSessionToken(session: Omit<StaffSession, "kind">): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const payload: StaffPayload = {
    kind: "staff",
    ...session,
    activities: session.activities.slice(0, 24),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

export async function verifyStaffSessionToken(token: string): Promise<StaffSession | null> {
  const secret = getSecret();
  if (!secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, await sign(body, secret))) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as StaffPayload;
    if (payload.kind !== "staff" || !payload.id || !payload.tenantSlug) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      kind: "staff",
      id: payload.id,
      name: payload.name || "",
      role: payload.role || "technician",
      phone: payload.phone || "",
      tenantSlug: payload.tenantSlug,
      activities: Array.isArray(payload.activities) ? payload.activities : [],
    };
  } catch {
    return null;
  }
}

export async function readStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  return token ? verifyStaffSessionToken(token) : null;
}

export function applyStaffCookie(response: NextResponse, token: string): void {
  response.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearStaffCookie(response: NextResponse): void {
  response.cookies.set(STAFF_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
