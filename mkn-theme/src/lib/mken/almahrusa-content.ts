import type { MkenConfig } from "@/lib/mken/tenant";
import { publicBrandSrc } from "@/lib/mken/logo-crop";

/** Exact Google Business name — keep NAP in sync with Maps. */
export const ALMAHRUSA_NAME = "المحروسة للشقق المفروشة | Mahrousa Apartment";
export const ALMAHRUSA_TAGLINE = "شقق مفروشة راقية بالمدينة المنورة — حجز مباشر";
export const ALMAHRUSA_SUBTITLE =
  "شقق مفروشة مجهزة بالكامل في المدينة المنورة 42522 — وحدات بإطلالة حديقة وأسرّة ملكية وغرف فردية، مع واي فاي ومطبخ وموقف سيارات.";
export const ALMAHRUSA_PHONE = "0554453287";
export const ALMAHRUSA_WHATSAPP = "966554453287";
export const ALMAHRUSA_EMAIL = "stayinmedina@gmail.com";
export const ALMAHRUSA_LOCATION = "شداد بن عارض، المدينة المنورة 42522";
export const ALMAHRUSA_MAP_CITY = "المدينة المنورة";
export const ALMAHRUSA_MAP_CENTER = { lat: 24.3512531, lng: 39.5107113 };
export const ALMAHRUSA_MAPS_URL = "https://maps.app.goo.gl/J3yxQx6r4HF6yeYM8";
export const ALMAHRUSA_RATING = "4.7";
export const ALMAHRUSA_REVIEWS = "32 تقييم على Google";
export const ALMAHRUSA_PLUS_CODE = "9G26+G7 المدينة المنورة";

const STALE_PHONES = new Set([
  "",
  "0551234567",
  "551234567",
  "966551234567",
  "966543530333",
  "0543530333",
]);
const STALE_NAMES = new Set(["مجموعة المحروسة", "almahrosa", "almahrusa"]);
const GENERIC_TITLES = new Set(["غرفة قياسية", "غرفة ديلوكس", "جناح فندقي", "جناح عائلي"]);

export const ALMAHRUSA_IDENTITY_THEME = {
  id: "custom-almahrusa",
  name: "هوية المحروسة",
  accentColor: "#6B2D91",
  badgeBg: "#E8A317",
  bgGradient: "#1A1028",
};

export const ALMAHRUSA_SERVICE_IDS = [
  "deluxe-room",
  "suite-room",
  "standard-room",
  "family-suite",
] as const;

