"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import {
  Dumbbell,
  Utensils,
  Timer,
  Award,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  Send,
  X,
  Star,
  Zap,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  Tag
} from "lucide-react";

interface PlanItem {
  id: string;
  category: "gym" | "meals" | "sessions" | "exhibitions";
  title: string;
  badge: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  trainer?: string;
  mealsInfo?: string;
}

const SUBSCRIPTIONS_DATA: PlanItem[] = [
  // 1. Gym
  {
    id: "gym-1",
    category: "gym",
    title: "عضوية اللياقة الفضية (Silver Gym)",
    badge: "نادي رياضي 🏋️",
    price: "299",
    period: "ر.س / شهرياً",
    description: "دخول غير محدود لصالة الحديد والكارديو مع خزائن خاصة واستخدام الساونا.",
    features: [
      "دخول غير محدود طوال الشهر 24/7",
      "أجهزة كارديو وحديد حديثة إيطالية",
      "خزانة شخصية ومرافق استجمام",
      "تقييم لياقة وقياس InBody شهري مجاني"
    ]
  },
  {
    id: "gym-2",
    category: "gym",
    title: "عضوية الـ VIP الذهبية الشاملة",
    badge: "الأكثر طلباً 🌟",
    price: "699",
    period: "ر.س / 3 أشهر",
    description: "تشمل صالات الحديد، المسبح الأولمبي، حصص اللياقة الجماعية، ومواقف مخصصة.",
    features: [
      "كافة مميزات الباقة الفضية",
      "دخول المسبح الأولمبي والجاكوزي",
      "حضور مجاني لجميع الكلاسات الجماعية",
      "موقف سيارة مظلل ومشروبات بروتين مجانية"
    ],
    popular: true
  },
  {
    id: "gym-3",
    category: "gym",
    title: "العضوية السنوية الملكية (Diamond Annual)",
    badge: "سنوي حصري 👑",
    price: "1,899",
    period: "ر.س / سنوياً",
    description: "توفير 45% مع تجميد اشتراك حتى 60 يوماً ودعوات مجانية للأصدقاء.",
    features: [
      "اشتراك سنوي كامل مع إمكانية التجميد 60 يوماً",
      "12 جلسة تدريب شخصي مجانية",
      "6 دعوات VIP للضيوف والأصدقاء",
      "حقيبة رياضية ومنتجات مكملات هدية"
    ]
  },

  // 2. Meals
  {
    id: "meals-1",
    category: "meals",
    title: "باقة التنشيف والرشاقة (Lean Diet)",
    badge: "وجبات صحية 🥗",
    price: "1,150",
    period: "ر.س / شهرياً (24 يوم)",
    description: "وجبتان رئيسيتان + سناك صحي يومياً محسوبة السعرات بدقة للوصول للوزن المثالي.",
    mealsInfo: "2 وجبة + 1 سناك يومياً",
    features: [
      "وجبتان صحيتان + سناك بروتين يومياً",
      "توصيل مبرد طازج صباح كل يوم لباب بيتك",
      "تحديد السعرات والماكروز بدقة مع أخصائي",
      "مرونة في اختيار وتغيير قائمة الأطباق أسبوعياً"
    ]
  },
  {
    id: "meals-2",
    category: "meals",
    title: "باقة الكيتو واللوكارب المتكاملة",
    badge: "كيتو دايت 🥑",
    price: "1,450",
    period: "ر.س / شهرياً (24 يوم)",
    description: "3 وجبات كيتو غنية بالدهون الصحية والبروتين النقي مع حلويات كيتو فاخرة.",
    mealsInfo: "3 وجبات كيتو + سناك دهون صحية",
    features: [
      "3 وجبات كيتو معتمدة بنسبة كارب أقل من 5%",
      "توصيل يومي معبأ بأحدث تقنيات حفظ الأطعمة",
      "متابعة أسبوعية مع أخصائي تغذية كيتو",
      "مشروبات إلكترولايت وحلى كيتو خالي من السكر"
    ],
    popular: true
  },
  {
    id: "meals-3",
    category: "meals",
    title: "باقة التضخيم والبناء العضلي (Bulking Pro)",
    badge: "بروتين عالي 🥩",
    price: "1,650",
    period: "ر.س / شهرياً (26 يوم)",
    description: "4 وجبات غنية بالبروتين (180g+ بروتين) والكارب المعقد للرياضيين وممارسي كمال الأجسام.",
    mealsInfo: "4 وجبات رئيسية ضخمة",
    features: [
      "4 وجبات يومية عادية أو دبل بروتين",
      "صدور دجاج، سلمون، ولحوم بقر ستيك طازجة",
      "توصيل صباحي أو مسائي حسب جدول تمرينك",
      "شيك بروتين وفيتامينات مجاناً مع الباقة"
    ]
  },

  // 3. Sessions
  {
    id: "session-1",
    category: "sessions",
    title: "باقة 8 حصص تدريب شخصي (1-on-1)",
    badge: "تدريب شخصي ⏱️",
    price: "850",
    period: "ر.س / باقة شهرية",
    description: "حصتان أسبوعياً مع مدرب معتمد لتصحيح الأداء ووضع برنامج تمرين وغذاء مخصص.",
    trainer: "كابتن معتمد دولياً (REPs)",
    features: [
      "8 جلسات خاصة مدة كل جلسة 60 دقيقة",
      "تصميم جدول تمارين خاص بأهدافك",
      "متابعة يومية للوجبات عبر الواتساب",
      "تعديل التمارين حسب قدرتك وإصاباتك السابقة"
    ]
  },
  {
    id: "session-2",
    category: "sessions",
    title: "باقة التحول الشامل (16 حصة مكثفة)",
    badge: "الأسرع نتائج 🚀",
    price: "1,490",
    period: "ر.س / باقة شهرية",
    description: "4 حصص أسبوعياً مع كابتن خاص، قياسات حيوية، وتحدي خسارة دهون وبناء عضلات سريع.",
    trainer: "نخبة كباتن اللياقة والتحول",
    features: [
      "16 جلسة خاصة مكثفة 60 دقيقة",
      "خطة مكملات غذائية ونظام دايت احترافي",
      "تصوير ومقارنة النتائج أسبوعياً",
      "أولوية حجز الأوقات المفضلة للمتدرب"
    ],
    popular: true
  },
  {
    id: "session-3",
    category: "sessions",
    title: "باقة كلاسات البيلاتس والكروسفت الجماعية",
    badge: "كلاسات جماعية 🔥",
    price: "550",
    period: "ر.س / 12 كلاس",
    description: "حضور 12 حصة جماعية تفاعلية تشمل HIIT، بيلاتس، سبينينج، وتمارين مقاومة.",
    trainer: "مدربات ومدربين كلاسات معتمدين",
    features: [
      "12 حصة جماعية في استوديوهات مجهزة بأحدث الصوتيات",
      "حماس وطاقة جماعية لحرق أقصى سعرات حرارية",
      "مرونة في حجز الحصص عبر التطبيق",
      "مناسب لجميع المستويات من المبتدئ للمتقدم"
    ]
  },

  // 4. Exhibitions
  {
    id: "exhibit-1",
    category: "exhibitions",
    title: "بطاقة الزائر للمعارض والمؤتمرات السنوية",
    badge: "معارض ومؤتمرات 🎪",
    price: "350",
    period: "ر.س / تذكرة موسمية",
    description: "دخول لكافة فعاليات المعارض التجارية والملتقيات المتخصصة المقامة على مدار العام.",
    features: [
      "دخول غير محدود لجميع أيام المعرض والملتقى",
      "بطاقة زائر رقمية ذكية مع رمز QR فوري",
      "حضور الجلسات الحوارية وورش العمل المفتوحة",
      "كتيب الدليل التجاري وقائمة الشركات العارضة"
    ]
  },
  {
    id: "exhibit-2",
    category: "exhibitions",
    title: "باقة كبار الشخصيات ورجال الأعمال (VIP Pass)",
    badge: "VIP للأعمال 💼",
    price: "1,200",
    period: "ر.س / للمؤتمر الكامل",
    description: "دخول قاعات الـ VIP، مقاعد الصف الأول، جلسات B2B الخاصة، وخدمة صف السيارات.",
    features: [
      "دخول صالة كبار الشخصيات (VIP Lounge) والضيافة الفاخرة",
      "مقاعد محجوزة في الصفوف الأولى في قاعة المؤتمرات الرئيسية",
      "تنسيق اجتماعات ثنائية B2B مع الرعاة والمتحدثين",
      "شهادة حضور معتمدة ومواقف سيارات خاصة مجانية"
    ],
    popular: true
  },
  {
    id: "exhibit-3",
    category: "exhibitions",
    title: "باقة وفود الشركات والجهات (Corporate Delegate)",
    badge: "وفود وشركات 🏢",
    price: "3,500",
    period: "ر.س / وفد حتى 5 أفراد",
    description: "تسجيل وفد رسمي متكامل مع جناح تعريفي مصغر وتغطية إعلامية.",
    features: [
      "بطاقات دخول شاملة لـ 5 ممثلين من منشأتك",
      "مساحة طاولة عرض براندينج (Branding Table) مصغرة",
      "إدراج شعار منشأتك في دليل الرعاة والمشاركين",
      "تغطية إعلامية وصور احترافية لوفد المنشأة"
    ]
  }
];

