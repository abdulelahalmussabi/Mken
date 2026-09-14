import { NextResponse } from "next/server";
import { clearSessionCookie, readAdminSession } from "@/lib/auth/session";
import {
  DELETE_CONFIRM_WORD,
  emailsMatch,
  eraseTenant,
  loadTenantForErase,
} from "@/lib/mken/pdpl-erase";
import { canonicalTenantSlug } from "@/lib/mken/tenant-slug";
import { isPlatformSlug } from "@/lib/mken/tenant";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const buckets = new Map<string, { windowStart: number; count: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > MAX_ATTEMPTS;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "طلب غير صالح" }, 400);
  }

  const confirm = String(body.confirm || "").trim();
  if (confirm !== DELETE_CONFIRM_WORD) {
    return json({ success: false, error: "اكتب DELETE للتأكيد" }, 400);
  }

  const session = await readAdminSession();
  const requested = canonicalTenantSlug(String(body.tenantSlug || ""));
  const email = String(body.email || "").trim();
  const ip = clientIp(request);
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 200);

  if (rateLimited(ip)) {
    return json({ success: false, error: "محاولات كثيرة، حاول لاحقاً" }, 429);
  }

  let slug = requested;
  let actor = "email";

  if (session?.role === "client") {
    slug = canonicalTenantSlug(session.clientSlug);
    if (!slug) return json({ success: false, error: "الحساب غير مرتبط بمنشأة" }, 403);
    if (requested && requested !== slug) {
      return json({ success: false, error: "لا يمكنك حذف منشأة أخرى" }, 403);
    }
    actor = `session:${session.email}`;
  } else if (session?.role === "super") {
    return json({ success: false, error: "حذف البيانات يتم من حساب المنشأة فقط" }, 403);
  } else {
    if (!slug || !email) {
      return json({ success: false, error: "البريد ومعرّف المنشأة مطلوبان" }, 400);
    }
    const tenant = await loadTenantForErase(slug);
    if (!tenant || !emailsMatch(tenant.email, email)) {
      return json({ success: false, error: "تعذّر التحقق من الطلب" }, 403);
    }
    actor = `email:${email.toLowerCase()}`;
  }

  if (!slug || isPlatformSlug(slug)) {
    return json({ success: false, error: "لا يمكن حذف هذا الحساب" }, 403);
  }

  const result = await eraseTenant({ slug, ip, userAgent, actor });
  if ("error" in result) {
    return json({ success: false, error: result.error }, result.status);
  }

  const response = json({ success: true, message: "تم حذف بيانات المنشأة" });
  if (session) await clearSessionCookie(response);
  return response;
}
