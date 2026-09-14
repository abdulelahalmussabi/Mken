import type { SupabaseClient } from "@supabase/supabase-js";
import { revokeGoogleOAuthToken } from "@/lib/mken/google-oauth";
import {
  getServiceRoleDb,
  getTenantDb,
  isDeletedTenantStatus,
  isPlatformSlug,
  PLATFORM_SLUG,
  TENANT_TABLE,
} from "@/lib/mken/tenant";
import { canonicalTenantSlug } from "@/lib/mken/tenant-slug";

export const DELETE_CONFIRM_WORD = "DELETE";

const OPERATIONAL_TABLES = [
  "mken_whatsapp_logs",
  "mken_appointments",
  "mken_orders",
  "mken_review_requests",
  "mken_staff_activities",
  "mken_staff_devices",
  "mken_staff",
  "mken_push_subscriptions",
  "mken_instagram_scheduled_posts",
  "mken_gbp_scheduled_posts",
  "mken_ad_campaigns",
  "mken_local_rank_scans",
  "mken_competitor_audits",
  "mken_inventory_items",
  "mken_tenant_domains",
  "pdpl_consent_logs",
] as const;

type TenantEraseRow = {
  tenant_slug: string;
  email?: string | null;
  phone?: string | null;
  owner_id?: string | null;
  subscription_status?: string | null;
  google_refresh_token?: string | null;
  google_access_token?: string | null;
  google_ads_refresh_token?: string | null;
  google_ads_access_token?: string | null;
};

function db(): SupabaseClient | null {
  return getServiceRoleDb() || getTenantDb();
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || "").trim().toLowerCase();
  const right = (b || "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export { isDeletedTenantStatus };

async function deleteBySlug(client: SupabaseClient, table: string, slug: string): Promise<void> {
  const { error } = await client.from(table).delete().eq("tenant_slug", slug);
  if (error && error.code !== "42P01" && error.code !== "42703") {
    console.error(`pdpl erase ${table}`, error.message);
  }
}

async function anonymizeInvoices(client: SupabaseClient, slug: string): Promise<void> {
  const { error } = await client
    .from("mken_invoices")
    .update({
      customer_id: null,
      customer_name: "محذوف",
      customer_phone: "",
    })
    .eq("tenant_slug", slug);
  if (error && error.code !== "42P01" && error.code !== "42703") {
    console.error("pdpl erase invoices", error.message);
  }
}

async function logDeletion(
  client: SupabaseClient,
  opts: { slug: string; phone: string; ip: string; userAgent: string; actor: string }
): Promise<void> {
  const { error } = await client.from("pdpl_consent_logs").insert({
    tenant_slug: null,
    user_phone: (opts.phone || "-").slice(0, 20),
    consent_type: "DATA_DELETION",
    consent_status: "REVOKED",
    ip_address: opts.ip.slice(0, 45),
    user_agent: `${opts.actor}:${opts.slug}:${opts.userAgent}`.slice(0, 500),
  });
  if (error) {
    console.error("pdpl_consent_logs deletion log failed", error.message);
  }
}

export async function loadTenantForErase(slug: string): Promise<TenantEraseRow | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from(TENANT_TABLE)
    .select(
      "tenant_slug, email, phone, owner_id, subscription_status, google_refresh_token, google_access_token, google_ads_refresh_token, google_ads_access_token"
    )
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as TenantEraseRow;
}

export async function eraseTenant(opts: {
  slug: string;
  ip: string;
  userAgent: string;
  actor: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const slug = canonicalTenantSlug(opts.slug);
  if (!slug || isPlatformSlug(slug) || slug === PLATFORM_SLUG) {
    return { error: "لا يمكن حذف حساب المنصة", status: 403 };
  }

  const client = db();
  if (!client) return { error: "قاعدة البيانات غير مهيأة على الخادم", status: 503 };

  const tenant = await loadTenantForErase(slug);
  if (!tenant) return { error: "المنشأة غير موجودة", status: 404 };
  if (isDeletedTenantStatus(tenant.subscription_status)) {
    return { error: "تم حذف بيانات هذه المنشأة مسبقاً", status: 409 };
  }

  await revokeGoogleOAuthToken(tenant.google_refresh_token);
  await revokeGoogleOAuthToken(tenant.google_access_token);
  await revokeGoogleOAuthToken(tenant.google_ads_refresh_token);
  await revokeGoogleOAuthToken(tenant.google_ads_access_token);

  await logDeletion(client, {
    slug,
    phone: tenant.phone || "-",
    ip: opts.ip,
    userAgent: opts.userAgent,
    actor: opts.actor,
  });

  const { data: staffRows } = await client.from("mken_staff").select("id").eq("tenant_slug", slug);
  const staffIds = (staffRows || []).map((row) => (row as { id?: string }).id).filter(Boolean) as string[];
  if (staffIds.length) {
    await client.from("mken_staff_devices").delete().in("staff_id", staffIds);
  }

  for (const table of OPERATIONAL_TABLES) {
    await deleteBySlug(client, table, slug);
  }
  await anonymizeInvoices(client, slug);

  const anonymized = {
    email: `deleted+${slug}@invalid.mken.live`,
    phone: null,
    business_name: "حساب محذوف",
    owner_id: null,
    subscription_status: "deleted",
    config_data: {},
    saved_config_data: null,
    google_access_token: null,
    google_refresh_token: null,
    google_token_expiry: null,
    google_business_location_id: null,
    google_place_id: null,
    updated_at: new Date().toISOString(),
  };

  let { error: updateError } = await client.from(TENANT_TABLE).update(anonymized).eq("tenant_slug", slug);
  if (updateError && (updateError.code === "42703" || updateError.message?.includes("column"))) {
    const { error: fallback } = await client
      .from(TENANT_TABLE)
      .update({
        email: anonymized.email,
        phone: null,
        business_name: "حساب محذوف",
        owner_id: null,
        subscription_status: "deleted",
        config_data: {},
      })
      .eq("tenant_slug", slug);
    updateError = fallback;
  }
  if (updateError) {
    return { error: "تعذّر تنفيذ الحذف", status: 500 };
  }

  const adsWipe = await client
    .from(TENANT_TABLE)
    .update({
      google_ads_refresh_token: null,
      google_ads_access_token: null,
      google_ads_token_expiry: null,
      google_ads_customer_id: null,
      google_ads_login_customer_id: null,
    })
    .eq("tenant_slug", slug);
  if (adsWipe.error && adsWipe.error.code !== "42703") {
    console.error("pdpl erase ads tokens", adsWipe.error.message);
  }

  if (tenant.owner_id) {
    const { error: authErr } = await client.auth.admin.deleteUser(tenant.owner_id);
    if (authErr) console.error("pdpl erase auth user", authErr.message);
  }

  return { ok: true };
}
