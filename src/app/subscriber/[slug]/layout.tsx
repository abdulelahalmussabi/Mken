import type { Metadata } from "next";
import { StorefrontFrame } from "@/components/storefront/StorefrontFrame";
import {
  loadStorefrontSeo,
  localBusinessJsonLd,
  noIndexRobots,
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
  if (client.claimStatus === "unclaimed" || client.claimStatus === "pending") {
    return {
      ...tenantPageMetadata(client, `/subscriber/${client.slug}`),
      robots: noIndexRobots,
      title: `معاينة غير مفهرسة — ${client.name}`,
    };
  }
  return tenantPageMetadata(client, `/subscriber/${client.slug}`);
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
      <StorefrontFrame slug={slug}>{children}</StorefrontFrame>
    </>
  );
}
