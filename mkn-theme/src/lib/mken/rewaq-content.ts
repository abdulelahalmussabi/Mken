import type { MkenConfig } from "@/lib/mken/tenant";

/** Exact Google Business name — keep NAP in sync with Maps. Distinct from منتجع رواء (`rewa`). */
export const REWAQ_NAME = "Rewaq Resident | رواق ريزدنت";
export const REWAQ_TAGLINE = "شقق مفروشة في مذينب، المدينة المنورة — حجز مباشر";
export const REWAQ_SUBTITLE =
  "شقق مفروشة مجهزة في حي مذينب بالمدينة المنورة 42317 — واي فاي ومطبخ صغير وتكييف وموقف سيارات. تسجيل الوصول من 16:00.";
export const REWAQ_PHONE = "0541303411";
export const REWAQ_WHATSAPP = "966541303411";
export const REWAQ_EMAIL = "rewaqresident@gmail.com";
export const REWAQ_LOCATION = "اسيد بن كعب، مذينب، المدينة المنورة 42317";
export const REWAQ_MAP_CITY = "المدينة المنورة";
export const REWAQ_MAP_CENTER = { lat: 24.4358546, lng: 39.6748747 };
export const REWAQ_MAPS_URL = "https://www.google.com/maps?cid=2595755909754175028";
export const REWAQ_RATING = "4.8";
export const REWAQ_REVIEWS = "105 تقييم على Google";
export const REWAQ_PLUS_CODE = "CMPF+8W المدينة المنورة";
export const REWAQ_LICENSE = "50031490";

const STALE_PHONES = new Set(["", "0551234567", "551234567", "966551234567", "966543530333", "0543530333"]);
const STALE_NAMES = new Set(["رواق", "rewaq", "rewa", "منتجع رواء الاستشفاء الرقمي"]);
const GENERIC_TITLES = new Set(["غرفة قياسية", "غرفة ديلوكس", "جناح فندقي", "جناح عائلي"]);

export const REWAQ_IDENTITY_THEME = {
  id: "custom-rewaq",
  name: "هوية رواق ريزدنت",
  accentColor: "#7A4E2D",
  badgeBg: "#C4A35A",
  bgGradient: "#1C1410",
};

export const REWAQ_SERVICE_IDS = ["deluxe-room", "suite-room", "standard-room", "family-suite"] as const;

export const REWAQ_LIVE_PHOTOS = {
  hero: "/rewaq/hero.web.jpg",
  deluxe: "/rewaq/deluxe.web.jpg",
  suite: "/rewaq/suite.web.jpg",
  standard: "/rewaq/standard.web.jpg",
  family: "/rewaq/family.web.jpg",
};

const PRICE = "السعر عند الطلب";

export const REWAQ_SERVICE_OVERRIDES: Record<
  string,
  {
    icon: string;
    title: string;
    shortTitle: string;
    description: string;
    features: string[];
    category: string;
    heroImage: string;
  }
> = {
  "deluxe-room": {
    icon: "🏨",
    title: "شقة مفروشة",
    shortTitle: "شقة",
    description: "وحدة مفروشة في رواق ريزدنت بمذينب — تكييف وواي فاي ومطبخ صغير.",
    features: ["مفروشة بالكامل", "مطبخ صغير", "واي فاي مجاني", "تكييف"],
    category: "شقق مفروشة",
    heroImage: REWAQ_LIVE_PHOTOS.deluxe,
  },
  "suite-room": {
    icon: "🛏️",
    title: "جناح إقامة",
    shortTitle: "جناح",
    description: "جناح أوسع داخل رواق ريزدنت — جلسة ومطبخ صغير وتكييف.",
    features: ["جلسة", "مطبخ صغير", "تكييف", "واي فاي"],
    category: "أجنحة",
    heroImage: REWAQ_LIVE_PHOTOS.suite,
  },
  "standard-room": {
    icon: "🔑",
    title: "غرفة مفروشة",
    shortTitle: "غرفة",
    description: "غرفة مفروشة بحمام خاص في حي مذينب — تكييف وواي فاي.",
    features: ["حمام خاص", "تكييف", "واي فاي", "موقف سيارات"],
    category: "غرف",
    heroImage: REWAQ_LIVE_PHOTOS.standard,
  },
  "family-suite": {
    icon: "👨‍👩‍👧‍👦",
    title: "شقة عائلية",
    shortTitle: "عائلي",
    description: "شقة مفروشة مناسبة للعائلات في المدينة المنورة 42317 — مطبخ صغير وموقف.",
    features: ["مساحة عائلية", "مطبخ صغير", "واي فاي", "موقف سيارات"],
    category: "عائلي",
    heroImage: REWAQ_LIVE_PHOTOS.family,
  },
};

