"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useOccasion, visitorMarketingKicker, tenantSafeCopy } from "@/context/OccasionContext";
import { OccasionSymbolsStrip } from "@/components/occasions/OccasionSymbolsStrip";
import { isolateTenantHref } from "@/lib/mken/tenant-host";
import { useStorefront, type StorefrontServiceOption } from "@/components/storefront/StorefrontFrame";
import { ServiceCard } from "@/components/storefront/StorefrontSitePage";
import { WhatsappCta } from "@/components/social/NeonSocialIcons";
import { isAdLive, liveAds, type SecondaryAd } from "@/lib/mken/appearance";
import { CalendarCheck, Clock, MapPin, Sparkles, Star } from "lucide-react";

function adToServiceOption(ad: SecondaryAd): StorefrontServiceOption {
  return {
    id: ad.id,
    name: ad.title,
    badge: ad.badge || "حجز",
    price: ad.price || "السعر عند الطلب",
    features: ad.features || [],
    image: ad.image,
    description: ad.text,
  };
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/);
  return match?.[1] || null;
}

export default function SubscriberStorefrontPage() {
  const { copyCoupon, occasionDetails, activeOccasion } = useOccasion();
  const {
    slug,
    storeInfo,
    appearance,
    pages,
    currentServices,
    accentColor,
    isCommerce,
    isHotel,
    isSalon,
    href,
    openBooking,
    whatsappHref,
  } = useStorefront();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const servicesPageOn = pages.enabled.services;
  const featuredIds = pages.home.featuredServiceIds;
  const featured =
    featuredIds.length > 0
      ? currentServices.filter((srv) => featuredIds.includes(srv.id))
      : currentServices.slice(0, 4);
  const gridServices = servicesPageOn
    ? featured
    : selectedCategory === "all"
      ? currentServices
      : currentServices.filter((srv) => srv.id === selectedCategory);
  const servicesHeading =
    appearance?.interfaceCopy?.servicesHeading ||
    (isCommerce ? "المنتجات والخدمات التجارية" : isHotel ? "خيارات الإقامة والخدمات" : "الخدمات المتوفرة");
  const servicesIntro =
    appearance?.interfaceCopy?.servicesIntro ||
    (isCommerce
      ? "اختر المنتج وتصفّح الأسعار واطلب بسهولة."
      : isHotel
        ? "اختر خيار الإقامة المناسب واطّلع على التفاصيل."
        : "اختر الخدمة المطلوبة وتصفح أسعارها واحجز مباشرة.");
  const primaryCta = pages.home.ctaLabel || (isCommerce ? "اطلب الآن" : isHotel ? "احجز إقامتك" : "احجز موعدك");
  const secondaryAds = liveAds(appearance?.ads?.secondary || []);
  const stats =
    pages.home.stats.length > 0
      ? pages.home.stats
      : storeInfo.rating
        ? [
            { label: "التقييم", value: storeInfo.rating },
            { label: "آراء العملاء", value: storeInfo.reviewsCount || "" },
          ].filter((row) => row.value)
        : [];
  const videoUrl = pages.home.heroVideoUrl.trim();
  const yt = videoUrl ? youtubeId(videoUrl) : null;
  const ctaHref = pages.home.ctaHref ? isolateTenantHref(pages.home.ctaHref, slug) : "";

  const primaryAd = appearance?.ads?.primary;
  const promoTitle = tenantSafeCopy(primaryAd?.title || "");
  const promoText = tenantSafeCopy(primaryAd?.text || "");
  const promoCoupon = tenantSafeCopy(primaryAd?.couponCode || "");
  const showPromo = Boolean(
    (primaryAd
      ? isAdLive(primaryAd) && (promoTitle || promoText || promoCoupon)
      : storeInfo.discountEnabled && (promoTitle || promoText || promoCoupon))
  );
  const heroKicker = visitorMarketingKicker({
    activeOccasion,
    shortName: occasionDetails.shortName,
    slogan: occasionDetails.slogan,
    promoTitle,
    isHotel,
    isCommerce,
    isSalon,
  });

  return (
    <>
      {showPromo && (
        <div
          className="w-full py-2.5 px-4 text-center text-xs font-bold border-b border-line flex items-center justify-center gap-2 flex-wrap bg-surface text-foreground"
          style={{
            background: `linear-gradient(90deg, var(--surface) 0%, ${accentColor}25 50%, var(--surface) 100%)`,
          }}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            {promoTitle || occasionDetails.slogan}
            {(promoText || occasionDetails.discountText) ? (
              <>
                {" "}
                — <strong>{promoText || occasionDetails.discountText}</strong>
              </>
            ) : null}
          </span>
          {(promoCoupon || occasionDetails.couponCode) && (
            <button
              type="button"
              onClick={() => copyCoupon(promoCoupon || occasionDetails.couponCode)}
              className="underline text-amber-300 mr-2 hover:opacity-80"
            >
              كود الخصم:{" "}
              <strong className="font-mono">{promoCoupon || occasionDetails.couponCode}</strong>
            </button>
          )}
          {appearance?.ads?.primary?.ctaLabel && appearance.ads.primary.ctaHref && (
            <a href={isolateTenantHref(appearance.ads.primary.ctaHref, slug)} className="underline text-amber-200 mr-2">
              {appearance.ads.primary.ctaLabel}
            </a>
          )}
        </div>
      )}

      <section id="hero" className="relative overflow-hidden pt-12 pb-20 border-b border-line">
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-25"
          style={{ backgroundColor: accentColor }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-line text-foreground text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{heroKicker}</span>
              </div>
              <OccasionSymbolsStrip />
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-5xl font-black text-foreground leading-tight tracking-tight">{storeInfo.name}</h2>
                <p
                  className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent leading-snug"
                  style={{ backgroundImage: `linear-gradient(135deg, var(--foreground) 0%, ${accentColor} 100%)` }}
                >
                  {storeInfo.tagline}
                </p>
              </div>
              <p className="text-base sm:text-lg text-muted leading-relaxed">{storeInfo.subtitle}</p>
              {!servicesPageOn ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                      selectedCategory === "all"
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-surface text-muted border-line"
                    }`}
                  >
                    الخدمات المتوفرة
                  </button>
                  {currentServices.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedCategory(srv.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                        selectedCategory === srv.id
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-surface text-muted border-line"
                      }`}
                    >
                      {srv.badge}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                {ctaHref ? (
                  <a
                    href={ctaHref}
                    className="px-7 py-4 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl flex items-center gap-2"
                    style={{ backgroundColor: accentColor }}
                  >
                    <CalendarCheck className="w-5 h-5" />
                    {primaryCta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openBooking()}
                    className="px-7 py-4 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl flex items-center gap-2"
                    style={{ backgroundColor: accentColor }}
                  >
                    <CalendarCheck className="w-5 h-5" />
                    {primaryCta}
                  </button>
                )}
                <Link
                  href={`/book?tenant=${slug}` as Route}
                  className="px-6 py-4 bg-surface hover:bg-surface-2 text-foreground border border-line font-bold text-base rounded-2xl flex items-center gap-2"
                >
                  <Clock className="w-5 h-5 text-amber-400" />
                  احجز موعد أونلاين
                </Link>
                {whatsappHref ? <WhatsappCta href={whatsappHref} size="lg" /> : null}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden border border-line bg-surface shadow-2xl p-4 space-y-4">
                {yt ? (
                  <iframe
                    title={storeInfo.name}
                    className="w-full h-64 rounded-2xl"
                    src={`https://www.youtube.com/embed/${yt}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : videoUrl ? (
                  <video src={videoUrl} className="w-full h-64 object-cover rounded-2xl" controls poster={storeInfo.heroImage} />
                ) : storeInfo.heroImage ? (
                  <img src={storeInfo.heroImage} alt={storeInfo.name} className="w-full h-64 object-cover rounded-2xl" />
                ) : null}
                <div className="space-y-2 text-right p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {storeInfo.rating} ({storeInfo.reviewsCount})
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {storeInfo.location}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{storeInfo.name} - خيارك الأول</h3>
                  <p className="text-xs text-muted leading-relaxed">{storeInfo.subtitle || storeInfo.tagline}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {stats.length > 0 ? (
        <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="p-5 rounded-2xl bg-surface border border-line text-center">
              <p className="text-xl font-black text-foreground">{item.value}</p>
              <p className="text-[11px] text-muted mt-1">{item.label}</p>
            </div>
          ))}
        </section>
      ) : null}

      {pages.home.partners.length > 0 ? (
        <section className="pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted mb-4">شركاؤنا وأبرز العملاء</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {pages.home.partners.map((item) => (
              <div key={item.name} className="px-4 py-2 rounded-full bg-surface border border-line text-xs font-bold text-foreground">
                {item.image ? <img src={item.image} alt={item.name} className="h-8 inline-block ml-2 rounded" /> : null}
                {item.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {secondaryAds.length > 0 || gridServices.length > 0 ? (
        <section id="services" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground">{servicesHeading}</h2>
            <p className="text-sm text-muted">{servicesIntro}</p>
          </div>
          {secondaryAds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              {secondaryAds.map((ad) => (
                <ServiceCard
                  key={ad.id}
                  srv={adToServiceOption(ad)}
                  accentColor={accentColor}
                  showPrice={pages.services.showPrices}
                  bookLabel={ad.ctaLabel || "احجز هذه الخدمة الآن"}
                  onBook={() => openBooking(adToServiceOption(ad))}
                />
              ))}
            </div>
          ) : null}
          {gridServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {gridServices.map((srv) => (
                <ServiceCard
                  key={srv.id}
                  srv={srv}
                  accentColor={accentColor}
                  showPrice={pages.services.showPrices}
                  detailsHref={servicesPageOn ? `${href("services")}` : undefined}
                  onBook={() => openBooking(srv)}
                />
              ))}
            </div>
          ) : null}
          {appearance?.interfaceCopy?.servicesFooter && !servicesPageOn ? (
            <p className="text-center text-sm text-muted max-w-2xl mx-auto leading-relaxed">
              {appearance.interfaceCopy.servicesFooter}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
