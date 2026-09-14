import type { MetadataRoute } from "next";
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { isIndexableStorefront, siteOrigin } from "@/lib/mken/seo";
import { fetchTenants } from "@/lib/mken/tenant";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const tenants = (await fetchTenants()) ?? DEFAULT_CLIENTS;

  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${origin}/book`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${origin}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${origin}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  for (const tenant of tenants) {
    if (!isIndexableStorefront(tenant)) continue;
    const home = (await tenantWebsiteUrl(tenant.slug)).replace(/\/$/, "");
    pages.push({
      url: `${home}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const path of ["about", "services", "work", "contact"] as const) {
      pages.push({
        url: `${home}/${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return pages;
}
