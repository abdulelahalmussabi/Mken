import { NextResponse } from "next/server";
import { DEFAULT_CLIENTS, adminClientView } from "@/data/default-clients";
import {
  TENANT_TABLE,
  fetchTenants,
  getTenantDb,
  isPlatformSlug,
  mergeIntoConfig,
  toClientRecord,
  type TenantRow,
} from "@/lib/mken/tenant";
import { readAdminSession, sha256Hex } from "@/lib/auth/session";
import type { ClientRecord } from "@/types/database";

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" },
      { status: 401 }
    );
  }

  const tenants = (await fetchTenants()) || [];
  const missingSeeds = DEFAULT_CLIENTS.filter(
    (seed) => !tenants.some((client) => client.slug === seed.slug)
  );
  const list = [...tenants, ...missingSeeds];
  const scoped =
    session.role === "super"
      ? list
      : list.filter((client) => client.slug === session.clientSlug);

  return NextResponse.json({
    success: true,
    clients: scoped.map(adminClientView),
    source: tenants.length > 0 ? "database" : "default",
  });
}

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (session?.role !== "super") {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
  }

  const db = getTenantDb();
  if (!db) {
    return NextResponse.json(
      { success: false, message: "قاعدة البيانات غير مهيأة على الخادم" },
      { status: 503 }
    );
  }

  try {
    const body: ClientRecord = await request.json();
    if (!body.slug || !body.name || !body.adminEmail || !body.adminPassword) {
      return NextResponse.json({ success: false, message: "بيانات ناقصة" }, { status: 400 });
    }

    const slug = body.slug.trim().toLowerCase();
    if (isPlatformSlug(slug) || slug.startsWith("_")) {
      return NextResponse.json({ success: false, message: "معرّف المنشأة غير صالح" }, { status: 400 });
    }
    const config = mergeIntoConfig({}, { ...body, slug });
    config.adminPasswordHash = await sha256Hex(body.adminPassword);

    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    const { data, error } = await db
      .from(TENANT_TABLE)
      .insert({
        tenant_slug: slug,
        business_name: body.name,
        email: body.adminEmail,
        phone: body.phone || "",
        subscription_status: body.active === false ? "inactive" : "active",
        subscription_end: oneYearOut.toISOString(),
        config_data: config,
      })
      .select("*");

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client: adminClientView(toClientRecord(data[0] as TenantRow)),
    });
  } catch {
    return NextResponse.json({ success: false, message: "فشل حفظ البيانات" }, { status: 500 });
  }
}
