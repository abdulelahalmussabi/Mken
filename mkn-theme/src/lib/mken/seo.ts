import type { Metadata } from "next";
import { DEFAULT_CLIENTS, storefrontClient } from "@/data/default-clients";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";
import { brandIconPath, isUsableLogoSrc, publicBrandSrc } from "@/lib/mken/logo-crop";
import { fetchTenantRow, isPlatformSlug, toClientRecord } from "@/lib/mken/tenant";
import type { StorefrontClient } from "@/types/database";

export const SITE_NAME = "مكّن";

export const SITE_DEFAULT_TITLE =
  "منصة مكّن | حزمة واجهات المناسبات السعودية وخدمات Local SEO";

export const SITE_DEFAULT_DESCRIPTION =
  "المنصة المتخصصة لأصحاب الأنشطة التجارية في المملكة العربية السعودية لتحسين الظهور في خرائط Google بحزمة واجهات تفاعلية للمناسبات الوطنية والدينية.";

export const noIndexRobots: Metadata["robots"] = { index: false, follow: false };

export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "https://mken.live";
}

export function siteMetadataBase(): URL {
  return new URL(`${siteOrigin()}/`);
}

export const PLATFORM_ICON = publicBrandSrc("mken.png");

export function brandMetadataIcons(slug?: string | null): NonNullable<Metadata["icons"]> {
  const url = brandIconPath(slug);
  return {
    icon: [{ url, type: "image/png" }],
    shortcut: url,
    apple: url,
  };
}

export async function loadStorefrontSeo(slug: string): Promise<StorefrontClient | null> {
  const key = slug.trim().toLowerCase();
  if (!key || isPlatformSlug(key)) return null;
  const row = await fetchTenantRow(key);
  const seed = DEFAULT_CLIENTS.find((client) => client.slug === key);
  const config = row?.config_data || {};
  const overlay =
    key === "rewa"
      ? applyRewaDefaults(config)
      : key === "almahrusa"
        ? applyAlmahrusaDefaults(config)
        : key === "rewaq"
          ? applyRewaqDefaults(config)
          : config;
  const record = row
    ? toClientRecord({ ...row, config_data: overlay })
    : seed;
  return record ? storefrontClient(record) : null;
}

const PAGE_TITLES: Record<string, (name: string) => string> = {
  storefront: (name) => name,
  book: (name) => `حجز موعد — ${name}`,
  about: (name) => `من نحن — ${name}`,
  services: (name) => `خدماتنا — ${name}`,
  work: (name) => `أعمالنا — ${name}`,
  contact: (name) => `اتصل بنا — ${name}`,
};

