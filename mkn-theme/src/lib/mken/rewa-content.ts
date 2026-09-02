import type { MkenConfig } from "@/lib/mken/tenant";

/** Placeholder catalog shipped with the first Rewa seed — not their real departments. */
export const REWA_LEGACY_SERVICE_IDS = [
  "dental-checkup",
  "gp-consultation",
  "nutrition-consult",
  "personal-training",
  "event-planning",
] as const;

export const REWA_ACTIVITY_IDS = [
  "healthcare",
  "fitness",
  "events",
  "hotels",
  "restaurant",
  "commerce",
] as const;

export interface RewaCustomService {
  id: string;
  activityId: string;
  icon: string;
  title: string;
  shortTitle: string;
  description: string;
  features: string[];
  category: string;
  price: string;
  heroImage: string;
}

const PRICE_BOOK = "السعر عند الطلب";
const PRICE_AD = "بالإعلان";

export const REWA_CUSTOM_SERVICES: RewaCustomService[] = [
  {
    id: "rewa-hijama",
    activityId: "healthcare",
    icon: "\u{1F33F}",
    title: "حجامة",
    shortTitle: "حجامة",
    description: "جلسة حجامة علاجية بإشراف مختصين داخل منتجع رواء — احجز موعدك مباشرة.",
    features: ["جلسة بإشراف مختص", "بيئة استشفائية هادئة", "موعد مرن", "متابعة بعد الجلسة"],
    category: "الطب البديل",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-healing-caves",
    activityId: "healthcare",
    icon: "⛰️",
    title: "كهوف استشفائية",
    shortTitle: "كهوف",
    description: "تجربة الكهوف الاستشفائية للاسترخاء وتنفس أعمق ضمن مسار الطب البديل.",
    features: ["جلسة كهف مخصصة", "إرشاد قبل الدخول", "مدة مناسبة للاستشفاء", "حجز مسبق"],
    category: "الطب البديل",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-therapy-trips",
    activityId: "healthcare",
    icon: "🌿",
    title: "رحلات علاجية",
    shortTitle: "رحلات",
    description: "رحلات علاجية مخططة تجمع الطبيعة والاستشفاء — احجز مقعدك في البرنامج.",
    features: ["برنامج رحلة واضح", "مرافقة متخصصة", "مناسب للاستشفاء", "حجز مسبق"],
    category: "الطب البديل",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-dental",
    activityId: "healthcare",
    icon: "🦷",
    title: "أسنان",
    shortTitle: "أسنان",
    description: "عيادة أسنان ضمن المجمع الطبي في رواء — فحص، تنظيف، وخطة علاج.",
    features: ["فحص شامل", "تنظيف", "خطة علاج", "مواعيد مرنة"],
    category: "المجمع الطبي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-pediatrics",
    activityId: "healthcare",
    icon: "👶",
    title: "أطفال",
    shortTitle: "أطفال",
    description: "عيادة أطفال في المجمع الطبي — كشف ومتابعة لصحة طفلك.",
    features: ["كشف أطفال", "متابعة نمو", "إرشاد للأسرة", "بيئة مطمئنة"],
    category: "المجمع الطبي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-obgyn",
    activityId: "healthcare",
    icon: "🌸",
    title: "نساء وولادة",
    shortTitle: "نساء وولادة",
    description: "رعاية نسائية وولادية ضمن المجمع الطبي بمنتجع رواء.",
    features: ["كشف ومتابعة", "خصوصية تامة", "استشارة مختصة", "حجز موعد"],
    category: "المجمع الطبي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-emergency",
    activityId: "healthcare",
    icon: "🚑",
    title: "طوارئ",
    shortTitle: "طوارئ",
    description: "خدمة طوارئ ضمن المجمع الطبي — للاستفسار عن الحالات العاجلة والتوجيه.",
    features: ["استجابة عاجلة", "تقييم أولي", "تنسيق داخلي", "تواصل مباشر"],
    category: "المجمع الطبي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-physio",
    activityId: "healthcare",
    icon: "🦴",
    title: "العلاج الطبيعي",
    shortTitle: "علاج طبيعي",
    description: "جلسات علاج طبيعي وإعادة حركة ضمن المجمع الطبي.",
    features: ["تقييم حركي", "خطة جلسات", "تمارين علاجية", "متابعة"],
    category: "المجمع الطبي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-cancer-rehab",
    activityId: "healthcare",
    icon: "🤍",
    title: "تأهيل التعافي من السرطان",
    shortTitle: "تعافي السرطان",
    description: "برنامج تأهيل نفسي وجسدي لدعم التعافي من السرطان في بيئة رواء.",
    features: ["خطة تأهيل فردية", "دعم نفسي", "جلسات جسدية", "مرافقة الأسرة"],
    category: "التأهيل النفسي والجسدي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-addiction-stroke",
    activityId: "healthcare",
    icon: "🧠",
    title: "الإدمان والجلطات",
    shortTitle: "إدمان وجلطات",
    description: "تأهيل متخصص لحالات الإدمان وما بعد الجلطات — مسار واضح للمتابعة.",
    features: ["تقييم شامل", "برنامج تأهيل", "متابعة منتظمة", "خصوصية"],
    category: "التأهيل النفسي والجسدي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-psych-crisis",
    activityId: "healthcare",
    icon: "💬",
    title: "الأزمات النفسية",
    shortTitle: "أزمات نفسية",
    description: "دعم متخصص للأزمات النفسية في مسار التأهيل النفسي والجسدي.",
    features: ["جلسة تقييم", "خطة دعم", "سرية تامة", "حجز عاجل عند الحاجة"],
    category: "التأهيل النفسي والجسدي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-gaming-addiction",
    activityId: "healthcare",
    icon: "🎮",
    title: "التعلق بالألعاب الإلكترونية",
    shortTitle: "تعلق الألعاب",
    description: "برنامج لتأهيل التعلق بالألعاب الإلكترونية — للمراهقين والأسر.",
    features: ["تقييم سلوكي", "إرشاد أسري", "خطة تقليل الاعتماد", "متابعة"],
    category: "التأهيل النفسي والجسدي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-seniors-club",
    activityId: "fitness",
    icon: "🌅",
    title: "نادي كبار السن",
    shortTitle: "كبار السن",
    description: "نادي رياضي واجتماعي لكبار السن داخل منتجع رواء — نشاط آمن ومنتظم.",
    features: ["برامج مناسبة للعمر", "إشراف مدرب", "جو اجتماعي", "اشتراك مرن"],
    category: "الرياضة",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-kids-martial-arts",
    activityId: "fitness",
    icon: "🥋",
    title: "نادي الأطفال لتعلم الفنون القتالية",
    shortTitle: "فنون قتالية",
    description: "نادي أطفال لتعليم الفنون القتالية بانضباط وثقة — سجّل طفلك.",
    features: ["تدريب عمري مناسب", "انضباط وثقة", "حصص منتظمة", "متابعة ولي الأمر"],
    category: "الرياضة",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-nutritionist",
    activityId: "fitness",
    icon: "🥗",
    title: "أخصائي تغذية",
    shortTitle: "تغذية",
    description: "استشارة أخصائي تغذية في عيادة السمنة والدايت.",
    features: ["تقييم غذائي", "خطة شخصية", "متابعة وزن", "تنسيق مع النادي"],
    category: "عيادة السمنة والدايت",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-healthy-meals",
    activityId: "fitness",
    icon: "🍱",
    title: "اشتراك وجبات صحية",
    shortTitle: "وجبات صحية",
    description: "اشتراك وجبات صحية ضمن مسار عيادة السمنة والدايت.",
    features: ["قائمة متوازنة", "اشتراك مرن", "تنسيق مع الأخصائي", "استلام منظم"],
    category: "عيادة السمنة والدايت",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-gym-membership",
    activityId: "fitness",
    icon: "🏋️",
    title: "اشتراك بالنادي",
    shortTitle: "اشتراك النادي",
    description: "اشتراك في نادي رواء ضمن برنامج السمنة والدايت أو الرياضة العامة.",
    features: ["دخول النادي", "برامج لياقة", "تنسيق غذائي اختياري", "مدة اشتراك واضحة"],
    category: "عيادة السمنة والدايت",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-certified-courses",
    activityId: "events",
    icon: "🎓",
    title: "الدورات التدريبية المعتمدة",
    shortTitle: "دورات معتمدة",
    description: "الجمعية تعلن عن دوراتها التدريبية المعتمدة — سجّل اهتمامك للاطلاع على المواعيد.",
    features: ["دورات معتمدة", "إعلان عبر الجمعية", "تسجيل اهتمام", "تحديث بالمواعيد"],
    category: "الجمعية",
    price: PRICE_AD,
    heroImage: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-events",
    activityId: "events",
    icon: "✨",
    title: "فعاليات رواء",
    shortTitle: "فعاليات",
    description: "فعاليات المنتجع تُعلن من هنا — استفسر عن الجدول والبرامج القادمة.",
    features: ["إعلان الفعالية", "برامج صحية ومجتمعية", "تسجيل اهتمام", "تفاصيل عند الإعلان"],
    category: "الفعاليات",
    price: PRICE_AD,
    heroImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-shop-library",
    activityId: "commerce",
    icon: "📚",
    title: "ركن المبيعات والمكتبة",
    shortTitle: "مبيعات ومكتبة",
    description: "ركن المبيعات والمكتبة داخل المنتجع — منتجات وقراءات تدعم مسار الاستشفاء.",
    features: ["ركن مبيعات", "مكتبة", "اطلع أثناء الزيارة", "استفسر عن المتوفر"],
    category: "ركن المبيعات والمكتبة",
    price: "استفسر",
    heroImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-apartments",
    activityId: "hotels",
    icon: "🏠",
    title: "الشقق الخدمية",
    shortTitle: "شقق خدمية",
    description: "سكن تابع للمنتجع مهيأ للإقامة — شقق خدمية لمن يرغب بالمكوث أثناء البرنامج.",
    features: ["سكن تابع للمنتجع", "مهيأة للسكن", "قريبة من العيادات", "حجز إقامة"],
    category: "الشقق الخدمية",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "rewa-maha-cafe",
    activityId: "restaurant",
    icon: "☕",
    title: "كوفي مهى المدينة",
    shortTitle: "مهى المدينة",
    description: "كوفي مهى المدينة داخل منتجع رواء — ضيافة يومية في قلب المنتجع.",
    features: ["ضيافة يومية", "موقع داخل المنتجع", "استراحة بين الجلسات", "استفسر عن الزيارة"],
    category: "الكوفي",
    price: PRICE_BOOK,
    heroImage: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  },
];

