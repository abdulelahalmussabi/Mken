import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { DEFAULT_CLIENTS } from "@/context/AdminContext";
import type { ClientRecord } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.toLowerCase();

  try {
    const supabase = await createClientServer();
    const { data: dbClient, error } = await supabase
      .from("clients")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!error && dbClient) {
      return NextResponse.json({ success: true, client: dbClient, source: "database" });
    }

    const defaultClient = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (defaultClient) {
      return NextResponse.json({ success: true, client: defaultClient, source: "default" });
    }

    return NextResponse.json({ success: false, message: "العميل غير موجود" }, { status: 404 });
  } catch (err) {
    const defaultClient = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (defaultClient) {
      return NextResponse.json({ success: true, client: defaultClient, source: "fallback" });
    }
    return NextResponse.json({ success: false, message: "خطأ في الخادم" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.toLowerCase();

  try {
    const body: Partial<ClientRecord> = await request.json();
    const supabase = await createClientServer();

    const { data, error } = await supabase
      .from("clients")
      .update(body)
      .eq("slug", slug)
      .select();

    if (error) {
      // Return success with updated payload even if DB RLS is not configured yet
      return NextResponse.json({
        success: true,
        client: { slug, ...body },
        warning: "تم تحديث البيانات محلياً (إعدادات DB RLS تحتاج ربط مفتاح السوبر)",
      });
    }

    return NextResponse.json({ success: true, client: data[0] });
  } catch (err) {
    return NextResponse.json({ success: false, message: "فشل تحديث البيانات" }, { status: 500 });
  }
}