export function publicAlmahrusaSrc(filename: string): string {
  const file = filename.replace(/^\/+/, "").replace(/^almahrusa\//, "");
  const web = file.replace(/\.jpe?g$/i, ".web.jpg");
  return `/almahrusa/${web}`;
}

export const ALMAHRUSA_LIVE_PHOTOS = {
  hero: "/almahrusa/hero.web.jpg",
  garden: "/almahrusa/garden.web.jpg",
  royal: "/almahrusa/royal.web.jpg",
  standard: "/almahrusa/standard.web.jpg",
  family: "/almahrusa/family.web.jpg",
  living: "/almahrusa/living.web.jpg",
  kitchen: "/almahrusa/kitchen.web.jpg",
  exterior: "/almahrusa/exterior.web.jpg",
};

export const ALMAHRUSA_PHOTOS = ALMAHRUSA_LIVE_PHOTOS;

const PRICE = "السعر عند الطلب";

export const ALMAHRUSA_SERVICE_OVERRIDES: Record<
  string,
  {
    icon: string;
    title: string;
    shortTitle: string;
    description: string;
    features: string[];
    category: string;
    heroImage: string;
    roomCount: number;
  }
> = {
  "deluxe-room": {
    icon: "🌳",
    title: "شقة مطلة على الحديقة",
    shortTitle: "إطلالة حديقة",
    description:
      "وحدات مفروشة بإطلالة مباشرة على الحديقة (الغرف 101، 106، 201، 206، 301، 306) — تكييف وواي فاي ومطبخ.",
    features: ["إطلالة حديقة", "مطبخ مجهز", "واي فاي مجاني", "تكييف"],
    category: "إطلالة حديقة",
    heroImage: ALMAHRUSA_LIVE_PHOTOS.garden,
    roomCount: 6,
  },
  "suite-room": {
    icon: "👑",
    title: "غرفة سرير ملكي",
    shortTitle: "سرير ملكي",
    description: "وحدات بأسرة ملكية واسعة (الغرف 102، 105، 203، 303) — جلسة مريحة ومطبخ وواي فاي.",
    features: ["سرير ملكي", "جلسة مريحة", "مطبخ", "واي فاي"],
    category: "سرير ملكي",
    heroImage: ALMAHRUSA_LIVE_PHOTOS.royal,
    roomCount: 4,
  },
  "standard-room": {
    icon: "🛏️",
    title: "غرفة فردي",
    shortTitle: "فردي",
    description:
      "غرف فردية مجهزة بالكامل (الغرف 103، 104، 202، 204، 205، 302، 304، 305) — حمام خاص وتكييف وواي فاي.",
    features: ["سرير مريح", "حمام خاص", "تكييف", "واي فاي"],
    category: "غرف فردية",
    heroImage: ALMAHRUSA_LIVE_PHOTOS.standard,
    roomCount: 8,
  },
  "family-suite": {
    icon: "👨‍👩‍👧‍👦",
    title: "شقة عائلية بمطبخ",
    shortTitle: "عائلي",
    description: "شقة مفروشة بمطبخ مجهز لكل الغرف — مناسبة للعائلات والإقامات الأطول في المدينة المنورة.",
    features: ["مطبخ في الوحدة", "مساحة عائلية", "واي فاي", "موقف سيارات"],
    category: "شقق عائلية",
    heroImage: ALMAHRUSA_LIVE_PHOTOS.family,
    roomCount: 3,
  },
};

export const ALMAHRUSA_PROMO_ADS = [
  {
    id: "almahrusa-ad-garden",
    enabled: true,
    title: "شقق مطلة على الحديقة",
    text: "إقامة مفروشة بإطلالة حديقة في المدينة المنورة — احجز مباشرة من الموقع أو واتساب.",
    image: ALMAHRUSA_LIVE_PHOTOS.garden,
    href: "",
    features: ["إطلالة حديقة", "مطبخ مجهز", "واي فاي", "موقف سيارات"],
    badge: "الأكثر طلباً",
    price: PRICE,
    ctaLabel: "احجز إقامتك",
    startDate: "",
    endDate: "",
  },
  {
    id: "almahrusa-ad-royal",
    enabled: true,
    title: "غرفة سرير ملكي",
    text: "وحدات بأسرّة ملكية ومطبخ خاص — حجز مباشر للمحروسة في المدينة المنورة.",
    image: ALMAHRUSA_LIVE_PHOTOS.royal,
    href: "",
    features: ["سرير ملكي", "مطبخ", "تكييف", "حجز مباشر"],
    badge: "مميز",
    price: PRICE,
    ctaLabel: "احجز إقامتك",
    startDate: "",
    endDate: "",
  },
  {
    id: "almahrusa-ad-family",
    enabled: true,
    title: "شقق عائلية مفروشة",
    text: "شقق بمطبخ كامل للعائلات في المدينة المنورة 42522 — تواصل للحجز.",
    image: ALMAHRUSA_LIVE_PHOTOS.family,
    href: "",
    features: ["مطبخ", "واي فاي", "موقف مجاني", "المدينة المنورة"],
    badge: "عائلي",
    price: PRICE,
    ctaLabel: "احجز إقامتك",
    startDate: "",
    endDate: "",
  },
];

export const ALMAHRUSA_PAGES = {
  enabled: { home: true, about: true, services: true, work: true, contact: true },
  labels: {
    home: "",
    about: "عن المحروسة",
    services: "خيارات الإقامة",
    work: "صور الوحدات",
    contact: "الحجز والتواصل",
  },
  home: {
    ctaLabel: "احجز إقامتك",
    ctaHref: "",
    featuredServiceIds: ["deluxe-room", "suite-room", "standard-room"],
    stats: [
      { label: "وحدة مفروشة", value: "18" },
      { label: "تقييم Google", value: ALMAHRUSA_RATING },
      { label: "آراء الضيوف", value: "32" },
      { label: "استقبال", value: "يومي" },
    ],
  },
  about: {
    story:
      "المحروسة للشقق المفروشة في المدينة المنورة: 18 وحدة على ثلاثة أدوار، منها غرف مطلة على الحديقة وأسرّة ملكية وغرف فردية. الموقع على خرائط جوجل باسم المحروسة للشقق المفروشة | Mahrousa Apartment، والعنوان المدينة المنورة 42522 (9G26+G7).",
    vision: "إقامة واضحة ومريحة للنزيل في المدينة المنورة، بحجز مباشر دون وسيط.",
    mission: "وحدات مفروشة جاهزة، تواصل واتساب على الرقم الظاهر في خرائط جوجل، وتأكيد حجز فوري.",
    values: [
      { title: "موقع موثّق", text: "نفس الاسم والجوال والعنوان الظاهرين على خرائط جوجل." },
      { title: "وحدات حقيقية", text: "18 غرفة بأرقام وأدوار واضحة: حديقة، ملكي، وفردي." },
      { title: "حجز مباشر", text: "من الموقع أو واتساب 055 445 3287 دون رسوم وسيط." },
    ],
    credentials: [
      { title: "خرائط جوجل", text: "تقييم 4.7 من 32 مراجعة — المحروسة للشقق المفروشة | Mahrousa Apartment." },
      { title: "العنوان", text: "شداد بن عارض، المدينة المنورة 42522 — Plus Code 9G26+G7." },
    ],
  },
  services: {
    showPrices: true,
    processSteps: [
      { title: "اختر الوحدة", text: "إطلالة حديقة، سرير ملكي، فردي، أو شقة عائلية بمطبخ." },
      { title: "حدد تاريخ الوصول", text: "تسجيل الوصول من الساعة 16:00 والمغادرة حتى 12:00." },
      { title: "أكّد عبر واتساب", text: "تواصل على 055 445 3287 واستلم تأكيد الوحدة." },
    ],
  },
  work: {
    gallery: [
      { image: ALMAHRUSA_LIVE_PHOTOS.hero, caption: "مبنى المحروسة للشقق المفروشة في المدينة المنورة" },
      { image: ALMAHRUSA_LIVE_PHOTOS.exterior, caption: "الواجهة وموقف السيارات" },
      { image: ALMAHRUSA_LIVE_PHOTOS.living, caption: "جلسة داخل الشقة المفروشة" },
      { image: ALMAHRUSA_LIVE_PHOTOS.garden, caption: "وحدة بإطلالة ومطبخ مجهز" },
      { image: ALMAHRUSA_LIVE_PHOTOS.royal, caption: "غرفة سرير ملكي" },
      { image: ALMAHRUSA_LIVE_PHOTOS.standard, caption: "غرفة فردي مجهزة" },
      { image: ALMAHRUSA_LIVE_PHOTOS.family, caption: "شقة عائلية بجلسة معيشة" },
      { image: ALMAHRUSA_LIVE_PHOTOS.kitchen, caption: "مطبخ وجلسة داخل الوحدة" },
      { image: publicAlmahrusaSrc("gallery-01.jpg"), caption: "حمام خاص مجهز" },
      { image: publicAlmahrusaSrc("gallery-02.jpg"), caption: "غرفة نوم مفروشة" },
      { image: publicAlmahrusaSrc("gallery-03.jpg"), caption: "بهو المصعد والاستقبال" },
      { image: publicAlmahrusaSrc("gallery-04.jpg"), caption: "تفاصيل الوحدة" },
    ],
    cases: [
      {
        title: "حجز مباشر من خرائط جوجل",
        challenge: "الضيف يجد المحروسة على الخرائط ويحتاج تأكيد غرفة دون وسيط.",
        solution: "رابط الموقع almahrusa.mken.live يظهر في بطاقة الخرائط مع رقم 055 445 3287.",
        result: "مسار واحد: الخرائط → الموقع أو واتساب → تأكيد الوحدة.",
      },
    ],
    testimonials: [
      {
        name: "ضيف عبر Google",
        text: "الضيوف يذكرون الإطلالة والخدمة والموقع في المدينة المنورة — التقييم الظاهر على الخرائط 4.7.",
        rating: "5",
      },
    ],
  },
  contact: {
    formEnabled: true,
    mapEnabled: true,
    hoursNote:
      "تسجيل الوصول من 16:00 حتى 23:30 — المغادرة حتى 12:00. للحجز واتساب 055 445 3287. العنوان: المدينة المنورة 42522 — 9G26+G7.",
  },
};

export function almahrusaStorefrontMap() {
  return {
    lat: ALMAHRUSA_MAP_CENTER.lat,
    lng: ALMAHRUSA_MAP_CENTER.lng,
    city: ALMAHRUSA_MAP_CITY,
    mapsUrl: ALMAHRUSA_MAPS_URL,
  };
}

export function hasAlmahrusaIdentityTheme(config: MkenConfig): boolean {
  const raw = config.customThemes;
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    const id = typeof item.id === "string" ? item.id : "";
    const name = typeof item.name === "string" ? item.name : "";
    return id === ALMAHRUSA_IDENTITY_THEME.id || name.includes("المحروسة");
  });
}