export default function SubscriptionsPage() {
  const { occasionDetails, openModal } = useOccasion();
  const { showToast } = useApp();

  const [activeTab, setActiveTab] = useState<"all" | "gym" | "meals" | "sessions" | "exhibitions">(
    "all"
  );
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredPlans =
    activeTab === "all"
      ? SUBSCRIPTIONS_DATA
      : SUBSCRIPTIONS_DATA.filter((p) => p.category === activeTab);

  const handleOpenSubscribe = (plan: PlanItem) => {
    setSelectedPlan(plan);
    setModalOpen(true);
  };

  const handleSubmitSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      showToast("يرجى تعبئة الاسم ورقم الجوال للتأكيد", "error");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      showToast(`تم تأكيد طلب اشتراكك في ${selectedPlan?.title} بنجاح!`, "success");

      const msg = encodeURIComponent(
        `السلام عليكم، أود تأكيد الاشتراك في باقة *${selectedPlan?.title}* عبر منصة مكّن:\n` +
          `• السعر: ${selectedPlan?.price} ${selectedPlan?.period}\n` +
          `• التصنيف: ${selectedPlan?.badge}\n` +
          `• تاريخ البدء المفضل: ${startDate || "في أقرب وقت"}\n` +
          `• اسم المشترك: ${clientName}\n` +
          `• رقم الجوال: ${clientPhone}\n` +
          (notes ? `• ملاحظات إضافية: ${notes}\n` : "") +
          `• كود الخصم المطبق: ${occasionDetails.couponCode} (${occasionDetails.discountText})`
      );
      window.open(`https://wa.me/966554453287?text=${msg}`, "_blank");
    }, 900);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      <Navbar />

      {/* Header Banner */}
      <section className="relative overflow-hidden pt-12 pb-16 border-b border-slate-800/80">
        <div
          className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none -z-10 opacity-25"
          style={{ backgroundColor: occasionDetails.accentColor }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-200 text-xs font-bold shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span>باقات واشتراكات منصة مكّن المعتمدة 🇸🇦</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            اشتراكاتك الرياضية والغذائية والفعاليات في مكان واحد
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            اختر الباقة المناسبة لك من النوادي الرياضية، خطط الوجبات الصحية، الحصص التدريبية مع نخبة المدربين، أو تذاكر المعارض والمؤتمرات، مع تفعيل خصم المناسبة الفوري.
          </p>

          {/* Festive Coupon Strip */}
          <div className="inline-flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300 shadow-md">
            <Tag className="w-4 h-4 text-amber-400" />
            <span>خصم مناسبة {occasionDetails.shortName}: <strong>{occasionDetails.discountText}</strong></span>
            <button onClick={openModal} className="underline text-amber-400 hover:text-white">
              كود الخصم: <code className="font-mono font-bold">{occasionDetails.couponCode}</code>
            </button>
          </div>
        </div>
      </section>

      {/* Categories Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-2xl mx-auto shadow-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            جميع الاشتراكات ({SUBSCRIPTIONS_DATA.length})
          </button>

          <button
            onClick={() => setActiveTab("gym")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "gym"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            <span>النادي الرياضي</span>
          </button>

          <button
            onClick={() => setActiveTab("meals")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "meals"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>الوجبات الصحية</span>
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "sessions"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>الحصص والمدربين</span>
          </button>

          <button
            onClick={() => setActiveTab("exhibitions")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "exhibitions"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>المعارض والمؤتمرات</span>
          </button>
        </div>
      </section>

      {/* Subscription Cards Grid */}
      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border transition-all duration-300 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl relative text-right group ${
                plan.popular
                  ? "bg-slate-900/95 border-amber-500/80 shadow-amber-500/10 ring-1 ring-amber-500/40 hover:-translate-y-1.5"
                  : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:-translate-y-1"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[11px] rounded-full shadow-lg">
                  الباقة الأكثر طلباً 🌟
                </span>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 bg-slate-950 text-amber-300 rounded-full border border-slate-800">
                    {plan.badge}
                  </span>
                  {plan.trainer && (
                    <span className="text-[11px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-lg">
                      {plan.trainer}
                    </span>
                  )}
                  {plan.mealsInfo && (
                    <span className="text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-lg font-bold">
                      {plan.mealsInfo}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-extrabold text-white group-hover:text-amber-400 transition-colors">
                  {plan.title}
                </h3>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-xs text-slate-400 font-bold">{plan.period}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{plan.description}</p>

                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleOpenSubscribe(plan)}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                    plan.popular
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950"
                      : "bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white"
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>اشترك في هذه الباقة الآن</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Subscription Modal */}
      {modalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-right relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                <span>{selectedPlan.badge}</span>
              </div>
              <h3 className="text-xl font-black text-white">تأكيد الاشتراك في {selectedPlan.title}</h3>
              <p className="text-xs text-slate-400">
                القيمة: <strong className="text-amber-300">{selectedPlan.price} {selectedPlan.period}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل للمشترك *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فيصل القحطاني"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال (الواتساب) *</label>
                <input
                  type="tel"
                  required
                  placeholder="05XXXXXXXX"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تاريخ بدء الاشتراك المفضل</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات أو تفضيلات خاصة</label>
                <textarea
                  rows={2}
                  placeholder="أي تفضيلات خاصة بالوجبات، أوقات التمرين، أو استلام البطاقات..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Occasion Coupon Discount */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                <span>خصم مناسبة {occasionDetails.shortName}: <strong>{occasionDetails.couponCode}</strong></span>
                <span className="font-bold">{occasionDetails.discountText}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>جاري تسجيل وتأكيد الطلب...</span>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span>تأكيد الاشتراك والمتابعة عبر الواتساب</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
