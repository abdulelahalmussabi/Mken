import { createHmac, createHash, createVerify, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/mken/tenant";
import { loadStaffForLogin, loginStaffByPin, type StaffMember } from "@/lib/mken/staff";
import {
  applyStaffCookie,
  createStaffSessionToken,
  safeEqual,
} from "@/lib/auth/session";
import { resolveBoundTenant } from "@/lib/mken/bound-host";

const INVALID = "بيانات الدخول غير صحيحة أو الحساب غير نشط";
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 5;
const buckets = new Map<string, { windowStart: number; count: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimit(ip: string, increment: boolean): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const key = `staff_login:${ip}`;
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= LOGIN_WINDOW_MS) {
    if (!increment) return { limited: false, retryAfterSec: 0 };
    bucket = { windowStart: now, count: 0 };
  }
  if (bucket.count >= LOGIN_MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - bucket.windowStart)) / 1000)),
    };
  }
  if (increment) {
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return { limited: false, retryAfterSec: 0 };
}

function challengeSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function signChallenge(challenge: string, expiresAt: number, staffId: string): string | null {
  const secret = challengeSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${challenge}:${expiresAt}:${staffId}`).digest("hex");
}

async function staffResponse(member: StaffMember) {
  const token = await createStaffSessionToken({
    id: member.id,
    name: member.name,
    role: member.role,
    phone: member.phone,
    tenantSlug: member.tenantSlug,
    activities: member.activities,
  });
  if (!token) {
    return NextResponse.json(
      { success: false, message: "الجلسات غير مهيأة على الخادم (ADMIN_SESSION_SECRET)" },
      { status: 503 }
    );
  }
  const response = NextResponse.json({
    success: true,
    staff: {
      id: member.id,
      name: member.name,
      role: member.role,
      phone: member.phone,
      tenantSlug: member.tenantSlug,
      activities: member.activities,
    },
  });
  applyStaffCookie(response, token);
  return response;
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const blocked = rateLimit(ip, false);
    if (blocked.limited) {
      return NextResponse.json(
        { success: false, message: "محاولات كثيرة، حاول بعد قليل" },
        { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } }
      );
    }

    const body = await request.json();
    const bound = await resolveBoundTenant(request);
    const tenantSlug = (bound || (typeof body.tenantSlug === "string" ? body.tenantSlug : ""))
      .trim()
      .toLowerCase();
    const step = typeof body.step === "string" ? body.step : "pin";

    if (step === "pin") {
      const result = await Promise.race([
        loginStaffByPin(tenantSlug, body.phone || "", body.pin || ""),
        new Promise<{ error: string }>((resolve) =>
          setTimeout(() => resolve({ error: "انتهت مهلة الاتصال بقاعدة البيانات" }), 8000)
        ),
      ]);
      if (result.error || !("member" in result) || !result.member) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: result.error || INVALID }, { status: 401 });
      }
      if (bound && result.member.tenantSlug.toLowerCase() !== bound) {
        return NextResponse.json({ success: false, message: "هذا النطاق مخصص لمنشأة أخرى" }, { status: 403 });
      }
      return staffResponse(result.member);
    }

    if (step === "passkey-challenge") {
      const loaded = await loadStaffForLogin(tenantSlug, body.phone || "");
      if (loaded.error || !loaded.member) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: loaded.error || INVALID }, { status: 401 });
      }
      if (bound && loaded.member.tenantSlug.toLowerCase() !== bound) {
        return NextResponse.json({ success: false, message: "هذا النطاق مخصص لمنشأة أخرى" }, { status: 403 });
      }

      const db = getTenantDb();
      if (!db) {
        return NextResponse.json({ success: false, message: "قاعدة البيانات غير مهيأة" }, { status: 503 });
      }

      const { data: devices, error } = await db
        .from("mken_staff_devices")
        .select("credential_id")
        .eq("staff_id", loaded.member.id);

      if (error || !devices?.length) {
        return NextResponse.json(
          { success: false, message: "لا توجد بصمة مسجّلة لهذا الموظف" },
          { status: 400 }
        );
      }

      const challenge = randomBytes(32).toString("base64url");
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const challengeSignature = signChallenge(challenge, expiresAt, loaded.member.id);
      if (!challengeSignature) {
        return NextResponse.json({ success: false, message: "الجلسات غير مهيأة" }, { status: 503 });
      }

      return NextResponse.json({
        success: true,
        challenge,
        expiresAt,
        challengeSignature,
        allowCredentials: (devices as { credential_id: string }[]).map((device) => ({
          type: "public-key",
          id: device.credential_id,
        })),
      });
    }

    if (step === "passkey-verify") {
      const loaded = await loadStaffForLogin(tenantSlug, body.phone || "");
      if (loaded.error || !loaded.member) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: loaded.error || INVALID }, { status: 401 });
      }
      if (bound && loaded.member.tenantSlug.toLowerCase() !== bound) {
        return NextResponse.json({ success: false, message: "هذا النطاق مخصص لمنشأة أخرى" }, { status: 403 });
      }

      const {
        credentialId,
        clientDataJSON,
        authenticatorData,
        signature,
        challenge,
        expiresAt,
        challengeSignature,
      } = body as Record<string, string>;

      if (
        !credentialId ||
        !clientDataJSON ||
        !authenticatorData ||
        !signature ||
        !challenge ||
        !expiresAt ||
        !challengeSignature
      ) {
        return NextResponse.json({ success: false, message: "بيانات التحقق ناقصة" }, { status: 400 });
      }

      const expected = signChallenge(challenge, Number(expiresAt), loaded.member.id);
      if (!expected || !safeEqual(expected, challengeSignature)) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: "تحدي غير صالح" }, { status: 400 });
      }
      if (Date.now() > Number(expiresAt)) {
        return NextResponse.json({ success: false, message: "انتهت صلاحية التحدي" }, { status: 400 });
      }

      const db = getTenantDb();
      if (!db) {
        return NextResponse.json({ success: false, message: "قاعدة البيانات غير مهيأة" }, { status: 503 });
      }

      const { data: device } = await db
        .from("mken_staff_devices")
        .select("public_key")
        .eq("staff_id", loaded.member.id)
        .eq("credential_id", credentialId)
        .maybeSingle();

      if (!device?.public_key) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: "الجهاز غير مسجّل" }, { status: 400 });
      }

      const clientDataHash = createHash("sha256").update(Buffer.from(clientDataJSON, "base64")).digest();
      const verifyData = Buffer.concat([Buffer.from(authenticatorData, "base64"), clientDataHash]);
      const pem = `-----BEGIN PUBLIC KEY-----\n${device.public_key}\n-----END PUBLIC KEY-----`;
      const verify = createVerify("SHA256");
      verify.update(verifyData);
      const valid = verify.verify(pem, Buffer.from(signature, "base64"));
      if (!valid) {
        rateLimit(ip, true);
        return NextResponse.json({ success: false, message: "فشل التحقق البيومتري" }, { status: 401 });
      }

      return staffResponse(loaded.member);
    }

    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: "تعذّر معالجة الدخول" }, { status: 500 });
  }
}
