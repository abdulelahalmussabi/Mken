import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontSitePage } from "@/components/storefront/StorefrontSitePage";
import { fetchPages, isToggleablePageId, resolvePageLabel } from "@/lib/mken/pages";
import { loadStorefrontSeo, noIndexRobots, tenantPageMetadata } from "@/lib/mken/seo";

type Props = {
  params: Promise<{ slug: string; page: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  if (!isToggleablePageId(page)) return { title: "الصفحة غير موجودة", robots: noIndexRobots };
  const client = await loadStorefrontSeo(slug);
  if (!client) return { title: "المنشأة غير موجودة", robots: noIndexRobots };
  const { pages } = await fetchPages(slug);
  const enabled = pages?.enabled[page] !== false;
  const label = resolvePageLabel(pages, page);
  if (!enabled) return { title: label, robots: noIndexRobots };
  const robots =
    client.claimStatus === "unclaimed" || client.claimStatus === "pending" ? noIndexRobots : undefined;
  const meta = tenantPageMetadata(client, `/subscriber/${client.slug}/${page}`, page);
  return {
    ...meta,
    title: `${label} — ${client.name}`,
    openGraph: meta.openGraph ? { ...meta.openGraph, title: `${label} — ${client.name}` } : undefined,
    twitter: meta.twitter ? { ...meta.twitter, title: `${label} — ${client.name}` } : undefined,
    ...(robots ? { robots } : {}),
  };
}

export default async function TenantSiteSubpage({ params }: Props) {
  const { slug, page } = await params;
  if (!isToggleablePageId(page)) notFound();
  const { pages } = await fetchPages(slug);
  if (!pages || pages.enabled[page] === false) notFound();
  return <StorefrontSitePage page={page} />;
}
