import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  fetchAppearance,
  updateAppearance,
  validateAppearance,
  type AppearanceUpdate,
  type CustomTheme,
  type SecondaryAd,
  type ThemeScheduleItem,
} from "@/lib/mken/appearance";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { appearance, error } = await fetchAppearance(scope.slug);
  if (error || !appearance) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, appearance });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function PUT(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  try {
    const body = await request.json();
    const update: AppearanceUpdate = {};

    if (body.mode === "manual" || body.mode === "seasonal") update.mode = body.mode;
    if (typeof body.forceId === "string") update.forceId = body.forceId;
    if (Array.isArray(body.schedule)) update.schedule = body.schedule as ThemeScheduleItem[];
    if (Array.isArray(body.customThemes)) update.customThemes = body.customThemes as CustomTheme[];
    if (isObject(body.interfaceCopy)) {
      update.interfaceCopy = body.interfaceCopy as AppearanceUpdate["interfaceCopy"];
    }
    if (isObject(body.ads)) {
      update.ads = {
        primary: isObject(body.ads.primary) ? body.ads.primary : undefined,
        secondary: Array.isArray(body.ads.secondary) ? (body.ads.secondary as SecondaryAd[]) : undefined,
      };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, message: "لا توجد حقول للتحديث" }, { status: 400 });
    }

    const invalid = validateAppearance(update);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { appearance, error } = await updateAppearance(scope.slug, update);
    if (error || !appearance) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر حفظ المظهر" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tenant: scope.slug, appearance });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
