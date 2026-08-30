"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import { UnclaimedClaimBanner } from "@/components/MagicPreviewForm";
import {
  STOREFRONT_PAGE_IDS,
  STOREFRONT_PAGE_META,
  emptyPages,
  storefrontPageHref,
  type StorefrontContactPublic,
  type StorefrontPageId,
  type StorefrontPagesPublic,
} from "@/lib/mken/pages";
import type { AppearancePublic } from "@/lib/mken/appearance";
import type {
  StorefrontCatalog,
  StorefrontCatalogService,
  StorefrontClient,
  StorefrontKind,
} from "@/types/database";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { BrandCutout } from "@/components/PlatformMark";
import { useColorScheme } from "@/context/ColorSchemeContext";
import { isUsableLogoSrc } from "@/lib/mken/logo-crop";
import {
  CalendarCheck,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  X,
  Zap,
} from "lucide-react";

export interface StorefrontServiceOption {
  id: string;
  name: string;
  badge: string;
  price: string;
  features: string[];
  image: string;
  description: string;
  popular?: boolean;
}

type LoadState = "loading" | "ready" | "missing";

export interface StorefrontContextValue {
  slug: string;
  pathname: string;
  storeClient: StorefrontClient;
  catalog: StorefrontCatalog;
  appearance: AppearancePublic | null;
  pages: StorefrontPagesPublic;
  contactExtras: StorefrontContactPublic;
  kind: StorefrontKind;
  isSalon: boolean;
  isHotel: boolean;
  isCommerce: boolean;
  accentColor: string;
  servicesNavLabel: string;
  currentServices: StorefrontServiceOption[];
  storeInfo: {
    name: string;
    tagline: string;
    subtitle: string;
    location: string;
    phone: string;
    whatsapp: string;
    rating: string;
    reviewsCount: string;
    heroImage: string;
    logo: string;
    demoNotice: string;
    discountEnabled?: boolean;
  };
  href: (page: StorefrontPageId) => string;
  openBooking: (srv?: StorefrontServiceOption) => void;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) throw new Error("useStorefront must be used inside StorefrontFrame");
  return ctx;
}

function catalogServiceToOption(service: StorefrontCatalogService): StorefrontServiceOption {
  return {
    id: service.id,
    name: service.name,
    badge: service.badge,
    price: service.price || "السعر عند الطلب",
    features: service.features,
    image: service.image,
    description: service.description || "",
    popular: service.popular,
  };
}

