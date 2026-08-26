import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  return handleSeed();
}

export async function POST() {
  return handleSeed();
}

async function handleSeed() {
  try {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ""
    ).trim();

    if (!url || !serviceKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      );
    }

    const sb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const defaultPassword = "Aa#321321";
    const accounts = [
      { email: "admin@mken.live", slug: "admin", name: "الإدارة العامة (Super Admin)" },
      { email: "almahrusa@mken.live", slug: "almahrusa", name: "مجموعة المحروسة" },
      { email: "almahrosa@mken.live", slug: "almahrosa", name: "مجموعة المحروسة" },
      { email: "almasabi@mken.live", slug: "almasabi", name: "مؤسسة المصعبي للتجارة" },
      { email: "rewa@mken.live", slug: "rewa", name: "منتجع رواء الاستشفاء الرقمي" },
      { email: "demo@mken.live", slug: "demo", name: "صالون النخبة" },
    ];

    const { data: usersData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      return NextResponse.json({ success: false, error: listErr.message }, { status: 500 });
    }

    const usersList = usersData.users || [];
    const results = [];

    for (const acc of accounts) {
      let userId: string;
      const existingUser = usersList.find((u) => {
        const e = (u.email || "").toLowerCase();
        return e === acc.email.toLowerCase() || (acc.slug === "admin" && e === "admin@mkem.live");
      });

      if (existingUser) {
        userId = existingUser.id;
        const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
          email: acc.email,
          password: defaultPassword,
          email_confirm: true,
        });
        if (updErr) {
          console.error(`Failed to update Auth for ${acc.email}:`, updErr.message);
        }
      } else {
        const { data: newAuth, error: createErr } = await sb.auth.admin.createUser({
          email: acc.email,
          password: defaultPassword,
          email_confirm: true,
        });
        if (createErr || !newAuth.user) {
          console.error(`Failed to create Auth for ${acc.email}:`, createErr?.message);
          continue;
        }
        userId = newAuth.user.id;
      }

      const { data: existingClient } = await sb
        .from("mken_saas_clients")
        .select("id")
        .eq("tenant_slug", acc.slug)
        .maybeSingle();

      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 10);

      if (existingClient) {
        await sb
          .from("mken_saas_clients")
          .update({
            owner_id: userId,
            email: acc.email,
            business_name: acc.name,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_slug", acc.slug);
      } else {
        await sb.from("mken_saas_clients").insert({
          tenant_slug: acc.slug,
          owner_id: userId,
          business_name: acc.name,
          email: acc.email,
          phone: "966543530333",
          subscription_end: oneYear.toISOString(),
          config_data: { brand: { name: acc.name } },
          subscription_status: "active",
        });
      }

      results.push({ email: acc.email, slug: acc.slug, uuid: userId });
    }

    return NextResponse.json({
      success: true,
      message: "🎉 All 4 admin accounts have been seeded in Supabase Auth & mken_saas_clients!",
      accounts: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