export function tenantPageMetadata(
  client: StorefrontClient,
  path: string,
  kind: "storefront" | "book" | "about" | "services" | "work" | "contact" = "storefront"
): Metadata {
  const title = (PAGE_TITLES[kind] || PAGE_TITLES.storefront)(client.name);
  const description =
    client.subtitle ||
    client.tagline ||
    `${client.name}${client.location ? ` — ${client.location}` : ""}`;
  const icon = brandIconPath(client.slug);
  const images = client.heroImage
    ? [{ url: client.heroImage }]
    : isUsableLogoSrc(client.logo)
      ? [{ url: icon }]
      : [{ url: PLATFORM_ICON }];

  const localizedKeywords = [
    client.name,
    client.location ? `${client.name} ${client.location}` : "",
    client.location ? `خدمات ${client.name} في ${client.location}` : "",
    `حجز ${client.name}`,
    `عروض ${client.name}`,
    client.tagline || "",
    client.subtitle || "",
    "حجز أونلاين",
    "المملكة العربية السعودية",
  ].filter(Boolean);

  return {
    title,
    description,
    keywords: localizedKeywords,
    icons: brandMetadataIcons(client.slug),
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      locale: "ar_SA",
      type: "website",
      siteName: SITE_NAME,
      images,
    },
    twitter: {
      card: client.heroImage ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export const SCHEMA_TYPE: Record<StorefrontClient["type"], string> = {
  salon: "HairSalon",
  hotel: "LodgingBusiness",
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",
  commerce: "Store",
  other: "LocalBusiness",
};

/**
 * خريطة تصنيفات الأنشطة التجارية المتخصصة في المملكة العربية السعودية
 * متوافقة بدقة مع مفردات Schema.org للأعمال المحلية وخرائط Google
 */
export const SAUDI_SCHEMA_TYPE_MAP: Record<string, string> = {
  // تجميل وعناية شخصية
  salon: "HairSalon",
  "barber-salon": "BarberShop",
  barber: "BarberShop",
  "spa-wellness": "DaySpa",
  spa: "DaySpa",

  // ضيافة وشقق مفروشة وفنادق
  hotels: "LodgingBusiness",
  hotel: "LodgingBusiness",
  "furnished-apartments": "LodgingBusiness",

  // أغذية ومشروبات
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",

  // رعاية صحية وطبية وبيطرية
  healthcare: "MedicalClinic",
  clinic: "MedicalClinic",
  dentist: "Dentist",
  veterinary: "VeterinaryCare",

  // سيارات وورش وصيانة
  "car-care": "AutoRepair",
  "auto-repair": "AutoRepair",
  "car-wash": "AutoWash",
  maintenance: "HomeAndConstructionBusiness",
  cleaning: "HomeAndConstructionBusiness",
  renovation: "GeneralContractor",

  // خدمات مهنية واستشارية وتقنية
  legal: "LegalService",
  consulting: "ProfessionalService",
  "tech-digital": "ProfessionalService",
  "it-support": "ProfessionalService",
  "app-development": "ProfessionalService",
  training: "EducationalOrganization",
  tutoring: "EducationalOrganization",

  // رياضة ولياقة
  fitness: "HealthClub",
  bodybuilding: "HealthClub",

  // تجارة وتجزئة وسياحة
  commerce: "Store",
  store: "Store",
  tailoring: "LocalBusiness",
  photography: "PhotographyBusiness",
  travel: "TravelAgency",
  events: "EntertainmentBusiness",
  security: "SecurityService",
  other: "LocalBusiness",
};

function parseHour(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
  const [h, m] = text.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function extractNumericPrice(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : undefined;
}

function extractRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5) return value;
  if (typeof value !== "string") return null;
  const num = parseFloat(value.replace(/[^\d.]/g, ""));
  return !isNaN(num) && num >= 1 && num <= 5 ? Math.round(num * 10) / 10 : null;
}

function extractReviewCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d]/g, "");
  const num = parseInt(digits, 10);
  return !isNaN(num) && num > 0 ? num : null;
}

function resolveSchemaType(client: StorefrontClient, config: Record<string, unknown>): string {
  const featured = typeof config.featuredActivity === "string" ? config.featuredActivity.trim().toLowerCase() : "";
  if (featured && SAUDI_SCHEMA_TYPE_MAP[featured]) {
    return SAUDI_SCHEMA_TYPE_MAP[featured];
  }

  const enabledActs = Array.isArray(config.enabledActivities) ? config.enabledActivities : [];
  for (const act of enabledActs) {
    if (typeof act === "string") {
      const key = act.trim().toLowerCase();
      if (SAUDI_SCHEMA_TYPE_MAP[key]) return SAUDI_SCHEMA_TYPE_MAP[key];
    }
  }

  const activity = typeof config.activity === "string" ? config.activity.trim().toLowerCase() : "";
  if (activity && SAUDI_SCHEMA_TYPE_MAP[activity]) {
    return SAUDI_SCHEMA_TYPE_MAP[activity];
  }

  const clientType = String(client.type || "").trim().toLowerCase();
  if (clientType && SAUDI_SCHEMA_TYPE_MAP[clientType]) {
    return SAUDI_SCHEMA_TYPE_MAP[clientType];
  }

  return "LocalBusiness";
}

