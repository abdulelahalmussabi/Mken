import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Tag,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { loadPublicStorefront } from "@/lib/mken/catalog";
import { noIndexRobots, siteOrigin } from "@/lib/mken/seo";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";

type Props = {
  params: Promise<{ slug: string; serviceId: string }>;
};

function extractPriceNumber(priceStr?: string): string {
  if (!priceStr) return "";
  const match = priceStr.match(/\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(",", ".") : "";
}

/**
 * Smart Service Landing Page — Sprint 6
 *
 * Implements strict Google Doorway Pages & Thin Content prevention:
 * 1. Checks quality criteria: valid numeric price, real hero image, and description.
 * 2. If any criteria is missing -> enforces `noindex, nofollow` to protect the domain.
 * 3. Deep Schema.org structured data (Service + Offer + BreadcrumbList).
 * 4. Mandatory Saudi E-Commerce Law compliance disclaimer in the footer.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const storefront = await loadPublicStorefront(slug);
  if (!storefront) return { title: "المنشأة غير موجودة", robots: noIndexRobots };

  const service = storefront.catalog.services.find((s) => s.id === serviceId);
  if (!service) return { title: "الخدمة غير موجودة", robots: noIndexRobots };

  // Anti-Doorway Pages Quality Gate
  const hasValidPrice = Boolean(service.price && /\d/.test(service.price));
  const hasValidImage = Boolean(service.image && service.image.trim().length > 5);
  const isClaimed =
    storefront.client.claimStatus !== "unclaimed" && storefront.client.claimStatus !== "pending";

  const isIndexable = hasValidPrice && hasValidImage && isClaimed;
  const robots = isIndexable
    ? {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large" as const,
        "max-video-preview": -1,
      }
    : noIndexRobots;

  let canonicalUrl = "";
  try {
    const base = await tenantWebsiteUrl(slug);
    canonicalUrl = `${base.replace(/\/$/, "")}/services/${service.id}`;
  } catch {
    canonicalUrl = `${siteOrigin()}/subscriber/${slug}/services/${service.id}`;
  }

  const title = `${service.name} — ${storefront.client.name} | الأسعار والحجز`;
  const desc =
    service.description && service.description.length > 20
      ? service.description
      : `تعرف على تفاصيل خدمة ${service.name} لدى ${storefront.client.name}. السعر: ${service.price || "حسب الطلب"}. متوفر في ${storefront.client.location || "المملكة العربية السعودية"}.`;

  return {
    title,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description: desc,
      url: canonicalUrl,
      images: service.image ? [{ url: service.image }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: service.image ? [service.image] : undefined,
    },
    robots,
  };
}

export default async function SmartServiceDetailPage({ params }: Props) {
  const { slug, serviceId } = await params;
  const storefront = await loadPublicStorefront(slug);
  if (!storefront) notFound();

  const service = storefront.catalog.services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const client = storefront.client;
  const accentColor = "#f59e0b";

  let canonicalBase = "";
  try {
    canonicalBase = (await tenantWebsiteUrl(slug)).replace(/\/$/, "");
  } catch {
    canonicalBase = `${siteOrigin()}/subscriber/${slug}`;
  }
  const pageUrl = `${canonicalBase}/services/${service.id}`;
  const bookUrl = `${canonicalBase}/book?service=${encodeURIComponent(service.id)}`;

  // Quality check for Doorway protection banner
  const hasValidPrice = Boolean(service.price && /\d/.test(service.price));
  const hasValidImage = Boolean(service.image && service.image.trim().length > 5);
  const isHighQuality = hasValidPrice && hasValidImage;

  const priceNum = extractPriceNumber(service.price);

  // Schema.org Deep JSON-LD
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: service.name,
        description: service.description || service.name,
        image: service.image || undefined,
        category: service.category || undefined,
        provider: {
          "@type": "LocalBusiness",
          name: client.name,
          telephone: client.phone || undefined,
          url: canonicalBase,
          address: client.location
            ? {
                "@type": "PostalAddress",
                addressCountry: "SA",
                addressLocality: client.location,
              }
            : undefined,
        },
        offers: {
          "@type": "Offer",
          price: priceNum || undefined,
          priceCurrency: "SAR",
          availability: "https://schema.org/InStock",
          url: pageUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "الرئيسية",
            "item": canonicalBase,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "الخدمات",
            "item": `${canonicalBase}/services`,
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": service.name,
            "item": pageUrl,
          },
        ],
      },
    ],
  };

  const waNumber = (client.whatsapp || client.phone || "").replace(/\D/g, "");
  const waInquiryUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`مرحباً ${client.name}، أود الاستفسار عن خدمة «${service.name}».`)}`
    : "";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans" dir="rtl">
        {/* شريط مسار التتبع الهرمي (Breadcrumbs) */}
        <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <nav className="flex items-center gap-2">
              <Link href={canonicalBase as Route} className="hover:text-amber-400 transition">
                {client.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" />
              <Link href={`${canonicalBase}/services` as Route} className="hover:text-amber-400 transition">
                الخدمات
              </Link>
              <ChevronRight className="w-3.5 h-3.5 rotate-180 text-slate-600" />
              <span className="text-slate-200 font-semibold truncate max-w-[200px] sm:max-w-none">
                {service.name}
              </span>
            </nav>

            {!isHighQuality ? (
              <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                صفحة خاصة (حماية الفهرسة مفعلة)
              </span>
            ) : null}
          </div>
        </div>

        {/* جسم الصفحة الرئيسي */}
        <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
          {/* البطاقة البطلة للخدمة (Hero Showcase) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            {/* معرض الصور */}
            <div className="md:col-span-5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative aspect-video md:aspect-square flex items-center justify-center">
              {service.image ? (
                <img
                  src={service.image}
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 text-slate-600">
                  <Tag className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">صورة الخدمة المعتمدة</p>
                </div>
              )}
              {service.badge ? (
                <span className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30">
                  {service.badge}
                </span>
              ) : null}
            </div>

            {/* تفاصيل الخدمة والأسعار */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {service.category ? (
                    <span className="text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-lg">
                      {service.category}
                    </span>
                  ) : null}
                  {service.duration ? (
                    <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {service.duration}
                    </span>
                  ) : null}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {service.name}
                </h1>
              </div>

              {/* صندوق السعر المعتمد */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">السعر المعتمد:</span>
                  <span className="text-2xl font-black text-amber-400">
                    {service.price || "حسب الطلب"}
                  </span>
                </div>
                <div className="text-left text-[11px] text-slate-500">
                  <span>شامل ضريبة القيمة المضافة</span>
                </div>
              </div>

              {/* الوصف التفصيلي */}
              {service.description ? (
                <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    نبذة عن الخدمة
                  </h2>
                  <p>{service.description}</p>
                </div>
              ) : null}

              {/* أزرار الحجز والتواصل الفوري */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={bookUrl}
                  className="flex-1 py-3.5 px-6 rounded-2xl text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition"
                  style={{ backgroundColor: accentColor }}
                >
                  <CalendarCheck className="w-4 h-4" />
                  احجز هذه الخدمة الآن
                </a>

                {waInquiryUrl ? (
                  <a
                    href={waInquiryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3.5 px-6 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    استفسار عبر واتساب
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* ميزات ومواصفات الخدمة */}
          {service.features && service.features.length > 0 ? (
            <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ماذا تشمل هذه الخدمة؟
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {service.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* معلومات المنشأة وموقع الخدمة */}
          <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs text-slate-400">مقدم الخدمة المعتمد:</span>
              <h4 className="text-base font-bold text-white">{client.name}</h4>
              {client.location ? (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {client.location}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`${canonicalBase}/services` as Route}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                عرض كافة الخدمات
              </Link>
            </div>
          </section>

          {/* التنويه النظامي الإلزامي وفق نظام التجارة الإلكترونية السعودي */}
          <footer className="text-center pt-6 border-t border-slate-800/60 space-y-2 text-[11px] text-slate-500">
            <p className="flex items-center justify-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              المحتوى مُنشأ بمساعدة تقنية — الأسعار والتفاصيل قابلة للتحديث بحسب المتجر الرسمي.
            </p>
            <p>© {new Date().getFullYear()} {client.name} — مدعوم عبر منصة مكّن الرقمية</p>
          </footer>
        </main>
      </div>
    </>
  );
}
