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
  resolvePageLabel,
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
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { BrandCutout } from "@/components/PlatformMark";
import { useColorScheme } from "@/context/ColorSchemeContext";
import { applyDocumentIcon, brandIconPath, isUsableLogoSrc, publicMediaSrc } from "@/lib/mken/logo-crop";
import { NeonSocialGlyph, WhatsappCta, WhatsappMark, type SocialPlatform } from "@/components/social/NeonSocialIcons";
import NeonSocialRow from "@/components/social/NeonSocialRow";
import {
  buildBookingWhatsappText,
  buildInquiryWhatsappText,
  buildWhatsappClickUrl,
  openWhatsappClick,
} from "@/lib/mken/wa-click";
import { newBookingId, submitPublicBooking } from "@/lib/mken/book-request";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import {
  CalendarCheck,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Phone,
  X,
  Zap,
} from "lucide-react";

const SOCIAL_GLYPH_IDS = new Set<string>([
  "twitter",
  "tiktok",
  "instagram",
  "snapchat",
  "whatsapp",
  "youtube",
  "facebook",
  "linkedin",
  "telegram",
]);

function isSocialPlatform(id: string): id is SocialPlatform {
  return SOCIAL_GLYPH_IDS.has(id);
}

export function StorefrontSocialLinks({
  items,
  size = "sm",
  excludeWhatsapp = true,
}: {
  items: StorefrontContactPublic["social"];
  size?: "sm" | "md";
  excludeWhatsapp?: boolean;
}) {
  const rows = items.filter((row) => row.url && (excludeWhatsapp ? row.id !== "whatsapp" : true));
  if (!rows.length) return null;
  const box = size === "md" ? "w-12 h-12" : "w-10 h-10";
  const glyph = size === "md" ? 28 : 22;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="حسابات التواصل">
      {rows.map((row) => (
        <a
          key={row.id}
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          title={row.name}
          className={`inline-flex items-center justify-center rounded-2xl bg-surface-2 border border-line hover:border-amber-500/50 hover:bg-surface transition ${box}`}
        >
          {isSocialPlatform(row.id) ? (
            <NeonSocialGlyph platform={row.id} size={glyph} />
          ) : (
            <span className="text-base" aria-hidden>
              {row.icon || row.name}
            </span>
          )}
          <span className="sr-only">{row.name}</span>
        </a>
      ))}
    </nav>
  );
}