function buildSaudiOpeningHours(workingHours?: {
  start?: unknown;
  end?: unknown;
  friday?: { start?: unknown; end?: unknown; closed?: boolean };
}) {
  if (!workingHours) return undefined;
  const opens = parseHour(workingHours.start);
  const closes = parseHour(workingHours.end);
  if (!opens || !closes) return undefined;

  const specifications: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string[];
    opens: string;
    closes: string;
  }> = [];

  // السبت إلى الخميس: مواعيد العمل القياسية
  specifications.push({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    opens,
    closes,
  });

  // الجمعة: يراعى فيها خصوصية ساعات العمل في المملكة (غالباً بعد الصلاة أو حسب تخصيص التاجر)
  if (workingHours.friday && workingHours.friday.closed) {
    // يوم الجمعة مغلق — لا يدرج له وقت فتح
  } else {
    const friOpens = parseHour(workingHours.friday?.start) || opens;
    const friCloses = parseHour(workingHours.friday?.end) || closes;
    specifications.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Friday"],
      opens: friOpens,
      closes: friCloses,
    });
  }

  return specifications;
}

interface ExtractedOffer {
  "@type": "Offer";
  itemOffered: {
    "@type": "Service";
    name: string;
    description?: string;
    category?: string;
    provider: {
      "@type": string;
      name: string;
    };
  };
  price?: string;
  priceCurrency: string;
  url: string;
}

function extractTenantOffers(
  config: Record<string, unknown>,
  client: StorefrontClient,
  schemaType: string,
  bookUrl: string
): ExtractedOffer[] {
  const offers: ExtractedOffer[] = [];
  const seenIds = new Set<string>();

  const servicesObj = config.services && typeof config.services === "object" ? config.services : {};
  const enabledList = Array.isArray(config.enabled)
    ? config.enabled.map((e) => String(e).trim())
    : null;

  for (const [key, rawSvc] of Object.entries(servicesObj)) {
    if (!rawSvc || typeof rawSvc !== "object") continue;
    const svc = rawSvc as Record<string, unknown>;
    const id = String(svc.id || key).trim();
    if (enabledList && !enabledList.includes(id)) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title =
      typeof svc.title === "string" && svc.title.trim()
        ? svc.title.trim()
        : typeof svc.name === "string"
          ? svc.name.trim()
          : "";
    if (!title) continue;

    const description = typeof svc.description === "string" && svc.description.trim() ? svc.description.trim() : undefined;
    const category = typeof svc.category === "string" && svc.category.trim() ? svc.category.trim() : undefined;
    const priceStr = extractNumericPrice(svc.price ?? svc.priceLabel);

    offers.push({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: title,
        description,
        category,
        provider: {
          "@type": schemaType,
          name: client.name,
        },
      },
      price: priceStr,
      priceCurrency: "SAR",
      url: `${bookUrl}#service-${id}`,
    });
  }

  if (Array.isArray(config.customServices)) {
    for (const rawSvc of config.customServices) {
      if (!rawSvc || typeof rawSvc !== "object") continue;
      const svc = rawSvc as Record<string, unknown>;
      const id = String(svc.id || "").trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const title =
        typeof svc.title === "string" && svc.title.trim()
          ? svc.title.trim()
          : typeof svc.name === "string"
            ? svc.name.trim()
            : "";
      if (!title) continue;

      const description = typeof svc.description === "string" && svc.description.trim() ? svc.description.trim() : undefined;
      const category = typeof svc.category === "string" && svc.category.trim() ? svc.category.trim() : undefined;
      const priceStr = extractNumericPrice(svc.price ?? svc.priceLabel);

      offers.push({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: title,
          description,
          category,
          provider: {
            "@type": schemaType,
            name: client.name,
          },
        },
        price: priceStr,
        priceCurrency: "SAR",
        url: `${bookUrl}#service-${id}`,
      });
    }
  }

  return offers;
}

