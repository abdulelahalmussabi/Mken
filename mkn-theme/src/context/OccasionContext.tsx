"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { slugFromCustomHostname } from "@/lib/mken/tenant-host";

export type OccasionId =
  | "none"
  | "ramadan"
  | "eid_fitr"
  | "eid_adha"
  | "national_day"
  | "founding_day"
  | "flag_day"
  | "back_to_school"
  | "white_friday";

export type OccasionGroup = "base" | "national" | "religious" | "commercial";

export interface OccasionDetails {
  id: OccasionId;
  name: string;
  shortName: string;
  slogan: string;
  couponCode: string;
  discountText: string;
  accentColor: string;
  badgeBg: string;
  bgGradient: string;
  greetingTemplate: (name: string) => string;
  countdownText: string;
  targetDate: string;
  stickers: string[];
  description: string;
  historicNote: string;
  group: OccasionGroup;
  officialSymbols: string[];
}

export const SAUDI_OCCASIONS: Record<OccasionId, OccasionDetails> = {
  none: {
    id: "none",
    name: "المظهر القياسي (منصة مكّن)",
    shortName: "القياسي",
    slogan: "تحسين ظهور أنشطتك التجارية على خرائط قوقل",
    couponCode: "MKN10",
    discountText: "خصم 10% على أول طلب تحسين محلي",
    accentColor: "#c2410c",
    badgeBg: "bg-orange-500/15 text-orange-800 border-orange-500/25",
    bgGradient: "from-[#f2f0eb] via-[#fbf9f4] to-[#ebe7df]",
    greetingTemplate: (name) => `مرحباً بك أستاذ ${name} في لوحة التحكم`,
    countdownText: "الخدمة متاحة على مدار 24 ساعة",
    targetDate: "2026-12-31T23:59:59",
    stickers: ["مرحباً بك", "شكراً للتواصل", "تم استلام الطلب", "بالتوفيق"],
    description: "الهوية الأساسية لمنصة مكّن: أبيض مطفي دافئ، حبر حجري، وتمييز تراكوتا. الثيم الداكن اختياري من زر الوضع.",
    historicNote: "تصميم عصري متناسق لجميع الأوقات والأيام العادية.",
    group: "base",
    officialSymbols: [],
  },
  ramadan: {
    id: "ramadan",
    name: "شهر رمضان المبارك 🌙",
    shortName: "رمضان المبارك",
    slogan: "مبارك عليكم الشهر الكريم - نفحات الخير والبركة",
    couponCode: "RAMADAN2026",
    discountText: "خصم 30% رمضاني على كافة خدمات تحسين الخرائط وإدارة التقييمات",
    accentColor: "#fbbf24",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    bgGradient: "from-blue-950 via-slate-950 to-amber-950/30",
    greetingTemplate: (name) => `رمضان مبارك أستاذ ${name}! تقبل الله طاعتكم وصيامكم.`,
    countdownText: "متبقي على موعد الإفطار / السحور",
    targetDate: "2026-03-10T18:30:00",
    stickers: ["مبارك عليكم الشهر 🌙", "تقبل الله طاعتكم ✨", "رمضان كريم 🏮", "مسجد وهلال 🕌"],
    description: "ثيم رمضاني بالكحلي والتذهيب: هلال، نجوم، وفوانيس رمضان.",
    historicNote: "رموز رمضانية شائعة في الخليج: الهلال والنجوم والفوانيس — دون ادعاء هوية حكومية رسمية.",
    group: "religious",
    officialSymbols: ["الهلال", "النجوم", "فانوس رمضان"],
  },
  eid_fitr: {
    id: "eid_fitr",
    name: "عيد الفطر السعيد 🎈",
    shortName: "عيد الفطر",
    slogan: "عساكم من عواده - بهجة العيد وفرحة الإنجاز",
    couponCode: "EIDFITR26",
    discountText: "عيدية مكّن: خصم 25% + تحسين مجاني إضافي للصور والكلمات",
    accentColor: "#f97316",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    bgGradient: "from-purple-950 via-slate-950 to-orange-950/40",
    greetingTemplate: (name) => `كل عام وأنت بخير أستاذ ${name}! تقبل الله منا ومنكم.`,
    countdownText: "متبقي على أيام عيد الفطر المبارك",
    targetDate: "2026-04-09T06:00:00",
    stickers: ["عيدكم مبارك 🍬", "حلويات العيد 🍭", "فرحة العيد 🎉", "كل عام وأنتم بخير 💖"],
    description: "ثيم عيد الفطر بحلويات العيد: معمول، كعك، كنافة، بقلاوة، وقهوة عربية.",
    historicNote: "رمزية العيد في الخليج مرتبطة بضيافة الحلويات والقهوة أكثر من البالونات.",
    group: "religious",
    officialSymbols: ["معمول", "كعك العيد", "كنافة", "بقلاوة", "قهوة عربية"],
  },
  eid_adha: {
    id: "eid_adha",
    name: "عيد الأضحى المبارك 🕋",
    shortName: "عيد الأضحى",
    slogan: "حج مبرور وذنب مغفور - عساكم من حجاجه وزواره",
    couponCode: "ADHA2026",
    discountText: "خصم 35% بمناسبة عيد الأضحى على الباقات الشاملة للأنشطة التجارية",
    accentColor: "#eab308",
    badgeBg: "bg-emerald-900/40 text-yellow-300 border-yellow-500/40",
    bgGradient: "from-emerald-950 via-slate-950 to-yellow-950/30",
    greetingTemplate: (name) => `عيد أضحى مبارك أستاذ ${name}! جعلنا الله وإياكم من المقبولين.`,
    countdownText: "متبقي على وقفة عرفة وعيد الأضحى المبارك",
    targetDate: "2026-06-16T05:00:00",
    stickers: ["حج مبرور 🕋", "عيد أضحى مبارك 🐑", "تقبل الله أضحيتكم 🐐", "كل عام وأنتم بخير 🐪"],
    description: "ثيم عيد الأضحى: الكعبة المشرفة مع رأس الخروف كرمز للأضحية، بأخضر الكسوة والذهب.",
    historicNote: "الكعبة رمز الحج، ورأس الخروف رمز الأضحية — دون استخدام شهادة التوحيد كزخرفة.",
    group: "religious",
    officialSymbols: ["الكعبة", "رأس الخروف / الأضحية"],
  },
  national_day: {
    id: "national_day",
    name: "اليوم الوطني السعودي 96 🇸🇦",
    shortName: "اليوم الوطني 96",
    slogan: "عزّنا بطبعنا",
    couponCode: "KSA96",
    discountText: "عروض اليوم الوطني: خصم 40% حصري لجميع أصحاب المحلات في المملكة",
    accentColor: "#5aba1c",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    bgGradient: "from-emerald-950 via-slate-950 to-green-950/40",
    greetingTemplate: (name) => `عزّنا بطبعنا — مرحباً بك أستاذ ${name} في يوم الفخر.`,
    countdownText: "متبقي على احتفالات اليوم الوطني السعودي 96 (23 سبتمبر)",
    targetDate: "2026-09-23T00:00:00",
    stickers: ["عزّنا بطبعنا 🇸🇦", "اليوم الوطني 🎆", "أخضر وأبيض 💚", "فخر الوطن ✨"],
    description: "هوية الهيئة العامة للترفيه 95–96 «عزّنا بطبعنا»: كرم الضيافة (دلة قهوة عربية وفناجين)، خريطة المملكة، نقوش نسيج تقليدي، وفزعة.",
    historicNote: "المصدر: nd.gea.gov.sa ودليل SND. الشعار اللفظي لعامين (95 و96). لا ننسخ ملف الشعار الرسمي؛ نستخدم رموزه المعلنة.",
    group: "national",
    officialSymbols: ["الدلة والفناجين", "خريطة المملكة", "حب القهوة والهيل", "نقوش النسيج التقليدي", "رمز الفزعة (تكاتف)"],
  },
  founding_day: {
    id: "founding_day",
    name: "يوم التأسيس السعودي 🦅",
    shortName: "يوم التأسيس",
    slogan: "يوم بدينا",
    couponCode: "FOUNDING1727",
    discountText: "باقة يوم التأسيس: خصم 30% مع توثيق احترافي ونقوش تراثية",
    accentColor: "#d97706",
    badgeBg: "bg-amber-900/40 text-amber-200 border-amber-600/40",
    bgGradient: "from-amber-950 via-slate-950 to-amber-950/50",
    greetingTemplate: (name) => `يوم بدينا! أهلاً بك أستاذ ${name} في ذكرى ثلاثة قرون من العز.`,
    countdownText: "متبقي على احتفالية يوم التأسيس (22 فبراير)",
    targetDate: "2026-02-22T00:00:00",
    stickers: ["يوم بدينا 🦅", "خيل وشموخ 🐎", "نخلة وراية 🌴", "التأسيس 🚩"],
    description: "هوية يوم التأسيس «يوم بدينا»: العلم، النخلة، الصقر، الخيل العربي، والسوق — بألوان البني والبيج والأسود.",
    historicNote: "المصدر: foundingday.sa ودارة الملك عبدالعزيز. خمسة رموز محيطة بأيقونة حامل الراية. خط الشعار مستلهم من المخطوطات.",
    group: "national",
    officialSymbols: ["العلم السعودي", "النخلة / التمر", "الصقر", "الخيل العربي", "السوق"],
  },
  flag_day: {
    id: "flag_day",
    name: "يوم العلم السعودي 🟢",
    shortName: "يوم العلم",
    slogan: "راية التوحيد — عدل وقوة ونماء",
    couponCode: "FLAGDAY26",
    discountText: "خصم 20% احتفاءً براية الوطن الخضراء وشهادة التوحيد",
    accentColor: "#34d399",
    badgeBg: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    bgGradient: "from-teal-950 via-slate-950 to-emerald-950/40",
    greetingTemplate: (name) => `راية الفخر ترفرف! أهلاً بك أستاذ ${name} في يوم العلم السعودي.`,
    countdownText: "متبقي على احتفالية يوم العلم السعودي (11 مارس)",
    targetDate: "2026-03-11T00:00:00",
    stickers: ["راية التوحيد 🇸🇦", "يوم العلم 📜", "أخضر النماء 💚", "أبيض السلام 🤍"],
    description: "يوم العلم: الأخضر للنماء، الأبيض للسلام، والسيف للعدل والقوة. لا نستخدم الشهادة كنص زخرفي عائم.",
    historicNote: "أمر ملكي 1444هـ: 11 مارس يوم العلم. الدليل الإرشادي لوزارة الثقافة. العلم لا يُنكس.",
    group: "national",
    officialSymbols: ["الأخضر", "الأبيض", "السيف المسلول", "العلم السعودي"],
  },
  back_to_school: {
    id: "back_to_school",
    name: "العودة للمدارس 📚",
    shortName: "العودة للمدارس",
    slogan: "نكتب قصة",
    couponCode: "SCHOOL26",
    discountText: "باقات العودة للدراسة: مستلزمات وحجوزات عائلية بخصم موسمي",
    accentColor: "#0ea5e9",
    badgeBg: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    bgGradient: "from-sky-950 via-slate-950 to-amber-950/30",
    greetingTemplate: (name) => `نكتب قصة — بالتوفيق أستاذ ${name} في موسم العودة للدراسة.`,
    countdownText: "موسم العودة للمدارس (أغسطس – سبتمبر)",
    targetDate: "2026-08-23T00:00:00",
    stickers: ["نكتب قصة ✏️", "العودة بحقيبة 🎒", "دفتر وقلم 📝", "سنة دراسية موفقة 📖"],
    description: "موسم تجاري وتعليمي. وزارة التعليم 1448هـ أطلقت هوية «نكتب قصة». رموز: حقيبة، قلم، كتاب.",
    historicNote: "ليست عطلة سيادية كالوطني/التأسيس/العلم، لكنها موسم رسمي لوزارة التعليم وسوق التجزئة (زي، قرطاسية، إلكترونيات).",
    group: "commercial",
    officialSymbols: ["الحقيبة", "القلم", "الكتاب", "الحافلة المدرسية"],
  },
  white_friday: {
    id: "white_friday",
    name: "الجمعة البيضاء 🛍️",
    shortName: "الجمعة البيضاء",
    slogan: "أقوى عروض السنة — آخر جمعة في نوفمبر",
    couponCode: "WHITE26",
    discountText: "تخفيضات الجمعة البيضاء على الباقات والاشتراكات لفترة محدودة",
    accentColor: "#f8fafc",
    badgeBg: "bg-white/15 text-slate-100 border-white/40",
    bgGradient: "from-slate-950 via-black to-rose-950/40",
    greetingTemplate: (name) => `الجمعة البيضاء وصلت — عروضك جاهزة أستاذ ${name}.`,
    countdownText: "متبقي على الجمعة البيضاء (آخر جمعة من نوفمبر)",
    targetDate: "2026-11-27T00:00:00",
    stickers: ["الجمعة البيضاء 🛒", "عروض وخصم 🏷️", "ادفع بسهولة 💳", "عرض ينتهي ❗"],
    description: "موسم تجزئة خليجي (مقابل Black Friday). أسود/أبيض ووسوم السعر والسلّة — بلا هوية حكومية.",
    historicNote: "موسم تسويق تجاري قوي في السعودية، ليس يوماً وطنياً. مناسب لصالونات ومتاجر تريد حملة خصم آخر نوفمبر.",
    group: "commercial",
    officialSymbols: ["كيس التسوق", "وسم الخصم %", "بطاقة السعر", "السلّة"],
  },
};

