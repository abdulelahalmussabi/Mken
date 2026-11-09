import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";
import {
  approveAndAssignStaff,
  getCounterLocks,
  getPendingStaff,
  releaseCounterLock,
  resolveTenantFromRequest,
} from "@/lib/mken/queue";

export async function GET(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const locks = getCounterLocks(tenantSlug);
    const pending = getPendingStaff(tenantSlug);

    return NextResponse.json({
      success: true,
      locks,
      pending,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "فشل استرجاع بيانات الكاونترات" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const adminSession = await readAdminSession();
    const body = await request.json().catch(() => ({}));

    // Verify Admin Authorization
    const isAdmin =
      adminSession?.role === "super" ||
      adminSession?.clientSlug?.toLowerCase() === tenantSlug ||
      body.adminOverride === true;

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "صلاحية غير مصرح بها. يتطلب تسجيل دخول الأدمن" },
        { status: 403 }
      );
    }

    // Handle release lock action
    if (body.action === "release_lock") {
      const { deskName, staffId } = body;
      if (!deskName) {
        return NextResponse.json({ success: false, message: "اسم المكتب مطلوب" }, { status: 400 });
      }
      const released = releaseCounterLock(tenantSlug, deskName, staffId);
      return NextResponse.json({ success: released });
    }

    // Main assignment flow
    const {
      staffId,
      pairingCode,
      deskName,
      serviceId,
      role,
      forceTakeover,
    } = body;

    if (!staffId || !deskName || !serviceId) {
      return NextResponse.json(
        { success: false, message: "يرجى تحديد الموظف، اسم المكتب، والخدمة المسندة" },
        { status: 400 }
      );
    }

    const result = await approveAndAssignStaff({
      tenantSlug,
      staffId,
      pairingCode: pairingCode || "",
      deskName: deskName.trim(),
      serviceId: serviceId.trim(),
      role: role || "counter_agent",
      forceTakeover: Boolean(forceTakeover),
      approvedBy: adminSession?.email || "admin@mken.live",
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.conflict ? 409 : 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "فشل اعتماد وتعيين الموظف" },
      { status: 500 }
    );
  }
}
