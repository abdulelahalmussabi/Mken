import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { getTenantSettings, updateTenantSettings } from "@/lib/mken/settings";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const res = await getTenantSettings(scope.tenantSlug);

    return NextResponse.json({
      success: true,
      tenant_slug: scope.tenantSlug,
      settings: res.settings,
      tableMissing: res.tableMissing,
      error: res.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const body = await req.json();

    const res = await updateTenantSettings(scope.tenantSlug, body);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, settings: res.settings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
