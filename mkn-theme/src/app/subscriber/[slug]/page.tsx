"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useOccasion } from "@/context/OccasionContext";
import { OccasionSymbolsStrip } from "@/components/occasions/OccasionSymbolsStrip";
import { isolateTenantHref } from "@/lib/mken/tenant-host";
import { useStorefront } from "@/components/storefront/StorefrontFrame";
import { ServiceCard } from "@/components/storefront/StorefrontSitePage";
import { CalendarCheck, Clock, MapPin, MessageCircle, Sparkles, Star } from "lucide-react";

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/);
  return match?.[1] || null;
}

export default function SubscriberStorefrontPage() {
  const { openModal, occasionDetails } = useOccasion();
  const {
    slug,
    storeInfo,
    appearance,
    pages,
    currentServices,
    accentColor,
    isCommerce,
    isHotel,
    href,
    openBooking,
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
    `اختر الخدمة المطلوبة وتصفح أسعارها واستفد من خصم ${occasionDetails.shortName} المباشر`;
  const primaryCta = pages.home.ctaLabel || (isCommerce ? "اطلب الآن" : isHotel ? "احجز إقامتك" : "احجز موعدك");
  const secondaryAds = (appearance?.ads?.secondary || []).filter((ad) => ad.enabled);
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

  const showPromo = appearance?.ads?.primary ? appearance.ads.primary.enabled : storeInfo.discountEnabled !== false;

  return (
    <>
      {showPromo && (
        <div
          className="w-full py-2.5 px-4 text-center text-xs font-bold border-b border-slate-800/80 flex items-center justify-center gap-2 flex-wrap"
          style={{
            background: `linear-gradient(90deg, rgba(15,23,42,0.95) 0%, ${accentColor}25 50%, rgba(15,23,42,0.95) 100%)`,
          }}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            {appearance?.ads?.primary?.title || occasionDetails.slogan} —{" "}
            <strong>{appearance?.ads?.primary?.text || occasionDetails.discountText}</strong>
          </span>
          {(appearance?.ads?.primary?.couponCode || occasionDetails.couponCode) && (
            <button type="button" onClick={openModal} className="underline text-amber-300 mr-2 hover:opacity-80">
              كود الخصم:{" "}
              <strong className="font-mono">{appearance?.ads?.primary?.couponCode || occasionDetails.couponCode}</strong>
            </button>
          )}
          {appearance?.ads?.primary?.ctaLabel && appearance.ads.primary.ctaHref && (
            <a href={isolateTenantHref(appearance.ads.primary.ctaHref, slug)} className="underline text-amber-200 mr-2">
              {appearance.ads.primary.ctaLabel}
            </a>
          )}
        </div>
      )}

      <section id="hero" className="relative overflow-hidden pt-12 pb-20 border-b border-slate-800/60">
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-25"
          style={{ backgroundColor: accentColor }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {occasionDetails.shortName} — {occasionDetails.slogan}
                </span>
              </div>
              <OccasionSymbolsStrip />
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-5xl font-black text-slate-100 leading-tight tracking-tight">{storeInfo.name}</h2>
                <p
                  className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent leading-snug"
                  style={{ backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${accentColor} 100%)` }}
                >
                  {storeInfo.tagline}
                </p>
              </div>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed">{storeInfo.subtitle}</p>
              {!servicesPageOn ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                      selectedCategory === "all"
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-slate-900 text-slate-300 border-slate-800"
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
                          : "bg-slate-900 text-slate-300 border-slate-800"
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
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-base rounded-2xl flex items-center gap-2"
                >
                  <Clock className="w-5 h-5 text-amber-400" />
                  احجز موعد أونلاين
                </Link>
                {storeInfo.whatsapp ? (
                  <a
                    href={`https://wa.me/${storeInfo.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-4 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-2xl font-bold text-sm flex items-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5 text-emerald-400" />
                    واتساب
                  </a>
                ) : null}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-2xl p-4 space-y-4">
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
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {storeInfo.location}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{storeInfo.name} - خيارك الأول</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{storeInfo.subtitle || storeInfo.tagline}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {stats.length > 0 ? (
        <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <p className="text-xl font-black text-white">{item.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{item.label}</p>
            </div>
          ))}
        </section>
      ) : null}

      {pages.home.partners.length > 0 ? (
        <section className="pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-slate-400 mb-4">شركاؤنا وأبرز العملاء</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {pages.home.partners.map((item) => (
              <div key={item.name} className="px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200">
                {item.image ? <img src={item.image} alt={item.name} className="h-8 inline-block ml-2 rounded" /> : null}
                {item.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {secondaryAds.length > 0 ? (
        <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secondaryAds.map((ad) => {
              const card = (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden text-right">
                  {ad.image ? <img src={ad.image} alt={ad.title} className="w-full h-40 object-cover" /> : null}
                  <div className="p-5 space-y-2">
                    <h3 className="text-sm font-extrabold text-white">{ad.title}</h3>
                    {ad.text ? <p className="text-xs text-slate-400 leading-relaxed">{ad.text}</p> : null}
                  </div>
                </div>
              );
              const adHref = ad.href ? isolateTenantHref(ad.href, slug) : "";
              return adHref ? (
                <a key={ad.id} href={adHref}>
                  {card}
                </a>
              ) : (
                <div key={ad.id}>{card}</div>
              );
            })}
          </div>
        </section>
      ) : null}

      {gridServices.length > 0 ? (
        <section id="services" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">{servicesHeading}</h2>
            <p className="text-sm text-slate-400">{servicesIntro}</p>
          </div>
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
          {appearance?.interfaceCopy?.servicesFooter && !servicesPageOn ? (
            <p className="text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {appearance.interfaceCopy.servicesFooter}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
