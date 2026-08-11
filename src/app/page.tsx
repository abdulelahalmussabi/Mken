"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import { ServiceItem } from "@/types/database";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapPin,
  Search,
  Star,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Users,
  MessageSquare,
  Send,
  AlertCircle,
  Loader2,
  Sparkles,
  Gift,
  Copy,
  Check,
  Building2,
  LayoutDashboard,
  ExternalLink,
  FileCheck2,
  QrCode,
  Scale,
  MessagesSquare,
  HelpCircle,
} from "lucide-react";

// Services / Core Systems Data
const SERVICES_DATA: ServiceItem[] = [
  {
    id: "srv-1",
    title: "نظام الفوترة الإلكترونية المعتمد (ZATCA)",
    shortDesc: "ربط الممارسات والفوترة الإلكترونية، أصدار فواتير PDF فورية مطابقة لمرحلة II مع رمز QR.",
    fullDesc:
      "نظام إصداد الفواتير والربط مع منظومة الزكاة والضريبة والجمارك (ZATCA Phase 2). إصدار إيصالات واستخراج فواتير PDF برمز QR فوري مع تتبع حالة السداد بدون تعقيدات ERP.",
    features: [
      "ربط ZATCA + OTP + شهادات الامتثال",
      "إصدار فاتورة PDF مطابقة مع QR فوري",
      "تتبع الفواتير المدفوعة وغير المدفوعة",
      "دعم ضريبة القيمة المضافة 15%",
    ],
    iconName: "FileCheck2",
    badge: "امتثال ZATCA 🇸🇦",
  },
  {
    id: "srv-2",
    title: "واتساب CRM والردود الذكية",
    shortDesc: "رد آلي على الاستفسارات والمواعيد، تأكيد الحجز أوتوماتيكياً، وسجل محادثات منظم.",
    fullDesc:
      "استقبل رسائل العملاء ورد آلياً على الأسعار والمواعيد والخدمات المتاحة، مع إرسال تذكيرات واستبيانات تقييم الخدمة عبر الواتساب تلقائياً.",
    features: [
      "رد آلي ذكي على الأسعار والمواعيد",
      "تأكيد وإشعار حجز فوري عبر الواتساب",
      "تذكيرات قبل الموعد بـ 24 ساعة",
      "ربط خادم UltraMsg أو WABA الرسمي",
    ],
    iconName: "MessagesSquare",
    badge: "أتمتة الواتساب",
  },
  {
    id: "srv-3",
    title: "خرائط Google والـ SEO المحلي",
    shortDesc: "تصدر حزمة الخرائط المحلية واجعل محلك أو فندقك خيار العميل الأول القريب.",
    fullDesc:
      "تحسين وترتيب نشاطك التجاري على خرائط قوقل بدقة عالية. اختيار الفئات، رفع صور جغرافية، وتحديث بيانات التواصل لمضاعفة اتصالات وزيارات العملاء.",
    features: [
      "تهيئة بيانات النشاط (NAP Consistency)",
      "رفع وتأكيد الصور الجغرافية المعتمدة",
      "ربط الموقع الإلكتروني وقنوات التواصل",
      "تصدر الكلمات المفتاحية الأكثر ربحية",
    ],
    iconName: "MapPin",
    badge: "تصدر الخرائط",
  },
];

