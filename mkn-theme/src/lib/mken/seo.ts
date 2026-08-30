import type { Metadata } from "next";
import { DEFAULT_CLIENTS, storefrontClient } from "@/data/default-clients";
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
  const record = row ? toClientRecord(row) : DEFAULT_CLIENTS.find((client) => client.slug === key);
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

export function localBusinessJsonLd(client: StorefrontClient) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: client.name,
    description: client.subtitle || client.tagline || undefined,
    url: `${siteOrigin()}/subscriber/${client.slug}`,
    image: client.logo || client.heroImage || undefined,
    telephone: client.phone || undefined,
    address: client.location
      ? {
          "@type": "PostalAddress",
          addressCountry: "SA",
          addressLocality: client.location,
        }
      : undefined,
  };
}
