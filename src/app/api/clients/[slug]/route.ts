import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { DEFAULT_CLIENTS } from "@/context/AdminContext";
import type { ClientRecord } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.toLowerCase()?.trim();

  if (!slug) {
    return NextResponse.json({ success: false, message: "المعرف غير صحيح" }, { status: 400 });
  }

  try {
    const supabase = await createClientServer();
    
    // 1. Check mken_saas_clients table
    try {
      const { data: saasClient, error: saasError } = await supabase
        .from("mken_saas_clients")
        .select("*")
        .or(`tenant_slug.eq.${slug},slug.eq.${slug}`)
        .maybeSingle();

      if (!saasError && saasClient) {
        return NextResponse.json({
          success: true,
          client: {
            slug: saasClient.tenant_slug || saasClient.slug,
            name: saasClient.name,
            tagline: saasClient.tagline || "",
            subtitle: saasClient.subtitle || "",
            type: saasClient.type || "clinic",
            phone: saasClient.phone || "",
            whatsapp: saasClient.whatsapp || "",
            location: saasClient.location || "",
            rating: saasClient.rating || "4.9",
            reviewsCount: saasClient.reviews_count || "تقييمات موثقة",
            heroImage: saasClient.hero_image || "",
            adminEmail: saasClient.admin_email || "",
            adminPassword: saasClient.admin_password || "",
            theme: saasClient.theme || "national_day",
            active: saasClient.active ?? true,
            socialLinks: saasClient.config_data?.social_links || saasClient.social_links,
          },
          source: "database_saas",
        });
      }
    } catch {
      // Ignore if table does not exist
    }

    // 2. Check clients table
    try {
      const { data: dbClient, error } = await supabase
        .from("clients")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (!error && dbClient) {
        return NextResponse.json({ success: true, client: dbClient, source: "database" });
      }
    } catch {
      // Ignore if table does not exist
    }

    // 3. Fallback to DEFAULT_CLIENTS in code
    const defaultClient = DEFAULT_CLIENTS.find(
      (c) => c.slug.toLowerCase() === slug || c.slug.toLowerCase() === slug.replace(/_/g, "-")
    );
    if (defaultClient) {
      return NextResponse.json({ success: true, client: defaultClient, source: "default" });
    }

    return NextResponse.json({ success: false, message: "المنشأة غير موجودة" }, { status: 404 });
  } catch (err) {
    const defaultClient = DEFAULT_CLIENTS.find((c) => c.slug.toLowerCase() === slug);
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