export const REWAQ_PROMO_ADS = [
  {
    id: "rewaq-ad-stay",
    enabled: true,
    title: "إقامة في رواق ريزدنت",
    text: "شقق مفروشة في مذينب، المدينة المنورة — احجز مباشرة عبر واتساب 054 130 3411.",
    image: REWAQ_LIVE_PHOTOS.hero,
    href: "",
    features: ["مذينب", "واي فاي", "مطبخ صغير", "موقف سيارات"],
    badge: "حجز مباشر",
    price: PRICE,
    ctaLabel: "احجز إقامتك",
    startDate: "",
    endDate: "",
  },
];

export const REWAQ_PAGES = {
  enabled: { home: true, about: true, services: true, work: true, contact: true },
  labels: {
    home: "",
    about: "عن رواق ريزدنت",
    services: "خيارات الإقامة",
    work: "صور الوحدات",
    contact: "الحجز والتواصل",
  },
  home: {
    ctaLabel: "احجز إقامتك",
    ctaHref: "",
    featuredServiceIds: ["deluxe-room", "suite-room", "standard-room"],
    stats: [
      { label: "تقييم Google", value: REWAQ_RATING },
      { label: "آراء الضيوف", value: "105" },
      { label: "الحي", value: "مذينب" },
      { label: "استقبال", value: "يومي" },
    ],
  },
  about: {
    story:
      "رواق ريزدنت (Rewaq Resident) شقق مفروشة في حي مذينب بالمدينة المنورة 42317، على شارع أسيد بن كعب. الحساب على خرائط جوجل باسم Rewaq Resident | رواق ريزدنت، والترخيص 50031490.",
    vision: "إقامة واضحة للضيف في المدينة المنورة، بحجز مباشر دون وسيط.",
    mission: "وحدات مفروشة جاهزة، تواصل واتساب على الرقم الظاهر في خرائط جوجل.",
    values: [
      { title: "موقع موثّق", text: "نفس الاسم والجوال والعنوان الظاهرين على خرائط جوجل." },
      { title: "حي مذينب", text: "اسيد بن كعب، المدينة المنورة 42317 — Plus Code CMPF+8W." },
      { title: "حجز مباشر", text: "من الموقع أو واتساب 054 130 3411." },
    ],
    credentials: [
      { title: "خرائط جوجل", text: "تقييم 4.8 من 105 مراجعات — Rewaq Resident | رواق ريزدنت." },
      { title: "الترخيص", text: "رقم الترخيص 50031490." },
    ],
  },
  services: {
    showPrices: true,
    processSteps: [
      { title: "اختر الوحدة", text: "شقة مفروشة، جناح، غرفة، أو شقة عائلية." },
      { title: "حدد تاريخ الوصول", text: "تسجيل الوصول من الساعة 16:00 حتى 23:30 والمغادرة حتى 12:00." },
      { title: "أكّد عبر واتساب", text: "تواصل على 054 130 3411 واستلم تأكيد الإقامة." },
    ],
  },
  work: {
    gallery: [
      { image: REWAQ_LIVE_PHOTOS.hero, caption: "مدخل رواق ريزدنت" },
      { image: REWAQ_LIVE_PHOTOS.deluxe, caption: "غرفة مفروشة" },
      { image: REWAQ_LIVE_PHOTOS.suite, caption: "غرفة سريرين" },
      { image: REWAQ_LIVE_PHOTOS.standard, caption: "جناح بغرفة نوم" },
      { image: REWAQ_LIVE_PHOTOS.family, caption: "وحدة إقامة" },
      { image: "/rewaq/bath.web.jpg", caption: "حمام خاص" },
    ],
    cases: [
      {
        title: "حجز مباشر من خرائط جوجل",
        challenge: "الضيف يجد رواق ريزدنت على الخرائط ويحتاج تأكيد إقامة دون وسيط.",
        solution: "الموقع rewaq.mken.live مع رقم 054 130 3411 الظاهر في بطاقة الخرائط.",
        result: "مسار واحد: الخرائط → الموقع أو واتساب → تأكيد الوحدة.",
      },
    ],
    testimonials: [
      {
        name: "ضيف عبر Google",
        text: "التقييم الظاهر على الخرائط 4.8 من 105 مراجعة.",
        rating: "5",
      },
    ],
  },
  contact: {
    formEnabled: true,
    mapEnabled: true,
    hoursNote:
      "تسجيل الوصول من 16:00 حتى 23:30 — المغادرة حتى 12:00. للحجز واتساب 054 130 3411. العنوان: اسيد بن كعب، مذينب، المدينة المنورة 42317 — CMPF+8W.",
  },
};

