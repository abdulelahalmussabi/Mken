import type { Metadata } from "next";
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

export default SubscriberStorefrontPage;
