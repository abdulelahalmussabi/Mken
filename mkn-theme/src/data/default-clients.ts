import type { ClientRecord, StorefrontClient } from "@/types/database";
import { publicBrandSrc } from "@/lib/mken/logo-crop";

/**
 * Seed records used until a client row exists in Supabase.
 * Credentials live in env (ADMIN_SEED_PASSWORDS), never in this bundle.
 */
export const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    slug: "almahrusa",
    name: "المحروسة للشقق المفروشة | Mahrousa Apartment",
    tagline: "شقق مفروشة راقية بالمدينة المنورة — حجز مباشر",
    subtitle:
      "شقق مفروشة مجهزة بالكامل في المدينة المنورة 42522 — وحدات بإطلالة حديقة وأسرّة ملكية وغرف فردية، مع واي فاي ومطبخ وموقف سيارات.",
    type: "hotel",
    phone: "0554453287",
    whatsapp: "966554453287",
    email: "stayinmedina@gmail.com",
    location: "شداد بن عارض، المدينة المنورة 42522",
    rating: "4.7",
    reviewsCount: "32 تقييم على Google",
    heroImage: "/almahrusa/hero.web.jpg",
    demoNotice: "صفحة المحروسة للشقق المفروشة — المدينة المنورة على منصة مكّن",
    socialLinks: {
      whatsapp: "https://wa.me/966554453287",
    },
    adminEmail: "almahrusa@mken.live",
    logo: publicBrandSrc("almahrusa.png"),
    theme: "custom-almahrusa",
    customThemes: [{ id: "custom-almahrusa", name: "هوية المحروسة", accentColor: "#6B2D91" }],
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "almasabi",
    name: "مؤسسة المصعبي للتجارة",
    tagline: "نحميك من الشمس… ونضيف الفخامة لمكانك",
    subtitle:
      "تصنيع وتركيب المظلات والسواتر والهناجر والبرجولات والخيام بجدة وخارجها، بخامات كورية وفرنسية وألمانية وأسعار منافسة.",
    type: "other",
    phone: "0543530333",
    whatsapp: "966543530333",
    email: "info@almasabi.sa",
    location: "جدة، المملكة العربية السعودية — تغطية مكة المكرمة والطائف",
    rating: "",
    reviewsCount: "",
    heroImage:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80",
    demoNotice: "صفحة مؤسسة المصعبي للتجارة — مظلات وسواتر وهناجر على منصة مكّن",
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
      "منتجع استشفائي متكامل في المدينة المنورة: طب بديل، مجمع طبي، تأهيل، رياضة، دايت، جمعية وفعاليات، شقق خدمية، وكوفي مهى المدينة.",
    type: "other",
    phone: "0148462524",
    whatsapp: "966549462524",
    email: "rewa@mken.live",
    location: "الحماوات، المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "210 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
    demoNotice:
      "✨ الموقع الرسمي لمنتجع رواء الاستشفاء الرقمي (rewa.care) على منصة مكّن",
    adminEmail: "rewa@mken.live",
    logo: publicBrandSrc("rewa.png"),
    theme: "none",
    customThemes: [{ id: "custom-rewa", name: "هوية رواء", accentColor: "#1A3F66" }],
    socialLinks: {
      instagram: "https://instagram.com/rewa.100000",
      tiktok: "https://www.tiktok.com/@rewa.1000",
      snapchat: "https://www.snapchat.com/add/rewa.1000",
      whatsapp: "https://wa.me/966549462524",
    },
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "rewaq",
    name: "Rewaq Resident | رواق ريزدنت",
    tagline: "شقق مفروشة في مذينب، المدينة المنورة — حجز مباشر",
    subtitle:
      "شقق مفروشة مجهزة في حي مذينب بالمدينة المنورة 42317 — واي فاي ومطبخ صغير وتكييف وموقف سيارات. تسجيل الوصول من 16:00.",
    type: "hotel",
    phone: "0541303411",
    whatsapp: "966541303411",
    email: "rewaqresident@gmail.com",
    location: "اسيد بن كعب، مذينب، المدينة المنورة 42317",
    rating: "4.8",
    reviewsCount: "105 تقييم على Google",
    heroImage: "/rewaq/hero.web.jpg",
    demoNotice: "رواق ريزدنت — مذينب، المدينة المنورة على منصة مكّن",
    socialLinks: {
      whatsapp: "https://wa.me/966541303411",
    },
    adminEmail: "rewaqresident@gmail.com",
    theme: "custom-rewaq",
    customThemes: [{ id: "custom-rewaq", name: "هوية رواق ريزدنت", accentColor: "#7A4E2D" }],
    active: true,
    createdAt: new Date("2026-09-02").toISOString(),
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
    logo: client.logo || "",
    demoNotice: client.demoNotice,
    theme: client.theme,
    couponCode: client.couponCode,
    discountText: client.discountText,
    promoTitle: client.promoTitle,
    discountEnabled: client.discountEnabled,
    socialLinks: client.socialLinks,
    claimStatus:
      client.claimStatus === "unclaimed" || client.claimStatus === "pending"
        ? client.claimStatus
        : "claimed",
  };
}

/** @deprecated Prefer adminClientView or storefrontClient. */
export const publicClient = adminClientView;
