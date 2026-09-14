import { NextResponse } from "next/server";
import { applySessionCookie, createSessionToken } from "@/lib/auth/session";
import { getServiceRoleDb } from "@/lib/mken/tenant";
import {
  RESERVED_SLUGS,
  TRIAL_DAYS,
  buildTrialTenantConfig,
  trialEndDate,
} from "@/lib/mken/trial-subscription";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "طلب غير صالح" }, 400);
  }

  const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase();
  const businessName = String(body.businessName || body.full_name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const phone = String(body.phone || "").trim();
  const activityId = String(body.activityId || "tech-digital").trim();

  if (!tenantSlug || !businessName || !email || !password || !phone) {
    return json({ success: false, error: "جميع الحقول الأساسية مطلوبة" }, 400);
  }

  if (!/^[a-z0-9-]+$/.test(tenantSlug) || tenantSlug.length < 3) {
    return json(
      {
        success: false,
        error: "رابط الموقع: أحرف إنجليزية صغيرة وأرقام وشرطات فقط (3 أحرف على الأقل)",
      },
      400
    );
  }

  if (RESERVED_SLUGS.includes(tenantSlug)) {
    return json({ success: false, error: "هذا المعرّف محجوز، اختر اسماً آخر" }, 400);
  }

  if (password.length < 6) {
    return json({ success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);
  }

  const supabase = getServiceRoleDb();
  if (!supabase) {
    return json({ success: false, error: "Database configuration error" }, 500);
  }

  const { data: existing, error: checkErr } = await supabase
    .from("mken_saas_clients")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();

  if (checkErr) {
    return json({ success: false, error: checkErr.message }, 500);
  }
  if (existing) {
    return json({ success: false, error: "معرّف الرابط محجوز لعميل آخر، اختر اسماً آخر." }, 400);
  }

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return json({ success: false, error: authErr?.message || "فشل إنشاء حساب المستخدم" }, 400);
  }

  const user = authData.user;
  const now = new Date();
  const trialEnd = trialEndDate(now);
  const configData = buildTrialTenantConfig({ businessName, phone, activityId });

  const insertObj = {
    tenant_slug: tenantSlug,
    owner_id: user.id,
    business_name: businessName,
    email,
    phone,
    subscription_start: now.toISOString(),
    subscription_end: trialEnd.toISOString(),
    config_data: configData,
    subscription_status: "trial",
    subscription_tier: "growth",
  };

  let insertRes = await supabase.from("mken_saas_clients").insert(insertObj).select().single();

  if (insertRes.error) {
    const errMessage = insertRes.error.message || "";
    if (insertRes.error.code === "42703" || errMessage.includes("column") || errMessage.includes("does not exist")) {
      insertRes = await supabase
        .from("mken_saas_clients")
        .insert({
          tenant_slug: tenantSlug,
          owner_id: user.id,
          business_name: businessName,
          email,
          phone,
          subscription_end: trialEnd.toISOString(),
          config_data: configData,
          subscription_status: "trial",
        })
        .select()
        .single();
    }
  }

  if (insertRes.error) {
    await supabase.auth.admin.deleteUser(user.id);
    return json({ success: false, error: insertRes.error.message }, 500);
  }

  const origin = new URL(request.url).origin;
  const siteUrl = `${origin}/subscriber/${tenantSlug}`;
  const adminUrl = `${origin}/admin?welcome=trial`;

  const response = json({
    success: true,
    client: insertRes.data,
    trialDays: TRIAL_DAYS,
    trialEndsAt: trialEnd.toISOString(),
    siteUrl,
    adminUrl,
  });

  const token = await createSessionToken({
    email,
    role: "client",
    clientSlug: tenantSlug,
  });
  if (token) await applySessionCookie(response, token);
  return response;
}
