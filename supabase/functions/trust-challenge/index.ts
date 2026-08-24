/**
 * Mken Trust Engine — trust-challenge
 * POST: evaluate device cookie; on miss → Authentica WhatsApp OTP + 15s SMS fallback
 */

import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  bindFingerprintHash,
  ipHash,
  phoneHash,
  randomHex,
  sha256Hex,
  subnetHash,
} from "../_shared/crypto.ts";
import { readDeviceToken } from "../_shared/cookies.ts";
import {
  OTP_TTL_SEC,
  WA_TO_SMS_FALLBACK_MS,
  createAdminClient,
  pepper,
} from "../_shared/env.ts";
import { clientIp, ipSubnet } from "../_shared/ip.ts";
import { authenticaSendOtp } from "../_shared/authentica.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { enforceOtpSendLimits } from "../_shared/rate-limit.ts";
import {
  isHex64,
  normalizeE164,
  sanitizeTenantSlug,
} from "../_shared/validate.ts";
import { logSecurityEvent, tenantExists } from "../_shared/security-log.ts";
import {
  evaluateTrustedDevice,
  revokeDevice,
  touchTrustedDevice,
} from "../_shared/trust.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

interface ChallengeBody {
  tenantSlug?: string;
  phone?: string;
  deviceFpHash?: string;
  turnstileToken?: string;
  rememberDevice?: boolean;
  fallbackEmail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const admin = createAdminClient();
    const body = (await req.json()) as ChallengeBody;

    const tenantSlug = sanitizeTenantSlug(body.tenantSlug);
    const e164 = normalizeE164(body.phone ?? "");
    const clientFp = body.deviceFpHash?.trim().toLowerCase() ?? "";
    const rememberDevice = body.rememberDevice !== false;

    if (!tenantSlug || !e164 || !isHex64(clientFp)) {
      return jsonResponse(req, { error: "invalid_payload" }, 400);
    }

    if (!(await tenantExists(admin, tenantSlug))) {
      return jsonResponse(req, { error: "tenant_not_found" }, 404);
    }

    const ip = clientIp(req);
    const subnet = ipSubnet(ip);
    const p = pepper();
    const phoneHashValue = await phoneHash(e164, p);
    const boundFp = await bindFingerprintHash(clientFp, p);
    const ipHashValue = await ipHash(ip, p);
    const subnetHashValue = await subnetHash(subnet, p);
    const ua = req.headers.get("user-agent") ?? "";
    const uaHash = ua ? await sha256Hex(`${ua}|${p}`) : null;

    // --- Trust cookie path ---
    const rawToken = readDeviceToken(req);
    const trust = await evaluateTrustedDevice(admin, {
      rawToken,
      tenantSlug,
      boundFpHash: boundFp,
      subnetHashValue,
    });

    if (trust.ok) {
      await touchTrustedDevice(admin, trust.device.id, ipHashValue, subnetHashValue);
      await logSecurityEvent(admin, {
        tenantSlug,
        userId: trust.userId,
        deviceId: trust.device.id,
        eventType: "TRUST_SKIP_OK",
        severity: "INFO",
        detail: { path: "cookie_fp_match" },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });

      return jsonResponse(req, {
        trust: true,
        skipOtp: true,
        userId: trust.userId,
        deviceId: trust.device.id,
      });
    }

    if (trust.device && (trust.reason === "fp_mismatch" || trust.reason === "subnet_drift" || trust.reason === "hmac_invalid")) {
      await revokeDevice(admin, trust.device.id, trust.reason);
      await logSecurityEvent(admin, {
        tenantSlug,
        userId: trust.device.user_id,
        deviceId: trust.device.id,
        eventType: trust.reason === "fp_mismatch" ? "FP_MISMATCH" : trust.reason === "subnet_drift" ? "IP_SUBNET_DRIFT" : "TOKEN_REPLAY",
        severity: "CRITICAL",
        detail: { reason: trust.reason, stepUp: true },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });
    }

