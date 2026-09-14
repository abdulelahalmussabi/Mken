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
  "منصة مكّن | فوترة زاتكا وواتساب CRM وربط خرائط جوجل";

export const SITE_DEFAULT_DESCRIPTION =
  "منصة سعودية متعددة المستأجرين: فواتير إلكترونية متوافقة مع الزكاة، واتساب CRM وحجز مواعيد، وموقع منشأة مربوط بخرائط جوجل — مع معاينة فورية بموافقة المالك.";

export const noIndexRobots: Metadata["robots"] = { index: false, follow: false };

export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return canonicalizePlatformOrigin(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/$/, "");
  if (vercel) return canonicalizePlatformOrigin(`https://${vercel}`);
  return "https://www.mken.live";
}

function canonicalizePlatformOrigin(raw: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.hostname === "mken.live") url.hostname = "www.mken.live";
    return url.origin;
  } catch {
    return "https://www.mken.live";
  }
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

const SKIP_SITEMAP_SLUGS = new Set(["demo", "default"]);

export function isIndexableStorefront(
  tenant: { slug: string; claimStatus?: string | null }
): boolean {
  const slug = tenant.slug.trim().toLowerCase();
  if (!slug || isPlatformSlug(slug) || SKIP_SITEMAP_SLUGS.has(slug)) return false;
  return tenant.claimStatus !== "unclaimed" && tenant.claimStatus !== "pending";
}

/** Public URL crawlers should treat as the page identity (subdomain or custom host). */
export async function tenantCanonicalUrl(slug: string, page?: string): Promise<string> {
  const base = (await tenantWebsiteUrl(slug)).replace(/\/$/, "");
  const suffix = (page || "").replace(/^\/+|\/+$/g, "");
  if (!suffix || suffix === "storefront") return `${base}/`;
  return `${base}/${suffix}`;
}

function toE164Sa(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 9) return `+966${digits.slice(1)}`;
  if (digits.length === 9) return `+966${digits}`;
  return `+${digits}`;
}

function absoluteHttpUrl(origin: string, src?: string | null): string | undefined {
  const value = (src || "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function tenantPageMetadata(
  client: StorefrontClient,
  canonicalUrl: string,
  kind: "storefront" | "book" | "about" | "services" | "work" | "contact" = "storefront"
): Metadata {
  const title = (PAGE_TITLES[kind] || PAGE_TITLES.storefront)(client.name);
  const description =
    client.subtitle ||
    client.tagline ||
    `${client.name}${client.location ? ` — ${client.location}` : ""}`;
  const origin = (() => {
    try {
      return new URL(canonicalUrl).origin;
    } catch {
      return siteOrigin();
    }
  })();
  const image =
    absoluteHttpUrl(origin, client.heroImage) ||
    (isUsableLogoSrc(client.logo) ? absoluteHttpUrl(origin, client.logo) : undefined) ||
    absoluteHttpUrl(origin, PLATFORM_ICON) ||
    PLATFORM_ICON;
  const images = [{ url: image }];

  return {
    metadataBase: new URL(`${origin}/`),
    title: { absolute: title },
    description,
    icons: brandMetadataIcons(client.slug),
    keywords: [client.name, client.location, "السعودية"].filter(Boolean),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      locale: "ar_SA",
      type: "website",
      siteName: client.name,
      images,
    },
    twitter: {
      card: client.heroImage ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((item) => item.url),
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
  const origin = website.replace(/\/$/, "");
  const area = config.serviceArea || {};
  const lat = Number(area.center?.lat);
  const lng = Number(area.center?.lng);
  const city = typeof area.city === "string" ? area.city.trim() : "";
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as { workingHours?: { start?: unknown; end?: unknown } })
      : {};
  const opens = parseHour(booking.workingHours?.start);
  const closes = parseHour(booking.workingHours?.end);
  const image =
    absoluteHttpUrl(origin, client.logo) ||
    absoluteHttpUrl(origin, client.heroImage) ||
    absoluteHttpUrl(origin, brandIconPath(client.slug));
  const street =
    client.location && city && client.location.trim() !== city
      ? client.location.trim()
      : client.location?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[client.type] || "LocalBusiness",
    name: client.name,
    description: client.subtitle || client.tagline || undefined,
    url: website,
    image,
    telephone: toE164Sa(client.phone || client.whatsapp || ""),
    address:
      street || city
        ? {
            "@type": "PostalAddress",
            addressCountry: "SA",
            ...(city ? { addressLocality: city } : {}),
            ...(street ? { streetAddress: street } : {}),
          }
        : undefined,
    geo:
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0
        ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
        : undefined,
    openingHoursSpecification:
      opens && closes
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: [
                "Saturday",
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
              ],
              opens,
              closes,
            },
          ]
        : undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/book`,
        inLanguage: "ar",
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
      result: { "@type": "Reservation", name: `حجز موعد — ${client.name}` },
    },
  };
}
