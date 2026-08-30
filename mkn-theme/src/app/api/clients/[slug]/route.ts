import { NextResponse } from "next/server";
import { adminClientView } from "@/data/default-clients";
import { canEditClient, readAdminSession, sha256Hex } from "@/lib/auth/session";
import { loadPublicStorefront } from "@/lib/mken/catalog";
import { hostnameFromHeaders, resolveBoundTenant } from "@/lib/mken/bound-host";
import { boundTenantFromHostname } from "@/lib/mken/tenant-host";
import {
  TENANT_TABLE,
  fetchTenantRow,
  getTenantDb,
  isPlatformSlug,
  mergeIntoConfig,
  updateTenant,
} from "@/lib/mken/tenant";
import type { ClientRecord } from "@/types/database";
import { logoValidationError } from "@/lib/mken/logo-crop";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Pragma",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Fields a client admin may change on its own record. */
const CLIENT_EDITABLE: (keyof ClientRecord)[] = [
  "name",
  "tagline",
  "subtitle",
  "phone",
  "whatsapp",
  "email",
  "location",
  "heroImage",
  "logo",
  "theme",
  "couponCode",
  "discountText",
  "promoTitle",
  "discountEnabled",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = rawSlug?.toLowerCase();
    if (!slug || isPlatformSlug(slug)) {
      return NextResponse.json({ success: false, message: "المنشأة غير موجودة" }, { status: 404, headers: CORS });
    }

    // Sync only — async custom-host DB lookup has timed out (empty 500) on tenant subdomains.
    const bound = boundTenantFromHostname(hostnameFromHeaders(request.headers));
    if (bound && bound !== slug) {
      return NextResponse.json({ success: false, message: "المنشأة غير موجودة" }, { status: 404, headers: CORS });
    }

    const payload = await loadPublicStorefront(slug);
    if (!payload) {
      return NextResponse.json({ success: false, message: "المنشأة غير موجودة" }, { status: 404, headers: CORS });
    }

    return NextResponse.json(
      {
        success: true,
        client: payload.client,
        catalog: payload.catalog,
        appearance: payload.appearance,
        pages: payload.pages,
        contactExtras: payload.contactExtras,
        source: payload.source,
      },
      { headers: CORS }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "تعذّر تحميل المنشأة" },
      { status: 500, headers: CORS }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug?.toLowerCase();
  if (!slug || isPlatformSlug(slug)) {
    return NextResponse.json({ success: false, message: "المنشأة غير موجودة" }, { status: 404 });
  }

  const session = await readAdminSession();
  if (!canEditClient(session, slug)) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
  }

  const bound = await resolveBoundTenant(request);
  if (bound && bound !== slug) {
    return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
  }

  try {
    const body: Partial<ClientRecord> = await request.json();
    const updates: Partial<ClientRecord> = {};

    if (session!.role === "super") {
      Object.assign(updates, body);
      delete updates.slug;
      delete updates.adminPassword;
    } else {
      for (const field of CLIENT_EDITABLE) {
        if (field in body) {
          (updates as Record<string, unknown>)[field] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0 && !body.adminPassword) {
      return NextResponse.json(
        { success: false, message: "لا توجد حقول للتحديث" },
        { status: 400 }
      );
    }

    if (typeof updates.logo === "string") {
      const logoError = logoValidationError(updates.logo);
      if (logoError) {
        return NextResponse.json({ success: false, message: logoError }, { status: 400 });
      }
    }

    const result = await updateTenant(slug, updates);
    if (result.error || !result.client) {
      return NextResponse.json(
        { success: false, message: result.error || "تعذّر حفظ التغييرات" },
        { status: 500 }
      );
    }

    // Password rotation stays super-admin only and is stored hashed in config_data.
    if (body.adminPassword && session!.role === "super") {
      const db = getTenantDb();
      const row = await fetchTenantRow(slug);
      if (db && row) {
        const config = mergeIntoConfig(row.config_data || {}, {});
        config.adminPasswordHash = await sha256Hex(body.adminPassword);
        await db.from(TENANT_TABLE).update({ config_data: config }).eq("tenant_slug", slug);
      }
    }

    return NextResponse.json({ success: true, client: adminClientView(result.client) });
  } catch {
    return NextResponse.json({ success: false, message: "فشل تحديث البيانات" }, { status: 500 });
  }
}