export const REWA_FEATURED_SERVICE_IDS = ["rewa-hijama", "rewa-healing-caves", "rewa-therapy-trips"];

const AD_CTA = "احجز هذه الخدمة الآن";

export const REWA_PROMO_ADS = [
  {
    id: "rewa-ad-general-medicine",
    enabled: true,
    title: "الطب العام",
    text: "عيادات الطب العام في منتجع رواء — احجز موعدك مباشرة.",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
    href: "",
    features: ["الأسنان", "الأطفال", "النساء والولادة", "الطوارئ 24 ساعة"],
    badge: "طب عام",
    price: PRICE_BOOK,
    ctaLabel: AD_CTA,
    startDate: "",
    endDate: "",
  },
  {
    id: "rewa-ad-complementary",
    enabled: true,
    title: "الطب التكميلي",
    text: "مسارات الطب التكميلي والاستشفاء داخل المنتجع — احجز جلستك.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
    href: "",
    features: [
      "الكهوف العلاجية ملح",
      "الكهوف العلاجية رمل",
      "الكهوف العلاجية أكسجين",
      "ممر مائي",
    ],
    badge: "تكميلي",
    price: PRICE_BOOK,
    ctaLabel: AD_CTA,
    startDate: "",
    endDate: "",
  },
  {
    id: "rewa-ad-nutrition",
    enabled: true,
    title: "السمنة والتغذية العلاجية",
    text: "عيادة السمنة والتغذية العلاجية — احجز استشارتك أو اشتراك الوجبات.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
    href: "",
    features: ["التغذية العلاجية", "الوجبات الصحية", "النادي الرياضي"],
    badge: "تغذية",
    price: PRICE_BOOK,
    ctaLabel: AD_CTA,
    startDate: "",
    endDate: "",
  },
  {
    id: "rewa-ad-sports",
    enabled: true,
    title: "النادي الرياضي",
    text: "النادي الرياضي في منتجع رواء — سجّل في البرنامج المناسب لك أو لأسرتك.",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
    href: "",
    features: ["فنون قتال", "نادي أطفال", "نادي كبار السن"],
    badge: "رياضة",
    price: PRICE_BOOK,
    ctaLabel: AD_CTA,
    startDate: "",
    endDate: "",
  },
];

