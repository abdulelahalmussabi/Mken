import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";
import { fetchPlatformOccasion, upsertPlatformOccasion } from "@/lib/mken/tenant";

export async function GET() {
  const theme = (await fetchPlatformOccasion()) || "none";
  return NextResponse.json({ success: true, theme });
}

export async function PUT(request: Request) {
  const session = await readAdminSession();
  if (session?.role !== "super") {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await upsertPlatformOccasion(body?.theme);
    if (result.error || !result.theme) {
      return NextResponse.json(
        { success: false, message: result.error || "تعذّر حفظ الثيم" },
        { status: result.error === "ثيم غير صالح" ? 400 : 500 }
      );
    }
    return NextResponse.json({ success: true, theme: result.theme });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
