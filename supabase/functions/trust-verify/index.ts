/**
 * Mken Trust Engine — trust-verify
 * POST: Authentica OTP verify → bind device cookie → optional session
 */

import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  bindFingerprintHash,
  ipHash,
  phoneHash,
  sha256Hex,
  subnetHash,
  timingSafeEqualHex,
} from "../_shared/crypto.ts";
import {
  buildDeviceCookieHeader,
  clearDeviceCookieHeader,
} from "../_shared/cookies.ts";
import {
  OTP_FAIL_LOCK_SEC,
  OTP_FAIL_LOCK_THRESHOLD,
  createAdminClient,
  pepper,
} from "../_shared/env.ts";
import { clientIp, ipSubnet } from "../_shared/ip.ts";
import { authenticaVerifyOtp } from "../_shared/authentica.ts";
import {
  isHex64,
  normalizeE164,
  sanitizeLabel,
  sanitizeOtp,
  sanitizeTenantSlug,
} from "../_shared/validate.ts";
import { logSecurityEvent, tenantExists } from "../_shared/security-log.ts";
import { bindTrustedDevice } from "../_shared/trust.ts";
import { issueUserSession, resolveUserAfterOtp } from "../_shared/users.ts";

interface VerifyBody {
  tenantSlug?: string;
  phone?: string;
  otp?: string;
  deviceFpHash?: string;
  challengeId?: string;
  challengeNonce?: string;
  rememberDevice?: boolean;
  deviceLabel?: string;
  browserFamily?: string;
  osFamily?: string;
  approxCity?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const admin = createAdminClient();
    const body = (await req.json()) as VerifyBody;

    const tenantSlug = sanitizeTenantSlug(body.tenantSlug);
    const e164 = normalizeE164(body.phone ?? "");
    const otp = sanitizeOtp(body.otp);
    const clientFp = body.deviceFpHash?.trim().toLowerCase() ?? "";

