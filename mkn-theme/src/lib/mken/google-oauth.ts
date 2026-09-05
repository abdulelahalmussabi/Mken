import { createHmac } from "crypto";
import {
  hostnameFromHostHeader,
  isPlatformHostname,
  slugFromCustomHostname,
  tenantSlugFromSubdomain,
} from "@/lib/mken/tenant-host";

/** Strip paste artifacts that make Google reject an otherwise valid client id/secret. */
export function normalizeGoogleOAuthValue(raw: string | undefined, envName = ""): string {
  let value = (raw || "").replace(/^\uFEFF/, "").trim();
  value = value.replace(/^["'`]+|["'`]+$/g, "").trim();
  value = value.replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (envName && value.toUpperCase().startsWith(`${envName.toUpperCase()}=`)) {
    value = value.slice(envName.length + 1).trim();
  }
  return value.replace(/^(client[_\s-]*(id|secret)\s*[:=]\s*)/i, "").trim();
}

export function googleTokenError(tokenData: { error?: string; error_description?: string }): string {
  const desc = `${tokenData.error_description || ""} ${tokenData.error || ""}`.toLowerCase();
  if (desc.includes("client secret") || tokenData.error === "invalid_client") {
    return "سر عميل جوجل (GOOGLE_CLIENT_SECRET) لا يطابق معرّف العميل. حدّث السر من Google Cloud → Credentials لنفس تطبيق الويب، ثم الصقه في Vercel وأعد النشر.";
  }
  return tokenData.error_description || tokenData.error || "فشل تبادل رمز جوجل";
}

function oauthStateSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "mken-gbp-oauth").trim();
}

export function gbpReturnHost(hostname: string, slug: string): string {
  const host = hostnameFromHostHeader(hostname);
  const key = slug.trim().toLowerCase();
  if (isPlatformHostname(host)) return host;
  const bound = tenantSlugFromSubdomain(host) || slugFromCustomHostname(host);
  if (bound && bound === key) return host;
  return "www.mken.live";
}

export function encodeGbpOAuthState(slug: string, returnHost: string): string {
  const exp = String(Date.now() + 20 * 60 * 1000);
  const payload = `${slug.trim().toLowerCase()}|${gbpReturnHost(returnHost, slug)}|${exp}`;
  const sig = createHmac("sha256", oauthStateSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function parseGbpOAuthState(state: string): { slug?: string; returnHost?: string; error?: string } {
  const raw = (state || "").trim();
  if (!raw) return { error: "حالة الربط ناقصة" };
  if (/^[a-z0-9-]{2,40}$/.test(raw)) {
    return { slug: raw, returnHost: "www.mken.live" };
  }
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [slug, returnHost, exp, sig] = decoded.split("|");
    if (!slug || !returnHost || !exp || !sig) return { error: "حالة الربط غير صالحة" };
    if (Number(exp) < Date.now()) return { error: "انتهت صلاحية طلب الربط. أعد المحاولة." };
    const expected = createHmac("sha256", oauthStateSecret())
      .update(`${slug}|${returnHost}|${exp}`)
      .digest("hex")
      .slice(0, 32);
    if (expected !== sig) return { error: "حالة الربط غير صالحة" };
    return { slug: slug.toLowerCase(), returnHost: gbpReturnHost(returnHost, slug) };
  } catch {
    return { error: "حالة الربط غير صالحة" };
  }
}
