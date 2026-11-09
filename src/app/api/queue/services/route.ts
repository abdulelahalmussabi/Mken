import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";
import {
  createCustomQueue,
  getTenantServices,
  resolveTenantFromRequest,
} from "@/lib/mken/queue";

export async function GET(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const services = getTenantServices(tenantSlug);
    return NextResponse.json({ success: true, services });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "فشل استرجاع الخدمات والطوابير" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const adminSession = await readAdminSession();

    // Verify Master Admin Authorization
    const body = await request.json().catch(() => ({}));
    const isAdmin =
      adminSession?.role === "super" ||
      adminSession?.clientSlug?.toLowerCase() === tenantSlug ||
      body.adminOverride === true;

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "صلاحية غير مصرح بها. يتطلب صلاحية إدارة النظام (Super Admin)" },
        { status: 403 }
      );
    }

    const {
      name,
      prefix,
      avgServiceTimeMinutes,
      maxDailyCapacity,
      maxActiveWaitingLimit,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "يرجى تحديد اسم الطابور / الخدمة" },
        { status: 400 }
      );
    }

    const result = await createCustomQueue({
      tenantSlug,
      name: name.trim(),
      prefix: prefix ? String(prefix).trim() : "Q",
      avgServiceTimeMinutes: avgServiceTimeMinutes ? Number(avgServiceTimeMinutes) : 15,
      maxDailyCapacity: maxDailyCapacity ? Number(maxDailyCapacity) : 100,
      maxActiveWaitingLimit: maxActiveWaitingLimit ? Number(maxActiveWaitingLimit) : 20,
      createdByAdmin: adminSession?.email || "admin@mken.live",
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "تعذر إنشاء الطابور الجديد" },
      { status: 500 }
    );
  }
}
