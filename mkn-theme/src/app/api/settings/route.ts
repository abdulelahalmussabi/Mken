import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  fetchTenantSettings,
  updateTenantSettings,
  validateSettings,
  type SettingsUpdate,
} from "@/lib/mken/settings";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { settings, error } = await fetchTenantSettings(scope.slug);
  if (error || !settings) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, settings });
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
    const update: SettingsUpdate = {};

    if (isObject(body.brand)) update.brand = body.brand as SettingsUpdate["brand"];
    if (typeof body.phone === "string") update.phone = body.phone;
    if (typeof body.heroImage === "string") update.heroImage = body.heroImage;
    if (isObject(body.social)) update.social = body.social as SettingsUpdate["social"];
    if (isObject(body.emails)) update.emails = body.emails as SettingsUpdate["emails"];
    if (isObject(body.serviceArea)) {
      update.serviceArea = body.serviceArea as SettingsUpdate["serviceArea"];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    const invalid = validateSettings(update);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { settings, error } = await updateTenantSettings(scope.slug, update);
    if (error || !settings) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر حفظ الإعدادات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tenant: scope.slug, settings });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
