import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createSessionToken,
  sha256Hex,
} from "@/lib/auth/session";
import {
  PREVIEW_RATE_IP_LIMIT,
  PREVIEW_RATE_IP_WINDOW_MS,
  PREVIEW_RATE_PHONE_LIMIT,
  PREVIEW_RATE_PHONE_WINDOW_MS,
  attachUnclaimedRobotsHeader,
  clientIp,
  createUnclaimedPreview,
  fetchLivePlaceDetails,
  isRateLimited,
  loadPreviewRow,
  normalizeSaudiPhone,
  previewCorsHeaders,
  previewSiteOrigin,
  previewStateFromConfig,
  proxyPlacePhoto,
  isPlacesApiConfigured,
  resolvePlaceId,
  startClaimOtp,
  verifyClaimOtp,
  verifyTurnstile,
} from "@/lib/mken/preview";

export const dynamic = "force-dynamic";

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: previewCorsHeaders(request) });
}

async function challengeToken(ip: string, bucket: number): Promise<string> {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "mken-preview";
  return sha256Hex(`preview:${secret}:${ip}:${bucket}`);
}

async function issueChallenge(ip: string): Promise<string> {
  return challengeToken(ip, Math.floor(Date.now() / (5 * 60 * 1000)));
}

async function checkChallenge(ip: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const current = await challengeToken(ip, bucket);
  const previous = await challengeToken(ip, bucket - 1);
  return token === current || token === previous;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: previewCorsHeaders(request) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "challenge";
  const ip = clientIp(request);

  if (action === "challenge") {
    return json(request, { success: true, challenge: await issueChallenge(ip) });
  }

  if (action === "photo") {
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    const reference = url.searchParams.get("ref") || "";
    const loaded = await loadPreviewRow(slug);
    const state = previewStateFromConfig(loaded.row?.config_data);
    if (!state?.placeId) {
      return json(request, { success: false, message: "غير مصرح" }, 403);
    }
    const image = await proxyPlacePhoto(reference);
    if (!image) return json(request, { success: false, message: "تعذّر جلب الصورة" }, 404);
    const headers = new Headers(image.headers);
    Object.entries(previewCorsHeaders(request)).forEach(([key, value]) => headers.set(key, value));
    return new NextResponse(image.body, { status: 200, headers });
  }

  if (action === "live") {
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    const loaded = await loadPreviewRow(slug);
    const state = previewStateFromConfig(loaded.row?.config_data);
    const placeId = state?.placeId || "";
    if (!placeId) {
      return json(request, { success: false, message: "لا توجد معاينة مرتبطة" }, 404);
    }
    const place = await fetchLivePlaceDetails(placeId);
    if (!place) {
      return json(request, { success: false, message: "تعذّر جلب بيانات الخرائط حالياً" }, 502);
    }
    const response = json(request, {
      success: true,
      claimStatus: state?.claimStatus || "unclaimed",
      place,
      googleAuthPath: "/api/google-business?action=auth-url",
    });
    return attachUnclaimedRobotsHeader(response, slug);
  }

  return json(request, { success: false, message: "إجراء غير معروف" }, 400);
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  let body: {
    action?: string;
    mapsUrl?: string;
    phone?: string;
    consent?: boolean;
    turnstileToken?: string;
    challenge?: string;
    website?: string;
    slug?: string;
    otp?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return json(request, { success: false, message: "طلب غير صالح" }, 400);
  }

  const action = body.action || "create";

  if (body.website) {
    return json(request, { success: true });
  }

  if (action === "create") {
    if (body.consent !== true) {
      return json(request, { success: false, message: "يلزم الموافقة الصريحة على معالجة البيانات" }, 400);
    }
    const ipLimit = isRateLimited(`preview:ip:${ip}`, PREVIEW_RATE_IP_LIMIT, PREVIEW_RATE_IP_WINDOW_MS);
    if (ipLimit.limited) {
      return json(
        request,
        { success: false, message: "تجاوزت حد الطلبات. أعد المحاولة بعد 10 دقائق.", retryAfterSec: ipLimit.retryAfterSec },
        429
      );
    }
    const captchaOk = await verifyTurnstile(body.turnstileToken, ip);
    const challengeOk = await checkChallenge(ip, body.challenge);
    if (!captchaOk || !challengeOk) {
      return json(request, { success: false, message: "فشل التحقق. حدّث الصفحة وحاول مجدداً." }, 403);
    }
    const phone = normalizeSaudiPhone(body.phone || "");
    if (!phone) {
      return json(request, { success: false, message: "أدخل رقم جوال سعودي صحيح" }, 400);
    }
    const phoneLimit = isRateLimited(
      `preview:phone:${phone}`,
      PREVIEW_RATE_PHONE_LIMIT,
      PREVIEW_RATE_PHONE_WINDOW_MS
    );
    if (phoneLimit.limited) {
      return json(request, { success: false, message: "تجاوزت حد المحاولات لهذا الرقم اليوم." }, 429);
    }
    if (!isPlacesApiConfigured()) {
      return json(
        request,
        {
          success: false,
          message: "معاينة الخرائط غير مفعّلة على الخادم. أضف GOOGLE_MAPS_API_KEY في Vercel ثم أعد النشر.",
        },
        503
      );
    }
    const placeId = await resolvePlaceId(body.mapsUrl || "");
    if (!placeId) {
      return json(request, { success: false, message: "تعذّر قراءة رابط خرائط جوجل. الصق الرابط أو معرّف المكان." }, 400);
    }
    const place = await fetchLivePlaceDetails(placeId);
    if (!place) {
      return json(request, { success: false, message: "تعذّر جلب بيانات الخرائط. تحقق من الرابط." }, 502);
    }
    const created = await createUnclaimedPreview({
      placeId,
      phone,
      ip,
      userAgent: request.headers.get("user-agent") || "",
    });
    if (created.error || !created.slug) {
      return json(request, { success: false, message: created.error || "تعذّر إنشاء المعاينة" }, 500);
    }
    const origin = previewSiteOrigin();
    return json(request, {
      success: true,
      slug: created.slug,
      existing: Boolean(created.existing),
      expiresAt: created.expiresAt,
      previewUrl: `${origin}/subscriber/${created.slug}`,
      place,
      notice: "لم يُحفظ من خرائط جوجل سوى place_id. الاسم والصور والمراجعات تُعرض حياً مع إسناد Google Maps.",
    });
  }

  if (action === "claim-start") {
    const slug = (body.slug || "").trim().toLowerCase();
    const phone = normalizeSaudiPhone(body.phone || "");
    if (!slug || !phone) {
      return json(request, { success: false, message: "بيانات المطالبة ناقصة" }, 400);
    }
    const challengeOk = await checkChallenge(ip, body.challenge);
    if (!challengeOk) {
      return json(request, { success: false, message: "فشل التحقق. حدّث الصفحة وحاول مجدداً." }, 403);
    }
    const started = await startClaimOtp(slug, phone, { ip, turnstileToken: body.turnstileToken });
    if (started.error) {
      return json(
        request,
        { success: false, message: started.error, retryAfterSec: started.retryAfterSec },
        started.retryAfterSec ? 429 : 400
      );
    }
    return json(request, {
      success: true,
      message: "أُرسل رمز التحقق إلى جوالك عبر رسالة نصية.",
      ...(started.devOtp ? { devOtp: started.devOtp } : {}),
    });
  }

  if (action === "claim-verify") {
    const slug = (body.slug || "").trim().toLowerCase();
    const phone = normalizeSaudiPhone(body.phone || "");
    const otp = (body.otp || "").trim();
    if (!slug || !phone || !otp) {
      return json(request, { success: false, message: "بيانات التحقق ناقصة" }, 400);
    }
    const verified = await verifyClaimOtp(slug, phone, otp);
    if (verified.error) return json(request, { success: false, message: verified.error }, 400);
    const loaded = await loadPreviewRow(slug);
    const email = loaded.row?.email || `preview-${slug}@unclaimed.mken.live`;
    const token = await createSessionToken({ email, role: "client", clientSlug: slug });
    const response = json(request, {
      success: true,
      slug,
      googleAuthUrl: verified.googleAuthUrl,
      settingsUrl: "/admin/settings",
      message: "تم التحقق. اربط Google Business لإسقاط noindex وإظهار الموقع في محركات البحث.",
    });
    if (token) applySessionCookie(response, token);
    return response;
  }

  return json(request, { success: false, message: "إجراء غير معروف" }, 400);
}