// Challenge / Problem Cards
const PROBLEMS_DATA = [
  {
    icon: Scale,
    title: "إلزام الزكاة والضريبة",
    desc: "الفوترة الإلكترونية أصبحت واجبة قانونياً في السعودية — ملفات Excel والحلول اليدوية لم تعد كافية لتجنب المخالفات والغرامات.",
    badge: "امتثال تنظيمي",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
  {
    icon: MessagesSquare,
    title: "فوضى واتساب اليومية",
    desc: "عشرات الرسائل والاستفسارات يومياً عن الأسعار والمواعيد — ضياع وقتك وفريقك في الردود المتكررة يدوياً بدل إتمام الصفقات.",
    badge: "أتمتة وحفظ وقت",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    icon: MapPin,
    title: "غيابك عن خريطة المنافسة",
    desc: "عملاؤك يبحثون يومياً على قوقل ويصلون إلى منافسيك القريبين لأن ملفك التجاري غير مكتمل أو غائب عن النتائج الأولى.",
    badge: "نمو المبيعات",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  },
];

// Showcase Tenants
const FEATURED_TENANTS = [
  {
    slug: "almahrusa",
    name: "المحروسة للشقق المخدومة",
    city: "المدينة المنورة",
    type: "شقق مخدومة وفنادق",
    rating: "4.9",
    reviews: "382 تقييم موثق",
    badge: "الموقع الرئيسي المعتمد 🇸🇦",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    themeName: "ثيم اليوم الوطني / الثقافة السعودية",
  },
  {
    slug: "demo",
    name: "صالون النخبة الرياض",
    city: "الرياض",
    type: "صالون وعناية شخصية",
    rating: "4.8",
    reviews: "194 تقييم موثق",
    badge: "ثيم عالي التفاعل",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
    themeName: "الثيم الأزرق العصري (Modern Blue)",
  },
  {
    slug: "almasabi",
    name: "مقهى ومحمصة الأصيل",
    city: "جدة",
    type: "كافيه ومحمصة",
    rating: "4.9",
    reviews: "512 تقييم موثق",
    badge: "ثيم القهوة والتراث",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
    themeName: "ثيم التأسيس والقهوة السعودية",
  },
];

// Pricing Packages
const PRICING_PLANS = [
  {
    title: "باقة امتثال",
    price: "199",
    unit: "ر.س / شهرياً",
    desc: "مثالية للمؤسسات والأنشطة الناشئة للالتزام بالفوترة والحجوزات.",
    features: [
      "فواتير ZATCA الإلكترونية المطابقة",
      "موقع تعريف ونظام حجوزات أونلاين",
      "رمز QR فوري وإيصالات السداد",
      "دعم الفترات والتحديثات",
    ],
    highlight: false,
    cta: "ابدأ 14 يوماً مجاناً",
  },
  {
    title: "باقة نمو ذكية",
    price: "399",
    unit: "ر.س / شهرياً",
    desc: "الباقة الأكثر طلباً للأنشطة التجارية السريعة النمو مع أتمتة الواتساب.",
    features: [
      "كافة ميزات باقة امتثال",
      "ردود واتساب CRM وتأكيد آلي",
      "إدارة المخزون والموردين والمشتريات",
      "ربط بوابة دفع ميسر Moyasar",
      "تحسين الظهور على خرائط قوقل",
    ],
    highlight: true,
    cta: "اشترك الآن واسحب عملائك",
  },
  {
    title: "باقة متكاملة ERP Lite",
    price: "799",
    unit: "ر.س / شهرياً",
    desc: "حل شامل للمؤسسات المتعددة الفروع مع نظام الديون والتقارير المتقدمة.",
    features: [
      "كافة ميزات باقة نمو",
      "إدارة الفروع المتعددة والمستأجرين",
      "سجل تدقيق حركات المستودعات",
      "دفتر ديون وسندات القبض المتقدم",
      "مدير حساب مخصص ودعم 24/7",
    ],
    highlight: false,
    cta: "احصل على الاستشارة",
  },
];

// Contact Form Schema
const contactSchema = z.object({
  name: z.string().min(3, { message: "الاسم يجب أن يتكون من 3 حروف على الأقل" }),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  message: z.string().min(10, { message: "الرسالة يجب أن تتكون من 10 حروف على الأقل" }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function HomePage() {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const { addContactMessage } = useApp();
  const { activeOccasion, occasionDetails, openModal, copyCoupon } = useOccasion();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onContactSubmit = async (data: ContactFormValues) => {
    setSubmittingContact(true);
    try {
      await addContactMessage(data.name, data.email, data.message);
      reset();
    } catch {
      // Handled in context
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleCopyCoupon = () => {
    copyCoupon(occasionDetails.couponCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-24 lg:pb-36 border-b border-slate-800/80">
        {/* Glow Effects Background */}
        <div
          className="absolute top-1/4 right-10 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none -z-10 opacity-25 transition-all duration-700"
          style={{ backgroundColor: occasionDetails.accentColor }}
        />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Right Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-right">
              {/* Saudi Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-slate-200 text-xs font-extrabold shadow-xl backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: "8s" }} />
                <span>
                  {activeOccasion === "none"
                    ? "🇸🇦 مخصص للسوق السعودي — الفوترة والخرائط والواتساب"
                    : `${occasionDetails.name} — ${occasionDetails.slogan}`}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.15] tracking-tight">
                فواتير معتمدة من الزكاة +{" "}
                <span
                  className="bg-clip-text text-transparent underline underline-offset-8 decoration-wavy transition-all duration-500"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${occasionDetails.accentColor}, #38bdf8, #818cf8)`,
                    textDecorationColor: occasionDetails.accentColor,
                  }}
                >
                  واتساب CRM ذكي
                </span>{" "}
                — موقعك جاهز في يوم واحد
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                منصة خفيفة وسريعة لرجل الأعمال والمنشآت في المملكة: امتثال تنظيمي، فواتير إلكترونية QR، ردود وتأكيدات واتساب آلية، وتصدر خرائط Google — بدون تعقيد ERP.
              </p>

              {/* Active Coupon Banner */}
              {activeOccasion !== "none" && (
                <div className={`p-4 rounded-2xl border ${occasionDetails.badgeBg} flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg backdrop-blur-md`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900/80 rounded-xl border border-white/20">
                      <Gift className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">عرض مناسبة {occasionDetails.shortName}</div>
                      <div className="text-xs text-slate-300">{occasionDetails.discountText}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCoupon}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-xl text-xs font-bold text-amber-300 transition-colors"
                    >
                      <code>{occasionDetails.couponCode}</code>
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2.5 px-7 py-4 font-black text-sm text-slate-950 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 text-center bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300"
                >
                  <span>جرب 14 يوماً مجاناً</span>
                  <ArrowLeft className="w-5 h-5" />
                </Link>

                <Link
                  href="/subscriber/almahrusa"
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-2xl text-slate-200 text-xs font-bold transition-all shadow-md"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>شاهد العرض الحي (المحروسة 🇸🇦)</span>
                </Link>
              </div>

              {/* Trust Micro-Badges */}
              <div className="pt-4 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> متوافق مع المرحلة II للفوترة
                </span>
                <span className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" /> فاتورة QR فورية
                </span>
                <span className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <MessagesSquare className="w-3.5 h-3.5 text-amber-400" /> ردود واتساب ذكية
                </span>
                <span className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> بدون بطاقة ائتمان للتجربة
                </span>
              </div>
            </div>

            {/* Left Hero Interactive Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">المحروسة للشقق المخدومة</h3>
                      <p className="text-xs text-slate-400">المدينة المنورة • المعتمد رسميًا</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black">
                    عرض حي 🇸🇦
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">أجنحة وغرف الضيافة</h4>
                      <p className="text-xs text-slate-400">حي ابو كبير - الحمراء - المدينة المنورة</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-xs bg-amber-400/10 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      4.9
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold">
                      فاتورة ZATCA
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold">
                      واتساب CRM
                    </span>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold">
                      خرائط Google
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-center text-xs font-semibold">
                    <Link
                      href="/subscriber/almahrusa"
                      className="p-2.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 rounded-xl text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      زيارة الموقع
                    </Link>
                    <Link
                      href="/admin"
                      className="p-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-slate-300 border border-slate-800 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                      لوحة التحكم
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges & Solutions Section (Problems Grid) */}
      <section className="py-20 bg-slate-950/60 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
              التحديات التي نحلها لك
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              لماذا تحتاج منصة &quot;مكّن&quot; اليوم؟
            </h2>
            <p className="text-slate-400 text-sm">
              معالجة العقبات الثلاث الأكثر تعقيداً لأصحاب المحلات والأنشطة بالسوق السعودي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROBLEMS_DATA.map((prob, idx) => {
              const IconComp = prob.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-4 text-right shadow-xl relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border ${prob.color} shrink-0`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800">
                      {prob.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {prob.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{prob.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Showcase Featured Tenants Section */}
      <section className="py-20 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>معاينة المواقع الحية</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              استعرض المظهر الحقيقي لمستأجري المنصة
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              تصفح الأنظمة الحية للمنشآت والمحلات المربوطة على منصة مكّن.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURED_TENANTS.map((tenant) => (
              <div
                key={tenant.slug}
                className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-3xl overflow-hidden shadow-xl transition-all hover:-translate-y-1.5 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                    <img
                      src={tenant.image}
                      alt={tenant.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                    <span className="absolute top-4 right-4 px-3 py-1 bg-slate-950/80 backdrop-blur-md text-white rounded-full text-xs font-extrabold border border-white/20 shadow-md">
                      {tenant.badge}
                    </span>
                  </div>

                  <div className="p-6 space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">{tenant.city}</span>
                      <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {tenant.rating}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {tenant.name}
                    </h3>
                    <p className="text-xs text-slate-400">{tenant.themeName}</p>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Link
                    href={`/subscriber/${tenant.slug}`}
                    className="w-full py-3 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>معاينة موقع {tenant.name}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Systems / 3-in-1 Platform Section */}
      <section id="features" className="py-20 bg-slate-950/60 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>ما نقدمه لك</span>
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white">
              ثلاثة أنظمة متكاملة في منصة واحدة
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              نظام الفوترة الإلكترونية، الواتساب الذكي، وتصدر نتائج خرائط قوقل.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES_DATA.map((service) => (
              <div
                key={service.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-6 shadow-xl transition-all hover:-translate-y-1.5 flex flex-col justify-between space-y-6 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-2xl text-slate-950 flex items-center justify-center font-bold shadow-lg"
                      style={{ backgroundColor: occasionDetails.accentColor }}
                    >
                      {service.iconName === "FileCheck2" && <FileCheck2 className="w-6 h-6" />}
                      {service.iconName === "MessagesSquare" && <MessagesSquare className="w-6 h-6" />}
                      {service.iconName === "MapPin" && <MapPin className="w-6 h-6" />}
                    </div>
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-semibold border border-slate-700">
                      {service.badge}
                    </span>
                  </div>

                  <h4 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    {service.title}
                  </h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{service.shortDesc}</p>
                </div>

                <button
                  onClick={() => setSelectedService(service)}
                  className="w-full py-3 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span>عرض التفاصيل الكاملة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Packages Section */}
      <section id="pricing" className="py-20 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full text-xs font-bold">
              شفافية وبدون مفاجآت
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              باقات الاشتراك المرنة
            </h2>
            <p className="text-slate-400 text-sm">
              إعداد وتجهيز أول مرة: 999–2,500 ر.س حسب نشاط وتعقيد المنشأة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING_PLANS.map((plan, idx) => (
              <div
                key={idx}
                className={`p-8 rounded-3xl border transition-all space-y-6 flex flex-col justify-between shadow-2xl relative ${
                  plan.highlight
                    ? "bg-slate-900 border-cyan-500 shadow-cyan-500/10"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-xs rounded-full shadow-lg">
                    الأكثر مبيعاً 🌟
                  </span>
                )}

                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-white">{plan.title}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-xs text-slate-400 font-bold">{plan.unit}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{plan.desc}</p>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    {plan.features.map((feat, fidx) => (
                      <div key={fidx} className="flex items-center gap-2 text-xs text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/register"
                  className={`w-full py-3.5 rounded-xl text-xs font-black transition-all text-center flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-slate-950/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black text-white">تواصل مع فريق منصة &quot;مكّن&quot;</h2>
            <p className="text-slate-400 text-sm">أدخل بياناتك وسيتواصل معك فريق الدعم لتجهيز منشأتك.</p>
          </div>

          <form onSubmit={handleSubmit(onContactSubmit)} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">الاسم الكامل</label>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="عبدالرحمن الشمري"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-100 text-sm outline-none transition-colors"
                />
                {errors.name && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">البريد الإلكتروني</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="name@company.sa"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-100 text-sm outline-none transition-colors"
                />
                {errors.email && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.email.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">تفاصيل النشاط أو الاستفسار</label>
              <textarea
                {...register("message")}
                rows={4}
                placeholder="أذكر اسم منشأتك والخدمة المطلوبة (فواتير الزكاة، حجوزات، مخزون، موردين، ربط واتساب)..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-100 text-sm outline-none transition-colors"
              />
              {errors.message && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.message.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingContact}
              className="w-full py-4 font-black text-slate-950 rounded-xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300"
            >
              {submittingContact ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>إرسال الرسالة للفريق</span>
            </button>
          </form>
        </div>
      </section>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}

      <Footer />
    </div>
  );
}
