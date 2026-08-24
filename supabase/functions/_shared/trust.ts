import type { AdminClient } from "./env.ts";
import {
  TRUST_MAX_AGE_SEC,
  hmacSecret,
} from "./env.ts";
import {
  buildTrustHmac,
  deviceTokenHash,
  randomTokenBase64Url,
  timingSafeEqualHex,
} from "./crypto.ts";

export interface TrustedDeviceRow {
  id: string;
  user_id: string;
  tenant_slug: string;
  device_token_hash: string;
  device_fp_hash: string;
  trust_hmac: string | null;
  last_ip_subnet_hash: string | null;
  expires_at: string;
  revoked_at: string | null;
}

export type TrustEval =
  | { ok: true; device: TrustedDeviceRow; userId: string }
  | {
    ok: false;
    reason:
      | "no_cookie"
      | "not_found"
      | "expired"
      | "fp_mismatch"
      | "subnet_drift"
      | "hmac_invalid";
    device?: TrustedDeviceRow;
  };

export async function evaluateTrustedDevice(
  admin: AdminClient,
  args: {
    rawToken: string | null;
    tenantSlug: string;
    boundFpHash: string;
    subnetHashValue: string;
  },
): Promise<TrustEval> {
  if (!args.rawToken) return { ok: false, reason: "no_cookie" };

  const tokenHash = await deviceTokenHash(args.rawToken);
  const { data, error } = await admin
    .from("user_trusted_devices")
    .select(
      "id,user_id,tenant_slug,device_token_hash,device_fp_hash,trust_hmac,last_ip_subnet_hash,expires_at,revoked_at",
    )
    .eq("tenant_slug", args.tenantSlug)
    .eq("device_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };

  const device = data as TrustedDeviceRow;
  if (new Date(device.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired", device };
  }

  if (!timingSafeEqualHex(device.device_fp_hash, args.boundFpHash)) {
    return { ok: false, reason: "fp_mismatch", device };
  }

  if (
    device.last_ip_subnet_hash &&
    device.last_ip_subnet_hash !== args.subnetHashValue
  ) {
    return { ok: false, reason: "subnet_drift", device };
  }

  if (device.trust_hmac) {
    const expUnix = Math.floor(new Date(device.expires_at).getTime() / 1000);
    const expected = await buildTrustHmac(hmacSecret(), {
      deviceFpHash: device.device_fp_hash,
      deviceTokenHash: device.device_token_hash,
      userId: device.user_id,
      expiresAtUnix: expUnix,
    });
    if (!timingSafeEqualHex(device.trust_hmac, expected)) {
      return { ok: false, reason: "hmac_invalid", device };
    }
  }

  return { ok: true, device, userId: device.user_id };
}

export async function revokeDevice(
  admin: AdminClient,
  deviceId: string,
  reason: string,
): Promise<void> {
  await admin
    .from("user_trusted_devices")
    .update({
      revoked_at: new Date().toISOString(),
      revoke_reason: reason.slice(0, 200),
    })
    .eq("id", deviceId)
    .is("revoked_at", null);
}

export async function bindTrustedDevice(
  admin: AdminClient,
  args: {
    tenantSlug: string;
    userId: string;
    boundFpHash: string;
    ipHashValue: string;
    subnetHashValue: string;
    asn?: number | null;
    deviceLabel: string;
    browserFamily?: string | null;
    osFamily?: string | null;
    approxCity?: string | null;
  },
): Promise<{ rawToken: string; deviceId: string; expiresAt: string }> {
  const rawToken = randomTokenBase64Url(32);
  const tokenHash = await deviceTokenHash(rawToken);
  const expiresAt = new Date(Date.now() + TRUST_MAX_AGE_SEC * 1000);
  const expUnix = Math.floor(expiresAt.getTime() / 1000);
  const trustHmac = await buildTrustHmac(hmacSecret(), {
    deviceFpHash: args.boundFpHash,
    deviceTokenHash: tokenHash,
    userId: args.userId,
    expiresAtUnix: expUnix,
  });

  const { data, error } = await admin
    .from("user_trusted_devices")
    .insert({
      tenant_slug: args.tenantSlug,
      user_id: args.userId,
      device_token_hash: tokenHash,
      device_fp_hash: args.boundFpHash,
      trust_hmac: trustHmac,
      device_label: args.deviceLabel,
      browser_family: args.browserFamily ?? null,
      os_family: args.osFamily ?? null,
      approx_city: args.approxCity ?? null,
      last_ip_hash: args.ipHashValue,
      last_ip_subnet_hash: args.subnetHashValue,
      last_asn: args.asn ?? null,
      expires_at: expiresAt.toISOString(),
      consent_recorded_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`bind_device_failed:${error?.message ?? "unknown"}`);
  }

  return {
    rawToken,
    deviceId: data.id as string,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function touchTrustedDevice(
  admin: AdminClient,
  deviceId: string,
  ipHashValue: string,
  subnetHashValue: string,
): Promise<void> {
  await admin
    .from("user_trusted_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      last_ip_hash: ipHashValue,
      last_ip_subnet_hash: subnetHashValue,
    })
    .eq("id", deviceId);
}
