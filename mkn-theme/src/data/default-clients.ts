import type { ClientRecord, StorefrontClient } from "@/types/database";
import { publicBrandSrc } from "@/lib/mken/logo-crop";

/**
 * Seed records used until a client row exists in Supabase.
 * Credentials live in env (ADMIN_SEED_PASSWORDS), never in this bundle.
 */
export const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    slug: "almahrusa",
    name: "المحروسة للشقق المفروشة | Mahrousa Apartment",
    tagline: "شقق مفروشة راقية بالمدينة المنورة — حجز مباشر",
    subtitle:
      "شقق مفروشة مجهزة بالكامل في المدينة المنورة 42522 — وحدات بإطلالة حديقة وأسرّة ملكية وغرف فردية، مع واي فاي ومطبخ وموقف سيارات.",
    type: "hotel",
    phone: "0554453287",
    whatsapp: "966554453287",
    email: "stayinmedina@gmail.com",
    location: "شداد بن عارض، المدينة المنورة 42522",
    rating: "4.7",
    reviewsCount: "32 تقييم على Google",
    heroImage: "/almahrusa/hero.web.jpg",
    demoNotice: "صفحة المحروسة للشقق المفروشة — المدينة المنورة على منصة مكّن",
    socialLinks: {
      whatsapp: "https://wa.me/966554453287",
    },
    adminEmail: "almahrusa@mken.live",
    logo: publicBrandSrc("almahrusa.png"),
    theme: "custom-almahrusa",
    customThemes: [{ id: "custom-almahrusa", name: "هوية المحروسة", accentColor: "#6B2D91" }],
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "almasabi",
    name: "مؤسسة المصعبي للتجارة",
    tagline: "نحميك من الشمس… ونضيف الفخامة لمكانك",
    subtitle:
      "تصنيع وتركيب المظلات والسواتر والهناجر وساندوتش بانل والبرجولات والخيام في المنطقة الغربية: المدينة المنورة، مكة المكرمة، جدة، والطائف. خامات كورية وفرنسية وألمانية وأسعار منافسة.",
    type: "other",
    phone: "0545111130 - 0543530333 - 0530006585",
    whatsapp: "966543530333",
    email: "info@almasabi.sa",
    location: "المنطقة الغربية — المدينة المنورة، مكة المكرمة، جدة، والطائف",
    commercialRegistryName: "مؤسسة عبدالإله علي المصعبي التجارية",
    commercialRegistryNumber: "7051816481",
    rating: "",
    reviewsCount: "",
    heroImage: "https://almasabi-media.vercel.app/hero.jpg",
    logo: publicBrandSrc("almasabi.png"),
    demoNotice: "صفحة مؤسسة المصعبي للتجارة — مظلات وسواتر وهناجر على منصة مكّن",
    adminEmail: "almasabi@mken.live",
    theme: "custom-almasabi",
    customThemes: [
      {
        id: "custom-almasabi",
        name: "هوية المصعبي",
        accentColor: "#f37f0d",
        badgeBg: "#5a2b7f",
        bgGradient: "#f6f1fb",
      },
    ],
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "demo",
    name: "صالون النخبة",
    tagline: "احجز وادخل بدون انتظار",
    subtitle:
      "في صالون النخبة نوفر حلاقة رجالية ونسائية، عناية باللحية، وتجميل – احجز موعدك أونلاين واختر الوقت المناسب.",
    type: "salon",
    phone: "0543530333",
    whatsapp: "966543530333",
    email: "info@demo-salon.sa",
    location: "حي الربيع - الرياض، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "512 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
    demoNotice:
      "🚀 عرض تجريبي حي – مثال: صالون النخبة على مكّن. جرب 14 يوماً مجاناً",
    adminEmail: "demo@mken.live",
    theme: "none",
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "rewa",
    name: "منتجع رواء الاستشفاء الرقمي",
    tagline: "رواء.. توازن واسترخاء",
    subtitle:
      "منتجع استشفائي متكامل في المدينة المنورة: طب بديل، مجمع طبي، تأهيل، رياضة، دايت، جمعية وفعاليات، شقق خدمية، وكوفي مهى المدينة.",
    type: "other",
    phone: "0148462524",
    whatsapp: "966549462524",
    email: "rewa@mken.live",
    location: "الحماوات، المدينة المنورة، المملكة العربية السعودية",
    rating: "4.9",
    reviewsCount: "210 تقييم موثق",
    heroImage:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80",
    demoNotice:
      "✨ الموقع الرسمي لمنتجع رواء الاستشفاء الرقمي (rewa.care) على منصة مكّن",
    adminEmail: "rewa@mken.live",
    logo: publicBrandSrc("rewa.png"),
    commercialRegistryName: "منتجع رواء الاستشفائي الرقمي",
    commercialRegistryNumber: "7043321418",
    theme: "none",
    customThemes: [{ id: "custom-rewa", name: "هوية رواء", accentColor: "#1A3F66" }],
    socialLinks: {
      instagram: "https://instagram.com/rewa.100000",
      tiktok: "https://www.tiktok.com/@rewa.1000",
      snapchat: "https://www.snapchat.com/add/rewa.1000",
      whatsapp: "https://wa.me/966549462524",
    },
    active: true,
    createdAt: new Date("2026-01-01").toISOString(),
  },
  {
    slug: "rewaq",
    name: "Rewaq Resident | رواق ريزدنت",
    tagline: "شقق مفروشة في مذينب، المدينة المنورة — حجز مباشر",
    subtitle:
      "شقق مفروشة مجهزة في حي مذينب بالمدينة المنورة 42317 — واي فاي ومطبخ صغير وتكييف وموقف سيارات. شهري - سنوي.",
    type: "hotel",
    phone: "0541303411",
    whatsapp: "966541303411",
    email: "rewaqresident@gmail.com",
    location: "اسيد بن كعب، مذينب، المدينة المنورة 42317",
    rating: "4.8",
    reviewsCount: "105 تقييم على Google",
    heroImage: "/rewaq/hero.web.jpg?v=3",
    logo: publicBrandSrc("rewaq.png"),
    demoNotice: "رواق ريزدنت — مذينب، المدينة المنورة على منصة مكّن",
    socialLinks: {
      whatsapp: "https://wa.me/966541303411",
    },
    adminEmail: "rewaqresident@gmail.com",
    theme: "custom-rewaq",
    customThemes: [{ id: "custom-rewaq", name: "هوية رواق ريزدنت", accentColor: "#7A4E2D" }],
    active: true,
    createdAt: new Date("2026-09-02").toISOString(),
  },
  {
    slug: "qasr-najd",
    name: "مطعم ومقهى قصر نجد التراثي",
    tagline: "أصالة الضيافة النجدية وتراث الأجداد في قلب العاصمة",
    subtitle:
      "نقدم في قصر نجد تجربة ضيافة سعودية فريدة: كبسة الحاشي البلدي، الجريش النجدي بالمسمنة، القرصان، والقهوة السعودية الملكية مع تمر خلاص القصيم في جلسات تراثية عائلية وملكية.",
    type: "restaurant",
    phone: "0114889900",
    whatsapp: "966504889900",
    email: "contact@qasrnajd.sa",
    location: "طريق التخصصي الفرعي، حي النخيل، الرياض 12384",
    commercialRegistryName: "مؤسسة قصر نجد التراثية لخدمات الإعاشة",
    commercialRegistryNumber: "1010348921",
    rating: "4.9",
    reviewsCount: "1,420 تقييم موثق",
    heroImage: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80",
    demoNotice: "قصر نجد التراثي — الرياض على منصة مكّن (معاينة تجريبية مؤمنة)",
    adminEmail: "admin@qasrnajd.sa",
    theme: "custom-qasr-najd",
    customThemes: [{ id: "custom-qasr-najd", name: "الهوية النجدية التراثية", accentColor: "#C27835" }],
    socialLinks: {
      whatsapp: "https://wa.me/966504889900",
      instagram: "https://instagram.com/qasr_najd_sa",
      tiktok: "https://tiktok.com/@qasrnajd",
    },
    active: true,
    createdAt: new Date("2026-02-01").toISOString(),
  },
  {
    slug: "arkan-spa",
    name: "صالون وسبا أركان اللحية والعناية الرجالية",
    tagline: "تجربة العناية الفندقية الفاخرة للرجل العصري",
    subtitle:
      "باقات متكاملة للعرسان ورجال الأعمال: حلاقة ملكية، تشذيب وتحديد اللحية بالموس الإيطالي، جلسات هايدرافاشيل للبشرة، ومساج الأحجار البركانية بأيدي خبراء متخصصين في أجواء راقية وخصوصية تامة.",
    type: "salon",
    phone: "0126655443",
    whatsapp: "966556655443",
    email: "info@arkan-spa.sa",
    location: "شارع الأمير محمد بن عبد العزيز (التحلية)، حي الروضة، جدة 23431",
    commercialRegistryName: "شركة أركان الجمال والعناية الرجالية ذات مسؤولية محدودة",
    commercialRegistryNumber: "4030289110",
    rating: "4.9",
    reviewsCount: "860 تقييم موثق",
    heroImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
    demoNotice: "صالون وسبا أركان — جدة على منصة مكّن (معاينة تجريبية مؤمنة)",
    adminEmail: "admin@arkan-spa.sa",
    theme: "custom-arkan",
    customThemes: [{ id: "custom-arkan", name: "الزمرد الفندقي الفاخر", accentColor: "#0F2E22" }],
    socialLinks: {
      whatsapp: "https://wa.me/966556655443",
      instagram: "https://instagram.com/arkan_barber_sa",
      snapchat: "https://snapchat.com/add/arkan_spa",
    },
    active: true,
    createdAt: new Date("2026-03-01").toISOString(),
  },
  {
    slug: "dar-maysan",
    name: "دار ميسان للعود والعطور الشرقية الفاخرة",
    tagline: "أصالة النفحات الملكية وأندر أخشاب العود الطبيعي المحسن",
    subtitle:
      "علامة سعودية متخصصة في انتقاء أجود أنواع العود المروكي والكلمنتان وأدهان العود المعتقة، مع عطور نيش حصرية بتركيبات شرقية ساحرة وتغليف هدايا فاخر لجميع مناطق المملكة والخليج العربي.",
    type: "commerce",
    phone: "0125544332",
    whatsapp: "966545544332",
    email: "care@darmaysan.sa",
    location: "طريق الدائري الثالث، مكة المكرمة 24231 — المعرض الرئيسي وفروع الرياض وجدة",
    commercialRegistryName: "مؤسسة دار ميسان للتجارة والتجزئة",
    commercialRegistryNumber: "1010721490",
    rating: "5.0",
    reviewsCount: "2,350 تقييم معتمد",
    heroImage: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1200&q=80",
    demoNotice: "دار ميسان للعود — متجر إلكتروني رسمي على مكّن (معاينة تجريبية مؤمنة)",
    adminEmail: "admin@darmaysan.sa",
    theme: "custom-dar-maysan",
    customThemes: [{ id: "custom-dar-maysan", name: "برغندي ميسان الملكي", accentColor: "#4A1525" }],
    socialLinks: {
      whatsapp: "https://wa.me/966545544332",
      instagram: "https://instagram.com/dar_maysan_sa",
      tiktok: "https://tiktok.com/@darmaysan",
    },
    active: true,
    createdAt: new Date("2026-04-01").toISOString(),
  },
  {
    slug: "saj",
    name: "مطعم ومخابز صاج الريف | Saj Al-Reef",
    tagline: "أشهى الفطائر والشاورما والمخبوزات على الصاج الطازج",
    subtitle:
      "مطعم ومخابز صاج متخصص في الفطائر الطازجة والشاورما والمشاوي على الصاج الساخن مع تشكيلة واسعة من المقبلات والعصائر الطازجة.",
    type: "restaurant",
    phone: "0114991122",
    whatsapp: "966554991122",
    email: "contact@saj-alreef.sa",
    location: "طريق الإمام سعود بن عبد العزيز بن محمد، حي التعاون، الرياض 12434",
    commercialRegistryName: "شركة صاج الريف المحدودة لتقديم الوجبات",
    commercialRegistryNumber: "1010887234",
    rating: "4.8",
    reviewsCount: "940 تقييم موثق",
    heroImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    demoNotice: "مطعم صاج الريف — الرياض على منصة مكّن (معاينة تجريبية موثقة)",
    adminEmail: "admin@saj-alreef.sa",
    theme: "custom-saj",
    customThemes: [{ id: "custom-saj", name: "هوية صاج الريف", accentColor: "#D9480F" }],
    socialLinks: {
      whatsapp: "https://wa.me/966554991122",
      instagram: "https://instagram.com/saj_alreef_sa",
      tiktok: "https://tiktok.com/@saj_alreef",
    },
    active: true,
    createdAt: new Date("2026-05-01").toISOString(),
  },
];

