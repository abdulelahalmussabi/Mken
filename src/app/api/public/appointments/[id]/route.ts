import { NextResponse } from "next/server";
import { fetchTenantRow, getServiceRoleDb } from "@/lib/mken/tenant";

const APT_ID_RE = /^apt_[a-z0-9]+_[a-z0-9]+$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !APT_ID_RE.test(id)) {
    return NextResponse.json({ success: false, message: "معرّف غير صالح" }, { status: 400 });
  }

  const db = getServiceRoleDb();
  if (!db) return NextResponse.json({ success: false }, { status: 500 });

  const { data, error } = await db
    .from("mken_appointments")
    .select("id, tenant_slug, payment_status, payment_amount")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ success: false, message: "الموعد غير موجود" }, { status: 404 });
  }

  const tenant = await fetchTenantRow(String(data.tenant_slug || ""));
  const payment = (tenant?.config_data as { payment?: Record<string, unknown> } | null)?.payment || {};
  const publishableKey =
    typeof payment.publishableKey === "string" ? payment.publishableKey.trim() : "";
  const currency = typeof payment.currency === "string" && payment.currency ? payment.currency : "SAR";
  const enabled = payment.enabled !== false && Boolean(publishableKey);

  return NextResponse.json({
    success: true,
    appointment: {
      id: data.id,
      tenant_slug: data.tenant_slug,
      payment_status: data.payment_status,
      payment_amount: data.payment_amount != null ? Number(data.payment_amount) : null,
    },
    payment: { enabled, publishableKey, currency },
  });
}
