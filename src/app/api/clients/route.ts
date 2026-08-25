import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { DEFAULT_CLIENTS } from "@/context/AdminContext";
import type { ClientRecord } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createClientServer();
    const clientsList: ClientRecord[] = [...DEFAULT_CLIENTS];

    // Try mken_saas_clients
    try {
      const { data: saasClients } = await supabase.from("mken_saas_clients").select("*");
      if (saasClients && saasClients.length > 0) {
        saasClients.forEach((sc) => {
          const slug = sc.tenant_slug || sc.slug;
          const mapped: ClientRecord = {
            slug,
            name: sc.name,
            tagline: sc.tagline || "",
            subtitle: sc.subtitle || "",
            type: sc.type || "clinic",
            phone: sc.phone || "",
            whatsapp: sc.whatsapp || "",
            location: sc.location || "",
            rating: sc.rating || "4.9",
            reviewsCount: sc.reviews_count || "تقييمات موثقة",
            heroImage: sc.hero_image || "",
            demoNotice: `✨ صفحة منشأة ${sc.name} على منصة مكّن`,
            adminEmail: sc.admin_email || "",
            adminPassword: sc.admin_password || "",
            theme: sc.theme || "national_day",
            active: sc.active ?? true,
            createdAt: sc.created_at || new Date().toISOString(),
            socialLinks: sc.config_data?.social_links || sc.social_links,
          };
          const existingIdx = clientsList.findIndex((c) => c.slug === slug);
          if (existingIdx >= 0) {
            clientsList[existingIdx] = { ...clientsList[existingIdx], ...mapped };
          } else {
            clientsList.push(mapped);
          }
        });
      }
    } catch {}

    // Try clients table
    try {
      const { data: dbClients } = await supabase.from("clients").select("*");
      if (dbClients && dbClients.length > 0) {
        dbClients.forEach((dc) => {
          const existingIdx = clientsList.findIndex((c) => c.slug === dc.slug);
          if (existingIdx >= 0) {
            clientsList[existingIdx] = { ...clientsList[existingIdx], ...dc };
          } else {
            clientsList.push(dc);
          }
        });
      }
    } catch {}

    return NextResponse.json({ success: true, clients: clientsList, source: "merged" });
  } catch (err) {
    return NextResponse.json(
      { success: true, clients: DEFAULT_CLIENTS, source: "fallback", error: String(err) },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: ClientRecord = await request.json();
    if (!body.slug || !body.name) {
      return NextResponse.json({ success: false, message: "بيانات ناقصة" }, { status: 400 });
    }

    const supabase = await createClientServer();
    
    // 1. Try mken_saas_clients
    try {
      await supabase.from("mken_saas_clients").upsert([
        {
          tenant_slug: body.slug,
          name: body.name,
          tagline: body.tagline,
          subtitle: body.subtitle,
          type: body.type,
          phone: body.phone,
          whatsapp: body.whatsapp,
          location: body.location,
          admin_email: body.adminEmail,
          admin_password: body.adminPassword,
          theme: body.theme,
          active: body.active,
          config_data: {
            social_links: body.socialLinks,
            coupon_code: body.couponCode,
            discount_text: body.discountText,
          },
        },
      ]);
    } catch {}

    // 2. Try clients table
    try {
      await supabase.from("clients").upsert([body]);
    } catch {}

    return NextResponse.json({ success: true, client: body });
  } catch (err) {
    return NextResponse.json({ success: false, message: "فشل حفظ البيانات" }, { status: 500 });
  }
}
