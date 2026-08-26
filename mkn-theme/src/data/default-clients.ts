import type { ClientRecord, StorefrontClient } from "@/types/database";

/**
 * Seed records used until a client row exists in Supabase.
 * Credentials live in env (ADMIN_SEED_PASSWORDS), never in this bundle.
 */
export const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    slug: "almahrusa",
    name: "مجموعة المحروسة",
    tagline: "إقامة مميزة وخدمة استثنائية",
    subtitle:
      "شقق مخدومة وغرف مفروشة في المدينة المنورة — احجز مسبقاً واستمتع بإقامة مريحة قريبة من الحرم.",
    type: "hotel",
    phone: "0551234567",
    whatsapp: "966551234567",
    email: "info@almahrusa.sa",
    location: "المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "382 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "✨ صفحة مجموعة المحروسة للشقق المخدومة — المدينة المنورة",
    adminEmail: "almahrusa@mken.live",
    theme: "none",
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "almasabi",
    name: "مؤسسة المصعبي للتجارة",
    tagline: "تجارة وتوريد بين جدة ومكة والمدينة",
    subtitle:
      "مؤسسة المصعبي للتجارة — توريد ومنتجات تجارية تغطي جدة ومكة المكرمة والمدينة المنورة.",
    type: "other",
    phone: "",
    whatsapp: "",
    email: "info@almasabi.sa",
    location: "جدة، مكة المكرمة، المدينة المنورة",
    rating: "",
    reviewsCount: "",
    heroImage:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    demoNotice: "صفحة مؤسسة المصعبي للتجارة على منصة مكّن",
    adminEmail: "almasabi@mken.live",
    theme: "none",
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "demo",
    name: "صالون النخبة",
    tagline: "احجز وادخل بدون انتظار",
    subtitle:
      "في صالون النخبة نوفر حلاقة رجالية ونسائية، عناية باللحية، وتجميل – احجز موعدك أونلاين واختر الوقت المناسب.",
    type: "salon",
    phone: "0543530333",
    whatsapp: "966543530333",
    email: "info@demo-salon.sa",
    location: "حي الربيع - الرياض، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "512 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "🚀 عرض تجريبي حي – مثال: صالون النخبة على مكّن. جرب 14 يوماً مجاناً",
    adminEmail: "demo@mken.live",
    theme: "none",
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "rewa",
    name: "منتجع رواء الاستشفاء الرقمي",
    tagline: "رواء.. توازن واسترخاء",
    subtitle:
      "منتجع صحي واستشفائي متكامل يضم عيادات الأسنان والسمنة والتغذية، نادي الدفاع عن النفس، واستضافة الفعاليات الصحية الدورية بالمدينة المنورة.",
    type: "other",
    phone: "0539770778",
    whatsapp: "966549462524",
    email: "rewa@mken.live",
    location: "المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "210 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
    demoNotice:
      "✨ الموقع الرسمي لمنتجع رواء الاستشفاء الرقمي (rewa.care) على منصة مكّن",
    adminEmail: "rewa@mken.live",
    theme: "none",
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
];

type CredentialField = "adminPassword" | "admin_password" | "admin_password_hash";

function omitCredentials<T extends object>(client: T): Omit<T, CredentialField> {
  const safe = { ...(client as Record<string, unknown>) };
  delete safe.adminPassword;
  delete safe.admin_password;
  delete safe.admin_password_hash;
  return safe as Omit<T, CredentialField>;
}

/** Full tenant record for an authenticated admin. Never includes passwords. */
export function adminClientView(client: ClientRecord): Omit<ClientRecord, CredentialField> {
  return omitCredentials(client);
}

/** Storefront-safe projection: identity and contact the public page already shows. */
export function storefrontClient(client: ClientRecord): StorefrontClient {
  return {
    slug: client.slug,
    name: client.name,
    tagline: client.tagline,
    subtitle: client.subtitle,
    type: client.type,
    phone: client.phone,
    whatsapp: client.whatsapp,
    location: client.location,
    rating: client.rating,
    reviewsCount: client.reviewsCount,
    heroImage: client.heroImage,
    demoNotice: client.demoNotice,
    theme: client.theme,
    couponCode: client.couponCode,
    discountText: client.discountText,
    discountEnabled: client.discountEnabled,
  };
}

/** @deprecated Prefer adminClientView or storefrontClient. */
export const publicClient = adminClientView;
