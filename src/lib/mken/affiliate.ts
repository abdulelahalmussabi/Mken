import { createClient } from "@/lib/supabase/client";

export interface AffiliateAccount {
  id?: string;
  tenantSlug: string;
  affiliateCode: string;
  commissionRate: number; // e.g. 20%
  totalClicks: number;
  totalSignups: number;
  totalEarnings: number;
  pendingPayout: number;
  referralUrl: string;
}

const ROOT_MARKETING_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "mken.live";

/**
 * Generate canonical affiliate URL for a tenant
 */
export function getReferralUrl(tenantSlug: string): string {
  const clean = (tenantSlug || "").trim().toLowerCase();
  return `https://${ROOT_MARKETING_DOMAIN}?ref=${clean}`;
}

/**
 * Get or automatically provision an affiliate account for a tenant
 */
export async function getOrCreateAffiliateAccount(tenantSlug: string): Promise<AffiliateAccount> {
  const cleanSlug = (tenantSlug || "rewa").trim().toLowerCase();
  const supabase = createClient();

  // 1. Fetch existing
  const { data: existing } = await supabase
    .from("mken_affiliates")
    .select("*")
    .eq("tenant_slug", cleanSlug)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      tenantSlug: existing.tenant_slug,
      affiliateCode: existing.affiliate_code,
      commissionRate: Number(existing.commission_rate || 20),
      totalClicks: Number(existing.total_clicks || 0),
      totalSignups: Number(existing.total_signups || 0),
      totalEarnings: Number(existing.total_earnings || 0),
      pendingPayout: Number(existing.pending_payout || 0),
      referralUrl: getReferralUrl(existing.affiliate_code || cleanSlug),
    };
  }

  // 2. Auto-provision affiliate account
  const defaultAccount = {
    tenant_slug: cleanSlug,
    affiliate_code: cleanSlug,
    commission_rate: 20.0,
    total_clicks: 0,
    total_signups: 0,
    total_earnings: 0.0,
    pending_payout: 0.0,
    is_active: true,
  };

  try {
    const { data: created } = await supabase
      .from("mken_affiliates")
      .insert(defaultAccount)
      .select()
      .single();

    if (created) {
      return {
        id: created.id,
        tenantSlug: created.tenant_slug,
        affiliateCode: created.affiliate_code,
        commissionRate: Number(created.commission_rate || 20),
        totalClicks: Number(created.total_clicks || 0),
        totalSignups: Number(created.total_signups || 0),
        totalEarnings: Number(created.total_earnings || 0),
        pendingPayout: Number(created.pending_payout || 0),
        referralUrl: getReferralUrl(created.affiliate_code || cleanSlug),
      };
    }
  } catch {}

  return {
    tenantSlug: cleanSlug,
    affiliateCode: cleanSlug,
    commissionRate: 20.0,
    totalClicks: 0,
    totalSignups: 0,
    totalEarnings: 0.0,
    pendingPayout: 0.0,
    referralUrl: getReferralUrl(cleanSlug),
  };
}

/**
 * Record a referral click event
 */
export async function trackReferralClick(referrerCode: string, ipHash?: string, userAgent?: string): Promise<boolean> {
  const cleanCode = (referrerCode || "").trim().toLowerCase();
  if (!cleanCode) return false;

  const supabase = createClient();

  try {
    // 1. Insert click event
    await supabase.from("mken_referral_events").insert({
      affiliate_slug: cleanCode,
      event_type: "click",
      ip_hash: ipHash || "anon",
      user_agent: userAgent || "browser",
    });

    // 2. Increment total_clicks
    const { data: aff } = await supabase
      .from("mken_affiliates")
      .select("total_clicks")
      .eq("affiliate_code", cleanCode)
      .maybeSingle();

    if (aff) {
      await supabase
        .from("mken_affiliates")
        .update({ total_clicks: (aff.total_clicks || 0) + 1, updated_at: new Date().toISOString() })
        .eq("affiliate_code", cleanCode);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Attribute a new paid subscription conversion to the referrer
 */
export async function attributeSubscriptionConversion(params: {
  referrerCode: string;
  newTenantSlug: string;
  planTier: string;
  amountPaid: number;
}): Promise<{ success: boolean; commissionEarned: number }> {
  const cleanCode = (params.referrerCode || "").trim().toLowerCase();
  const supabase = createClient();

  try {
    const { data: aff } = await supabase
      .from("mken_affiliates")
      .select("*")
      .eq("affiliate_code", cleanCode)
      .maybeSingle();

    const commissionRate = aff ? Number(aff.commission_rate || 20) : 20;
    const commissionEarned = (params.amountPaid * commissionRate) / 100;

    // Record conversion event
    await supabase.from("mken_referral_events").insert({
      affiliate_slug: cleanCode,
      event_type: "subscription",
      referred_slug: params.newTenantSlug,
      plan_tier: params.planTier,
      amount: params.amountPaid,
      commission_earned: commissionEarned,
    });

    // Update balances
    if (aff) {
      await supabase
        .from("mken_affiliates")
        .update({
          total_signups: (aff.total_signups || 0) + 1,
          total_earnings: Number(aff.total_earnings || 0) + commissionEarned,
          pending_payout: Number(aff.pending_payout || 0) + commissionEarned,
          updated_at: new Date().toISOString(),
        })
        .eq("affiliate_code", cleanCode);
    }

    return { success: true, commissionEarned };
  } catch {
    return { success: false, commissionEarned: 0 };
  }
}
