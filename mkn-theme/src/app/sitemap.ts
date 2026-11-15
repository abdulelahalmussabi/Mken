import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import { siteOrigin } from "@/lib/mken/seo";
import { fetchTenants, fetchTenantRow } from "@/lib/mken/tenant";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { hostnameFromHeaders } from "@/lib/mken/tenant-host";
import { resolveBoundTenantFromHostname } from "@/lib/mken/bound-host";
import { loadPublicStorefront } from "@/lib/mken/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Multi-level dynamic sitemap generator:
 * 1. Per-Tenant Domain Isolation: If requested on a custom domain (e.g., clinic.sa)
 *    or dedicated subdomain, returns a scoped, high-priority sitemap for that tenant.
 * 2. Canonical SEO Hierarchy: Automatically points to active custom domains
 *    rather than hardcoded /subscriber/ URLs.
 * 3. Bilingual Support: Includes hreflang alternates (ar/en) for Saudi multi-language SEO.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let boundTenant: string | null = null;
  let requestHost = "";

  try {
    const h = await headers();
    requestHost = hostnameFromHeaders(h);
    if (requestHost) {
      boundTenant = await resolveBoundTenantFromHostname(requestHost);
    }
  } catch {
    // Static build fallback
  }

  const now = new Date();

  // 1. إذا كان الطلب قادماً من دومين خاص بمنشأة معينة (e.g. dr-sami.sa or rewa.mken.live)
  if (boundTenant && requestHost) {
    const baseUrl = `https://${requestHost}`.replace(/\/$/, "");
    const tenantRow = await fetchTenantRow(boundTenant);
    const lastMod = tenantRow?.created_at ? new Date(tenantRow.created_at) : now;

    const tenantRoutes: Array<{
      path: string;
      changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
      priority: number;
    }> = [
      { path: "", changeFrequency: "daily", priority: 1.0 },
      { path: "/services", changeFrequency: "weekly", priority: 0.9 },
      { path: "/book", changeFrequency: "daily", priority: 0.9 },
      { path: "/about", changeFrequency: "monthly", priority: 0.7 },
      { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
      { path: "/work", changeFrequency: "weekly", priority: 0.6 },
      { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
      { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    ];

    const tenantPages: MetadataRoute.Sitemap = tenantRoutes.map((route) => {
      const pageUrl = `${baseUrl}${route.path}`;
      return {
        url: pageUrl,
        lastModified: lastMod,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            ar: pageUrl,
            en: route.path ? `${pageUrl}?lang=en` : `${baseUrl}?lang=en`,
          },
        },
      };
    });

    // إضافة صفحات الخدمات الذكية المستوفية لشروط الجودة ومكافحة Doorway Pages
    try {
      const storefront = await loadPublicStorefront(boundTenant);
      for (const service of storefront?.catalog?.services || []) {
        const hasValidPrice = Boolean(service.price && /\d/.test(service.price));
        const hasValidImage = Boolean(service.image && service.image.trim().length > 5);
        if (hasValidPrice && hasValidImage) {
          tenantPages.push({
            url: `${baseUrl}/services/${service.id}`,
            lastModified: lastMod,
            changeFrequency: "weekly",
            priority: 0.8,
            alternates: {
              languages: {
                ar: `${baseUrl}/services/${service.id}`,
                en: `${baseUrl}/services/${service.id}?lang=en`,
              },
            },
          });
        }
      }
    } catch {
      // non-fatal
    }

    return tenantPages;
  }

  // 2. إذا كان الطلب على منصة مكّن الرئيسية (mken.live)
  const origin = siteOrigin();
  const tenants = (await fetchTenants()) ?? DEFAULT_CLIENTS;

  const pages: MetadataRoute.Sitemap = [
    {
      url: origin,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          ar: origin,
          en: `${origin}?lang=en`,
        },
      },
    },
    {
      url: `${origin}/book`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${origin}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  for (const tenant of tenants) {
    if (tenant.claimStatus === "unclaimed" || tenant.claimStatus === "pending") continue;

    // استخراج الدومين الكنسي المخصص للمنشأة
    let canonicalBase = "";
    try {
      canonicalBase = (await tenantWebsiteUrl(tenant.slug)).replace(/\/$/, "");
    } catch {
      canonicalBase = `${origin}/subscriber/${tenant.slug}`;
    }

    // إذا كان للمنشأة دومين خاص، ندرجه بالصيغة الكنسية الكاملة
    if (canonicalBase && !canonicalBase.includes("/subscriber/")) {
      pages.push({
        url: canonicalBase,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
        alternates: {
          languages: {
            ar: canonicalBase,
            en: `${canonicalBase}?lang=en`,
          },
        },
      });

      for (const sub of ["services", "about", "contact", "book"] as const) {
        pages.push({
          url: `${canonicalBase}/${sub}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }

      // إدراج صفحات الخدمات ذات المحتوى المكتمل والمطابقة لمعايير الجودة
      try {
        const storefront = await loadPublicStorefront(tenant.slug);
        for (const service of storefront?.catalog?.services || []) {
          const hasValidPrice = Boolean(service.price && /\d/.test(service.price));
          const hasValidImage = Boolean(service.image && service.image.trim().length > 5);
          if (hasValidPrice && hasValidImage) {
            pages.push({
              url: `${canonicalBase}/services/${service.id}`,
              lastModified: now,
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }
      } catch {
        // non-fatal
      }
    }

    // إدراج مسار المنصة المرجعي (Platform Fallback)
    pages.push({
      url: `${origin}/subscriber/${tenant.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });

    for (const path of ["about", "services", "work", "contact"] as const) {
      pages.push({
        url: `${origin}/subscriber/${tenant.slug}/${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return pages;
}
