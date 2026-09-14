import type { Metadata } from "next";
import { StorefrontFrame } from "@/components/storefront/StorefrontFrame";
import { TenantMetaPixel } from "@/components/TenantMetaPixel";
import {
  loadStorefrontSeo,
  localBusinessJsonLd,
  noIndexRobots,
  tenantCanonicalUrl,
  tenantPageMetadata,
} from "@/lib/mken/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const client = await loadStorefrontSeo(slug);
  if (!client) {
    return { title: "المنشأة غير موجودة", robots: noIndexRobots };
  }
  const canonical = await tenantCanonicalUrl(client.slug);
  if (client.claimStatus === "unclaimed" || client.claimStatus === "pending") {
    return {
      ...tenantPageMetadata(client, canonical),
      robots: noIndexRobots,
      title: { absolute: `معاينة غير مفهرسة — ${client.name}` },
    };
  }
  return tenantPageMetadata(client, canonical);
}

export default async function SubscriberLayout({ children, params }: Props) {
  const { slug } = await params;
  const client = await loadStorefrontSeo(slug);
  const jsonLd =
    client && client.claimStatus !== "unclaimed" && client.claimStatus !== "pending"
      ? await localBusinessJsonLd(client)
      : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <TenantMetaPixel slug={slug} />
      <StorefrontFrame slug={slug}>{children}</StorefrontFrame>
    </>
  );
}
