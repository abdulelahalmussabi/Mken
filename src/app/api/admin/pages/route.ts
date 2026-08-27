import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { getTenantPages, createTenantPage, getPlanLimits } from "@/lib/mken/pages";
import { createClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;

    const pages = await getTenantPages(tenantSlug);
    const limits = getPlanLimits("pro");

    return NextResponse.json({
      success: true,
      tenantSlug,
      pages,
      limits,
      totalCount: pages.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب الصفحات";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const body = await req.json();

    if (!body.title || !body.slug) {
      return NextResponse.json(
        { success: false, error: "عنوان الصفحة ومسار الرابط مطلوبان" },
        { status: 400 }
      );
    }

    const res = await createTenantPage(tenantSlug, {
      title: body.title,
      slug: body.slug,
      blocks: body.blocks || [],
      planTier: body.planTier || "pro",
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء الصفحة بنجاح",
      page: res.page,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء إنشاء الصفحة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = resolveTenantScope(req);
    const tenantSlug = scope.tenantSlug;
    const url = new URL(req.url);
    const pageId = url.searchParams.get("id");

    if (!pageId) {
      return NextResponse.json({ success: false, error: "معرف الصفحة مطلوب" }, { status: 400 });
    }

    const supabase = createClient();

    // Prevent deleting the primary home page
    const { data: page } = await supabase
      .from("mken_pages")
      .select("is_home")
      .eq("id", pageId)
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    if (page?.is_home) {
      return NextResponse.json(
        { success: false, error: "لا يمكن حذف الصفحة الرئيسية للمشروع" },
        { status: 400 }
      );
    }

    await supabase
      .from("mken_pages")
      .delete()
      .eq("id", pageId)
      .eq("tenant_slug", tenantSlug);

    return NextResponse.json({
      success: true,
      message: "تم حذف الصفحة بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف الصفحة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
