import { NextResponse } from "next/server";
import { applyManualOverride, resolveTenantFromRequest } from "@/lib/mken/queue";

export async function POST(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const body = await request.json();

    const serviceId = body.serviceId || body.departmentId || "reception";
    const action = body.action as
      | "add_capacity"
      | "extend_time"
      | "pause_intake"
      | "emergency_close"
      | "reset_override"
      | "toggle_automation";
    const value = typeof body.value === "number" ? body.value : undefined;
    const staffUserId = body.staffUserId || "staff-supervisor-active";
    const reason = body.reason;

    if (
      !["add_capacity", "extend_time", "pause_intake", "emergency_close", "reset_override", "toggle_automation"].includes(
        action
      )
    ) {
      return NextResponse.json(
        { success: false, error: "إجراء غير صالح للتدخل اليدوي" },
        { status: 400 }
      );
    }

    const evaluation = await applyManualOverride({
      tenantSlug,
      serviceId,
      action,
      value,
      staffUserId,
      reason,
    });

    return NextResponse.json({
      success: true,
      evaluation,
      message: "تم تطبيق قرار التجاوز اليدوي بنجاح وتحديث حالة الصالة",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل تنفيذ إجراء التدخل اليدوي" },
      { status: 500 }
    );
  }
}
