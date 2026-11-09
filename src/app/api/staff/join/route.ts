import { NextResponse } from "next/server";
import {
  checkStaffOnboardingStatus,
  getPendingStaff,
  requestStaffJoin,
  resolveTenantFromRequest,
} from "@/lib/mken/queue";
import { applyStaffCookie, createStaffSessionToken, readAdminSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const url = new URL(request.url);
    const staffId = url.searchParams.get("id");

    // 1. If staffId specified: Check individual onboarding status (Mobile polling)
    if (staffId) {
      const staff = checkStaffOnboardingStatus(tenantSlug, staffId);
      if (!staff) {
        return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
      }

      const response = NextResponse.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          pairingCode: staff.pairingCode,
          pairingCodeExpiresAt: staff.pairingCodeExpiresAt,
          status: staff.onboardingStatus,
          assignedDeskName: staff.assignedDeskName,
          assignedServiceId: staff.assignedServiceId,
          assignedRole: staff.assignedRole,
          sessionToken: staff.sessionToken,
        },
      });

      // If approved & active: automatically set the secure staff session cookie on mobile!
      if (staff.onboardingStatus === "active" && staff.sessionToken) {
        const token = await createStaffSessionToken({
          id: staff.id,
          name: staff.name,
          role: (staff.assignedRole as any) || "technician",
          phone: staff.phone,
          tenantSlug: staff.tenantSlug,
          activities: [staff.assignedServiceId || "general"],
        });
        if (token) {
          applyStaffCookie(response, token);
        }
      }

      return response;
    }

    // 2. Otherwise: List all pending staff for this tenant (For Admin Queue Console)
    const pending = getPendingStaff(tenantSlug);
    return NextResponse.json({ success: true, pending });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "فشل استرجاع بيانات الانضمام" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const { name, phone } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "يرجى كتابة اسم الموظف كاملاً" },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== "string" || phone.trim().replace(/\D/g, "").length < 9) {
      return NextResponse.json(
        { success: false, message: "يرجى إدخال رقم جوال صحيح (مثال: 0551234567)" },
        { status: 400 }
      );
    }

    const result = await requestStaffJoin(tenantSlug, name.trim(), phone.trim());

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "تعذر تسجيل طلب الانضمام، حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