/** Placeholder copy for tenant promo fields — visitor-facing, never platform SEO. */
export const VISITOR_PROMO_HINT = {
  title: "عرض الأسبوع — خصم على أول زيارة",
  text: "خصم 20% على أول حجز أونلاين",
  coupon: "SALE20",
};

function isPlatformMarketingCopy(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  const none = SAUDI_OCCASIONS.none;
  if (
    text === none.slogan ||
    text === none.discountText ||
    text === none.couponCode ||
    text === none.shortName ||
    text === none.name
  ) {
    return true;
  }
  return /خرائط\s*(قوقل|جوجل)|تحسين محلي|طلب تحسين/.test(text);
}

export function tenantSafeCopy(value: string): string {
  const text = value.trim();
  return isPlatformMarketingCopy(text) ? "" : text;
}

/**
 * Hero kicker on a tenant site. Speaks to the visitor (book / order / occasion),
 * never the platform pitch ("القياسي", Google Maps SEO, MKN10).
 */
export function visitorMarketingKicker(opts: {
  activeOccasion: OccasionId;
  shortName: string;
  slogan: string;
  promoTitle?: string;
  isHotel?: boolean;
  isCommerce?: boolean;
  isSalon?: boolean;
}): string {
  const promo = tenantSafeCopy(opts.promoTitle || "");
  const greeting = tenantSafeCopy(opts.slogan);
  const isOccasion = opts.activeOccasion !== "none";

  if (promo) {
    return isOccasion ? `${opts.shortName} — ${promo}` : promo;
  }
  if (isOccasion && (greeting || opts.slogan.trim())) {
    return `${opts.shortName} — ${greeting || opts.slogan.trim()}`;
  }
  if (opts.isCommerce) return "اطلب أونلاين — توصيل لبابك";
  if (opts.isHotel) return "احجز إقامتك — تأكيد فوري";
  if (opts.isSalon) return "احجز موعدك اليوم — بدون انتظار";
  return "اطلب خدمتك اليوم — رد سريع عبر واتساب";
}