export interface StorefrontServiceOption {
  id: string;
  name: string;
  badge: string;
  price: string;
  features: string[];
  image: string;
  description: string;
  popular?: boolean;
  category?: string;
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
    commercialRegistryName?: string;
    commercialRegistryNumber?: string;
  };
  href: (page: StorefrontPageId) => string;
  whatsappHref: string;
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
    category: service.category || "",
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
  const { showToast, user, logout } = useApp();
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
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<StorefrontServiceOption | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("16:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setClientName((current) => current || user.full_name || "");
    setClientPhone((current) => current || user.phone || "");
  }, [user]);

  useEffect(() => {
    if (appearance) setDarkEnabled(appearance.darkModeEnabled !== false);
  }, [appearance, setDarkEnabled]);

  // Live Preview Event Listener (Micro-Reconciler connection)
  useEffect(() => {
    const handlePreviewPatch = (e: Event) => {
      const patches = (e as CustomEvent).detail;
      if (!Array.isArray(patches)) return;
      setStoreClient((prev) => {
        const base = prev || ({
          slug: slug || "demo",
          name: "متجر مكّن التجريبي",
          tagline: "أشهى المأكولات والمنتجات بجودة عالية",
          subtitle: "مرحباً بك في المتجر التجريبي",
          type: "restaurant",
          phone: "+966501234567",
          whatsapp: "966501234567",
          location: "الرياض - المملكة العربية السعودية",
          rating: "4.9",
          reviewsCount: "128",
          heroImage: "",
          logo: "",
          commercialRegistryName: "مؤسسة المتجر التجريبي",
          commercialRegistryNumber: "1010998877",
          demoNotice: "معاينة تجريبية مؤمنة - غير صالحة للأغراض التجارية أو الضريبية",
          theme: "emerald",
          couponCode: "",
          discountText: "",
          promoTitle: "",
        } as StorefrontClient);
        const copy = { ...base };
        for (const p of patches) {
          if (p.path === "/client/name") copy.name = p.value;
          if (p.path === "/client/tagline") copy.tagline = p.value;
          if (p.path === "/client/subtitle") copy.subtitle = p.value;
        }
        return copy;
      });
      setLoadState("ready");
    };

    window.addEventListener("mken-preview-patch", handlePreviewPatch);
    return () => window.removeEventListener("mken-preview-patch", handlePreviewPatch);
  }, [slug]);

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

    const initSyntheticStore = () => {
      const foundClient = DEFAULT_CLIENTS.find((c) => c.slug === slug);
      if (foundClient) {
        setStoreClient({
          slug: foundClient.slug,
          name: foundClient.name,
          tagline: foundClient.tagline || "",
          subtitle: foundClient.subtitle || "",
          type: foundClient.type,
          phone: foundClient.phone || "+966501234567",
          whatsapp: foundClient.whatsapp || "966501234567",
          location: foundClient.location || "المملكة العربية السعودية",
          rating: foundClient.rating || "4.9",
          reviewsCount: foundClient.reviewsCount || "120 تقييم",
          heroImage: foundClient.heroImage || "",
          logo: foundClient.logo || "",
          commercialRegistryName: foundClient.commercialRegistryName || "",
          commercialRegistryNumber: foundClient.commercialRegistryNumber || "",
          demoNotice: foundClient.demoNotice || "معاينة تجريبية مؤمنة - منصة مكّن",
          theme: foundClient.theme || "emerald",
          couponCode: foundClient.couponCode || "",
          discountText: foundClient.discountText || "",
          promoTitle: foundClient.promoTitle || "",
        });

        if (slug === "qasr-najd") {
          setCatalog({
            kind: "generic",
            services: [
              {
                id: "qn-01",
                name: "كبسة حاشي بلدي طازج",
                badge: "الأكثر طلباً",
                price: "75 ر.س",
                features: ["لحم حاشي بلدي طازج", "أرز بشاور فاخر", "سلطة حارة ومخلل"],
                image: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80",
                description: "مطهو على الطريقة النجدية الأصيلة مع بهارات قصر نجد الخاصة وتوابل الزعفران.",
                popular: true,
                category: "الأطباق الرئيسية",
              },
              {
                id: "qn-02",
                name: "جريش نجدي بالمسمنة والسمن البري",
                badge: "طبق تراثي",
                price: "35 ر.س",
                features: ["قمح حب مجروش", "مسمنة بصل مكرمل", "سمن بري غنم"],
                image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
                description: "مطهو على نار هادئة لساعات طويلة حتى يكتسب القوام الكريمي والمذاق الغني.",
                popular: true,
                category: "شعبيات نجد",
              },
              {
                id: "qn-03",
                name: "قرصان نجد باللحم البلدي والخضار",
                badge: "مميز",
                price: "30 ر.س",
                features: ["رقاق قمح مسبك", "خضار مشكلة طازجة", "مرق لحم غني"],
                image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
                description: "طبقات من رقاق القرصان المسقي بمرق اللحم والخضار النجدية الشهية.",
                popular: false,
                category: "شعبيات نجد",
              },
              {
                id: "qn-04",
                name: "دلة قهوة سعودية مع خلاص القصيم الفاخر",
                badge: "ضيافة ملكية",
                price: "45 ر.س",
                features: ["بن هرري محمص بدرجة شقراء", "هيل وزعفران سوبر نقيل", "تمر خلاص مكنوز"],
                image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
                description: "رمز الكرم والضيافة السعودية تُقدم ساخنة في دلة رسلان مع الفنجان والتمر الفاخر.",
                popular: true,
                category: "المشروبات والضيافة",
              },
            ],
          });
        } else if (slug === "arkan-spa") {
          setCatalog({
            kind: "salon",
            services: [
              {
                id: "ark-01",
                name: "باقة العريس الملكية المتكاملة VIP",
                badge: "باقة النخبة",
                price: "650 ر.س",
                features: ["حلاقة ملكية وتحديد لحية", "تنظيف بشرة هيدرافاشيل", "مساج استرخائي 45 دقيقة", "بديكير ومناكير سبا"],
                image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
                description: "عناية متكاملة قبل المناسبات الكبرى في جناح خاص بأعلى معايير التعقيم والخصوصية.",
                popular: true,
                category: "باقات المناسبات",
              },
              {
                id: "ark-02",
                name: "حلاقة ملكية وتحديد اللحية بالموس الإيطالي",
                badge: "الأكثر طلباً",
                price: "85 ر.س",
                features: ["فوطة بخار ساخنة مهدئة", "تحديد دقيق للشوارب واللحية", "سيروم مغذي بالزيوت الطبيعية"],
                image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=80",
                description: "تجربة حلاقة دقيقة تمنحك إطلالة مهندمة وتغذي مسامات الجلد وبصيلات اللحية.",
                popular: true,
                category: "الحلاقة والتشذيب",
              },
              {
                id: "ark-03",
                name: "جلسة تنظيف بشرة هيدرافاشيل عميق",
                badge: "عناية طبية",
                price: "220 ر.س",
                features: ["إزالة الرؤوس السوداء والشوائب", "تقشير مائي غير جراحي", "حقن سيروم حمض الهيالورونيك"],
                image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
                description: "تجديد شباب البشرة والتخلص من علامات الإرهاق وأشعة الشمس في 45 دقيقة.",
                popular: false,
                category: "العناية بالبشرة",
              },
              {
                id: "ark-04",
                name: "مساج الأحجار البركانية الساخنة (Hot Stone)",
                badge: "استرخاء عميق",
                price: "280 ر.س",
                features: ["أحجار بازلتية دافئة", "زيوت لافندر وإكليل الجبل", "إرخاء العضلات المتشنجة"],
                image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80",
                description: "جلسة علاجية تزيل الضغوط وتنشط الدورة الدموية بإشراف أخصائي مساج محترف.",
                popular: true,
                category: "السبا والمساج",
              },
            ],
          });
        } else if (slug === "dar-maysan") {
          setCatalog({
            kind: "commerce",
            services: [
              {
                id: "dm-01",
                name: "دهن عود براشين ملكي قديم (ربع تولة)",
                badge: "نادر ومميز",
                price: "420 ر.س",
                features: ["تقطير حطبي تقليدي", "نكهة سويتية بخورية فواحة", "ثبات على الشماغ لأكثر من 48 ساعة"],
                image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80",
                description: "دهن عود معتق مستخرج من غابات براشين التايلندية العريقة، مصفى ومحفوظ في قنينة كريستال فاخرة.",
                popular: true,
                category: "أدهان العود الفاخرة",
              },
              {
                id: "dm-02",
                name: "بخور مروكي دبل سوبر محسن فاخر (أوقية)",
                badge: "الأكثر مبيعاً",
                price: "290 ر.س",
                features: ["كسر مباخر كبيرة", "زبد كثيف مستمر", "خالي من رائحة المستكة أو الاحتراق"],
                image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80",
                description: "رائحة باردة فخمة تملأ أرجاء المجالس وصالات المناسبات والضيافة برائحة العود الأصيل.",
                popular: true,
                category: "أخشاب العود والبخور",
              },
              {
                id: "dm-03",
                name: "عطر ميسان رويال نيش (Extrait de Parfum 100ml)",
                badge: "إصدار حصري",
                price: "380 ر.س",
                features: ["تركيز عطري 35%", "مزيج العود والعنبر والزعفران", "توقيع عطري لا يُنسى"],
                image: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80",
                description: "عطر فاخر يجمع بين دفء الشرق وأناقة العطور العالمية في زجاجة ثقيلة بتصميم مهيب.",
                popular: false,
                category: "عطور النيش",
              },
              {
                id: "dm-04",
                name: "صندوق الإهداء التذكاري دار ميسان VIP",
                badge: "هدايا فاخرة",
                price: "850 ر.س",
                features: ["صندوق خشبي مبطن بالمخمل", "دهن عود + أوقية مروكي + عطر ميسان", "كتابة الاسم بالذهب"],
                image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80",
                description: "الهدية المثالية للتعبير عن التقدير في الأعياد والأعراس والمناسبات الرسمية.",
                popular: true,
                category: "بوكسات الإهداء",
              },
            ],
          });
        } else if (slug === "saj") {
          setCatalog({
            kind: "generic",
            featuredActivity: "restaurant",
            activities: [
              {
                id: "restaurant",
                title: "فطائر ومشاوي الصاج",
                shortTitle: "صاج",
                icon: "Utensils",
                tagline: "طازج يومياً",
              },
            ],
            services: [
              {
                id: "saj-01",
                activityId: "restaurant",
                duration: "10-15 دقيقة",
                name: "فطيرة شاورما صاج جامبو بالجبنة السائلة",
                badge: "الأكثر طلباً",
                price: "24 ر.س",
                features: ["دجاج متبل طازج", "خبز صاج رقيق مخبوز طازجاً", "ثومية وجبنة ذائبة ومخلل"],
                image: "https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&w=600&q=80",
                description: "شاورما دجاج محضرة على صاج ساخن مع صوص الثومية الخاص والجبنة الموتزاريلا الذائبة.",
                popular: true,
                category: "فطائر وشاورما الصاج",
              },
              {
                id: "saj-02",
                activityId: "restaurant",
                duration: "15-20 دقيقة",
                name: "صحن مشاوي مشكل صاج على الفحم",
                badge: "وجبة عائلية",
                price: "68 ر.س",
                features: ["شيش طاووق وكباب لحم", "خبز صاج ساخن", "حمص ومتبل وبطاطس مقلية"],
                image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
                description: "تشكيلة من أسياخ المشاوي الطازجة المشوية على الفحم مع خبز الصاج الطازج والمقبلات.",
                popular: true,
                category: "مشاوي الصاج",
              },
              {
                id: "saj-03",
                activityId: "restaurant",
                duration: "10 دقائق",
                name: "فطيرة جبنة حلوم وزعتر بلدي على الصاج",
                badge: "فطور ومساء",
                price: "16 ر.س",
                features: ["جبنة حلوم قبرصي مشوية", "زعتر فلسطيني بالسمسم", "طماطم ونعناع طازج"],
                image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80",
                description: "فطيرة صاج مقرمشة محشوة بقطع الحلوم المشوي وزيت الزيتون البكر والنعناع.",
                popular: false,
                category: "معجنات وفطائر",
              },
              {
                id: "saj-04",
                activityId: "restaurant",
                duration: "5 دقائق",
                name: "عصير صاج عوار قلب طازج (لتر عائلي)",
                badge: "طازج 100%",
                price: "28 ر.س",
                features: ["مانجو وفراولة طبيعية", "آيس كريم فانيلا", "قطع موز ومكسرات"],
                image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
                description: "خلطة صاج المنعشة من الفواكه الطبيعية الطازجة مع الآيس كريم لترطيب وانتعاش يدوم.",
                popular: true,
                category: "المشروبات والعصائر",
              },
            ],
          } as unknown as StorefrontCatalog);
        }
        setLoadState("ready");
        return;
      }

      setStoreClient({
        slug: slug || "demo",
        name: "متجر مكّن التجريبي",
        tagline: "أشهى المأكولات والمنتجات بجودة عالية",
        subtitle: "مرحباً بك في المتجر التجريبي، استكشف المنتجات واحجز خدماتك بكل سهولة",
        type: "restaurant",
        phone: "+966501234567",
        whatsapp: "966501234567",
        location: "الرياض - المملكة العربية السعودية",
        rating: "4.9",
        reviewsCount: "128",
        heroImage: "",
        logo: "",
        commercialRegistryName: "مؤسسة المتجر التجريبي",
        commercialRegistryNumber: "1010998877",
        demoNotice: "معاينة تجريبية مؤمنة - غير صالحة للأغراض التجارية أو الضريبية",
        theme: "emerald",
        couponCode: "",
        discountText: "",
        promoTitle: "",
      });
      setCatalog({
        kind: "generic",
        services: [
          {
            id: "srv-01",
            name: "الخدمة التجريبية الأولى",
            badge: "الأكثر طلباً",
            price: "150 ر.س",
            features: ["جودة استثنائية", "تنفيذ فوري", "دعم متواصل"],
            image: "",
            description: "وصف الخدمة التجريبية لعرض شكل البطاقات في المتجر",
            popular: true,
            category: "خدمات مميزة",
          },
          {
            id: "srv-02",
            name: "الخدمة التجريبية الثانية",
            badge: "عرض خاص",
            price: "95 ر.س",
            features: ["خدمة سريعة", "ضمان معتمد"],
            image: "",
            description: "وصف توضيحي للخدمة الثانية لاختبار تجربة المستخدم والتنسيق",
            popular: false,
            category: "خدمات عامة",
          },
        ],
      });
      setLoadState("ready");
    };

    const path = `/api/clients/${encodeURIComponent(slug)}`;
    const platformUrl = `https://www.mken.live${path}`;
    const readJson = (res: Response) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status))));
    const isStorefrontPayload = (data: { success?: boolean; client?: unknown; catalog?: unknown } | null) =>
      Boolean(data?.success && data.client && data.catalog);
    const fetchOpts: RequestInit = { cache: "no-store" };
    fetch(path, fetchOpts)
      .then(readJson)
      .then((data) => (isStorefrontPayload(data) ? data : Promise.reject(new Error("incomplete"))))
      .catch(() => fetch(platformUrl, fetchOpts).then(readJson))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.client && data.catalog) {
          setStoreClient({
            ...data.client,
            heroImage: publicMediaSrc(data.client.heroImage || ""),
            logo: publicMediaSrc(data.client.logo || "") || data.client.logo,
          });
          setCatalog({
            ...data.catalog,
            services: (data.catalog.services || []).map((service: StorefrontCatalogService) => ({
              ...service,
              image: publicMediaSrc(service.image || ""),
            })),
          });
          setAppearance(
            data.appearance
              ? {
                  ...data.appearance,
                  ads: {
                    primary: {
                      ...data.appearance.ads.primary,
                      image: publicMediaSrc(data.appearance.ads.primary?.image || ""),
                    },
                    secondary: (data.appearance.ads.secondary || []).map((ad: { image?: string }) => ({
                      ...ad,
                      image: publicMediaSrc(ad.image || ""),
                    })),
                  },
                }
              : null
          );
          const nextPages = data.pages || emptyPages();
          setPages({
            ...nextPages,
            home: {
              ...nextPages.home,
              partners: (nextPages.home?.partners || []).map((partner: { image?: string }) => ({
                ...partner,
                image: publicMediaSrc(partner.image || ""),
              })),
            },
            about: {
              ...nextPages.about,
              team: (nextPages.about?.team || []).map((person: { image?: string }) => ({
                ...person,
                image: publicMediaSrc(person.image || ""),
              })),
            },
            work: {
              ...nextPages.work,
              gallery: (nextPages.work?.gallery || []).map((item: { image?: string }) => ({
                ...item,
                image: publicMediaSrc(item.image || ""),
              })),
            },
          });
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
          if (slug === "demo" || (typeof window !== "undefined" && window.location.search.includes("preview=true"))) {
            initSyntheticStore();
          } else {
            setLoadState("missing");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (slug === "demo" || (typeof window !== "undefined" && window.location.search.includes("preview=true"))) {
            initSyntheticStore();
          } else {
            setLoadState("missing");
          }
        }
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
        commercialRegistryName: storeClient.commercialRegistryName || "",
        commercialRegistryNumber: storeClient.commercialRegistryNumber || "",
      }
    : null;

  const href = (page: StorefrontPageId) => storefrontPageHref(slug, page, pathname);

  const inquiryWaHref = useMemo(
    () =>
      storeInfo?.whatsapp
        ? buildWhatsappClickUrl(storeInfo.whatsapp, buildInquiryWhatsappText(storeInfo.name))
        : "",
    [storeInfo?.whatsapp, storeInfo?.name]
  );

  useEffect(() => {
    applyDocumentIcon(brandIconPath(slug));
  }, [slug]);

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
      whatsappHref: inquiryWaHref,
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
    inquiryWaHref,
  ]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInfo || isSubmitting) return;
    if (!clientName.trim() || !clientPhone.trim()) {
      showToast("يرجى ملء كافة البيانات المطلوب إدخالها", "error");
      return;
    }

    setIsSubmitting(true);
    const appointmentId = newBookingId();
    const fields = {
      businessName: storeInfo.name,
      customerName: clientName,
      customerPhone: clientPhone,
      serviceName: selectedService?.name || "خدمة عامة",
      servicePrice: selectedService?.price,
      date: bookingDate || "اليوم",
      time: bookingTime,
      appointmentId,
    };
    const result = await submitPublicBooking({
      id: appointmentId,
      tenant: slug,
      customerName: clientName,
      customerPhone: clientPhone,
      date: bookingDate || new Date().toISOString().slice(0, 10),
      time: bookingTime.slice(0, 5),
      serviceId: selectedService?.id,
      serviceName: selectedService?.name,
      servicePrice: selectedService?.price,
    });
    setIsSubmitting(false);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }

    setBookingOpen(false);
    const href = buildWhatsappClickUrl(storeInfo.whatsapp, buildBookingWhatsappText(fields));
    if (href) {
      showToast(`تم حفظ حجزك في تقويم ${storeInfo.name} — أكمل الإرسال من واتساب`, "success");
      openWhatsappClick(href);
      return;
    }
    showToast(`تم حفظ حجزك في تقويم ${storeInfo.name}. سنتواصل معك قريباً`, "success");
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
    label: resolvePageLabel(pages, id, id === "services" ? servicesNavLabel : undefined),
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-2 flex items-center justify-between gap-3">
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
                  <h1 className="font-extrabold text-foreground tracking-tight leading-tight text-[clamp(0.72rem,1.7vw,1.05rem)] line-clamp-2">
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
              {user ? (
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="max-w-[7rem] truncate text-[11px] font-bold text-foreground">
                    {user.full_name}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 rounded-xl bg-surface border border-line text-muted hover:text-foreground"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent("/")}` as Route}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-foreground hover:border-amber-500/50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  دخول الزائر
                </Link>
              )}
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
                <WhatsappCta href={inquiryWaHref} size="sm" compactOnMobile />
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
            {inquiryWaHref ? <WhatsappCta href={inquiryWaHref} size="md" /> : null}
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
                  {inquiryWaHref ? (
                    <li className="flex items-center gap-2">
                      <WhatsappMark size={18} />
                      <a href={inquiryWaHref} target="_blank" rel="noreferrer">
                        محادثة واتساب مباشرة
                      </a>
                    </li>
                  ) : null}
                </ul>
                {contactExtras.social.some((row) => row.url) || storeClient?.socialLinks ? (
                  <div className="pt-1 space-y-2">
                    <p className="text-[11px] font-bold text-foreground">تابعنا</p>
                    <NeonSocialRow
                      socialLinks={
                        storeClient?.socialLinks && Object.values(storeClient.socialLinks).some(Boolean)
                          ? storeClient.socialLinks
                          : Object.fromEntries(
                              contactExtras.social
                                .filter((row) => row.url)
                                .map((row) => [row.id === "twitter" ? "twitter" : row.id, row.url])
                            )
                      }
                      size="md"
                      align="right"
                    />
                  </div>
                ) : null}
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
              <div className="space-y-1">
                <div>
                  جميع الحقوق محفوظة © {new Date().getFullYear()}{" "}
                  {storeInfo.commercialRegistryName || storeInfo.name}
                </div>
                {storeInfo.commercialRegistryNumber ? (
                  <div className="flex items-center gap-2">
                    <span>السجل التجاري:</span>
                    <span dir="ltr" className="font-mono font-bold text-foreground">
                      {storeInfo.commercialRegistryNumber}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <Link href={"/privacy" as Route} className="hover:text-foreground transition-colors">
                  سياسة الخصوصية وحماية البيانات (PDPL)
                </Link>
                <span>•</span>
                <Link href={"/terms" as Route} className="hover:text-foreground transition-colors">
                  الشروط والأحكام
                </Link>
                <span>•</span>
                <Link href={"/" as Route} className="text-muted hover:text-foreground font-bold">
                  مشغّل بواسطة منصة مكّن 🇸🇦
                </Link>
              </div>
            </div>
          </div>
        </footer>

        {inquiryWaHref ? <WhatsappCta href={inquiryWaHref} floating /> : null}

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
                {!user ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted font-medium">دخول سريع لتعبئة الاسم من حسابك</p>
                    <SocialAuthButtons compact nextPath="/" />
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="flex-1 h-px bg-line" />
                      أو يدوياً
                      <span className="flex-1 h-px bg-line" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-600 font-bold">
                    مسجّل كـ {user.full_name}
                    {user.provider === "google" ? " عبر جوجل" : user.provider === "apple" ? " عبر آبل" : ""}
                  </p>
                )}
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
                  className="w-full py-3.5 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSubmitting ? "جاري حفظ الحجز..." : "تأكيد الحجز ومتابعة عبر الواتساب"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </StorefrontContext.Provider>
  );
}
