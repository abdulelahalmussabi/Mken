import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/auth/session";
import {
  fetchPlatformBrand,
  upsertPlatformLogo,
  upsertPlatformOccasion,
} from "@/lib/mken/tenant";

export async function GET() {
  const brand = await fetchPlatformBrand();
  return NextResponse.json({ success: true, theme: brand.theme, logo: brand.logo });
}

export async function PUT(request: Request) {
  const session = await readAdminSession();
  if (session?.role !== "super") {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body?.logo === "string") {
      const result = await upsertPlatformLogo(body.logo);
      if (result.error) {
        return NextResponse.json({ success: false, message: result.error }, { status: 400 });
      }
      const brand = await fetchPlatformBrand();
      return NextResponse.json({ success: true, theme: brand.theme, logo: result.logo ?? brand.logo });
    }

    const result = await upsertPlatformOccasion(body?.theme);
    if (result.error || !result.theme) {
      return NextResponse.json(
        { success: false, message: result.error || "تعذّر حفظ الثيم" },
        { status: result.error === "ثيم غير صالح" ? 400 : 500 }
      );
    }
    const brand = await fetchPlatformBrand();
    return NextResponse.json({ success: true, theme: result.theme, logo: brand.logo });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