interface FaqQuestion {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

function extractTenantFaqs(config: Record<string, unknown>): FaqQuestion[] {
  const faqs: FaqQuestion[] = [];
  const seenQ = new Set<string>();

  const activities =
    config.activities && typeof config.activities === "object"
      ? (config.activities as Record<string, unknown>)
      : {};
  const featured = typeof config.featuredActivity === "string" ? config.featuredActivity.trim() : "";

  const candidateSources: unknown[] = [
    featured && activities[featured] && typeof activities[featured] === "object"
      ? (activities[featured] as { content?: { faq?: unknown } }).content?.faq
      : null,
    config.faq,
    config.faqs,
  ];

  for (const act of Object.values(activities)) {
    if (act && typeof act === "object") {
      const subContent = (act as { content?: { faq?: unknown } }).content;
      if (subContent && subContent.faq) {
        candidateSources.push(subContent.faq);
      }
    }
  }

  for (const source of candidateSources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (!item || typeof item !== "object") continue;
      const q = String(item.q || item.question || "").trim();
      const a = String(item.a || item.answer || "").trim();
      if (q && a && !seenQ.has(q)) {
        seenQ.add(q);
        faqs.push({
          "@type": "Question",
          name: q,
          acceptedAnswer: {
            "@type": "Answer",
            text: a,
          },
        });
      }
    }
  }

  return faqs;
}

interface ExtractedReview {
  "@type": "Review";
  author: {
    "@type": "Person";
    name: string;
  };
  reviewRating: {
    "@type": "Rating";
    ratingValue: number;
    bestRating: 5;
    worstRating: 1;
  };
  reviewBody?: string;
  datePublished?: string;
}

function extractTenantReviews(config: Record<string, unknown>): ExtractedReview[] {
  const reviews: ExtractedReview[] = [];
  const rawList = Array.isArray(config.reviews)
    ? config.reviews
    : Array.isArray(config.testimonials)
      ? config.testimonials
      : [];

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const authorName = String(r.author || r.name || r.customerName || "").trim();
    if (!authorName) continue;

    const rawRating = Number(r.rating || r.stars || r.score || 5);
    const ratingValue = Math.min(5, Math.max(1, Number.isFinite(rawRating) ? rawRating : 5));
    const reviewBody = String(r.text || r.comment || r.quote || r.body || "").trim() || undefined;
    const datePublished = typeof r.date === "string" && r.date.trim() ? r.date.trim() : undefined;

    reviews.push({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: authorName,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody,
      datePublished,
    });

    if (reviews.length >= 10) break;
  }

  return reviews;
}