type CredentialField = "adminPassword" | "admin_password" | "admin_password_hash";

function omitCredentials<T extends object>(client: T): Omit<T, CredentialField> {
  const safe = { ...(client as Record<string, unknown>) };
  delete safe.adminPassword;
  delete safe.admin_password;
  delete safe.admin_password_hash;
  return safe as Omit<T, CredentialField>;
}

/** Full tenant record for an authenticated admin. Never includes passwords. */
export function adminClientView(client: ClientRecord): Omit<ClientRecord, CredentialField> {
  return omitCredentials(client);
}

/** Storefront-safe projection: identity and contact the public page already shows. */
export function storefrontClient(client: ClientRecord): StorefrontClient {
  return {
    slug: client.slug,
    name: client.name,
    tagline: client.tagline,
    subtitle: client.subtitle,
    type: client.type,
    phone: client.phone,
    whatsapp: client.whatsapp,
    location: client.location,
    rating: client.rating,
    reviewsCount: client.reviewsCount,
    heroImage: client.heroImage,
    logo: client.logo || "",
    commercialRegistryName: client.commercialRegistryName || "",
    commercialRegistryNumber: client.commercialRegistryNumber || "",
    taxNumber: client.taxNumber || "",
    demoNotice: client.demoNotice,
    theme: client.theme,
    couponCode: client.couponCode,
    discountText: client.discountText,
    promoTitle: client.promoTitle,
    discountEnabled: client.discountEnabled,
    socialLinks: client.socialLinks,
    claimStatus:
      client.claimStatus === "unclaimed" || client.claimStatus === "pending"
        ? client.claimStatus
        : "claimed",
  };
}

/** @deprecated Prefer adminClientView or storefrontClient. */
export const publicClient = adminClientView;
