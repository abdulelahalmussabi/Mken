import type { Metadata } from "next";
import { StorefrontFrame } from "@/components/storefront/StorefrontFrame";
import SubscriberStorefrontPage from "@/app/subscriber/[slug]/page";
import { loadStorefrontSeo, noIndexRobots, tenantPageMetadata } from "@/lib/mken/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await loadStorefrontSeo(slug);
  if (!client) {
    return { title: "المنشأة غير موجودة", robots: noIndexRobots };
  }
  return tenantPageMetadata(client, `/store/${client.slug}`);
}

export default async function StoreAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <StorefrontFrame slug={slug}>
      <SubscriberStorefrontPage />
    </StorefrontFrame>
  );
}