/** Navy / gold / sky from the official رواء wordmark — selectable in the theme library. */
export const REWA_IDENTITY_THEME = {
  id: "custom-rewa",
  name: "هوية رواء",
  accentColor: "#1A3F66",
  badgeBg: "#C4A35A",
  bgGradient: "#0D2136",
};

export function hasRewaIdentityTheme(config: MkenConfig): boolean {
  const raw = config.customThemes;
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    const id = typeof item.id === "string" ? item.id : "";
    const name = typeof item.name === "string" ? item.name : "";
    return id === REWA_IDENTITY_THEME.id || name.includes("رواء");
  });
}

/** Official Google Maps pin: https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8 */
export const REWA_MAPS_URL = "https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8";
export const REWA_MAP_CENTER = { lat: 24.46624, lng: 39.550085 };
export const REWA_MAP_CITY = "المدينة المنورة";
export const REWA_LOCATION = "الحماوات، المدينة المنورة، المملكة العربية السعودية";
export const REWA_PHONE = "0148462524";
export const REWA_WHATSAPP = "966549462524";
/** Previous seed used the landline as WhatsApp; replace it when still stored. */
const STALE_REWA_WHATSAPP = new Set(["966148462524", "148462524", "0148462524"]);

export const REWA_SOCIAL_DEFAULTS: Record<string, { enabled: boolean; value: string }> = {
  instagram: { enabled: true, value: "rewa.100000" },
  tiktok: { enabled: true, value: "rewa.1000" },
  snapchat: { enabled: true, value: "rewa.1000" },
  whatsapp: { enabled: true, value: REWA_WHATSAPP },
};