    if (!tenantSlug || !e164 || !otp || !isHex64(clientFp)) {
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

    // Load challenge (prefer id+nonce; fallback latest pending for phone)
    let challengeQuery = admin
      .from("otp_challenges")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .eq("phone_hash", phoneHashValue)
      .in("status", ["pending", "fallback_sms", "fallback_email"]);

    if (body.challengeId) {
      challengeQuery = challengeQuery.eq("id", body.challengeId);
    }

    const { data: challenges, error: chErr } = await challengeQuery
      .order("created_at", { ascending: false })
      .limit(1);

    if (chErr) {
      console.error("challenge_lookup_failed", chErr.message);
      return jsonResponse(req, { error: "challenge_lookup_failed" }, 500);
    }

    const challenge = challenges?.[0];
    if (!challenge) {
      return jsonResponse(req, { error: "challenge_not_found" }, 404);
    }

    if (body.challengeNonce) {
      const nonce = body.challengeNonce.trim().toLowerCase();
      if (!timingSafeEqualHex(String(challenge.challenge_nonce), nonce)) {
        return jsonResponse(req, { error: "challenge_nonce_mismatch" }, 403);
      }
    }

    if (challenge.locked_until && new Date(challenge.locked_until).getTime() > Date.now()) {
      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "OTP_LOCKOUT",
        severity: "HIGH",
        detail: { challengeId: challenge.id },
        ipHash: ipHashValue,
      });
      return jsonResponse(req, { error: "otp_locked" }, 423);
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await admin.from("otp_challenges").update({ status: "expired" }).eq("id", challenge.id);
      return jsonResponse(req, { error: "challenge_expired" }, 410);
    }

    // Fingerprint must match the challenge binding
    if (!timingSafeEqualHex(String(challenge.device_fp_hash), boundFp)) {
      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: "FP_MISMATCH",
        severity: "CRITICAL",
        detail: { phase: "verify", challengeId: challenge.id },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });
      return jsonResponse(req, { error: "fingerprint_mismatch" }, 403);
    }

    const verified = await authenticaVerifyOtp({ phone: e164, otp });
    if (!verified.ok) {
      const failCount = Number(challenge.fail_count ?? 0) + 1;
      const patch: Record<string, unknown> = { fail_count: failCount };

      if (failCount >= OTP_FAIL_LOCK_THRESHOLD) {
        patch.status = "locked";
        patch.locked_until = new Date(Date.now() + OTP_FAIL_LOCK_SEC * 1000).toISOString();
      }

      await admin.from("otp_challenges").update(patch).eq("id", challenge.id);

      await logSecurityEvent(admin, {
        tenantSlug,
        eventType: failCount >= OTP_FAIL_LOCK_THRESHOLD ? "OTP_LOCKOUT" : "OTP_FAILED",
        severity: failCount >= OTP_FAIL_LOCK_THRESHOLD ? "HIGH" : "MEDIUM",
        detail: { failCount, challengeId: challenge.id },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });

      if (failCount >= OTP_FAIL_LOCK_THRESHOLD) {
        return jsonResponse(req, {
          error: "otp_locked",
          failCount,
          lockSeconds: OTP_FAIL_LOCK_SEC,
        }, 423);
      }

      return jsonResponse(req, {
        error: "otp_invalid",
        failCount,
        remainingAttempts: OTP_FAIL_LOCK_THRESHOLD - failCount,
      }, 401);
    }

    // Mark challenge verified (idempotent)
    await admin
      .from("otp_challenges")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("id", challenge.id)
      .in("status", ["pending", "fallback_sms", "fallback_email"]);

    const { userId, created } = await resolveUserAfterOtp(admin, {
      tenantSlug,
      e164,
      phoneHashValue,
    });

    await logSecurityEvent(admin, {
      tenantSlug,
      userId,
      eventType: "OTP_VERIFIED",
      severity: "INFO",
      detail: { challengeId: challenge.id, userCreated: created },
      ipHash: ipHashValue,
      userAgentHash: uaHash,
    });

    const remember =
      body.rememberDevice !== undefined
        ? body.rememberDevice !== false
        : challenge.remember_device !== false;

    let deviceId: string | null = null;
    let setCookie: string | null = null;

    if (remember) {
      const bound = await bindTrustedDevice(admin, {
        tenantSlug,
        userId,
        boundFpHash: boundFp,
        ipHashValue,
        subnetHashValue,
        deviceLabel: sanitizeLabel(
          body.deviceLabel,
          [body.osFamily, body.browserFamily].filter(Boolean).join(" — ") ||
            "جهاز موثوق",
        ),
        browserFamily: body.browserFamily ?? null,
        osFamily: body.osFamily ?? null,
        approxCity: body.approxCity ?? null,
      });

      deviceId = bound.deviceId;
      setCookie = buildDeviceCookieHeader(bound.rawToken);

      await logSecurityEvent(admin, {
        tenantSlug,
        userId,
        deviceId,
        eventType: "TOKEN_BOUND",
        severity: "INFO",
        detail: { expiresAt: bound.expiresAt },
        ipHash: ipHashValue,
        userAgentHash: uaHash,
      });
    } else {
      setCookie = clearDeviceCookieHeader();
    }

    const session = await issueUserSession(admin, userId);

    const headers: Record<string, string> = {};
    if (setCookie) headers["Set-Cookie"] = setCookie;

    return jsonResponse(
      req,
      {
        verified: true,
        userId,
        userCreated: created,
        deviceBound: Boolean(deviceId),
        deviceId,
        session: session.accessToken
          ? {
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            expires_in: session.expiresIn,
            token_type: "bearer",
          }
          : null,
        // For Vercel BFF re-set when Edge host ≠ *.mken.live
        cookieHint: deviceId
          ? {
            name: "mken_device_trust",
            maxAge: 60 * 60 * 24 * 60,
            flags: ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"],
          }
          : null,
      },
      200,
      headers,
    );
  } catch (err) {
    console.error("trust_verify_error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
