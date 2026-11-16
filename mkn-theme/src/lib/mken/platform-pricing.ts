/**
 * Public SaaS packages for mken.live/pricing.
 * Monthly list prices match the marketing landing; yearly = 10× month (شهران مجاناً).
 */

export type PlatformPlanId = "basic" | "growth" | "unlimited";
export type BillingCycle = "monthly" | "yearly";

export interface PlatformPlan {
  id: PlatformPlanId;
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  popular?: boolean;
  cta: { label: string; href: string };
  features: string[];
  missing?: string[];
}

export const PLATFORM_PLANS: PlatformPlan[] = [
  {
    id: "basic",
    name: "امتثال",
    blurb: "موقع وحجز وفواتير نظامية لمنشأتك.",
    monthly: 199,
    yearly: 1990,
    cta: { label: "ابدأ", href: "/register" },
    features: [
      "فاتورتك نظامية ومتوافقة مع الزكاة",
      "موقع منشأة + حجز مواعيد",
      "رمز QR على كل فاتورة",
    ],
    missing: ["واتساب CRM", "متجر إلكتروني"],
  },
  {
    id: "growth",
    name: "نمو",
    blurb: "كل الامتثال + عملاؤك يحجزون من واتساب.",
    monthly: 399,
    yearly: 3990,
    popular: true,
    cta: { label: "جرّب 14 يوماً مجاناً", href: "/register" },
    features: [
      "كل ميزات امتثال",
      "عملاؤك يحجزون من واتساب مع ردود ذكية",
      "متجر إلكتروني للطلبات",
      "14 يوماً تجربة مجانية بدون بطاقة",
    ],
  },
  {
    id: "unlimited",
    name: "احترافي",
    blurb: "ظهور محلي أقوى ودعم أولوية.",
    monthly: 699,
    yearly: 6990,
    cta: {
      label: "تواصل للترقية",
      href: "https://wa.me/966543530333?text=%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A8%D8%A7%D9%82%D8%A9%20%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A%20%D9%85%D9%83%D9%86",
    },
    features: [
      "كل ميزات نمو",
      "تحسين الظهور على خرائط جوجل",
      "دعم أولوية وإعداد أسرع",
      "تقارير رانك محلي (حسب التفعيل)",
    ],
  },
];

export function planPrice(plan: PlatformPlan, cycle: BillingCycle): number {
  return cycle === "yearly" ? plan.yearly : plan.monthly;
}

export function yearlySavings(plan: PlatformPlan): number {
  return plan.monthly * 12 - plan.yearly;
}
