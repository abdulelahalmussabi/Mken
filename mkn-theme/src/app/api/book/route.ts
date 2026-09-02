import { NextResponse } from "next/server";
import { createPublicAppointment } from "@/lib/mken/appointments";
import { fetchTenantRow, isPlatformSlug } from "@/lib/mken/tenant";
import { boundTenantFromHostname, hostnameFromHeaders } from "@/lib/mken/tenant-host";
import { capiIdsFromRequest, sendMetaCapiEvent } from "@/lib/mken/meta-ads";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const buckets = new Map<string, { windowStart: number; count: number }>();

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
  }
  if (bucket.count >= MAX_PER_WINDOW) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return false;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: "بيانات غير صالحة" },
      { status: 400, headers: CORS }
    );
  }

  const slug = str(body.tenant || body.slug).trim().toLowerCase();
  if (!slug || isPlatformSlug(slug)) {
    return NextResponse.json(
      { success: false, message: "المنشأة غير موجودة" },
      { status: 404, headers: CORS }
    );
  }

  const bound = boundTenantFromHostname(hostnameFromHeaders(request.headers));
  if (bound && bound !== slug) {
    return NextResponse.json(
      { success: false, message: "المنشأة غير موجودة" },
      { status: 404, headers: CORS }
    );
  }

  if (rateLimited(`${clientIp(request)}:${slug}`)) {
    return NextResponse.json(
      { success: false, message: "محاولات كثيرة، حاول بعد قليل" },
      { status: 429, headers: CORS }
    );
  }

  const tenant = await fetchTenantRow(slug);
  if (!tenant) {
    return NextResponse.json(
      { success: false, message: "المنشأة غير موجودة" },
      { status: 404, headers: CORS }
    );
  }

  const { appointment, error } = await createPublicAppointment({
    id: str(body.id),
    tenantSlug: slug,
    customerName: str(body.customerName || body.name),
    phone: str(body.customerPhone || body.phone),
    date: str(body.date),
    time: str(body.time),
    serviceId: str(body.serviceId),
    serviceName: str(body.serviceName),
    servicePrice: str(body.servicePrice),
    notes: str(body.notes),
    coupon: str(body.coupon),
  });

  if (error || !appointment) {
    const raw = error || "تعذّر حفظ الحجز";
    const message = /row-level security|permission denied|rls/i.test(raw)
      ? "تعذّر حفظ الحجز على الخادم"
      : raw;
    return NextResponse.json({ success: false, message }, { status: 400, headers: CORS });
  }

  const ids = capiIdsFromRequest(request, body);
  void sendMetaCapiEvent({
    eventName: "Schedule",
    phone: appointment.phone,
    eventId: `book_${appointment.id}`,
    ctwaClid: ids.ctwaClid,
    fbp: ids.fbp,
    fbc: ids.fbc,
    sourceUrl: await tenantWebsiteUrl(slug),
  });

  return NextResponse.json(
    { success: true, id: appointment.id, status: appointment.status },
    { status: 201, headers: CORS }
  );
}
