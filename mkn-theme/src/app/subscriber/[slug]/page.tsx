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
import { motion } from "framer-motion";
import { TenantLocationSection } from "@/components/storefront/TenantLocationSection";
import { TenantStatsStrip } from "@/components/storefront/AnimatedStatValue";

const ONEPLUS_EASE = [0.16, 1, 0.3, 1] as const;

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
    storeClient,
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
        <div className="w-full py-3 px-4 text-center text-xs font-bold border-b border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 flex items-center justify-center gap-2 flex-wrap shadow-xs transition-colors">
          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-extrabold">
            {promoTitle || occasionDetails.slogan}
            {(promoText || occasionDetails.discountText) ? (
              <>
                {" "}
                — <span className="font-normal opacity-90">{promoText || occasionDetails.discountText}</span>
              </>
            ) : null}
          </span>
          {(promoCoupon || occasionDetails.couponCode) && (
            <button
              type="button"
              onClick={() => copyCoupon(promoCoupon || occasionDetails.couponCode)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors cursor-pointer mr-2 shadow-xs"
              title="انقر لنسخ كود الخصم"
            >
              <span>كود الخصم:</span>
              <strong className="font-mono font-black">{promoCoupon || occasionDetails.couponCode}</strong>
            </button>
          )}
          {appearance?.ads?.primary?.ctaLabel && appearance.ads.primary.ctaHref && (
            <a
              href={isolateTenantHref(appearance.ads.primary.ctaHref, slug)}
              className="underline text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 font-bold mr-2 transition-colors"
            >
              {appearance.ads.primary.ctaLabel}
            </a>
          )}
        </div>
      )}

      <section id="hero" className="relative overflow-hidden pt-12 pb-20 border-b border-line bg-background">
        {/* Dynamic Multi-Layered Ambient Mesh Background Orbs */}
        <div
          className="ambient-glow-orb-primary -top-24 right-1/4 -z-10 opacity-60"
          style={{ background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)` }}
        />
        <div
          className="ambient-glow-orb-secondary top-1/3 left-6 -z-10 opacity-45"
          style={{ background: `radial-gradient(circle, ${accentColor}25 0%, transparent 70%)` }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ONEPLUS_EASE }}
              className="lg:col-span-7 space-y-6 text-right"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-[#141417]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-zinc-200 text-xs font-bold shadow-xs">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{heroKicker}</span>
              </div>
              <OccasionSymbolsStrip />
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">{storeInfo.name}</h2>
                <p
                  className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent leading-snug"
                  style={{ backgroundImage: `linear-gradient(135deg, var(--foreground) 0%, ${accentColor} 100%)` }}
                >
                  {storeInfo.tagline}
                </p>
              </div>
              <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 leading-relaxed">{storeInfo.subtitle}</p>
              {!servicesPageOn ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      selectedCategory === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent shadow-sm"
                        : "bg-white/80 dark:bg-[#141417] text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-slate-300"
                    }`}
                  >
                    الخدمات المتوفرة
                  </button>
                  {currentServices.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedCategory(srv.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        selectedCategory === srv.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent shadow-sm"
                          : "bg-white/80 dark:bg-[#141417] text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-white/10 hover:border-slate-300"
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
                    className="px-7 py-4 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/20 ring-1 ring-white/20 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: accentColor || "var(--primary-accent)" }}
                  >
                    <CalendarCheck className="w-5 h-5" />
                    {primaryCta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openBooking()}
                    className="px-7 py-4 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/20 ring-1 ring-white/20 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: accentColor || "var(--primary-accent)" }}
                  >
                    <CalendarCheck className="w-5 h-5" />
                    {primaryCta}
                  </button>
                )}
                <Link
                  href={`/book?tenant=${slug}` as Route}
                  className="px-6 py-4 bg-white/90 dark:bg-[#141417] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 font-bold text-base rounded-2xl flex items-center gap-2 shadow-xs transition-colors backdrop-blur-xl"
                >
                  <Clock className="w-5 h-5 text-amber-500" />
                  احجز موعد أونلاين
                </Link>
                {whatsappHref ? <WhatsappCta href={whatsappHref} size="lg" /> : null}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: ONEPLUS_EASE }}
              className="lg:col-span-5"
            >
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className="relative rounded-3xl overflow-hidden bg-white/90 dark:bg-[#141417]/85 backdrop-blur-2xl border-t border-emerald-400/35 border-x border-b border-slate-200/80 dark:border-white/10 shadow-2xl shadow-slate-900/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] p-4 space-y-4 spotlight-card"
                style={{
                  borderTopColor: `${accentColor}55`,
                  "--spotlight-color": `${accentColor}18`,
                } as React.CSSProperties}
              >
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
                <div className="space-y-3 text-right p-2 relative z-10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {storeInfo.rating} ({storeInfo.reviewsCount})
                    </span>
                    <a
                      href="#tenant-locations"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold transition-all shadow-xs cursor-pointer group"
                      title="الانتقال إلى خريطة المواقع والفروع ونطاق الخدمة"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span>{storeInfo.location.split(/[-–,]/)[0]?.trim() || "مواقعنا وفروعنا"}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">| الخريطة والفروع ↓</span>
                    </a>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{storeInfo.name} - خيارك الأبرز ووجهتك المفضلة</h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{storeInfo.subtitle || storeInfo.tagline}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <TenantStatsStrip stats={stats} accentColor={accentColor} />

      {pages.home.partners.length > 0 ? (
        <section className="pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-slate-500 dark:text-zinc-400 mb-4">شركاؤنا وأبرز العملاء</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {pages.home.partners.map((item) => (
              <div key={item.name} className="px-4 py-2 rounded-full bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-zinc-200 shadow-xs">
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
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-[1.35]">{servicesHeading}</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">{servicesIntro}</p>
          </div>
          {secondaryAds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              {secondaryAds.map((ad, idx) => (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, delay: idx * 0.1, ease: ONEPLUS_EASE }}
                >
                  <ServiceCard
                    srv={adToServiceOption(ad)}
                    accentColor={accentColor}
                    showPrice={pages.services.showPrices}
                    bookLabel={ad.ctaLabel || "احجز هذه الخدمة الآن"}
                    onBook={() => openBooking(adToServiceOption(ad))}
                  />
                </motion.div>
              ))}
            </div>
          ) : null}
          {gridServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {gridServices.map((srv, idx) => (
                <motion.div
                  key={srv.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, delay: idx * 0.1, ease: ONEPLUS_EASE }}
                >
                  <ServiceCard
                    srv={srv}
                    accentColor={accentColor}
                    showPrice={pages.services.showPrices}
                    detailsHref={servicesPageOn ? `${href("services")}` : undefined}
                    onBook={() => openBooking(srv)}
                  />
                </motion.div>
              ))}
            </div>
          ) : null}
          {appearance?.interfaceCopy?.servicesFooter && !servicesPageOn ? (
            <p className="text-center text-sm text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              {appearance.interfaceCopy.servicesFooter}
            </p>
          ) : null}
        </section>
      ) : null}

      <TenantLocationSection />
    </>
  );
}