export function fillRewaSocial(social: unknown): Record<string, { enabled?: boolean; value?: string }> {
  const next = social && typeof social === "object" && !Array.isArray(social)
    ? { ...(social as Record<string, { enabled?: boolean; value?: string }>) }
    : {};
  for (const [id, def] of Object.entries(REWA_SOCIAL_DEFAULTS)) {
    const current = next[id];
    const saved = typeof current?.value === "string" ? current.value.trim() : "";
    const staleWhatsapp = id === "whatsapp" && STALE_REWA_WHATSAPP.has(saved.replace(/\D/g, ""));
    const usable = Boolean(saved) && !staleWhatsapp;
    next[id] = {
      enabled: usable ? current?.enabled !== false : def.enabled,
      value: usable ? saved : def.value,
    };
  }
  return next;
}

export function rewaStorefrontMap() {
  return {
    lat: REWA_MAP_CENTER.lat,
    lng: REWA_MAP_CENTER.lng,
    city: REWA_MAP_CITY,
    mapsUrl: REWA_MAPS_URL,
  };
}

export const REWA_ACTIVITY_OVERRIDES: Record<string, { title: string; shortTitle: string; tagline: string }> = {
  healthcare: {
    title: "الرعاية الطبية والتأهيل",
    shortTitle: "طبي",
    tagline: "طب بديل ومجمع طبي وتأهيل",
  },
  fitness: {
    title: "الرياضة والدايت",
    shortTitle: "رياضة",
    tagline: "أندية ولياقة وتغذية",
  },
  events: {
    title: "الجمعية والفعاليات",
    shortTitle: "فعاليات",
    tagline: "دورات معتمدة وبرامج معلنة",
  },
  hotels: {
    title: "الإقامة",
    shortTitle: "إقامة",
    tagline: "شقق خدمية تابعة للمنتجع",
  },
  restaurant: {
    title: "الضيافة",
    shortTitle: "ضيافة",
    tagline: "كوفي مهى المدينة",
  },
  commerce: {
    title: "المبيعات والمكتبة",
    shortTitle: "مبيعات",
    tagline: "ركن المبيعات والمكتبة",
  },
};

