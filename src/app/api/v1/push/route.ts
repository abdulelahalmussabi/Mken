import { NextResponse } from "next/server";
import { getServiceRoleDb } from "@/lib/mken/tenant";
import {
  isPushConfigured,
  isPushEnabledForTenant,
  sendPushToTenant,
  upsertPushSubscription,
} from "@/lib/mken/web-push";

export const dynamic = "force-dynamic";

function actionFrom(request: Request): string {
  const url = new URL(request.url);
  const q = (url.searchParams.get("action") || "").toLowerCase();
  if (q) return q;
  const path = url.pathname;
  if (path.includes("push-subscribe") || path.endsWith("/subscribe")) return "subscribe";
  if (path.includes("push-notify") || path.endsWith("/notify")) return "notify";
  if (path.includes("push-test") || path.endsWith("/test")) return "test";
  return "";
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: Request) {
  const supabase = getServiceRoleDb();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const action = actionFrom(request);
  if (!action) {
    return NextResponse.json({ error: "Unknown push action" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const tenantSlug = String(body.tenantSlug || body.tenant_slug || "default").trim() || "default";

  try {
    if (action === "subscribe") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
      const keys = body.keys as { p256dh?: string; auth?: string } | undefined;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return NextResponse.json({ error: "Missing endpoint or keys" }, { status: 400 });
      }
      const enabled = await isPushEnabledForTenant(supabase, tenantSlug);
      if (!enabled) {
        return NextResponse.json({ error: "Push not enabled for this tenant" }, { status: 400 });
      }
      const saved = await upsertPushSubscription(supabase, {
        tenantSlug,
        endpoint,
        keys,
        label: typeof body.label === "string" ? body.label : "admin",
        userAgent: typeof body.userAgent === "string" ? body.userAgent : undefined,
      });
      if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
      return NextResponse.json({ ok: true, tenantSlug });
    }

    if (action === "notify") {
      const title = typeof body.title === "string" ? body.title.slice(0, 120) : "مكِّن";
      const text = typeof body.body === "string" ? body.body.slice(0, 500) : "";
      const url = typeof body.url === "string" ? body.url.slice(0, 200) : "/admin";
      const result = await sendPushToTenant(supabase, tenantSlug, title, text, url);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "test") {
      if (!isPushConfigured()) {
        return NextResponse.json(
          {
            error: "VAPID keys missing on server. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.",
          },
          { status: 503 }
        );
      }
      const result = await sendPushToTenant(
        supabase,
        tenantSlug,
        "اختبار Push — مكِّن",
        "تم إعداد التنبيهات بنجاح.",
        "/admin"
      );
      if (result.skipped === "no-subscriptions") {
        return NextResponse.json(
          { error: "لا توجد اشتراكات. اضغط «اشتراك هذا الجهاز» أولاً.", ...result },
          { status: 404 }
        );
      }
      if (result.skipped) {
        return NextResponse.json({ error: result.skipped, ...result }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: "تم إرسال إشعار الاختبار", ...result });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown push action" }, { status: 400 });
}
