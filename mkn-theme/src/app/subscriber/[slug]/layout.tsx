import type { Metadata } from "next";
import { StorefrontFrame } from "@/components/storefront/StorefrontFrame";
import { loadPublicStorefront, withPublicMedia } from "@/lib/mken/catalog";
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
  const storefront = await loadPublicStorefront(slug);
  const initialData = storefront ? withPublicMedia(storefront) : null;
  const jsonLd =
    client && client.claimStatus !== "unclaimed" && client.claimStatus !== "pending"
      ? await localBusinessJsonLd(client)
      : null;

  const seoShell =
    initialData && client ? (
      <noscript>
        <article lang="ar" dir="rtl">
          <h1>{initialData.client.name}</h1>
          {initialData.client.tagline ? <p>{initialData.client.tagline}</p> : null}
          {initialData.client.subtitle ? <p>{initialData.client.subtitle}</p> : null}
          {initialData.client.location ? <p>{initialData.client.location}</p> : null}
          <ul>
            {initialData.catalog.services.slice(0, 12).map((service) => (
              <li key={service.id}>
                {service.name}
                {service.price ? ` — ${service.price}` : ""}
              </li>
            ))}
          </ul>
          {initialData.client.commercialRegistryNumber ? (
            <p>
              السجل التجاري: {initialData.client.commercialRegistryNumber}
              {initialData.client.taxNumber ? ` · الرقم الضريبي: ${initialData.client.taxNumber}` : ""}
            </p>
          ) : null}
        </article>
      </noscript>
    ) : null;

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
      {seoShell}
      <StorefrontFrame slug={slug} initialData={initialData}>
        {children}
      </StorefrontFrame>
    </>
  );
}