const REWA_PAGES = {
  enabled: { home: true, about: true, services: true, work: true, contact: true },
  labels: {
    home: "",
    about: "أقسام رواء",
    services: "خدمات الحجز",
    work: "الحياة في رواء",
    contact: "تواصل وإقامة",
  },
  home: {
    ctaLabel: "احجز موعدك",
    ctaHref: "",
    featuredServiceIds: REWA_FEATURED_SERVICE_IDS,
    stats: [
      { value: "10", label: "أقسام متكاملة" },
      { value: "المدينة المنورة", label: "موقع المنتجع" },
      { value: "4.9", label: "تقييم الضيوف" },
    ],
  },
  about: {
    story:
      "منتجع رواء الاستشفاء الرقمي في المدينة المنورة منظومة متكاملة: طب بديل يُحجز مباشرة، مجمع طبي، تأهيل نفسي وجسدي، رياضة، عيادة سمنة ودايت، جمعية تعلن دوراتها المعتمدة، فعاليات بالإعلان، ركن مبيعات ومكتبة، شقق خدمية تابعة للمنتجع، وكوفي مهى المدينة.",
    vision: "أن نكون وجهة الاستشفاء المتوازن في المدينة المنورة: علاج، تأهيل، رياضة، إقامة وضيافة في مكان واحد.",
    mission:
      "نسهّل على الضيف اختيار مساره — من حجز الحجامة والكهوف والرحلات العلاجية إلى عيادات المجمع وبرامج التأهيل والأندية — مع مسارات واضحة للإعلان عن الدورات والفعاليات والاستفسار عن السكن والكوفي.",
    values: [
      {
        title: "الطب البديل",
        text: "حجامة، كهوف استشفائية، ورحلات علاجية — هذه الخدمات تُحجز مباشرة من الموقع.",
      },
      {
        title: "المجمع الطبي",
        text: "أسنان، أطفال، نساء وولادة، طوارئ، والعلاج الطبيعي.",
      },
      {
        title: "التأهيل النفسي والجسدي",
        text: "تأهيل التعافي من السرطان، الإدمان والجلطات، الأزمات النفسية، والتعلق بالألعاب الإلكترونية.",
      },
      {
        title: "الرياضة",
        text: "نادي كبار السن، ونادي الأطفال لتعلم الفنون القتالية.",
      },
      {
        title: "عيادة السمنة والدايت",
        text: "أخصائي تغذية، اشتراك وجبات صحية، واشتراك بالنادي.",
      },
      {
        title: "الجمعية",
        text: "إعلان عن الدورات التدريبية المعتمدة — سجّل اهتمامك للاطلاع على الجدول.",
      },
      {
        title: "الفعاليات",
        text: "فعاليات المنتجع تُعلن من هنا؛ استفسر عن البرامج القادمة.",
      },
      {
        title: "ركن المبيعات والمكتبة",
        text: "ركن للمنتجات والقراءات داخل المنتجع — اطّلع أثناء الزيارة.",
      },
      {
        title: "الشقق الخدمية",
        text: "سكن تابع للمنتجع مهيأ للإقامة خلال البرامج والعلاج.",
      },
      {
        title: "كوفي مهى المدينة",
        text: "ضيافة يومية في قلب المنتجع بين الجلسات والزيارات.",
      },
    ],
    credentials: [
      { title: "المدينة المنورة", text: "منتجع رواء الاستشفاء الرقمي — حضور محلي وخدمة متكاملة للضيف المقيم والزائر." },
      { title: "مسار حجز واضح", text: "الطب البديل يُحجز من الموقع، وبقية الأقسام للاستشارة أو التسجيل أو الإقامة." },
    ],
  },
  services: {
    showPrices: true,
    processSteps: [
      { title: "اختر القسم", text: "طب بديل، مجمع طبي، تأهيل، رياضة، دايت، أو إقامة وضيافة." },
      { title: "احجز أو استفسر", text: "خدمات الطب البديل تُحجز مباشرة، وبقية المسارات عبر النموذج أو واتساب." },
      { title: "نرحب بك في رواء", text: "في المدينة المنورة: عيادات، أندية، شقق خدمية، وكوفي مهى المدينة." },
    ],
  },
  work: {
    cases: [
      {
        title: "الجمعية — الدورات التدريبية المعتمدة",
        challenge: "الجمعية ليست عيادة؛ دورها الإعلان عن الدورات المعتمدة.",
        solution: "نعرض الدورات كمسار تسجيل اهتمام، ونحدّث المواعيد عند كل إعلان.",
        result: "مسار واضح للمهتمين بالاعتماد والتدريب دون خلطه مع الحجز الطبي.",
      },
      {
        title: "فعاليات تُعلن في حينها",
        challenge: "البرامج المجتمعية والصحية ليست جدولاً ثابتاً طوال العام.",
        solution: "صفحة الحياة في رواء وبطاقة الفعاليات تستقبل الاستفسار عند كل إعلان.",
        result: "الضيف يعرف أين يبحث، والفريق يعلن دون إعادة بناء الموقع.",
      },
      {
        title: "ركن المبيعات والمكتبة",
        challenge: "ركن داخلي يُزار أثناء التواجد في المنتجع.",
        solution: "نعرضه كواجهة تسويقية مع دعوة للاطلاع والاستفسار عن المتوفر.",
        result: "امتداد لتجربة الاستشفاء: منتج وقراءة بجانب العيادة والنادي.",
      },
      {
        title: "الشقق الخدمية",
        challenge: "بعض البرامج تحتاج مكوثاً قريباً من العيادات والأندية.",
        solution: "سكن تابع للمنتجع مهيأ للسكن، يُحجز كإقامة خدمية.",
        result: "إقامة وعلاج في منظومة واحدة دون تشتت الضيف.",
      },
      {
        title: "كوفي مهى المدينة",
        challenge: "الضيافة جزء من اليوم داخل المنتجع وليست خدمة طبية.",
        solution: "بطاقة ومسار تواصل مستقل لكوفي مهى المدينة.",
        result: "استراحة واضحة بين الجلسات والزيارات العائلية.",
      },
    ],
    testimonials: [
      {
        name: "زائر للمنتجع",
        text: "وضوح الأقسام ساعدني أختار بين الحجز الطبي والاستفسار عن السكن والكوفي دون تشتت.",
        rating: "5",
      },
      {
        name: "أسرة مقيمة",
        text: "الشقق الخدمية قريبة من العيادات، والأطفال وجدوا نادي الفنون القتالية ضمن نفس المكان.",
        rating: "5",
      },
    ],
  },
  contact: {
    formEnabled: true,
    mapEnabled: true,
    hoursNote:
      "للطب البديل احجز من صفحة الخدمات. للشقق الخدمية وكوفي مهى المدينة والدورات والفعاليات راسلنا عبر النموذج أو واتساب. الموقع: المدينة المنورة.",
  },
};