export function rewaqStorefrontMap() {
  return {
    lat: REWAQ_MAP_CENTER.lat,
    lng: REWAQ_MAP_CENTER.lng,
    city: REWAQ_MAP_CITY,
    mapsUrl: REWAQ_MAPS_URL,
  };
}

export function hasRewaqIdentityTheme(config: MkenConfig): boolean {
  const raw = config.customThemes;
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    const id = typeof item.id === "string" ? item.id : "";
    const name = typeof item.name === "string" ? item.name : "";
    return id === REWAQ_IDENTITY_THEME.id || name.includes("رواق ريزدنت");
  });
}

export function isStaleRewaqPhone(value: unknown): boolean {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return true;
  return STALE_PHONES.has(digits) || STALE_PHONES.has(String(value || "").trim());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isUnsplash(value: string): boolean {
  return /unsplash\.com|images\.unsplash/i.test(value);
}

function isPlaceholderPhoto(value: string): boolean {
  if (!value.trim() || isUnsplash(value) || /googleusercontent\.com/i.test(value)) return true;
  return /\/rewaq\//i.test(value) && !/\.web\.jpg/i.test(value);
}

function pagesStory(config: MkenConfig): string {
  const pages = asRecord(config.pages);
  const about = asRecord(pages.about);
  return typeof about.story === "string" ? about.story.trim() : "";
}

function fillRewaqSocial(social: unknown): Record<string, { enabled?: boolean; value?: string }> {
  const next =
    social && typeof social === "object" && !Array.isArray(social)
      ? { ...(social as Record<string, { enabled?: boolean; value?: string }>) }
      : {};
  const saved = typeof next.whatsapp?.value === "string" ? next.whatsapp.value.trim() : "";
  next.whatsapp = {
    enabled: true,
    value: isStaleRewaqPhone(saved) ? REWAQ_WHATSAPP : saved,
  };
  return next;
}

export function applyRewaqDefaults(config: MkenConfig): MkenConfig {
  const next: MkenConfig = { ...config };
  const brand = { ...(next.brand || {}) };
  const currentName = typeof brand.name === "string" ? brand.name.trim() : "";
  if (!currentName || STALE_NAMES.has(currentName) || currentName.includes("رواء الاستشفاء")) {
    brand.name = REWAQ_NAME;
  }
  if (!brand.tagline || /قريبة من الحرم|رواء\.\./.test(brand.tagline)) brand.tagline = REWAQ_TAGLINE;
  next.brand = brand;

  if (isStaleRewaqPhone(next.phone)) next.phone = REWAQ_PHONE;
  if (!next.subtitle || /قريبة من الحرم|طب بديل/.test(String(next.subtitle))) next.subtitle = REWAQ_SUBTITLE;
  if (!next.location || /جدة|الحماوات/.test(String(next.location))) next.location = REWAQ_LOCATION;
  next.rating = next.rating && next.rating !== "0" ? next.rating : REWAQ_RATING;
  next.reviewsCount = next.reviewsCount || REWAQ_REVIEWS;
  next.mapsUrl = REWAQ_MAPS_URL;
  next.heroImage = REWAQ_LIVE_PHOTOS.hero;
  next.adminEmail = REWAQ_EMAIL;

  next.social = fillRewaqSocial(next.social);
  const emails = asRecord(next.emails);
  const inquiries = asRecord(emails.inquiries);
  const savedEmail = typeof inquiries.value === "string" ? inquiries.value.trim() : "";
  next.emails = {
    ...emails,
    inquiries: {
      enabled: true,
      value: savedEmail === REWAQ_EMAIL || savedEmail.includes("@gmail.com") ? savedEmail || REWAQ_EMAIL : REWAQ_EMAIL,
    },
  };

  const currentArea = asRecord(next.serviceArea);
  next.serviceArea = {
    ...currentArea,
    enabled: true,
    displayOnHomepage: true,
    city: REWAQ_MAP_CITY,
    center: { ...REWAQ_MAP_CENTER },
    radiusKm: 12,
    coverageNote: `${REWAQ_LOCATION} — ${REWAQ_PLUS_CODE}`,
    showAsFullCity: true,
  };

  next.enabledActivities = ["hotels"];
  next.enabled = [...REWAQ_SERVICE_IDS];
  next.featuredActivity = "hotels";
  next.featured = "deluxe-room";

  const activities = asRecord(next.activities);
  const hotels = asRecord(activities.hotels);
  activities.hotels = {
    ...hotels,
    icon: "🏨",
    title: "شقق مفروشة",
    shortTitle: "إقامة",
    tagline: "احجز في رواق ريزدنت بمذينب",
    description: REWAQ_SUBTITLE,
  };
  next.activities = activities;

  const services = asRecord(next.services);
  for (const [id, override] of Object.entries(REWAQ_SERVICE_OVERRIDES)) {
    const current = asRecord(services[id]);
    const title = typeof current.title === "string" ? current.title.trim() : "";
    services[id] = {
      ...current,
      icon: override.icon,
      title: !title || GENERIC_TITLES.has(title) ? override.title : title,
      shortTitle: override.shortTitle,
      description: override.description,
      features: override.features,
      category: override.category,
      stayUnit: "night",
      heroImage: override.heroImage,
    };
  }
  next.services = services;

  const emptyPages = !pagesStory(next);
  const currentPages = asRecord(next.pages);
  next.pages = {
    ...currentPages,
    ...(emptyPages ? REWAQ_PAGES : {}),
    home: emptyPages ? { ...asRecord(currentPages.home), ...REWAQ_PAGES.home } : currentPages.home,
    about: emptyPages ? { ...asRecord(currentPages.about), ...REWAQ_PAGES.about } : currentPages.about,
    work: {
      ...asRecord(currentPages.work),
      gallery: REWAQ_PAGES.work.gallery,
    },
  };

  if (!hasRewaqIdentityTheme(next)) {
    const existing = Array.isArray(next.customThemes) ? next.customThemes : [];
    next.customThemes = [REWAQ_IDENTITY_THEME, ...existing];
  }

  const pack = asRecord(next.occasionPack);
  next.occasionPack = {
    ...pack,
    forceId: REWAQ_IDENTITY_THEME.id,
    mode: "manual",
    enabled: false,
  };

  next.interfaceCopy = {
    servicesHeading: "خيارات الإقامة في رواق ريزدنت",
    servicesIntro: "شقق مفروشة في مذينب، المدينة المنورة 42317.",
    servicesFooter: "للحجز: 054 130 3411 — اسيد بن كعب، مذينب",
  };

  const currentAds = next.ads || {};
  const secondary = Array.isArray(currentAds.secondary) ? [...currentAds.secondary] : [];
  const existingIds = new Set(secondary.map((item) => (item && item.id) || "").filter(Boolean));
  const refreshedSecondary = secondary.map((item) => {
    if (!item || typeof item !== "object") return item;
    const image = typeof item.image === "string" ? item.image : "";
    if (!isPlaceholderPhoto(image)) return item;
    const seed = REWAQ_PROMO_ADS.find((ad) => ad.id === item.id);
    return seed ? { ...item, image: seed.image } : item;
  });
  for (const seed of REWAQ_PROMO_ADS) {
    if (!existingIds.has(seed.id)) refreshedSecondary.push({ ...seed });
  }
  const primary = currentAds.primary || {};
  next.ads = {
    ...currentAds,
    primary: {
      enabled: primary.enabled === true,
      title: primary.title || "احجز في رواق ريزدنت",
      text: primary.text || "شقق مفروشة بمذينب — واتساب 054 130 3411",
      image: REWAQ_LIVE_PHOTOS.hero,
      ctaLabel: primary.ctaLabel || "احجز إقامتك",
      ctaHref: primary.ctaHref || "",
      couponCode: primary.couponCode || "",
    },
    secondary: refreshedSecondary,
  };

  next.booking = {
    ...(asRecord(next.booking) as MkenConfig["booking"]),
    enabled: true,
    mode: "stay",
    workingHours: { start: "16:00", end: "23:30" },
  };

  next.demoNotice = "رواق ريزدنت — مذينب، المدينة المنورة 42317 | 054 130 3411";
  return next;
}