export function StorefrontFrame({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const { occasionDetails } = useOccasion();
  const { showToast } = useApp();
  const { setDarkEnabled } = useColorScheme();
  const [storeClient, setStoreClient] = useState<StorefrontClient | null>(null);
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [appearance, setAppearance] = useState<AppearancePublic | null>(null);
  const [pages, setPages] = useState<StorefrontPagesPublic>(emptyPages());
  const [contactExtras, setContactExtras] = useState<StorefrontContactPublic>({
    emails: [],
    social: [],
    hoursStart: "",
    hoursEnd: "",
    map: null,
  });
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [showAppBanner, setShowAppBanner] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<StorefrontServiceOption | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("16:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (appearance) setDarkEnabled(appearance.darkModeEnabled !== false);
  }, [appearance, setDarkEnabled]);

  useEffect(() => {
    return () => setDarkEnabled(true);
  }, [setDarkEnabled]);

  useEffect(() => {
    if (!slug) {
      setLoadState("missing");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    const path = `/api/clients/${encodeURIComponent(slug)}`;
    const platformUrl = `https://www.mken.live${path}`;
    const host = typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "";
    const onPlatform = host === "mken.live" || host === "localhost" || host.endsWith(".localhost");
    const primary = onPlatform ? path : platformUrl;
    const secondary = onPlatform ? platformUrl : path;
    const readJson = (res: Response) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status))));
    const hasLogo = (data: { success?: boolean; client?: { logo?: string }; catalog?: unknown } | null) =>
      Boolean(data?.success && data.client && data.catalog && isUsableLogoSrc(data.client.logo));
    fetch(primary)
      .then(readJson)
      .then((data) => (hasLogo(data) ? data : Promise.reject(new Error("no-logo"))))
      .catch(() => fetch(secondary).then(readJson))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.client && data.catalog) {
          setStoreClient(data.client);
          setCatalog(data.catalog);
          setAppearance(data.appearance || null);
          setPages(data.pages || emptyPages());
          setContactExtras(
            data.contactExtras || {
              emails: [],
              social: [],
              hoursStart: "",
              hoursEnd: "",
              map: null,
            }
          );
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
  const accentColor = appearance?.customTheme?.accentColor || occasionDetails.accentColor;
  const currentServices = (catalog?.services || []).map(catalogServiceToOption);
  const servicesNavLabel = isSalon
    ? "خدمات الصالون"
    : isHotel
      ? "خيارات الإقامة"
      : isCommerce
        ? "المنتجات"
        : "خدماتنا";

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
        logo: storeClient.logo || "",
        demoNotice: storeClient.demoNotice || `صفحة ${storeClient.name} على منصة مكّن`,
        discountEnabled: storeClient.discountEnabled,
      }
    : null;

  const href = (page: StorefrontPageId) => storefrontPageHref(slug, page, pathname);

  useEffect(() => {
    if (!storeInfo?.logo || !isUsableLogoSrc(storeInfo.logo)) return;
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = storeInfo.logo;
    if (storeInfo.logo.startsWith("data:")) {
      const match = storeInfo.logo.match(/^data:([^;]+)/);
      if (match) link.type = match[1];
    }
  }, [storeInfo?.logo]);

  const openBooking = (srv?: StorefrontServiceOption) => {
    setSelectedService(srv || currentServices[0] || null);
    setBookingOpen(true);
  };

  const value = useMemo<StorefrontContextValue | null>(() => {
    if (!storeClient || !catalog || !storeInfo) return null;
    return {
      slug,
      pathname,
      storeClient,
      catalog,
      appearance,
      pages,
      contactExtras,
      kind,
      isSalon,
      isHotel,
      isCommerce,
      accentColor,
      servicesNavLabel,
      currentServices,
      storeInfo,
      href,
      openBooking,
    };
  }, [
    slug,
    pathname,
    storeClient,
    catalog,
    appearance,
    pages,
    contactExtras,
    kind,
    isSalon,
    isHotel,
    isCommerce,
    accentColor,
    servicesNavLabel,
    currentServices,
    storeInfo,
  ]);

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInfo) return;
    if (!clientName.trim() || !clientPhone.trim()) {
      showToast("يرجى ملء كافة البيانات المطلوب إدخالها", "error");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setBookingOpen(false);
      showToast(`تم تأكيد طلب حجزك في ${storeInfo.name} بنجاح!`, "success");
      const msg = encodeURIComponent(
        `السلام عليكم، أود تأكيد موعد حجز في *${storeInfo.name}*:\n` +
          `• الخدمة: ${selectedService?.name || "خدمة عامة"}\n` +
          `• السعر: ${selectedService?.price || ""}\n` +
          `• التاريخ والوقت: ${bookingDate || "اليوم"} - الساعة ${bookingTime}\n` +
          `• الاسم: ${clientName}\n` +
          `• الجوال: ${clientPhone}`
      );
      window.open(`https://wa.me/${storeInfo.whatsapp}?text=${msg}`, "_blank");
    }, 800);
  };

  if (loadState === "loading" || !storeInfo || !value) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        {loadState === "missing" ? (
          <>
            <p className="text-lg font-bold">المنشأة غير موجودة</p>
            <p className="text-sm text-muted">لا توجد بيانات معزولة للنطاق {slug || "—"}</p>
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

  const navItems = STOREFRONT_PAGE_IDS.filter((id) => pages.enabled[id]).map((id) => ({
    id,
    label: id === "services" ? servicesNavLabel : STOREFRONT_PAGE_META[id].label,
    href: href(id),
  }));

  const isActive = (page: StorefrontPageId) => {
    const target = href(page);
    if (page === "home") {
      return pathname === target || pathname === `${target}/`;
    }
    return pathname === target || pathname.endsWith(`/${STOREFRONT_PAGE_META[page].path}`);
  };

  const primaryCta = pages.home.ctaLabel || (isCommerce ? "اطلب الآن" : isHotel ? "احجز إقامتك" : "احجز موعدك");
  const bookHref = `/book?tenant=${slug}`;

  return (
    <StorefrontContext.Provider value={value}>
      <div className="min-h-screen flex flex-col bg-theme-main text-foreground font-sans transition-colors duration-500 relative">
        <div className="w-full py-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 text-white text-xs font-bold text-center flex items-center justify-center gap-2 px-4 shadow-md">
          <span>{storeInfo.demoNotice}</span>
        </div>
        {value.storeClient.claimStatus === "unclaimed" || value.storeClient.claimStatus === "pending" ? (
          <UnclaimedClaimBanner slug={slug} accentColor={accentColor} />
        ) : null}

        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link href={href("home") as Route} className="flex items-center gap-2.5 min-w-0">
                {isUsableLogoSrc(storeInfo.logo) ? (
                  <BrandCutout src={storeInfo.logo} alt={storeInfo.name} className="h-11 sm:h-12 max-w-[4.75rem]" />
                ) : (
                  <div
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSalon ? "💈" : isCommerce ? "📦" : "🏢"}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-extrabold text-foreground tracking-tight whitespace-nowrap leading-none text-[clamp(0.72rem,1.7vw,1.15rem)] max-sm:truncate">
                    {storeInfo.name}
                  </h1>
                  <p className="text-[11px] text-muted font-medium mt-0.5 truncate">{storeInfo.tagline}</p>
                </div>
              </Link>
              <ColorSchemeToggle />
            </div>

            <nav className="hidden lg:flex items-center gap-1 bg-surface/80 p-1.5 rounded-full border border-line">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href as Route}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition ${
                    isActive(item.id)
                      ? "text-foreground bg-surface-2"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={bookHref as Route}
                className="px-3.5 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full transition flex items-center gap-1"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                حجز موعد أونلاين
              </Link>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={bookHref as Route}
                className="px-4 py-2 text-xs font-bold text-slate-950 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-1.5"
                style={{ backgroundColor: accentColor }}
              >
                <CalendarCheck className="w-4 h-4" />
                <span className="hidden sm:inline">احجز موعدك أونلاين</span>
                <span className="sm:hidden">احجز</span>
              </Link>
              {storeInfo.whatsapp ? (
                <a
                  href={`https://wa.me/${storeInfo.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">واتساب</span>
                </a>
              ) : null}
            </div>
          </div>
          <nav className="lg:hidden overflow-x-auto border-t border-line px-3 py-2 flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href as Route}
                className={`shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-full ${
                  isActive(item.id) ? "bg-surface-2 text-foreground" : "text-muted bg-surface/80"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        {children}

        <section className="mt-auto border-t border-line bg-surface/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openBooking()}
              className="px-6 py-3 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <CalendarCheck className="w-4 h-4" />
              {primaryCta}
            </button>
            <Link
              href={bookHref as Route}
              className="px-5 py-3 bg-background border border-line text-foreground font-bold text-sm rounded-2xl"
            >
              احجز موعد أونلاين
            </Link>
            {storeInfo.whatsapp ? (
              <a
                href={`https://wa.me/${storeInfo.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 bg-emerald-700 text-white font-bold text-sm rounded-2xl flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                واتساب
              </a>
            ) : null}
            {pages.enabled.contact ? (
              <Link
                href={href("contact") as Route}
                className="px-5 py-3 bg-surface-2 text-foreground font-bold text-sm rounded-2xl"
              >
                تواصل معنا
              </Link>
            ) : null}
          </div>
        </section>

        <footer className="bg-background border-t border-line pt-12 pb-8 text-right">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-line">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  {isUsableLogoSrc(storeInfo.logo) ? (
                    <BrandCutout src={storeInfo.logo} alt="" className="h-9 max-w-[3.5rem]" />
                  ) : null}
                  <h3 className="font-extrabold text-lg text-foreground">{storeInfo.name}</h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">{storeInfo.tagline}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href as Route}
                      className="text-[11px] text-muted hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-foreground">تواصل معنا</h4>
                <ul className="space-y-2 text-xs text-muted">
                  <li className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{storeInfo.location}</span>
                  </li>
                  {storeInfo.phone ? (
                    <li className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span dir="ltr">{storeInfo.phone}</span>
                    </li>
                  ) : null}
                  {storeInfo.whatsapp ? (
                    <li className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-sky-400 shrink-0" />
                      <a href={`https://wa.me/${storeInfo.whatsapp}`} target="_blank" rel="noreferrer">
                        محادثة واتساب مباشرة
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-foreground">إدارة المنشأة</h4>
                <Link
                  href={`/admin/login?client=${slug}` as Route}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-line text-amber-700 text-xs font-bold"
                >
                  <Zap className="w-4 h-4" />
                  تسجيل دخول الأدمن / الموظفين
                </Link>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
              <div>جميع الحقوق محفوظة © {new Date().getFullYear()} {storeInfo.name}</div>
              <Link href={"/" as Route} className="text-muted hover:text-foreground font-bold">
                مشغّل بواسطة منصة مكّن 🇸🇦
              </Link>
            </div>
          </div>
        </footer>

        {showAppBanner && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-surface/95 border border-line backdrop-blur-2xl rounded-2xl p-4 shadow-2xl space-y-3 text-right">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => setShowAppBanner(false)} className="text-muted hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-foreground">ثبّت تطبيق المنشأة</span>
                  <span className="text-[11px] text-muted">وصول أسرع وتذكير بالمواعيد</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {storeInfo.whatsapp ? (
          <a
            href={`https://wa.me/${storeInfo.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-5 left-5 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-2xl"
            title="تواصل معنا عبر واتساب"
          >
            <MessageCircle className="w-7 h-7 fill-white text-emerald-500" />
          </a>
        ) : null}

        {bookingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
            <div className="bg-surface border border-line rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-right relative">
              <button onClick={() => setBookingOpen(false)} className="absolute top-5 left-5 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
                حجز موعد في {storeInfo.name}
              </h3>
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">الاسم الكامل *</label>
                  <input
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-line rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">رقم الجوال *</label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-line rounded-xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-line rounded-xl text-sm"
                  />
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-line rounded-xl text-sm"
                  >
                    <option value="14:00">02:00 مساءً</option>
                    <option value="16:00">04:00 مساءً</option>
                    <option value="18:00">06:00 مساءً</option>
                    <option value="20:00">08:00 مساءً</option>
                    <option value="22:00">10:00 مساءً</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 text-slate-950 font-extrabold text-sm rounded-xl"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSubmitting ? "جاري إرسال الطلب..." : "تأكيد الحجز ومتابعة عبر الواتساب"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </StorefrontContext.Provider>
  );
}
