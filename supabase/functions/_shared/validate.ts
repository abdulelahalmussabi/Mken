/** Phone / payload validation — Saudi E.164 focused, international-safe */

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizeE164(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;
  let p = phone.trim().replace(/[\s\-()]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (/^05\d{8}$/.test(p)) p = `+966${p.slice(1)}`; // local SA mobile
  if (/^5\d{8}$/.test(p)) p = `+966${p}`;
  if (!p.startsWith("+") && /^9665\d{8}$/.test(p)) p = `+${p}`;
  if (!E164_RE.test(p)) return null;
  return p;
}

export function isHex64(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{64}$/i.test(v);
}

export function sanitizeTenantSlug(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) return null;
  return s;
}

export function sanitizeOtp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const otp = v.trim();
  if (!/^\d{4,8}$/.test(otp)) return null;
  return otp;
}

export function sanitizeLabel(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim().replace(/[\u0000-\u001F<>]/g, "").slice(0, 80);
  return s || fallback;
}
