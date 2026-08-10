import { NextResponse } from "next/server";
import { createClientServer } from "@/lib/supabase/server";
import { DEFAULT_CLIENTS } from "@/context/AdminContext";

const SUPER_ADMIN_EMAIL = "admin@mken.live";
const SUPER_ADMIN_PASSWORD = "Aa#321321";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, message: "يرجى إدخال البريد الإلكتروني وكلمة المرور" },
        { status: 400 }
      );
    }

    // 1. Super Admin Validation
    if (normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASSWORD) {
      return NextResponse.json({
        success: true,
        role: "super",
        email: normalizedEmail,
        message: "مرحباً بك في لوحة التحكم المركزية!",
      });
    }

    // 2. Client Admin Validation via Supabase / Default Clients
    const supabase = await createClientServer();
    const { data: dbClient } = await supabase
      .from("clients")
      .select("*")
      .ilike("admin_email", normalizedEmail)
      .single();

    if (dbClient && dbClient.admin_password === password && dbClient.active) {
      return NextResponse.json({
        success: true,
        role: "client",
        email: normalizedEmail,
        clientSlug: dbClient.slug,
        clientName: dbClient.name,
        message: `مرحباً بك في لوحة تحكم ${dbClient.name}!`,
      });
    }

    // Fallback to DEFAULT_CLIENTS
    const matchedClient = DEFAULT_CLIENTS.find(
      (c) =>
        c.adminEmail.toLowerCase() === normalizedEmail &&
        c.adminPassword === password &&
        c.active
    );

    if (matchedClient) {
      return NextResponse.json({
        success: true,
        role: "client",
        email: normalizedEmail,
        clientSlug: matchedClient.slug,
        clientName: matchedClient.name,
        message: `مرحباً بك في لوحة تحكم ${matchedClient.name}!`,
      });
    }

    return NextResponse.json(
      { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
      { status: 401 }
    );
  } catch (err) {
    return NextResponse.json({ success: false, message: "خطأ في معالجة طلب الدخول" }, { status: 500 });
  }
}
