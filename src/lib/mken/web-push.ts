import {
  createPrivateKey,
  sign,
  createECDH,
  createCipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type PushKeys = { p256dh?: string; auth?: string };

function vapidConfig() {
  return {
    publicKey: (process.env.VAPID_PUBLIC_KEY || "").trim(),
    privateKey: (process.env.VAPID_PRIVATE_KEY || "").trim(),
    subject: (process.env.VAPID_SUBJECT || "mailto:admin@mken.live").trim(),
  };
}

export function vapidPublicKey(): string {
  return vapidConfig().publicKey;
}

export function isPushConfigured(): boolean {
  const cfg = vapidConfig();
  return Boolean(cfg.publicKey && cfg.privateKey);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Buffer {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function vapidJwt(audience: string): string | null {
  const cfg = vapidConfig();
  if (!cfg.publicKey || !cfg.privateKey) return null;
  try {
    const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    const payload = b64url(
      Buffer.from(
        JSON.stringify({
          aud: audience,
          exp: Math.floor(Date.now() / 1000) + 12 * 3600,
          sub: cfg.subject,
        })
      )
    );
    const data = `${header}.${payload}`;
    const priv = fromB64url(cfg.privateKey);
    if (priv.length !== 32) return null;
    const key = createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e0201010420", "hex"),
        priv,
        Buffer.from("a00706052b8104000a", "hex"),
      ]),
      format: "der",
      type: "sec1",
    });
    const sig = sign("SHA256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" });
    return `${data}.${b64url(sig)}`;
  } catch {
    return null;
  }
}

export async function isPushEnabledForTenant(
  supabase: SupabaseClient,
  tenantSlug: string
): Promise<boolean> {
  const slug = tenantSlug || "default";
  const { data, error } = await supabase
    .from("mken_saas_clients")
    .select("config_data")
    .eq("tenant_slug", slug)
    .maybeSingle();

  let cfg: Record<string, unknown> = {};
  if (!error && data?.config_data && typeof data.config_data === "object") {
    cfg = data.config_data as Record<string, unknown>;
  } else {
    const { data: legacy } = await supabase
      .from("mken_config")
      .select("config_data")
      .eq("tenant_slug", slug)
      .maybeSingle();
    if (legacy?.config_data && typeof legacy.config_data === "object") {
      cfg = legacy.config_data as Record<string, unknown>;
    }
  }
  const push = (cfg.push && typeof cfg.push === "object" ? cfg.push : {}) as {
    enabled?: boolean;
    vapidPublicKey?: string;
  };
  return Boolean(push.enabled !== false && isPushConfigured());
}

async function fetchTenantSubscriptions(supabase: SupabaseClient, tenantSlug: string) {
  const slug = tenantSlug || "default";
  const { data, error } = await supabase
    .from("mken_push_subscriptions")
    .select("endpoint, keys")
    .eq("tenant_slug", slug);
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data || []) as { endpoint: string; keys: PushKeys }[];
}

function hkdfSha256(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, length));
}

function encryptWebPushPayload(payload: Buffer, p256dh: string, auth: string): Buffer {
  const userPublic = fromB64url(p256dh);
  const userAuth = fromB64url(auth);
  const salt = randomBytes(16);
  const local = createECDH("prime256v1");
  local.generateKeys();
  const localPublic = local.getPublicKey();
  const shared = local.computeSecret(userPublic);
  const authInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userPublic, localPublic]);
  const ikm = hkdfSha256(shared, userAuth, authInfo, 32);
  const cek = hkdfSha256(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdfSha256(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
  const padded = Buffer.concat([payload, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([localPublic.length]), localPublic, encrypted]);
}

async function sendPush(endpoint: string, keys: PushKeys, payload: Buffer): Promise<number> {
  const url = new URL(endpoint);
  const jwt = vapidJwt(`${url.protocol}//${url.host}`);
  const cfg = vapidConfig();
  if (!jwt) throw new Error("vapid-jwt-failed");
  if (!keys.p256dh || !keys.auth) throw new Error("subscription-keys-missing");
  const body = encryptWebPushPayload(payload, keys.p256dh, keys.auth);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${cfg.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(body),
  });
  return res.status;
}

export async function sendPushToTenant(
  supabase: SupabaseClient,
  tenantSlug: string,
  title: string,
  body: string,
  url: string
): Promise<{ sent: number; failed: number; skipped?: string }> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, skipped: "vapid-not-configured" };
  }
  const enabled = await isPushEnabledForTenant(supabase, tenantSlug);
  if (!enabled) return { sent: 0, failed: 0, skipped: "push-disabled" };

  const subs = await fetchTenantSubscriptions(supabase, tenantSlug);
  if (!subs.length) return { sent: 0, failed: 0, skipped: "no-subscriptions" };

  const payload = Buffer.from(
    JSON.stringify({
      title: title.slice(0, 120) || "مكّن",
      body: body.slice(0, 500),
      url: url.slice(0, 200) || "/admin",
    }),
    "utf8"
  );

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      const status = await sendPush(sub.endpoint, sub.keys || {}, payload);
      if (status === 201 || status === 200 || status === 204) sent += 1;
      else if (status === 404 || status === 410) {
        failed += 1;
        await supabase.from("mken_push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function upsertPushSubscription(
  supabase: SupabaseClient,
  row: {
    tenantSlug: string;
    endpoint: string;
    keys: PushKeys;
    label?: string;
    userAgent?: string;
  }
): Promise<{ error?: string }> {
  const { error } = await supabase.from("mken_push_subscriptions").upsert(
    {
      tenant_slug: row.tenantSlug,
      endpoint: row.endpoint,
      keys: row.keys,
      label: (row.label || "admin").slice(0, 40),
      user_agent: (row.userAgent || "").slice(0, 200) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return { error: error.message };
  return {};
}
