import type { AdminClient } from "./env.ts";
import {
  IP_OTP_LIMIT,
  IP_OTP_WINDOW_SEC,
  PHONE_OTP_LIMIT,
  PHONE_OTP_WINDOW_SEC,
} from "./env.ts";

export interface RateLimitResult {
  limited: boolean;
  retryAfterSec: number;
  hitCount: number;
}

export async function hitRateLimit(
  admin: AdminClient,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc("otp_rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSec,
  });

  if (error) {
    console.error("otp_rate_limit_hit_error", error.message);
    // Fail-closed على أخطاء العداد لمنع pumping عند فشل DB
    return { limited: true, retryAfterSec: 60, hitCount: limit };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    limited: Boolean(row?.limited),
    retryAfterSec: Number(row?.retry_after_sec ?? 0),
    hitCount: Number(row?.hit_count ?? 0),
  };
}

export async function enforceOtpSendLimits(
  admin: AdminClient,
  phoneHashValue: string,
  ipSubnetHashValue: string,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number; scope: string }> {
  const phone = await hitRateLimit(
    admin,
    `otp_phone:${phoneHashValue}`,
    PHONE_OTP_LIMIT,
    PHONE_OTP_WINDOW_SEC,
  );
  if (phone.limited) {
    return { ok: false, retryAfterSec: phone.retryAfterSec, scope: "phone" };
  }

  const ip = await hitRateLimit(
    admin,
    `otp_ip:${ipSubnetHashValue}`,
    IP_OTP_LIMIT,
    IP_OTP_WINDOW_SEC,
  );
  if (ip.limited) {
    return { ok: false, retryAfterSec: ip.retryAfterSec, scope: "ip" };
  }

  return { ok: true };
}
