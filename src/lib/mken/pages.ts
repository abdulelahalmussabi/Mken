import { createClient } from "@/lib/supabase/client";
import type { TenantPage } from "@/types/blocks";

export interface PlanLimits {
  tier: "starter" | "pro" | "enterprise";
  maxPages: number;
  allowCustomDomain: boolean;
  allowWhiteLabel: boolean;
}

export function getPlanLimits(planTier: string = "starter"): PlanLimits {
  const clean = (planTier || "starter").toLowerCase();
  switch (clean) {
    case "enterprise":
      return { tier: "enterprise", maxPages: 999, allowCustomDomain: true, allowWhiteLabel: true };
    case "pro":
      return { tier: "pro", maxPages: 5, allowCustomDomain: true, allowWhiteLabel: true };
    case "starter":
    default:
      return { tier: "starter", maxPages: 1, allowCustomDomain: false, allowWhiteLabel: false };
  }
}

/**
 * Fetch all pages for a tenant
 */
export async function getTenantPages(tenantSlug: string): Promise<TenantPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mken_pages")
    .select("*")
    .eq("tenant_slug", tenantSlug.toLowerCase())
    .order("order_index", { ascending: true });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    tenantSlug: row.tenant_slug,
    title: row.title,
    slug: row.slug,
    blocks: row.blocks || [],
    isHome: Boolean(row.is_home),
    isPublished: Boolean(row.is_published),
    seoMetadata: row.seo_metadata || {},
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Fetch a single page by slug
 */
export async function getTenantPageBySlug(tenantSlug: string, slug: string): Promise<TenantPage | null> {
  const supabase = createClient();
  const cleanSlug = (slug || "home").trim().toLowerCase();

  const { data, error } = await supabase
    .from("mken_pages")
    .select("*")
    .eq("tenant_slug", tenantSlug.toLowerCase())
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    tenantSlug: data.tenant_slug,
    title: data.title,
    slug: data.slug,
    blocks: data.blocks || [],
    isHome: Boolean(data.is_home),
    isPublished: Boolean(data.is_published),
    seoMetadata: data.seo_metadata || {},
    orderIndex: data.order_index,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new page with quota validation
 */
export async function createTenantPage(
  tenantSlug: string,
  pageData: { title: string; slug: string; blocks?: any[]; planTier?: string }
): Promise<{ success: boolean; page?: TenantPage; error?: string }> {
  const supabase = createClient();
  const cleanSlug = pageData.slug.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const limits = getPlanLimits(pageData.planTier || "pro");

  // 1. Quota Check
  const { count } = await supabase
    .from("mken_pages")
    .select("*", { count: "exact", head: true })
    .eq("tenant_slug", tenantSlug.toLowerCase());

  const currentCount = count || 0;
  if (currentCount >= limits.maxPages) {
    return {
      success: false,
      error: `لقد بلغت الحد الأقصى للصفحات المسموح بها في باقتك (${limits.maxPages} صفحات). يرجى ترقية الباقة لإنشاء المزيد من الصفحات.`,
    };
  }

  // 2. Insert Page
  const { data, error } = await supabase
    .from("mken_pages")
    .insert({
      tenant_slug: tenantSlug.toLowerCase(),
      title: pageData.title,
      slug: cleanSlug,
      blocks: pageData.blocks || [],
      is_home: currentCount === 0, // first page defaults to home
      is_published: true,
      order_index: currentCount,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "يوجد مسار صفحة بهذا الاسم مسبقاً لهذه المنشأة" };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    page: {
      id: data.id,
      tenantSlug: data.tenant_slug,
      title: data.title,
      slug: data.slug,
      blocks: data.blocks,
      isHome: data.is_home,
      isPublished: data.is_published,
    },
  };
}
