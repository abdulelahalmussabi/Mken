import type { Metadata } from "next";
import { DEFAULT_CLIENTS, storefrontClient } from "@/data/default-clients";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";
import { fetchTenantRow, isPlatformSlug, toClientRecord } from "@/lib/mken/tenant";
import type { StorefrontClient } from "@/types/database";

export const SITE_NAME = "مكّن";

export const SITE_DEFAULT_TITLE =
  "منصة مكّن | حزمة واجهات المناسبات السعودية وخدمات Local SEO";

export const SITE_DEFAULT_DESCRIPTION =
  "المنصة الأولى المخصصة لأصحاب المحلات والأنشطة التجارية في المملكة العربية السعودية لتحسين الظهور في خرائط Google بحزمة واجهات تفاعلية للمناسبات الوطنية والدينية.";

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
  const images = client.heroImage ? [{ url: client.heroImage }] : undefined;

  return {
    title,
    description,
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
      images: client.heroImage ? [client.heroImage] : undefined,
    },
  };
}

const SCHEMA_TYPE: Record<StorefrontClient["type"], string> = {
  salon: "HairSalon",
  hotel: "LodgingBusiness",
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",
  other: "LocalBusiness",
};

function parseHour(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
  const [h, m] = text.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

export async function localBusinessJsonLd(client: StorefrontClient) {
  const row = await fetchTenantRow(client.slug);
  const config = row?.config_data || {};
  const website = await tenantWebsiteUrl(client.slug);
  const area = config.serviceArea || {};
  const lat = Number(area.center?.lat);
  const lng = Number(area.center?.lng);
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as { workingHours?: { start?: unknown; end?: unknown } })
      : {};
  const opens = parseHour(booking.workingHours?.start);
  const closes = parseHour(booking.workingHours?.end);
  const bookUrl = website.replace(/\/$/, "");

  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[client.type] || "LocalBusiness",
    name: client.name,
    description: client.subtitle || client.tagline || undefined,
    url: website,
    image: client.logo || client.heroImage || undefined,
    telephone: client.phone || undefined,
    priceRange: "$$",
    address: client.location
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
    openingHoursSpecification:
      opens && closes
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
              opens,
              closes,
            },
          ]
        : undefined,
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
}
