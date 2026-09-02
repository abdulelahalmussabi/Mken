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
  hasCustomDomain: boolean;
}

export const SAAS_TIERS: Record<"basic" | "growth" | "unlimited", SaasFeatures> = {
  basic: {
    tier: "basic",
    name: "الباقة الأساسية",
    hasWhatsApp: false,
    hasCommerce: false,
    hasInvoices: false,
    hasCustomDomain: false,
  },
  growth: {
    tier: "growth",
    name: "الباقة المتقدمة",
    hasWhatsApp: true,
    hasCommerce: true,
    hasInvoices: false,
    hasCustomDomain: false,
  },
  unlimited: {
    tier: "unlimited",
    name: "الباقة الاحترافية",
    hasWhatsApp: true,
    hasCommerce: true,
    hasInvoices: true,
    hasCustomDomain: false,
  },
};

export const SAAS_FEATURES_UNLIMITED: SaasFeatures = {
  ...SAAS_TIERS.unlimited,
  hasCustomDomain: true,
};
export const SAAS_FEATURES_LOCKED: SaasFeatures = SAAS_TIERS.basic;

const PLATFORM_SLUGS = new Set(["admin", "mken", "default"]);

export interface SaasConfigSlice {
  subscription?: {
    tier?: string;
    customFeatures?: {
      hasBooking?: boolean;
      hasWhatsApp?: boolean;
      hasCommerce?: boolean;
      hasInvoices?: boolean;
      hasCustomDomain?: boolean;
    };
    pricing?: {
      currency?: string;
      monthly?: number;
      yearly?: number;
      customDomainYear?: number;
      addOns?: Record<string, number>;
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
  const addonDomain = !!sub?.customFeatures?.hasCustomDomain;

  if (tier === "custom") {
    const custom = sub.customFeatures || {};
    return {
      tier: "custom",
      name: "باقة مخصصة",
      hasWhatsApp: !!custom.hasWhatsApp,
      hasCommerce: !!custom.hasCommerce,
      hasInvoices: !!custom.hasInvoices,
      hasCustomDomain: addonDomain,
    };
  }

  if (tier === "growth") return { ...SAAS_TIERS.growth, hasCustomDomain: addonDomain };
  if (tier === "unlimited") return { ...SAAS_TIERS.unlimited, hasCustomDomain: addonDomain };
  return { ...SAAS_TIERS.basic, hasCustomDomain: addonDomain };
}

export function geoGridMonthlyCredits(tier: SaasTierId): number {
  if (tier === "unlimited") return 40;
  if (tier === "growth" || tier === "custom") return 8;
  return 2;
}

export function geoGridCreditCost(gridSize: "3x3" | "5x5" | "7x7"): number {
  if (gridSize === "7x7") return 4;
  if (gridSize === "5x5") return 2;
  return 1;
}

export function geoGridAllowedSizes(tier: SaasTierId): Array<"3x3" | "5x5" | "7x7"> {
  if (tier === "unlimited") return ["3x3", "5x5", "7x7"];
  if (tier === "growth" || tier === "custom") return ["3x3", "5x5"];
  return ["3x3"];
}

export function adGenerateDailyLimit(tier: SaasTierId): number {
  if (tier === "unlimited") return 40;
  if (tier === "growth" || tier === "custom") return 12;
  return 3;
}

export const SAAS_FEATURE_MESSAGES = {
  whatsapp: "سجل واتساب غير متاح في باقتك الحالية. يتطلب الباقة المتقدمة أو أعلى.",
  commerce: "المتجر الإلكتروني يتطلب الباقة المتقدمة 🌟",
  invoices: "الفواتير والمخزون يتطلبان الباقة الاحترافية.",
  customDomain: "الدومين الخاص إضافة سنوية تُفعَّل من خيارات الاشتراك.",
  geoGrid: "نفدت أرصدة فحص الرانك لهذا الشهر. رقِّ الباقة أو انتظر بداية الشهر التالي.",
  adGenerate: "بلغت حد توليد الإعلانات لهذا اليوم. رقِّ الباقة أو عُد غداً.",
} as const;