    // --- Turnstile (fail-closed) ---
    const turnstile = await verifyTurnstile(body.turnstileToken ?? "", ip);
    if (!turnstile.ok) {
      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "TURNSTILE_FAIL",
        severity: "HIGH",
        detail: { codes: turnstile.errorCodes },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });
      return jsonResponse(req, { error: "turnstile_failed" }, 403);
    }

    // --- Rate limits ---
    const limits = await enforceOtpSendLimits(admin, phoneHashValue, subnetHashValue);
    if (!limits.ok) {
      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "RATE_LIMITED",
        severity: "HIGH",
        detail: { scope: limits.scope, retryAfterSec: limits.retryAfterSec },
        ipHash: ipHashValue,
      });
      return jsonResponse(
        req,
        { error: "rate_limited", scope: limits.scope, retryAfterSec: limits.retryAfterSec },
        429,
        { "Retry-After": String(limits.retryAfterSec) },
      );
    }

    // --- Lockout check on recent challenge ---
    const { data: recent } = await admin
      .from("otp_challenges")
      .select("id,locked_until,status,fail_count")
      .eq("tenant_slug", tenantSlug)
      .eq("phone_hash", phoneHashValue)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.locked_until && new Date(recent.locked_until).getTime() > Date.now()) {
      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "OTP_LOCKOUT",
        severity: "HIGH",
        detail: { phase: "challenge" },
        ipHash: ipHashValue,
      });
      return jsonResponse(req, { error: "otp_locked" }, 423);
    }

    const challengeNonce = randomHex(32);
    const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString();
    const fallbackEmail = typeof body.fallbackEmail === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.fallbackEmail)
      ? body.fallbackEmail.trim().toLowerCase()
      : null;
    const fallbackEmailHash = fallbackEmail
      ? await sha256Hex(`${fallbackEmail}|${p}`)
      : null;

    const sendWa = await authenticaSendOtp({
      method: "whatsapp",
      phone: e164,
      fallbackEmail: fallbackEmail ?? undefined,
    });

    if (!sendWa.ok) {
      console.error("authentica_wa_failed", sendWa.status, sendWa.message);
      return jsonResponse(req, { error: "otp_send_failed", channel: "whatsapp" }, 502);
    }

    const { data: challenge, error: chErr } = await admin
      .from("otp_challenges")
      .insert({
        tenant_slug: tenantSlug,
        phone_hash: phoneHashValue,
        challenge_nonce: challengeNonce,
        device_fp_hash: boundFp,
        channel: "whatsapp",
        status: "pending",
        turnstile_ok: true,
        remember_device: rememberDevice,
        fallback_email_hash: fallbackEmailHash,
        ip_hash: ipHashValue,
        ip_subnet_hash: subnetHashValue,
        wa_sent_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (chErr || !challenge) {
      console.error("challenge_insert_failed", chErr?.message);
      return jsonResponse(req, { error: "challenge_persist_failed" }, 500);
    }

    await logSecurityEvent(admin, {
      tenantSlug,
      eventType: "OTP_SENT",
      severity: "INFO",
      detail: { channel: "whatsapp", challengeId: challenge.id },
      ipHash: ipHashValue,
      userAgentHash: uaHash,
    });

    // 15s WhatsApp → SMS fallback (async)
    const challengeId = challenge.id as string;
    const fallbackPromise = (async () => {
      await sleep(WA_TO_SMS_FALLBACK_MS);
      const { data: live } = await admin
        .from("otp_challenges")
        .select("id,status,expires_at,sms_sent_at")
        .eq("id", challengeId)
        .maybeSingle();

      if (!live) return;
      if (live.status === "verified" || live.status === "locked" || live.status === "expired") {
        return;
      }
      if (new Date(live.expires_at).getTime() <= Date.now()) {
        await admin.from("otp_challenges").update({ status: "expired" }).eq("id", challengeId);
        return;
      }
      if (live.sms_sent_at) return;

      const sms = await authenticaSendOtp({
        method: "sms",
        phone: e164,
        fallbackEmail: fallbackEmail ?? undefined,
      });

      if (!sms.ok) {
        console.error("authentica_sms_fallback_failed", sms.message);
        return;
      }

      await admin
        .from("otp_challenges")
        .update({
          status: "fallback_sms",
          channel: "sms",
          sms_sent_at: new Date().toISOString(),
        })
        .eq("id", challengeId)
        .in("status", ["pending"]);

      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "OTP_SENT",
        severity: "INFO",
        detail: { channel: "sms", challengeId, fallback: true },
        ipHash: ipHashValue,
      });
    })();

    try {
      EdgeRuntime.waitUntil(fallbackPromise);
    } catch {
      // Runtime without waitUntil — fire-and-forget
      fallbackPromise.catch((e) => console.error("fallback_error", e));
    }

    return jsonResponse(req, {
      trust: false,
      skipOtp: false,
      otpRequired: true,
      channel: "whatsapp",
      challengeId,
      challengeNonce,
      expiresAt,
      fallbackAt: new Date(Date.now() + WA_TO_SMS_FALLBACK_MS).toISOString(),
      fallbackChannel: "sms",
      stepUpReason: trust.reason !== "no_cookie" && trust.reason !== "not_found"
        ? trust.reason
        : undefined,
    });
  } catch (err) {
    console.error("trust_challenge_error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
