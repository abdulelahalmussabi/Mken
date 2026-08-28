import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontSitePage } from "@/components/storefront/StorefrontSitePage";
import { isPageEnabled, isToggleablePageId, STOREFRONT_PAGE_META } from "@/lib/mken/pages";
import { loadStorefrontSeo, noIndexRobots, tenantPageMetadata } from "@/lib/mken/seo";

type Props = {
  params: Promise<{ slug: string; page: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  if (!isToggleablePageId(page)) return { title: "الصفحة غير موجودة", robots: noIndexRobots };
  const client = await loadStorefrontSeo(slug);
  if (!client) return { title: "المنشأة غير موجودة", robots: noIndexRobots };
  const enabled = await isPageEnabled(slug, page);
  if (!enabled) return { title: STOREFRONT_PAGE_META[page].label, robots: noIndexRobots };
  const robots =
    client.claimStatus === "unclaimed" || client.claimStatus === "pending" ? noIndexRobots : undefined;
  return {
    ...tenantPageMetadata(client, `/subscriber/${client.slug}/${page}`, page),
    ...(robots ? { robots } : {}),
  };
}

export default async function TenantSiteSubpage({ params }: Props) {
  const { slug, page } = await params;
  if (!isToggleablePageId(page)) notFound();
  const enabled = await isPageEnabled(slug, page);
  if (!enabled) notFound();
  return <StorefrontSitePage page={page} />;
}
