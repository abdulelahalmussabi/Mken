/**
 * SaaS tiers match js/services-store.js `SAAS_TIERS` and admin.js
 * `updateSaaSFeatureVisibility`. Do not import server modules from here —
 * this file is safe for client components.
 */

export const COMMERCE_ACTIVITY_ID = "commerce";

export type SaasTierId = "basic" | "growth" | "unlimited" | "custom";

export interface SaasFeatures {
  tier: SaasTierId;
  name: string;
  hasWhatsApp: boolean;
  hasCommerce: boolean;
  hasInvoices: boolean;
}

export const SAAS_TIERS: Record<"basic" | "growth" | "unlimited", SaasFeatures> = {
  basic: {
    tier: "basic",
    name: "الباقة الأساسية",
    hasWhatsApp: false,
    hasCommerce: false,
    hasInvoices: false,
  },
  growth: {
    tier: "growth",
    name: "الباقة المتقدمة",
    hasWhatsApp: true,
    hasCommerce: true,
    hasInvoices: false,
  },
  unlimited: {
    tier: "unlimited",
    name: "الباقة الاحترافية",
    hasWhatsApp: true,
    hasCommerce: true,
    hasInvoices: true,
  },
};

export const SAAS_FEATURES_UNLIMITED: SaasFeatures = SAAS_TIERS.unlimited;
export const SAAS_FEATURES_LOCKED: SaasFeatures = SAAS_TIERS.basic;

const PLATFORM_SLUGS = new Set(["admin", "mken", "default"]);

export interface SaasConfigSlice {
  subscription?: {
    tier?: string;
    customFeatures?: {
      hasWhatsApp?: boolean;
      hasCommerce?: boolean;
      hasInvoices?: boolean;
    };
  };
}

export function saasFeaturesFromConfig(
  config: SaasConfigSlice | null | undefined,
  opts: { slug?: string; superAdmin?: boolean } = {}
): SaasFeatures {
  const slug = (opts.slug || "").toLowerCase();
  if (opts.superAdmin || PLATFORM_SLUGS.has(slug)) return SAAS_FEATURES_UNLIMITED;

  const sub = config?.subscription;
  if (!sub) return SAAS_FEATURES_UNLIMITED;

  const tier = (sub.tier || "basic").toLowerCase();
  if (tier === "custom") {
    const custom = sub.customFeatures || {};
    return {
      tier: "custom",
      name: "باقة مخصصة",
      hasWhatsApp: !!custom.hasWhatsApp,
      hasCommerce: !!custom.hasCommerce,
      hasInvoices: !!custom.hasInvoices,
    };
  }

  if (tier === "growth") return SAAS_TIERS.growth;
  if (tier === "unlimited") return SAAS_TIERS.unlimited;
  return SAAS_TIERS.basic;
}

export const SAAS_FEATURE_MESSAGES = {
  whatsapp: "سجل واتساب غير متاح في باقتك الحالية. يتطلب الباقة المتقدمة أو أعلى.",
  commerce: "المتجر الإلكتروني يتطلب الباقة المتقدمة 🌟",
  invoices: "الفواتير والمخزون يتطلبان الباقة الاحترافية.",
} as const;

