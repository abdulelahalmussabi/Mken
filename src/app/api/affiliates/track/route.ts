import { NextRequest, NextResponse } from "next/server";
import { trackReferralClick, attributeSubscriptionConversion } from "@/lib/mken/affiliate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, ref, newTenantSlug, planTier, amountPaid } = body;

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anon";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (type === "click" && ref) {
      await trackReferralClick(ref, ip, userAgent);
      return NextResponse.json({ success: true, tracked: "click" });
    }

    if (type === "conversion" && ref && newTenantSlug) {
      const res = await attributeSubscriptionConversion({
        referrerCode: ref,
        newTenantSlug,
        planTier: planTier || "starter",
        amountPaid: Number(amountPaid || 0),
      });
      return NextResponse.json({ success: res.success, commissionEarned: res.commissionEarned });
    }

    return NextResponse.json({ success: false, error: "نوع الحدث غير معروف" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تسجيل حدث الإحالة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
