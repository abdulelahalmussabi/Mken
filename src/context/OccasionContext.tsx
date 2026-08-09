"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type OccasionId =
  | "none"
  | "ramadan"
  | "eid_fitr"
  | "eid_adha"
  | "national_day"
  | "founding_day"
  | "flag_day";

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
}

export const SAUDI_OCCASIONS: Record<OccasionId, OccasionDetails> = {
  none: {
    id: "none",
    name: "المظهر القياسي (منصة مكّن)",
    shortName: "القياسي",
    slogan: "تحسين ظهور أنشطتك التجارية على خرائط قوقل",
    couponCode: "MKN10",
    discountText: "خصم 10% على أول طلب تحسين محلي",
    accentColor: "#f97316",
    badgeBg: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    bgGradient: "from-slate-900 via-slate-950 to-slate-900",
    greetingTemplate: (name) => `مرحباً بك أستاذ ${name} في لوحة التحكم`,
    countdownText: "الخدمة متاحة على مدار 24 ساعة",
    targetDate: "2026-12-31T23:59:59",
    stickers: ["مرحباً بك", "شكراً للتواصل", "تم استلام الطلب", "بالتوفيق"],
    description: "الهوية الأساسية الفاخرة لمنصة مكّن بلوني الأزرق الداكن والبرتقالي المتوهج.",
    historicNote: "تصميم عصري متناسق لجميع الأوقات والأيام العادية.",
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
    stickers: ["مبارك عليكم الشهر 🌙", "تقبل الله طاعتكم ✨", "رمضان كريم 💛", "جزاكم الله خيراً 🤲"],
    description: "ثيم رمضاني روحاني متألق باللون الكحلي العميق والتذهيب الأنيق مع الفوانيس والنجوم.",
    historicNote: "شهر الصيام والقرآن والتكافل الاجتماعي والمبادرات الخيرية في المملكة.",
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
    stickers: ["عيدكم مبارك 🎈", "عساكم من عواده ✨", "كل عام وأنتم بخير ☕", "تقبل الله منا ومنكم 🍬"],
    description: "ثيم فرائحي مليء بالألوان الأرجوانية والبرتقالية وتأثيرات قصاصات المطر والمعمول والقهوة.",
    historicNote: "عيد الأمة الإسلامية بعد صيام رمضان المبارك، واحتفال الفرحة بالتواصل والعيدية.",
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
    stickers: ["حج مبرور وذنب مغفور 🕋", "عيد أضحى مبارك ✨", "تقبل الله أعمالكم 🤲", "كل عام وأنتم بخير 🌾"],
    description: "هوية إيمانية ملكية بالأخضر الزمردي والأسود والتذهيب المستوحى من كسوة الكعبة المشرفة.",
    historicNote: "مناسبة الحج والأضحية المباركة واجتماع ضيوف الرحمن في المشاعر المقدسة.",
  },
  national_day: {
    id: "national_day",
    name: "اليوم الوطني السعودي 96 🇸🇦",
    shortName: "اليوم الوطني 96",
    slogan: "نحلم ونحقق - 96 عاماً من الفخر والعز والمجد",
    couponCode: "KSA96",
    discountText: "عروض اليوم الوطني: خصم 40% حصري لجميع أصحاب المحلات في المملكة",
    accentColor: "#10b981",
    badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    bgGradient: "from-emerald-950 via-slate-950 to-green-950/40",
    greetingTemplate: (name) => `دام عزك يا وطن! مرحباً بك أستاذ ${name} في يوم الفخر والاعتزاز.`,
    countdownText: "متبقي على احتفالات اليوم الوطني السعودي 96 (23 سبتمبر)",
    targetDate: "2026-09-23T00:00:00",
    stickers: ["دام عزك يا وطن 🇸🇦", "نحلم ونحقق ✨", "همة حتى القمة 🌴", "فخر واعتزاز 🦅"],
    description: "ثيم وطني مهيب باللون الأخضر السعودي المشع والسيفين والنخلة وزخارف رؤية 2030.",
    historicNote: "ذكرى توحيد المملكة العربية السعودية على يد الملك المؤسس عبد العزيز آل سعود عام 1932م.",
  },
  founding_day: {
    id: "founding_day",
    name: "يوم التأسيس السعودي 🦅",
    shortName: "يوم التأسيس",
    slogan: "يوم بدينا 1727م - ثلاثة قرون من الأصالة والعز والتاريخ",
    couponCode: "FOUNDING1727",
    discountText: "باقة يوم التأسيس: خصم 30% مع توثيق احترافي ونقوش تراثية",
    accentColor: "#d97706",
    badgeBg: "bg-amber-900/40 text-amber-200 border-amber-600/40",
    bgGradient: "from-amber-950 via-slate-950 to-amber-950/50",
    greetingTemplate: (name) => `يوم بدينا! أهلاً بك أستاذ ${name} في ذكرى ثلاثة قرون من العز.`,
    countdownText: "متبقي على احتفالية يوم التأسيس (22 فبراير)",
    targetDate: "2026-02-22T00:00:00",
    stickers: ["يوم بدينا 🦅", "ثلاثة قرون من العز 🌴", "منذ عام 1727م 📜", "أصالة وتاريخ 🏇"],
    description: "ثيم تراثي فاخر باللون الطيني والتراكوتا والسدو والخيل العربي الأصيل والختم التاريخي.",
    historicNote: "ذكرى تأسيس الدولة السعودية الأولى على يد الإمام محمد بن سعود عام 1139هـ / 1727م.",
  },
  flag_day: {
    id: "flag_day",
    name: "يوم العلم السعودي 🟢",
    shortName: "يوم العلم",
    slogan: "راية التوحيد الخفاقة - رمز السيادة والقوة والكرامة",
    couponCode: "FLAGDAY26",
    discountText: "خصم 20% احتفاءً براية الوطن الخضراء وشهادة التوحيد",
    accentColor: "#34d399",
    badgeBg: "bg-teal-500/20 text-teal-300 border-teal-500/40",
    bgGradient: "from-teal-950 via-slate-950 to-emerald-950/40",
    greetingTemplate: (name) => `راية الفخر ترفرف! أهلاً بك أستاذ ${name} في يوم العلم السعودي.`,
    countdownText: "متبقي على احتفالية يوم العلم السعودي (11 مارس)",
    targetDate: "2026-03-11T00:00:00",
    stickers: ["مجدي وكرري 🟢", "راية التوحيد 🇸🇦", "الخفاق الأخضر ⚔️", "وطن الكرامة ✨"],
    description: "ثيم راقٍ ومضيء بالأخضر الفاقع والأبيض النقي احتفاءً بعلم المملكة وشهادة التوحيد.",
    historicNote: "اليوم الذي أقر فيه الملك عبد العزيز رحمه الله العلم بشكله الحالي في 11 مارس 1937م.",
  },
};

interface OccasionContextType {
  activeOccasion: OccasionId;
  setOccasion: (id: OccasionId) => void;
  occasionDetails: OccasionDetails;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  copyCoupon: (code: string) => void;
  isMounted: boolean;
}

const OccasionContext = createContext<OccasionContextType | undefined>(undefined);

export const OccasionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOccasion, setActiveOccasionState] = useState<OccasionId>("national_day");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem("mkn_occasion");
      if (saved && SAUDI_OCCASIONS[saved as OccasionId]) {
        setActiveOccasionState(saved as OccasionId);
      }
    } catch {
      // fallback
    }
  }, []);

  const setOccasion = (id: OccasionId) => {
    setActiveOccasionState(id);
    try {
      localStorage.setItem("mkn_occasion", id);
    } catch {
      // ignore
    }
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

  return (
    <OccasionContext.Provider
      value={{
        activeOccasion,
        setOccasion,
        occasionDetails: SAUDI_OCCASIONS[activeOccasion] || SAUDI_OCCASIONS.none,
        showModal,
        openModal,
        closeModal,
        copyCoupon,
        isMounted,
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
