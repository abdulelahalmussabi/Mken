import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  fetchPages,
  isToggleablePageId,
  updatePages,
  validatePages,
  type PagesUpdate,
  type ToggleablePageId,
} from "@/lib/mken/pages";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const { pages, error } = await fetchPages(scope.slug);
  if (error || !pages) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenant: scope.slug, pages });
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
    const update: PagesUpdate = {};

    if (isObject(body.enabled)) {
      const enabled: Partial<Record<ToggleablePageId, boolean>> = {};
      for (const [key, value] of Object.entries(body.enabled)) {
        if (isToggleablePageId(key) && typeof value === "boolean") enabled[key] = value;
      }
      if (Object.keys(enabled).length) update.enabled = enabled;
    }
    if (isObject(body.home)) update.home = body.home as PagesUpdate["home"];
    if (isObject(body.about)) update.about = body.about as PagesUpdate["about"];
    if (isObject(body.services)) update.services = body.services as PagesUpdate["services"];
    if (isObject(body.work)) update.work = body.work as PagesUpdate["work"];
    if (isObject(body.contact)) update.contact = body.contact as PagesUpdate["contact"];

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, message: "لا توجد حقول للتحديث" }, { status: 400 });
    }

    const invalid = validatePages(update);
    if (invalid) {
      return NextResponse.json({ success: false, message: invalid }, { status: 400 });
    }

    const { pages, error } = await updatePages(scope.slug, update);
    if (error || !pages) {
      return NextResponse.json(
        { success: false, message: error || "تعذّر حفظ الصفحات" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, tenant: scope.slug, pages });
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }
}
