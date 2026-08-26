"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import { OccasionSymbolsStrip } from "@/components/occasions/OccasionSymbolsStrip";
import { OccasionThemeSelector } from "@/components/occasions/OccasionThemeSelector";
import type { StorefrontCatalog, StorefrontCatalogService, StorefrontClient, StorefrontKind } from "@/types/database";
import type { AppearancePublic } from "@/lib/mken/appearance";
import { isolateTenantHref } from "@/lib/mken/tenant-host";
import {
  Building2,
  Bed,
  Sparkles,
  Phone,
  CalendarCheck,
  MessageCircle,
  Share2,
  MapPin,
  Star,
  CheckCircle2,
  Download,
  X,
  Scissors,
  User,
  Clock,
  ArrowRight,
  Send,
  Zap,
  Loader2,
} from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  badge: string;
  price: string;
  features: string[];
  image: string;
  popular?: boolean;
}

function catalogServiceToOption(service: StorefrontCatalogService): ServiceOption {
  return {
    id: service.id,
    name: service.name,
    badge: service.badge,
    price: service.price || "السعر عند الطلب",
    features: service.features,
    image: service.image,
    popular: service.popular,
  };
}

export default function SubscriberStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = (resolvedParams.slug || "").trim().toLowerCase();

  const { activeOccasion, occasionDetails, openModal } = useOccasion();
  const { showToast } = useApp();
  const [storeClient, setStoreClient] = useState<StorefrontClient | null>(null);
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [appearance, setAppearance] = useState<AppearancePublic | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!slug) {
      setLoadState("missing");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    setStoreClient(null);
    setCatalog(null);
    setAppearance(null);
    fetch(`/api/clients/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.client && data.catalog) {
          setStoreClient(data.client);
          setCatalog(data.catalog);
          setAppearance(data.appearance || null);
          setLoadState("ready");
        } else {
          setLoadState("missing");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const kind: StorefrontKind = catalog?.kind || "generic";
  const isSalon = kind === "salon";
  const isHotel = kind === "hotel";
  const isCommerce = kind === "commerce";

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAppBanner, setShowAppBanner] = useState<boolean>(true);
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("16:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentServices = (catalog?.services || []).map(catalogServiceToOption);
  const servicesNavLabel = isSalon
    ? "خدمات الصالون"
    : isHotel
      ? "خيارات الإقامة"
      : isCommerce
        ? "المنتجات"
        : "خدماتنا";
  const servicesHeading =
    appearance?.interfaceCopy?.servicesHeading ||
    (isSalon
      ? "خدمات الصالون المتوفرة"
      : isHotel
        ? "خيارات الإقامة والخدمات"
        : isCommerce
          ? "المنتجات والخدمات التجارية"
          : "الخدمات المتوفرة");
  const servicesIntro =
    appearance?.interfaceCopy?.servicesIntro ||
    `اختر الخدمة المطلوبة وتصفح أسعارها واستفد من خصم ${occasionDetails.shortName} المباشر`;
  const servicesFooter = appearance?.interfaceCopy?.servicesFooter || "";
  const primaryCta = isCommerce ? "اطلب الآن" : isHotel ? "احجز إقامتك" : "احجز موعدك";
  const accentColor = appearance?.customTheme?.accentColor || occasionDetails.accentColor;
  const secondaryAds = (appearance?.ads?.secondary || []).filter((ad) => ad.enabled);

  const storeInfo = storeClient
    ? {
        name: storeClient.name,
        tagline: storeClient.tagline || (isCommerce ? "اطلب وتوصيل" : "احجز دون انتظار"),
        subtitle: storeClient.subtitle || "",
        location: storeClient.location || "المملكة العربية السعودية",
        phone: storeClient.phone || "",
        whatsapp: storeClient.whatsapp || "",
        rating: storeClient.rating || "",
        reviewsCount: storeClient.reviewsCount || "",
        heroImage:
          appearance?.ads?.primary?.image ||
          storeClient.heroImage ||
          catalog?.services[0]?.image ||
          "",
        demoNotice: storeClient.demoNotice || `صفحة ${storeClient.name} على منصة مكّن`,
        couponCode: storeClient.couponCode,
        discountText: storeClient.discountText,
        discountEnabled: storeClient.discountEnabled ?? false,
      }
    : null;

  if (loadState === "loading" || !storeInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200">
        {loadState === "missing" ? (
          <>
            <p className="text-lg font-bold">المنشأة غير موجودة</p>
            <p className="text-sm text-slate-400">لا توجد بيانات معزولة للنطاق {slug || "—"}</p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-sm">جاري تحميل بيانات المنشأة…</p>
          </>
        )}
      </div>
    );
  }

  const handleOpenBooking = (srv?: ServiceOption) => {
    setSelectedService(srv || currentServices[0]);
    setBookingModalOpen(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      showToast("يرجى ملء كافة البيانات المطلوب إدخالها", "error");
      return;
    }
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setBookingModalOpen(false);
      showToast(`تم تأكيد طلب حجزك في ${storeInfo.name} بنجاح!`, "success");

      const msg = encodeURIComponent(
        `السلام عليكم، أود تأكيد موعد حجز في *${storeInfo.name}*:\n` +
          `• الخدمة: ${selectedService?.name || "خدمة عامة"}\n` +
          `• السعر: ${selectedService?.price}\n` +
          `• التاريخ والوقت: ${bookingDate || "اليوم"} - الساعة ${bookingTime}\n` +
          `• الاسم: ${clientName}\n` +
          `• الجوال: ${clientPhone}\n` +
          `• كود الخصم المطبق: ${occasionDetails.couponCode} (${occasionDetails.discountText})`
      );
      window.open(`https://wa.me/${storeInfo.whatsapp}?text=${msg}`, "_blank");
    }, 1000);
  };

  const filteredServices =
    selectedCategory === "all"
      ? currentServices
      : currentServices.filter((s) => s.id === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-theme-main text-slate-100 font-sans transition-colors duration-500 relative">
      {/* Top Demo Bar */}
      <div className="w-full py-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 text-white text-xs font-bold text-center flex items-center justify-center gap-2 px-4 shadow-md">
        <span>{storeInfo.demoNotice}</span>
      </div>

      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg transition-transform hover:scale-105 shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {isSalon ? "💈" : isCommerce ? "📦" : "🏢"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-extrabold text-slate-100 tracking-tight whitespace-nowrap leading-none text-[clamp(0.72rem,1.7vw,1.15rem)] max-sm:truncate">
                  {storeInfo.name}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-normal hidden xl:inline-block shrink-0">
                  موقع موثق 🇸🇦
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{storeInfo.tagline}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-full border border-slate-800">
            <a href="#hero" className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white rounded-full hover:bg-slate-800 transition">
              الرئيسية
            </a>
            <a href="#services" className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white rounded-full hover:bg-slate-800 transition">
              {servicesNavLabel}
            </a>
            <Link href={`/book?tenant=${slug}`} className="px-3.5 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full transition flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5" />
              حجز موعد أونلاين
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <OccasionThemeSelector />
            <Link
              href={`/book?tenant=${slug}`}
              className="px-4 py-2 text-xs font-bold text-slate-950 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-1.5"
              style={{ backgroundColor: accentColor }}
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">احجز موعدك أونلاين</span>
              <span className="sm:hidden">احجز</span>
            </Link>

            <a
              href={`https://wa.me/${storeInfo.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">واتساب</span>
            </a>
          </div>
        </div>
      </header>

      {/* Festive Occasion Top Banner */}
      {(appearance?.ads?.primary ? appearance.ads.primary.enabled : storeInfo.discountEnabled !== false) && (
        <div
          className="w-full py-2.5 px-4 text-center text-xs font-bold border-b border-slate-800/80 flex items-center justify-center gap-2 transition-colors duration-500 flex-wrap"
          style={{
            background: `linear-gradient(90deg, rgba(15,23,42,0.95) 0%, ${accentColor}25 50%, rgba(15,23,42,0.95) 100%)`,
          }}
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
          <span>
            {appearance?.ads?.primary?.title || occasionDetails.slogan} —{" "}
            <strong>{appearance?.ads?.primary?.text || storeInfo.discountText || occasionDetails.discountText}</strong>
          </span>
          {(appearance?.ads?.primary?.couponCode || storeInfo.couponCode || occasionDetails.couponCode) && (
            <button onClick={openModal} className="underline text-amber-300 mr-2 hover:opacity-80">
              كود الخصم:{" "}
              <strong className="font-mono">
                {appearance?.ads?.primary?.couponCode || storeInfo.couponCode || occasionDetails.couponCode}
              </strong>
            </button>
          )}
          {appearance?.ads?.primary?.ctaLabel && appearance.ads.primary.ctaHref && (
            <a href={isolateTenantHref(appearance.ads.primary.ctaHref, slug)} className="underline text-amber-200 mr-2">
              {appearance.ads.primary.ctaLabel}
            </a>
          )}
        </div>
      )}

      {/* Main Hero Section */}
      <section id="hero" className="relative overflow-hidden pt-12 pb-20 border-b border-slate-800/60">
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-25 transition-colors duration-500"
          style={{ backgroundColor: accentColor }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Text Content */}
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-bold shadow-lg">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{occasionDetails.shortName} — {occasionDetails.slogan}</span>
              </div>

              <OccasionSymbolsStrip />

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl font-black text-slate-100 leading-tight tracking-tight">
                  {storeInfo.name}
                </h1>
                <p
                  className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent leading-snug"
                  style={{
                    backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${accentColor} 100%)`,
                  }}
                >
                  {storeInfo.tagline}
                </p>
              </div>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
                {storeInfo.subtitle}
              </p>

              {/* Service Badges Filter */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    selectedCategory === "all"
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  الخدمات المتوفرة
                </button>
                {currentServices.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedCategory(srv.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedCategory === srv.id
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    {srv.badge}
                  </button>
                ))}
              </div>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => handleOpenBooking()}
                  className="px-7 py-4 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl transition-transform hover:scale-105 flex items-center gap-2"
                  style={{ backgroundColor: accentColor }}
                >
                  <CalendarCheck className="w-5 h-5" />
                  {primaryCta}
                </button>

                <Link
                  href={`/book?tenant=${slug}`}
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-base rounded-2xl transition flex items-center gap-2"
                >
                  <Clock className="w-5 h-5 text-amber-400" />
                  احجز موعد أونلاين
                </Link>

                <a
                  href={`https://wa.me/${storeInfo.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-4 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/80 rounded-2xl font-bold text-sm transition flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  واتساب
                </a>
              </div>
            </div>

            {/* Hero Image Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-2xl p-4 space-y-4">
                <img
                  src={storeInfo.heroImage}
                  alt={storeInfo.name}
                  className="w-full h-64 object-cover rounded-2xl shadow-md"
                />

                <div className="space-y-2 text-right p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {storeInfo.rating} ({storeInfo.reviewsCount})
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {storeInfo.location}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-100">{storeInfo.name} - خيارك الأول</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {storeInfo.subtitle || storeInfo.tagline}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {secondaryAds.length > 0 && (
        <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secondaryAds.map((ad) => {
              const card = (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden text-right">
                  {ad.image && (
                    <img src={ad.image} alt={ad.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5 space-y-2">
                    <h3 className="text-sm font-extrabold text-white">{ad.title}</h3>
                    {ad.text && <p className="text-xs text-slate-400 leading-relaxed">{ad.text}</p>}
                  </div>
                </div>
              );
              const href = ad.href ? isolateTenantHref(ad.href, slug) : "";
              return href ? (
                <a key={ad.id} href={href}>
                  {card}
                </a>
              ) : (
                <div key={ad.id}>{card}</div>
              );
            })}
          </div>
        </section>
      )}

      {/* Services List Section */}
      <section id="services" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            {servicesHeading}
          </h2>
          <p className="text-sm text-slate-400">
            {servicesIntro}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredServices.map((srv) => (
            <div
              key={srv.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={srv.image}
                    alt={srv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30">
                    {srv.badge}
                  </div>
                  {srv.popular && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      الأكثر طلباً
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4 text-right">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-slate-100">{srv.name}</h3>
                    <span className="text-sm font-black text-amber-400">{srv.price}</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300">
                    {srv.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => handleOpenBooking(srv)}
                  className="w-full py-3 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-transform hover:scale-102 flex items-center justify-center gap-2"
                  style={{ backgroundColor: accentColor }}
                >
                  <CalendarCheck className="w-4 h-4" />
                  احجز هذه الخدمة الآن
                </button>
              </div>
            </div>
          ))}
        </div>
        {servicesFooter && (
          <p className="text-center text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">{servicesFooter}</p>
        )}
      </section>

      {/* Storefront Footer */}
      <footer className="mt-auto bg-slate-950 border-t border-slate-800/80 pt-12 pb-8 text-right">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800/60">
            {/* Store Info Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSalon ? "💈" : isCommerce ? "📦" : "🏢"}
                </div>
                <h3 className="font-extrabold text-lg text-slate-100">{storeInfo.name}</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{storeInfo.tagline}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{storeInfo.subtitle}</p>
            </div>

            {/* Quick Contact Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">تواصل معنا</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{storeInfo.location}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span dir="ltr">{storeInfo.phone}</span>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-sky-400 shrink-0" />
                  <a
                    href={`https://wa.me/${storeInfo.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-emerald-400 transition"
                  >
                    محادثة واتساب مباشرة
                  </a>
                </li>
              </ul>
            </div>

            {/* Admin & Management Link Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">إدارة المنشأة</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                مخصص لمدير المنشأة والموظفين للوصول إلى لوحة التحكّم وتغيير الثيم والإعدادات.
              </p>
              <Link
                href={`/admin/login?client=${slug}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 text-xs font-bold transition hover:border-amber-500/50 shadow-md"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>تسجيل دخول الأدمن / الموظفين</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              جميع الحقوق محفوظة © 2026 {storeInfo.name}
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span>مشغّل بواسطة</span>
              <Link href="/" className="text-slate-400 hover:text-white font-bold transition">
                منصة مكّن 🇸🇦
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating App Install Banner */}
      {showAppBanner && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-slate-700/90 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl space-y-3 animate-fade-in text-right">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => setShowAppBanner(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-100">ثبت التطبيق الخاصة بالمنشأة</span>
                <span className="text-[11px] text-slate-400">وصول أسرع وإشعارات لتذكير بمواعيدك وحجوزاتك</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Download className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAppBanner(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
            >
              لاحقاً
            </button>
            <button
              onClick={() => {
                showToast(`جاري تثبيت تطبيق ${storeInfo.name} على جهازك...`, "success");
                setShowAppBanner(false);
              }}
              className="px-4 py-1.5 text-slate-950 font-bold text-xs rounded-lg shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              تثبيت
            </button>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${storeInfo.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 left-5 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110"
        title="تواصل معنا عبر واتساب"
      >
        <MessageCircle className="w-7 h-7 fill-white text-emerald-500" />
      </a>

      {/* Interactive Booking Modal */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-right relative">
            <button
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
                حجز موعد في {storeInfo.name}
              </h3>
              <p className="text-xs text-slate-400">
                الخدمة المختارة: <strong className="text-amber-300">{selectedService?.name}</strong> ({selectedService?.price})
              </p>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="مثال: محمد الشمري"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال (واتساب) *</label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الوقت المفضل *</label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="14:00">02:00 مساءً</option>
                    <option value="16:00">04:00 مساءً</option>
                    <option value="18:00">06:00 مساءً</option>
                    <option value="20:00">08:00 مساءً</option>
                    <option value="22:00">10:00 مساءً</option>
                  </select>
                </div>
              </div>

              {/* Coupon Discount Info */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                <span>خصم المناسبة ({occasionDetails.shortName}): <strong>{occasionDetails.couponCode}</strong></span>
                <span className="font-bold">{occasionDetails.discountText}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl transition flex items-center justify-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? "جاري إرسال الطلب..." : "تأكيد الحجز ومتابعة عبر الواتساب"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