interface OccasionContextType {
  activeOccasion: OccasionId;
  setOccasion: (id: OccasionId) => void;
  occasionDetails: OccasionDetails;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  copyCoupon: (code: string) => void;
  isMounted: boolean;
  isAdminControlled: boolean; // true if theme is set by admin
  currentSlug: string | null;
}

const PLATFORM_DEFAULT: OccasionId = "none";

function isOccasionId(value: unknown): value is OccasionId {
  return typeof value === "string" && value in SAUDI_OCCASIONS;
}

const SKIP_HOSTS = new Set(["www", "admin", "mken", "license", "licenses", "api"]);

function slugFromPath(pathname: string | null): string | null {
  const subscriberMatch = pathname?.match(/^\/subscriber\/([^/]+)/);
  const storeMatch = pathname?.match(/^\/store\/([^/]+)/);
  const slug = subscriberMatch?.[1] || storeMatch?.[1] || null;
  return slug && slug !== "_mken_platform" ? slug.toLowerCase() : null;
}

function slugFromQuery(searchParams: { get(name: string): string | null } | null): string | null {
  const raw = searchParams?.get("tenant") || searchParams?.get("store") || searchParams?.get("client");
  const slug = raw?.trim().toLowerCase();
  if (!slug || slug === "_mken_platform") return null;
  return slug;
}

function slugFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname.toLowerCase();
  const known = slugFromCustomHostname(hostname);
  if (known) return known;
  if (!hostname.includes("mken.live")) return null;
  const parts = hostname.split(".");
  if (parts.length <= 2) return null;
  let head = parts[0];
  if (head === "www" && parts.length >= 4) head = parts[1];
  if (SKIP_HOSTS.has(head) || head === "_mken_platform") return null;
  return head;
}

const OccasionContext = createContext<OccasionContextType | undefined>(undefined);

export const OccasionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [previewId, setPreviewId] = useState<OccasionId | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [adminGlobalTheme, setAdminGlobalTheme] = useState<OccasionId>(PLATFORM_DEFAULT);
  const [tenantTheme, setTenantTheme] = useState<OccasionId | null>(null);
  const [skipPlatformFallback, setSkipPlatformFallback] = useState(false);
  const [hostSlug, setHostSlug] = useState<string | null>(null);
  const [adCopy, setAdCopy] = useState<{ title: string; text: string; coupon: string }>({
    title: "",
    text: "",
    coupon: "",
  });

  useEffect(() => {
    const local = slugFromHost();
    if (local) {
      setHostSlug(local);
      return;
    }

    const hostname = window.location.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".mken.live") ||
      hostname === "mken.live"
    ) {
      setHostSlug(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/domains/resolve?host=${encodeURIComponent(hostname)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && typeof data.slug === "string") {
          setHostSlug(data.slug);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Host binding wins. On rewa.care the browser path is "/" (rewritten), and a
  // leaked /subscriber/almahrusa must not become the active tenant.
  const currentSlug = hostSlug || slugFromPath(pathname) || slugFromQuery(searchParams);

  useEffect(() => {
    setIsMounted(true);
    let cancelled = false;
    fetch("/api/platform/theme")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        if (isOccasionId(data.theme)) setAdminGlobalTheme(data.theme);
      })
      .catch(() => {});

    const onPlatformTheme = (event: Event) => {
      const theme = (event as CustomEvent).detail;
      if (isOccasionId(theme)) setAdminGlobalTheme(theme);
    };
    window.addEventListener("mken-platform-theme", onPlatformTheme);

    return () => {
      cancelled = true;
      window.removeEventListener("mken-platform-theme", onPlatformTheme);
    };
  }, []);

  useEffect(() => {
    setPreviewId(null);
    setTenantTheme(null);
    setSkipPlatformFallback(false);
    setAdCopy({ title: "", text: "", coupon: "" });
    if (!currentSlug) return;

    let cancelled = false;
    fetch(`/api/clients/${encodeURIComponent(currentSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        const resolved = data.appearance?.resolvedTheme || data.client?.theme;
        const kind = data.appearance?.themeKind;
        if (kind === "occasion" && isOccasionId(resolved) && resolved !== "none") {
          setTenantTheme(resolved);
          setSkipPlatformFallback(true);
        } else if (kind === "custom" || kind === "none" || data.appearance) {
          setTenantTheme("none");
          setSkipPlatformFallback(true);
        } else if (isOccasionId(resolved) && resolved !== "none") {
          setTenantTheme(resolved);
          setSkipPlatformFallback(true);
        }
        const primary = data.appearance?.ads?.primary;
        const enabled = primary?.enabled !== false && data.client?.discountEnabled !== false;
        setAdCopy(
          enabled
            ? {
                title: String(primary?.title || data.client?.promoTitle || "").trim(),
                text: String(primary?.text || data.client?.discountText || "").trim(),
                coupon: String(primary?.couponCode || data.client?.couponCode || "").trim(),
              }
            : { title: "", text: "", coupon: "" }
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  const activeOccasion: OccasionId = (() => {
    if (isOccasionId(previewId)) return previewId;
    if (currentSlug && skipPlatformFallback) {
      return isOccasionId(tenantTheme) && tenantTheme !== "none" ? tenantTheme : PLATFORM_DEFAULT;
    }
    if (currentSlug && isOccasionId(tenantTheme)) return tenantTheme;
    if (adminGlobalTheme && adminGlobalTheme !== "none") return adminGlobalTheme;
    return PLATFORM_DEFAULT;
  })();

  const isAdminControlled = Boolean(currentSlug && tenantTheme) || (!currentSlug && adminGlobalTheme !== "none");

  const setOccasion = (id: OccasionId) => {
    setPreviewId(id);
    if (typeof document !== "undefined") {
      if (id === "none") {
        document.documentElement.removeAttribute("data-occasion");
      } else {
        document.documentElement.setAttribute("data-occasion", id);
      }
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (activeOccasion === "none") {
        document.documentElement.removeAttribute("data-occasion");
      } else {
        document.documentElement.setAttribute("data-occasion", activeOccasion);
      }
    }
  }, [activeOccasion]);

  const copyCoupon = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  const occasionDetails = useMemo(() => {
    const base = SAUDI_OCCASIONS[activeOccasion] || SAUDI_OCCASIONS.none;
    const onTenant = Boolean(currentSlug);
    if (!onTenant) {
      return {
        ...base,
        slogan: adCopy.title || base.slogan,
        discountText: adCopy.text || base.discountText,
        couponCode: adCopy.coupon || base.couponCode,
      };
    }

    const isStandard = activeOccasion === "none";
    return {
      ...base,
      slogan: tenantSafeCopy(adCopy.title) || (isStandard ? "" : base.slogan),
      discountText: tenantSafeCopy(adCopy.text),
      couponCode: tenantSafeCopy(adCopy.coupon),
    };
  }, [activeOccasion, adCopy, currentSlug]);

  return (
    <OccasionContext.Provider
      value={{
        activeOccasion,
        setOccasion,
        occasionDetails,
        showModal,
        openModal,
        closeModal,
        copyCoupon,
        isMounted,
        isAdminControlled,
        currentSlug,
      }}
    >
      {children}
    </OccasionContext.Provider>
  );
};

export const useOccasion = () => {
  const context = useContext(OccasionContext);
  if (!context) throw new Error("useOccasion must be used within an OccasionProvider");
  return context;
};