export function isStaleAlmahrusaPhone(value: unknown): boolean {
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
  return /\/almahrusa\//i.test(value) && !/\.web\.jpg/i.test(value);
}

function pagesStory(config: MkenConfig): string {
  const pages = asRecord(config.pages);
  const about = asRecord(pages.about);
  return typeof about.story === "string" ? about.story.trim() : "";
}

function fillAlmahrusaSocial(social: unknown): Record<string, { enabled?: boolean; value?: string }> {
  const next =
    social && typeof social === "object" && !Array.isArray(social)
      ? { ...(social as Record<string, { enabled?: boolean; value?: string }>) }
      : {};
  const saved = typeof next.whatsapp?.value === "string" ? next.whatsapp.value.trim() : "";
  next.whatsapp = {
    enabled: true,
    value: isStaleAlmahrusaPhone(saved) ? ALMAHRUSA_WHATSAPP : saved,
  };
  return next;
}

/**
 * Overlay Maps-accurate NAP, Medina pin, real photos, and room copy.
 * Safe on read: only replaces empty/stale/generic placeholders.
 */
export function applyAlmahrusaDefaults(config: MkenConfig): MkenConfig {
  const next: MkenConfig = { ...config };
  const brand = { ...(next.brand || {}) };
  const currentName = typeof brand.name === "string" ? brand.name.trim() : "";
  if (!currentName || STALE_NAMES.has(currentName)) brand.name = ALMAHRUSA_NAME;
  if (!brand.tagline || /قريبة من الحرم|خدمة استثنائية/.test(brand.tagline)) {
    brand.tagline = ALMAHRUSA_TAGLINE;
  }
  const logo = typeof brand.logo === "string" ? brand.logo.trim() : "";
  if (!logo || /almahrusa\.jpe?g/i.test(logo) || logo.startsWith("data:image/")) {
    brand.logo = publicBrandSrc("almahrusa.png");
  }
  next.brand = brand;

  if (isStaleAlmahrusaPhone(next.phone)) next.phone = ALMAHRUSA_PHONE;
  if (!next.subtitle || /قريبة من الحرم/.test(String(next.subtitle))) next.subtitle = ALMAHRUSA_SUBTITLE;
  if (!next.location || /جدة|المملكة العربية السعودية\s*$/.test(String(next.location))) {
    next.location = ALMAHRUSA_LOCATION;
  }
  next.rating = next.rating && next.rating !== "0" ? next.rating : ALMAHRUSA_RATING;
  next.reviewsCount = next.reviewsCount || ALMAHRUSA_REVIEWS;
  next.mapsUrl = ALMAHRUSA_MAPS_URL;
  next.heroImage = ALMAHRUSA_LIVE_PHOTOS.hero;

  next.social = fillAlmahrusaSocial(next.social);
  const emails = asRecord(next.emails);
  const inquiries = asRecord(emails.inquiries);
  const savedEmail = typeof inquiries.value === "string" ? inquiries.value.trim() : "";
  next.emails = {
    ...emails,
    inquiries: {
      enabled: true,
      value:
        savedEmail.includes("@") && !/@mken\.live$|info@almahrusa\.sa/i.test(savedEmail)
          ? savedEmail
          : ALMAHRUSA_EMAIL,
    },
  };

  const currentArea = asRecord(next.serviceArea);
  const lat = Number(currentArea.center && asRecord(currentArea.center).lat);
  const jeddahPin = !Number.isFinite(lat) || Math.abs(lat - 21.485811) < 0.01;
  next.serviceArea = {
    ...currentArea,
    enabled: true,
    displayOnHomepage: true,
    city: ALMAHRUSA_MAP_CITY,
    center: jeddahPin ? { ...ALMAHRUSA_MAP_CENTER } : { ...(asRecord(currentArea.center) as { lat?: number; lng?: number }), ...ALMAHRUSA_MAP_CENTER },
    radiusKm: 15,
    coverageNote: `${ALMAHRUSA_LOCATION} — ${ALMAHRUSA_PLUS_CODE}`,
    showAsFullCity: true,
  };

  next.enabledActivities = ["hotels"];
  const enabled = Array.isArray(next.enabled)
    ? next.enabled.filter((id): id is string => typeof id === "string")
    : [];
  const nextEnabled = ALMAHRUSA_SERVICE_IDS.filter((id) => enabled.length === 0 || enabled.includes(id));
  next.enabled = nextEnabled.length ? nextEnabled : [...ALMAHRUSA_SERVICE_IDS];
  next.featuredActivity = "hotels";
  next.featured = "deluxe-room";

  const activities = asRecord(next.activities);
  const hotels = asRecord(activities.hotels);
  activities.hotels = {
    ...hotels,
    icon: "🏨",
    title: "شقق مفروشة",
    shortTitle: "إقامة",
    tagline: "احجز شقتك المفروشة بالمدينة المنورة",
    description: ALMAHRUSA_SUBTITLE,
  };
  next.activities = activities;

  const services = asRecord(next.services);
  for (const [id, override] of Object.entries(ALMAHRUSA_SERVICE_OVERRIDES)) {
    const current = asRecord(services[id]);
    const title = typeof current.title === "string" ? current.title.trim() : "";
    services[id] = {
      ...current,
      icon: override.icon,
      title: !title || GENERIC_TITLES.has(title) ? override.title : title,
      shortTitle: override.shortTitle,
      description:
        typeof current.description === "string" && current.description.trim() && !/إفطار|VIP|minibar/i.test(current.description)
          ? current.description
          : override.description,
      features: override.features,
      category: override.category,
      roomCount: override.roomCount,
      stayUnit: "night",
      heroImage: override.heroImage,
    };
  }
  next.services = services;

  const emptyPages = !pagesStory(next);
  const currentPages = asRecord(next.pages);
  next.pages = {
    ...currentPages,
    ...(emptyPages ? ALMAHRUSA_PAGES : {}),
    home: emptyPages ? { ...asRecord(currentPages.home), ...ALMAHRUSA_PAGES.home } : currentPages.home,
    about: emptyPages ? { ...asRecord(currentPages.about), ...ALMAHRUSA_PAGES.about } : currentPages.about,
    work: {
      ...asRecord(currentPages.work),
      gallery: ALMAHRUSA_PAGES.work.gallery,
    },
  };

  if (!hasAlmahrusaIdentityTheme(next)) {
    const existing = Array.isArray(next.customThemes) ? next.customThemes : [];
    next.customThemes = [ALMAHRUSA_IDENTITY_THEME, ...existing];
  }

  const pack = asRecord(next.occasionPack);
  next.occasionPack = {
    ...pack,
    forceId: ALMAHRUSA_IDENTITY_THEME.id,
    mode: "manual",
    enabled: false,
  };

  const storedCopy = asRecord(next.interfaceCopy);
  const storedFooter = typeof storedCopy.servicesFooter === "string" ? storedCopy.servicesFooter : "";
  next.interfaceCopy = {
    servicesHeading:
      typeof storedCopy.servicesHeading === "string" && storedCopy.servicesHeading.trim() && !/الحرم/.test(storedCopy.servicesHeading)
        ? storedCopy.servicesHeading
        : "خيارات الإقامة في المحروسة",
    servicesIntro:
      typeof storedCopy.servicesIntro === "string" && storedCopy.servicesIntro.trim()
        ? storedCopy.servicesIntro
        : "شقق مفروشة في المدينة المنورة — إطلالة حديقة، سرير ملكي، وغرف فردية.",
    servicesFooter:
      storedFooter && !/الحرم/.test(storedFooter)
        ? storedFooter
        : "للحجز: 055 445 3287 — المدينة المنورة 42522",
  };

  const currentAds = next.ads || {};
  const secondary = Array.isArray(currentAds.secondary) ? [...currentAds.secondary] : [];
  const existingIds = new Set(secondary.map((item) => (item && item.id) || "").filter(Boolean));
  const refreshedSecondary = secondary.map((item) => {
    if (!item || typeof item !== "object") return item;
    const image = typeof item.image === "string" ? item.image : "";
    if (!isPlaceholderPhoto(image)) return item;
    const seed = ALMAHRUSA_PROMO_ADS.find((ad) => ad.id === item.id);
    return seed ? { ...item, image: seed.image } : item;
  });
  for (const seed of ALMAHRUSA_PROMO_ADS) {
    if (!existingIds.has(seed.id)) refreshedSecondary.push({ ...seed });
  }
  const primary = currentAds.primary || {};
  next.ads = {
    ...currentAds,
    primary: {
      enabled: primary.enabled === true,
      title: primary.title || "احجز في المحروسة للشقق المفروشة",
      text: primary.text || "شقق مفروشة بالمدينة المنورة — واتساب 055 445 3287",
      image: ALMAHRUSA_LIVE_PHOTOS.hero,
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

  if (!next.demoNotice || /قريبة من الحرم/.test(String(next.demoNotice))) {
    next.demoNotice = "المحروسة للشقق المفروشة — المدينة المنورة 42522 | 055 445 3287";
  }

  return next;
}
