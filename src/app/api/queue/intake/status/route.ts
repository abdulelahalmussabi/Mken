import { NextResponse } from "next/server";
import { evaluateIntakeStatus, resolveTenantFromRequest } from "@/lib/mken/queue";

export async function GET(request: Request) {
  try {
    const tenantSlug = resolveTenantFromRequest(request);
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("service") || searchParams.get("department") || "reception";

    const evaluation = await evaluateIntakeStatus(tenantSlug, serviceId);
    return NextResponse.json({ success: true, evaluation });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "تعذّر فحص حالة الاستقبال" },
      { status: 500 }
    );
  }
}
