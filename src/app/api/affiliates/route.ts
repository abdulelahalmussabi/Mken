import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { getOrCreateAffiliateAccount } from "@/lib/mken/affiliate";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;

    const affiliate = await getOrCreateAffiliateAccount(tenantSlug);

    return NextResponse.json({
      success: true,
      affiliate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب بيانات برنامج الشركاء";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
