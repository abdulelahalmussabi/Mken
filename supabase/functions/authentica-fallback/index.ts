/**
 * Mken Trust Engine — authentica-fallback
 * POST: manual channel escalation (SMS / Email) if waitUntil fallback missed
 * Requires active challenge + Turnstile
 */

import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { ipHash, phoneHash, sha256Hex, subnetHash } from "../_shared/crypto.ts";
import { createAdminClient, pepper } from "../_shared/env.ts";
import { clientIp, ipSubnet } from "../_shared/ip.ts";
import { authenticaSendOtp, type AuthenticaMethod } from "../_shared/authentica.ts";
import { verifyTurnstile } from "../_shared/turnstile.ts";
import { enforceOtpSendLimits } from "../_shared/rate-limit.ts";
import {
  normalizeE164,
  sanitizeTenantSlug,
} from "../_shared/validate.ts";
import { logSecurityEvent, tenantExists } from "../_shared/security-log.ts";
import { timingSafeEqualHex } from "../_shared/crypto.ts";

interface FallbackBody {
  tenantSlug?: string;
  phone?: string;
  challengeId?: string;
  challengeNonce?: string;
  channel?: "sms" | "email";
  email?: string;
  turnstileToken?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405);
  }

  try {
    const admin = createAdminClient();
    const body = (await req.json()) as FallbackBody;

    const tenantSlug = sanitizeTenantSlug(body.tenantSlug);
    const e164 = normalizeE164(body.phone ?? "");
    const channel: AuthenticaMethod = body.channel === "email" ? "email" : "sms";
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";

    if (!tenantSlug || !e164 || !challengeId) {
      return jsonResponse(req, { error: "invalid_payload" }, 400);
    }

    if (!(await tenantExists(admin, tenantSlug))) {
      return jsonResponse(req, { error: "tenant_not_found" }, 404);
    }

    const ip = clientIp(req);
    const turnstile = await verifyTurnstile(body.turnstileToken ?? "", ip);
    if (!turnstile.ok) {
      return jsonResponse(req, { error: "turnstile_failed" }, 403);
    }

    const p = pepper();
    const phoneHashValue = await phoneHash(e164, p);
    const subnetHashValue = await subnetHash(ipSubnet(ip), p);
    const ipHashValue = await ipHash(ip, p);

    const limits = await enforceOtpSendLimits(admin, phoneHashValue, subnetHashValue);
    if (!limits.ok) {
      return jsonResponse(
        req,
        { error: "rate_limited", scope: limits.scope, retryAfterSec: limits.retryAfterSec },
        429,
        { "Retry-After": String(limits.retryAfterSec) },
      );
    }

    const { data: challenge, error } = await admin
      .from("otp_challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("tenant_slug", tenantSlug)
      .eq("phone_hash", phoneHashValue)
      .maybeSingle();

    if (error || !challenge) {
      return jsonResponse(req, { error: "challenge_not_found" }, 404);
    }

    if (body.challengeNonce) {
      if (
        !timingSafeEqualHex(
          String(challenge.challenge_nonce),
          body.challengeNonce.trim().toLowerCase(),
        )
      ) {
        return jsonResponse(req, { error: "challenge_nonce_mismatch" }, 403);
      }
    }

    if (!["pending", "fallback_sms", "fallback_email"].includes(challenge.status)) {
      return jsonResponse(req, { error: "challenge_not_active" }, 409);
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await admin.from("otp_challenges").update({ status: "expired" }).eq("id", challenge.id);
      return jsonResponse(req, { error: "challenge_expired" }, 410);
    }

    if (channel === "sms" && challenge.sms_sent_at) {
      return jsonResponse(req, { ok: true, channel: "sms", deduped: true });
    }
    if (channel === "email" && challenge.email_sent_at) {
      return jsonResponse(req, { ok: true, channel: "email", deduped: true });
    }

    if (channel === "email") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(req, { error: "email_required" }, 400);
      }
      const emailHash = await sha256Hex(`${email}|${p}`);
      const send = await authenticaSendOtp({ method: "email", email });
      if (!send.ok) {
        return jsonResponse(req, { error: "otp_send_failed", channel: "email" }, 502);
      }
      await admin
        .from("otp_challenges")
        .update({
          status: "fallback_email",
          channel: "email",
          email_sent_at: new Date().toISOString(),
          fallback_email_hash: emailHash,
        })
        .eq("id", challenge.id);
    } else {
      const send = await authenticaSendOtp({ method: "sms", phone: e164 });
      if (!send.ok) {
        return jsonResponse(req, { error: "otp_send_failed", channel: "sms" }, 502);
      }
      await admin
        .from("otp_challenges")
        .update({
          status: "fallback_sms",
          channel: "sms",
          sms_sent_at: new Date().toISOString(),
        })
        .eq("id", challenge.id);
    }

    await logSecurityEvent(admin, {
      tenantSlug,
      eventType: "OTP_SENT",
      severity: "INFO",
      detail: { channel, challengeId, manualFallback: true },
      ipHash: ipHashValue,
    });

    return jsonResponse(req, { ok: true, channel, challengeId });
  } catch (err) {
    console.error("authentica_fallback_error", err);
    return jsonResponse(req, { error: "internal_error" }, 500);
  }
});