export function isLegacyRewaCatalog(config: MkenConfig): boolean {
  const enabled = Array.isArray(config.enabled)
    ? config.enabled.filter((id): id is string => typeof id === "string")
    : [];
  if (enabled.some((id) => id.startsWith("rewa-"))) return false;
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pagesStory(config: MkenConfig): string {
  const pages = asRecord(config.pages);
  const about = asRecord(pages.about);
  return typeof about.story === "string" ? about.story.trim() : "";
}

function featuredLooksLegacy(ids: unknown): boolean {
  if (!Array.isArray(ids) || ids.length === 0) return true;
  const legacy = new Set<string>(REWA_LEGACY_SERVICE_IDS);
  return ids.every((id) => typeof id === "string" && legacy.has(id));
}

/**
 * Injects Rewa's real departments into tenant config without touching other
 * tenants. Safe to run on read: only replaces the old placeholder catalog and
 * empty page copy. Manual admin edits (non-legacy enabled lists / existing story) win.
 */
export function applyRewaDefaults(config: MkenConfig): MkenConfig {
  const next: MkenConfig = { ...config, customServices: REWA_CUSTOM_SERVICES };

  const activities = asRecord(next.activities);
  for (const [id, override] of Object.entries(REWA_ACTIVITY_OVERRIDES)) {
    const current = asRecord(activities[id]);
    activities[id] = {
      ...current,
      title: typeof current.title === "string" && current.title.trim() ? current.title : override.title,
      shortTitle:
        typeof current.shortTitle === "string" && current.shortTitle.trim()
          ? current.shortTitle
          : override.shortTitle,
      tagline: typeof current.tagline === "string" && current.tagline.trim() ? current.tagline : override.tagline,
    };
  }
  next.activities = activities;

  const serviceMap = asRecord(next.services);
  for (const service of REWA_CUSTOM_SERVICES) {
    const current = asRecord(serviceMap[service.id]);
    serviceMap[service.id] = {
      ...current,
      heroImage:
        typeof current.heroImage === "string" && current.heroImage.trim()
          ? current.heroImage
          : service.heroImage,
    };
  }
  next.services = serviceMap;

  if (isLegacyRewaCatalog(next)) {
    next.enabledActivities = [...REWA_ACTIVITY_IDS];
    next.enabled = REWA_CUSTOM_SERVICES.map((service) => service.id);
    next.featuredActivity = "healthcare";
    next.featured = REWA_FEATURED_SERVICE_IDS[0];
  }

  const currentPages = asRecord(next.pages);
  const currentHome = asRecord(currentPages.home);
  const emptyPages = !pagesStory(next);
  const homeFeatured = featuredLooksLegacy(currentHome.featuredServiceIds);

  if (emptyPages || homeFeatured || isLegacyRewaCatalog(config)) {
    const nextHome = {
      ...currentHome,
      ...(emptyPages || homeFeatured ? { featuredServiceIds: REWA_PAGES.home.featuredServiceIds } : {}),
      ...(emptyPages && !(typeof currentHome.ctaLabel === "string" && currentHome.ctaLabel.trim())
        ? { ctaLabel: REWA_PAGES.home.ctaLabel }
        : {}),
      ...(emptyPages && (!Array.isArray(currentHome.stats) || currentHome.stats.length === 0)
        ? { stats: REWA_PAGES.home.stats }
        : {}),
    };
    next.pages = {
      ...currentPages,
      enabled: emptyPages ? REWA_PAGES.enabled : currentPages.enabled || REWA_PAGES.enabled,
      labels: emptyPages
        ? { ...asRecord(currentPages.labels), ...REWA_PAGES.labels }
        : currentPages.labels || REWA_PAGES.labels,
      home: nextHome,
      about: emptyPages ? { ...asRecord(currentPages.about), ...REWA_PAGES.about } : currentPages.about,
      services: emptyPages ? { ...asRecord(currentPages.services), ...REWA_PAGES.services } : currentPages.services,
      work: emptyPages ? { ...asRecord(currentPages.work), ...REWA_PAGES.work } : currentPages.work,
      contact: emptyPages ? { ...asRecord(currentPages.contact), ...REWA_PAGES.contact } : currentPages.contact,
    };
  }

  if (!next.subtitle) {
    next.subtitle =
      "منتجع استشفائي متكامل في المدينة المنورة: طب بديل، مجمع طبي، تأهيل، رياضة، دايت، جمعية وفعاليات، شقق خدمية، وكوفي مهى المدينة.";
  }

  const currentArea = asRecord(next.serviceArea);
  next.serviceArea = {
    ...currentArea,
    enabled: true,
    displayOnHomepage: true,
    city: REWA_MAP_CITY,
    center: { ...REWA_MAP_CENTER },
    radiusKm: 20,
    coverageNote: "منتجع رواء الاستشفاء الرقمي — المدينة المنورة",
    showAsFullCity: true,
  };
  next.mapsUrl = REWA_MAPS_URL;
  if (!next.location || String(next.location).includes("جدة")) {
    next.location = REWA_LOCATION;
  }

  if (!hasRewaIdentityTheme(next)) {
    const existing = Array.isArray(next.customThemes) ? next.customThemes : [];
    next.customThemes = [REWA_IDENTITY_THEME, ...existing];
  }

  next.social = fillRewaSocial(next.social);
  if (!next.phone) next.phone = REWA_PHONE;

  const currentAds = next.ads || {};
  const secondary = Array.isArray(currentAds.secondary) ? [...currentAds.secondary] : [];
  const existingIds = new Set(secondary.map((item) => (item && item.id) || "").filter(Boolean));
  for (const seed of REWA_PROMO_ADS) {
    if (!existingIds.has(seed.id)) secondary.push({ ...seed });
  }
  next.ads = { ...currentAds, secondary };

  return next;
}
