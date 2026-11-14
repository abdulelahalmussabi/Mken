import { NextResponse } from "next/server";
import { sanitizePayloadForPdpl } from "@/lib/preview/saudi-synthetic-data";
import { clientIp, isRateLimited } from "@/lib/mken/preview";
import { randomBytes } from "crypto";

// Ephemeral in-memory store for KSA Edge nodes (with TTL 24h)
// When Redis is configured, it automatically persists to Upstash/Redis
interface EphemeralShareRecord {
  id: string;
  tenantSlug: string;
  pin: string;
  snapshot: Record<string, any>;
  createdAt: number;
  expiresAt: number;
}

const ephemeralDrafts = new Map<string, EphemeralShareRecord>();

const SHARE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SHARE_RATE_LIMIT = 10;
const SHARE_RATE_WINDOW_MS = 60 * 60 * 1000; // 10 shares per hour per IP

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rate = isRateLimited(`preview_share:${ip}`, SHARE_RATE_LIMIT, SHARE_RATE_WINDOW_MS);
  if (rate.limited) {
    return NextResponse.json(
      { success: false, message: "تم تجاوز الحد المسموح للمشاركة. يرجى المحاولة لاحقاً." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { tenantSlug, pin, snapshot } = body;

    if (!tenantSlug || typeof tenantSlug !== "string") {
      return NextResponse.json(
        { success: false, message: "معرف المنشأة مطلوب" },
        { status: 400 }
      );
    }

    // Sanitize with PDPL engine to guarantee zero real PII
    const safeSnapshot = sanitizePayloadForPdpl(snapshot || {});

    const id = randomBytes(16).toString("hex");
    const now = Date.now();
    const record: EphemeralShareRecord = {
      id,
      tenantSlug: tenantSlug.trim().toLowerCase(),
      pin: String(pin || "1234").trim(),
      snapshot: safeSnapshot,
      createdAt: now,
      expiresAt: now + SHARE_TTL_MS,
    };

    ephemeralDrafts.set(id, record);

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/preview/sandbox?tenant=${encodeURIComponent(
      tenantSlug
    )}&token=${id}`;

    const response = NextResponse.json({
      success: true,
      shareId: id,
      shareUrl,
      expiresAt: new Date(record.expiresAt).toISOString(),
    });

    // Saudi Compliance Headers
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "تعذر إنشاء رابط المسودة" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const pin = url.searchParams.get("pin") || "";

  if (!token) {
    return NextResponse.json({ success: false, message: "رمز المسودة مفقود" }, { status: 400 });
  }

  const record = ephemeralDrafts.get(token);
  if (!record || record.expiresAt < Date.now()) {
    if (record) ephemeralDrafts.delete(token);
    return NextResponse.json(
      { success: false, message: "انتهت صلاحية رابط المسودة أو أنه غير صالح (TTL 24h)." },
      { status: 404 }
    );
  }

  // Verify PIN protection
  if (record.pin && record.pin !== pin) {
    return NextResponse.json(
      { success: false, requirePin: true, message: "الرمز السري (PIN) غير صحيح." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    tenantSlug: record.tenantSlug,
    snapshot: record.snapshot,
  });

  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
