import { createHmac, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { readStaffSession, safeEqual } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/mken/tenant";

function challengeSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function signChallenge(challenge: string, expiresAt: number, staffId: string): string | null {
  const secret = challengeSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${challenge}:${expiresAt}:${staffId}`).digest("hex");
}

function rpId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host") || "localhost";
  return host.split(":")[0];
}

function deviceNameFromAgent(agent: string): string {
  if (/iPhone|iPad/i.test(agent)) return "iPhone";
  if (/Android/i.test(agent)) return "Android";
  if (/Mac/i.test(agent)) return "Mac";
  return "PC-Windows";
}

async function requireStaff() {
  const session = await readStaffSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}

export async function GET() {
  const { session, response } = await requireStaff();
  if (!session || response) return response;

  const db = getTenantDb();
  if (!db) {
    return NextResponse.json({ success: false, message: "قاعدة البيانات غير مهيأة" }, { status: 503 });
  }

  const { data, error } = await db
    .from("mken_staff_devices")
    .select("id, device_name, created_at")
    .eq("staff_id", session.id);

  if (error) {
    return NextResponse.json({ success: false, message: "تعذّر قراءة الأجهزة" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    enrolled: Boolean(data?.length),
    devices: data || [],
  });
}

export async function POST(request: Request) {
  const { session, response } = await requireStaff();
  if (!session || response) return response;

  const db = getTenantDb();
  if (!db) {
    return NextResponse.json({ success: false, message: "قاعدة البيانات غير مهيأة" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }

  const step = typeof body.step === "string" ? body.step : "enroll-challenge";

  if (step === "enroll-challenge") {
    const challenge = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const challengeSignature = signChallenge(challenge, expiresAt, session.id);
    if (!challengeSignature) {
      return NextResponse.json({ success: false, message: "الجلسات غير مهيأة" }, { status: 503 });
    }

    const { data: devices } = await db
      .from("mken_staff_devices")
      .select("credential_id")
      .eq("staff_id", session.id);

    return NextResponse.json({
      success: true,
      challenge,
      expiresAt,
      challengeSignature,
      rp: { name: "منصة مكّن", id: rpId(request) },
      user: {
        id: Buffer.from(session.id).toString("base64url"),
        name: session.phone || session.id,
        displayName: session.name || session.phone || "موظف",
      },
      excludeCredentials: ((devices || []) as { credential_id: string }[]).map((device) => ({
        type: "public-key",
        id: device.credential_id,
      })),
    });
  }

  if (step === "enroll-verify") {
    const credentialId = typeof body.credentialId === "string" ? body.credentialId : "";
    const publicKeyDer = typeof body.publicKeyDer === "string" ? body.publicKeyDer : "";
    const challenge = typeof body.challenge === "string" ? body.challenge : "";
    const expiresAt = Number(body.expiresAt);
    const challengeSignature = typeof body.challengeSignature === "string" ? body.challengeSignature : "";
    const deviceName =
      typeof body.deviceName === "string" && body.deviceName.trim()
        ? body.deviceName.trim().slice(0, 80)
        : deviceNameFromAgent(request.headers.get("user-agent") || "");

    if (!credentialId || !publicKeyDer || !challenge || !expiresAt || !challengeSignature) {
      return NextResponse.json({ success: false, message: "بيانات التسجيل ناقصة" }, { status: 400 });
    }

    const expected = signChallenge(challenge, expiresAt, session.id);
    if (!expected || !safeEqual(expected, challengeSignature)) {
      return NextResponse.json({ success: false, message: "تحدي غير صالح" }, { status: 400 });
    }
    if (Date.now() > expiresAt) {
      return NextResponse.json({ success: false, message: "انتهت صلاحية التحدي" }, { status: 400 });
    }

    const deviceId = `dev_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    const { error } = await db.from("mken_staff_devices").insert({
      id: deviceId,
      staff_id: session.id,
      device_name: deviceName,
      credential_id: credentialId,
      public_key: publicKeyDer,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, message: "هذا الجهاز مسجّل مسبقاً" },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, message: "تعذّر حفظ البصمة" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deviceId });
  }

  return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
}
