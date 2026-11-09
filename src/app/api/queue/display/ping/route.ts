import { NextResponse } from "next/server";
import { pingDisplayScreen } from "@/lib/mken/queue";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const screenToken = body.screenToken || "central-hall-tv-token";
    const screenName = body.screenName || "شاشة الصالة المركزية";
    const tenantSlug = body.tenantSlug || "default";

    const screen = await pingDisplayScreen({
      screenToken,
      screenName,
      tenantSlug,
    });

    return NextResponse.json({
      success: true,
      screen,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "فشل إرسال نبضة الشاشة" },
      { status: 500 }
    );
  }
}
