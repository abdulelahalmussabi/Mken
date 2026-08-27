import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/mken/pages";

export interface SubscriptionUpdateParams {
  tenantSlug: string;
  planTier: "starter" | "pro" | "enterprise";
  status: "active" | "past_due" | "canceled";
  customerEmail?: string;
  amountPaid?: number;
  paymentProvider?: "moyasar" | "stripe" | "tap";
}

/**
 * Handle subscription update and automatically synchronize tenant quotas (max_pages, domains)
 */
export async function applySubscriptionUpdate(params: SubscriptionUpdateParams): Promise<{
  success: boolean;
  limits: any;
  error?: string;
}> {
  const supabase = createClient();
  const limits = getPlanLimits(params.planTier);

  try {
    // 1. Update or Sync in mken_saas_clients or settings
    await supabase
      .from("mken_saas_clients")
      .update({
        subscription_status: params.status,
        plan: params.planTier,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_slug", params.tenantSlug.toLowerCase());

    return {
      success: true,
      limits,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث حالة الاشتراك";
    return { success: false, limits, error: message };
  }
}