export async function localBusinessJsonLd(client: StorefrontClient) {
  const key = client.slug.trim().toLowerCase();
  const row = await fetchTenantRow(key);
  const baseConfig = row?.config_data || {};
  const config =
    key === "rewa"
      ? applyRewaDefaults(baseConfig)
      : key === "almahrusa"
        ? applyAlmahrusaDefaults(baseConfig)
        : key === "rewaq"
          ? applyRewaqDefaults(baseConfig)
          : baseConfig;

  const website = await tenantWebsiteUrl(client.slug);
  const area = (config.serviceArea && typeof config.serviceArea === "object" ? config.serviceArea : {}) as {
    center?: { lat?: unknown; lng?: unknown };
  };
  const lat = Number(area.center?.lat);
  const lng = Number(area.center?.lng);
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as {
          workingHours?: {
            start?: unknown;
            end?: unknown;
            friday?: { start?: unknown; end?: unknown; closed?: boolean };
          };
        })
      : {};

  const bookUrl = website.replace(/\/$/, "");
  const schemaType = resolveSchemaType(client, config);
  const ratingVal = extractRating(client.rating);
  const reviewCountVal = extractReviewCount(client.reviewsCount);
  const locationConfig = client.locationConfig || (config.locationConfig as import("@/types/database").TenantLocationConfig | undefined);

  // 1. الكيان الأساسي لنشاط العمل المحلي (LocalBusiness Schema)
  const localBusinessEntity: Record<string, unknown> = {
    "@type": schemaType,
    name: client.name,
    description: client.subtitle || client.tagline || undefined,
    url: website,
    image: client.logo || client.heroImage || undefined,
    telephone: client.phone || undefined,
    priceRange: "$$",
    address: locationConfig?.primaryLocation
      ? {
          "@type": "PostalAddress",
          addressCountry: "SA",
          addressLocality: locationConfig.primaryLocation.city || client.location || "المملكة العربية السعودية",
          streetAddress: locationConfig.primaryLocation.address || locationConfig.primaryLocation.district || undefined,
        }
      : client.location
        ? {
            "@type": "PostalAddress",
            addressCountry: "SA",
            addressLocality: client.location,
          }
        : undefined,
    geo:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
        : undefined,
    hasMap: locationConfig?.primaryLocation?.googleMapsUrl || undefined,
    openingHoursSpecification: buildSaudiOpeningHours(booking.workingHours),
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: bookUrl,
        inLanguage: "ar",
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
      result: { "@type": "Reservation", name: `حجز موعد — ${client.name}` },
    },
  };

  // إدراج نطاق التغطية والمناطق المخدومة (areaServed) لمتاجر الخدمات والمقاولات والتوصيل
  if (locationConfig?.coverageRegions && locationConfig.coverageRegions.length > 0) {
    localBusinessEntity.areaServed = locationConfig.coverageRegions.map((region) => ({
      "@type": "City",
      name: region,
      containedInPlace: {
        "@type": "Country",
        name: "Saudi Arabia",
        alternateName: "المملكة العربية السعودية",
      },
    }));
  }

  // إدراج فروع المنشأة المتعددة (department / subOrganization)
  if (locationConfig?.branches && locationConfig.branches.length > 0) {
    localBusinessEntity.department = locationConfig.branches.map((b) => ({
      "@type": schemaType,
      name: b.name,
      telephone: b.phone || client.phone || undefined,
      address: {
        "@type": "PostalAddress",
        addressLocality: b.city,
        streetAddress: b.address || b.district || undefined,
        addressCountry: "SA",
      },
      hasMap: b.googleMapsUrl || undefined,
    }));
  }

  // 2. إدراج تقييمات العملاء ونجوم الظهور المعتمدة (AggregateRating Schema)
  if (ratingVal !== null) {
    localBusinessEntity.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingVal,
      reviewCount: reviewCountVal || 1,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // 3. إدراج مراجعات وتقييمات العملاء الفردية (Review Schema)
  const reviews = extractTenantReviews(config);
  if (reviews.length > 0) {
    localBusinessEntity.review = reviews;
  }

  // 4. إدراج كتالوج الخدمات والأسعار والعروض (OfferCatalog & Service Schema)
  const offers = extractTenantOffers(config, client, schemaType, bookUrl);
  if (offers.length > 0) {
    localBusinessEntity.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `خدمات وعروض ${client.name}`,
      itemListElement: offers,
    };
  }

  // 5. استخراج الأسئلة الشائعة والأجوبة (FAQPage Schema)
  const faqs = extractTenantFaqs(config);
  const faqEntity =
    faqs.length > 0
      ? {
          "@type": "FAQPage",
          mainEntity: faqs,
        }
      : null;

  // إرجاع بنية الرسم البياني المترابط المعياري (@graph) المعترف بها رسمياً من Google Rich Results
  return {
    "@context": "https://schema.org",
    "@graph": [localBusinessEntity, ...(faqEntity ? [faqEntity] : [])],
  };
}
