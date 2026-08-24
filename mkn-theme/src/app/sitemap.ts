import type { MetadataRoute } from "next";
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import { siteOrigin } from "@/lib/mken/seo";
import { fetchTenants } from "@/lib/mken/tenant";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const tenants = (await fetchTenants()) ?? DEFAULT_CLIENTS;

  const pages: MetadataRoute.Sitemap = [
    { url: origin, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${origin}/book`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  for (const tenant of tenants) {
    pages.push({
      url: `${origin}/subscriber/${tenant.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return pages;
}
