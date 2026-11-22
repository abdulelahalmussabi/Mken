"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import MagicPreviewForm from "@/components/MagicPreviewForm";
import { ServiceItem } from "@/types/database";
import { useApp } from "@/context/AppContext";
import { useOccasion, OccasionId } from "@/context/OccasionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  MapPin,
  Search,
  Star,
  TrendingUp,
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
  BarChart3,
  PhoneCall,
  Gift,
  Copy,
  Check,
} from "lucide-react";

// Animated Counter component with 60fps GPU easing
function AnimatedCounter({
  target,
  duration = 1800,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  target: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutCubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setVal(easeProgress * target);
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setVal(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasStarted, target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {decimals > 0 ? val.toFixed(decimals) : Math.round(val)}
      {suffix}
    </span>
  );
}

// OnePlus-style flagship motion animation presets
const heroStaggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const ONEPLUS_EASE = [0.16, 1, 0.3, 1] as const;

const heroRiseItem = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: ONEPLUS_EASE,
    },
  },
};

const seasonalTabs: { id: OccasionId; name: string; icon: string }[] = [
  { id: "none", name: "القياسي", icon: "✨" },
  { id: "founding_day", name: "يوم التأسيس", icon: "🐎" },
  { id: "national_day", name: "اليوم الوطني", icon: "🇸🇦" },
  { id: "ramadan", name: "رمضان والأعياد", icon: "🌙" },
];

// Services Data
const SERVICES_DATA: ServiceItem[] = [
  {
    id: "srv-1",
    title: "تحسين وتأكيد خرائط Google",
    shortDesc: "تصدر حزمة الخرائط الثلاثية (Local Pack) واجعل نشاطك التجاري في مقدمة ما يراه الزبون القريب.",
    fullDesc:
      "نقوم بتحسين وترتيب نشاطك التجاري على خرائط قوقل بدقة عالية. يشمل ذلك اختيار الفئات الدقيقة، إضافة الكلمات المفتاحية الوصفية، رفع صور عالية الجودة وتأكيد الموقع الجغرافي لضمان الظهور في الترتيب المتقدم في محيطك.",
    features: [
      "تهيئة بيانات النشاط (NAP Consistency)",
      "تحسين الصور الجغرافية (Geo-tagged Photos)",
      "ربط الموقع الإلكتروني وقنوات التواصل",
      "معالجة المشاكل والبلاغات الوهمية",
    ],
    iconName: "MapPin",
    badge: "الأكثر طلباً",
  },
  {
    id: "srv-2",
    title: "تهيئة الكلمات المفتاحية المحلية",
    shortDesc: "استهداف العبارات والجمل الأكثر بحثاً من قبل سكان منطقتك ومدينتك.",
    fullDesc:
      "ندرس سلوك البحث المحلي للزبائن في مدينتك (مثل: 'أفضل كافيه بالرياض'، 'أقرب سباك بجدة') ونقوم بتهيئة محرك البحث لنشاطك التجاري ليتصدر هذه الجمل المفتاحية بدقة.",
    features: [
      "تحليل كلمات البحث المحلية الأكثر ربحية",
      "تحسين النص الوصفي للنشاط التجاري والخدمات",
      "ربط النشاط التجاري بالمناطق والأحياء المجاورة",
      "تقارير تحليلية شهرية لعمليات البحث",
    ],
    iconName: "Search",
    badge: "تغطية كاملة",
  },
  {
    id: "srv-3",
    title: "إدارة السمعة والتقييمات الإيجابية",
    shortDesc: "بناء ثقة العملاء وزيادة التقييمات الـ 5 نجوم بطرق نظامية وفعالة.",
    fullDesc:
      "نساعدك في إعداد آلية سهلة للحصول على تقييمات إيجابية حقيقية من عملائك، وصياغة ردود احترافية تعكس جودة خدمتك وترفع من تصنيف الخوارزمية لمتجرك.",
    features: [
      "تصميم QR Code مخصص لجمع التقييمات",
      "صياغة ردود ذكية ومحسنة للـ SEO",
      "التفاعل السريع مع ملاحظات الزوار",
      "رفع معدل التحويل من الخريطة للفرع",
    ],
    iconName: "Star",
    badge: "ثقة ونمو",
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
  const { activeOccasion, occasionDetails, openModal, copyCoupon, setOccasion } = useOccasion();

  const heroCardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroCardRef,
    offset: ["start end", "end start"],
  });
  const heroCardScale = useTransform(scrollYProgress, [0, 0.6], [0.96, 1.02]);
  const heroCardY = useTransform(scrollYProgress, [0, 0.6], [20, -10]);

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
    <div dir="rtl" className="min-h-screen flex flex-col bg-transparent text-foreground font-sans transition-colors duration-500">
      <Navbar />

      {/* Hero Section — transparent so festive particles show through */}
      <section
        className={`relative z-10 overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 border-b border-line bg-[#09090B] ${
          activeOccasion === "national_day" ? "bg-national-pattern bg-sadu-pattern" : ""
        }`}
      >
        {/* Subtle Frosted Noise Texture Overlay */}
        <div className="absolute inset-0 frosted-noise pointer-events-none opacity-40 -z-10" />

        {activeOccasion === "none" && (
          <div className="ambient-spotlight" aria-hidden="true" />
        )}

        {/* 5-Layer Multi-Layered Ambient Mesh Background Orbs */}
        <div
          className="ambient-glow-orb-primary -top-24 right-1/4 -z-10 opacity-70"
          style={{
            background: activeOccasion === "none"
              ? "radial-gradient(circle, rgba(6, 78, 59, 0.45) 0%, transparent 70%)"
              : `radial-gradient(circle, ${occasionDetails.accentColor}33 0%, transparent 70%)`,
          }}
        />
        <div
          className="ambient-glow-orb-secondary top-1/3 left-6 -z-10 opacity-60"
          style={{
            background: activeOccasion === "none"
              ? "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%)"
              : `radial-gradient(circle, ${occasionDetails.accentColor}25 0%, transparent 70%)`,
          }}
        />
        <div className="absolute bottom-6 right-10 w-96 h-96 rounded-full blur-[140px] pointer-events-none -z-10 bg-emerald-600/10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Right Hero Content with OnePlus Staggered Entrance */}
            <motion.div
              variants={heroStaggerContainer}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 space-y-6 text-right"
            >
              {/* Saudi Seasonal Themes Switcher & Pill Badge */}
              <motion.div variants={heroRiseItem} className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-zinc-200 text-xs font-bold shadow-lg backdrop-blur-xl">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: "8s" }} />
                  <span>
                    {activeOccasion === "none"
                      ? "المنصة المتخصصة للسوق السعودي 🇸🇦"
                      : `${occasionDetails.name} — ${occasionDetails.slogan}`}
                  </span>
                </div>

                {/* Interactive Saudi Seasonal Themes Gliding Switcher */}
                <div className="pt-1 flex items-center justify-start overflow-x-auto no-scrollbar">
                  <div className="inline-flex items-center gap-1.5 p-1.5 bg-[#141417]/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl">
                    {seasonalTabs.map((tab) => {
                      const isActive =
                        activeOccasion === tab.id ||
                        (tab.id === "ramadan" &&
                          (activeOccasion === "ramadan" || activeOccasion === "eid_fitr" || activeOccasion === "eid_adha"));
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setOccasion(tab.id)}
                          className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none flex items-center gap-1.5 shrink-0 ${
                            isActive ? "text-white" : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="activeSeasonalLandingPill"
                              className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-md shadow-emerald-500/25 ring-1 ring-white/20"
                              transition={{ type: "spring", stiffness: 400, damping: 32 }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5">
                            <span>{tab.icon}</span>
                            <span>{tab.name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              <motion.h1
                variants={heroRiseItem}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white text-metallic-dark leading-tight tracking-tight"
              >
                اجعل نشاطك التجاري{" "}
                <span
                  className="bg-clip-text text-transparent underline underline-offset-8 decoration-wavy transition-colors duration-500"
                  style={{
                    backgroundImage: activeOccasion === "none"
                      ? `linear-gradient(to right, #10B981, #D4AF37, #10B981)`
                      : `linear-gradient(to right, ${occasionDetails.accentColor}, #fbbf24, ${occasionDetails.accentColor})`,
                    textDecorationColor: activeOccasion === "none" ? "var(--primary-accent)" : occasionDetails.accentColor,
                  }}
                >
                  الخيار الأبرز
                </span>{" "}
                في منطقتك
              </motion.h1>

              <motion.p
                variants={heroRiseItem}
                className="text-zinc-300 text-base sm:text-lg leading-relaxed max-w-2xl"
              >
                نساعد أصحاب الأنشطة التجارية والمتاجر في المملكة العربية السعودية على تصدر خرائط Google ونتائج البحث المحلية، لجلب المزيد من اتصالات العملاء والزيارات المباشرة لفرعك يومياً.
              </motion.p>

              {/* Occasion Coupon Highlight Box */}
              {activeOccasion !== "none" && (
                <motion.div
                  variants={heroRiseItem}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg ${
                    activeOccasion === "national_day"
                      ? "bg-[#043d28]/90 border-emerald-600/40 text-emerald-50"
                      : occasionDetails.badgeBg
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-black/25 rounded-xl border border-white/15">
                      <Gift
                        className={`w-5 h-5 ${
                          activeOccasion === "national_day" ? "text-amber-300" : "text-amber-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        عرض {occasionDetails.shortName}
                      </div>
                      <div
                        className={`text-xs ${
                          activeOccasion === "national_day" ? "text-emerald-100/90" : "text-slate-300"
                        }`}
                      >
                        {occasionDetails.discountText}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCoupon}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                        activeOccasion === "national_day"
                          ? "bg-emerald-500/20 border-emerald-400/40 text-amber-200 hover:bg-emerald-500/30"
                          : "bg-slate-900 border-slate-700 hover:bg-slate-800 text-amber-300"
                      }`}
                    >
                      <code>{occasionDetails.couponCode}</code>
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* CTAs */}
              <motion.div
                variants={heroRiseItem}
                className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
              >
                <Link
                  href={"/preview" as Route}
                  className="flex items-center justify-center gap-2.5 px-7 py-4 font-extrabold text-base text-slate-950 rounded-2xl shadow-xl shadow-emerald-500/25 ring-1 ring-white/20 transition-all hover:scale-105 active:scale-95 text-center"
                  style={{ backgroundColor: activeOccasion === "none" ? "var(--primary-accent)" : occasionDetails.accentColor }}
                >
                  <span>جهّز معاينة موقعك الآن</span>
                  <ArrowLeft className="w-5 h-5" />
                </Link>

                <button
                  onClick={openModal}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-2xl text-white text-sm font-bold transition-all cursor-pointer backdrop-blur-xl shadow-lg"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>دراسة واجهات المناسبات 🇸🇦</span>
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                variants={heroRiseItem}
                className="pt-4 flex items-center gap-6 text-xs text-zinc-400"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>حلول موثوقة وعالية الجودة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>سرعة وسهولة التفعيل</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>خدمة مخصصة للأعمال</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Left Hero Interactive Card with Specular Glass & Parallax */}
            <div className="lg:col-span-5 relative">
              <motion.div
                ref={heroCardRef}
                style={{ scale: heroCardScale, y: heroCardY }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className="relative mx-auto max-w-md specular-glass-dark spotlight-card rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">صانع المعاينة الفورية</h3>
                      <p className="text-xs text-zinc-400">بموافقة المالك — بدون كشط واتساب</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-extrabold shadow-xs">
                    PDPL
                  </span>
                </div>
                <div className="relative z-10">
                  <MagicPreviewForm compact />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section — Clean Soft Alabaster with Specular Top-Lit Glass */}
      <section id="services" data-section="light" className="relative z-10 py-20 bg-[#F8FAFC] border-b border-slate-200/80 overflow-hidden">
        {/* Ultra-soft tinted frosted layer for high-contrast depth */}
        <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
              <Sparkles className="w-4 h-4" />
              <span>خدماتنا المتخصصة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#09090B] leading-[1.35] tracking-tight max-w-2xl mx-auto">
              كل ما يحتاجه نشاطك التجاري لتصدر نتائج البحث والخرائط
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed max-w-2xl mx-auto">
              نقدم حلولاً متكاملة ومصممة خصيصاً للتوافق مع خوارزميات Google المحلية والجمهور السعودي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES_DATA.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.12,
                  ease: ONEPLUS_EASE,
                }}
                whileHover={{
                  y: -6,
                  transition: { duration: 0.3, ease: ONEPLUS_EASE },
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className="relative bg-white/90 backdrop-blur-2xl border-t border-emerald-400/40 border-x border-b border-slate-200/80 rounded-3xl p-6 shadow-xl shadow-slate-900/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)] hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/15 transition-all duration-300 flex flex-col justify-between space-y-6 group overflow-hidden spotlight-card"
              >
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/25 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: activeOccasion === "none" ? "var(--primary-accent)" : occasionDetails.accentColor }}
                    >
                      {service.iconName === "MapPin" && <MapPin className="w-6 h-6" />}
                      {service.iconName === "Search" && <Search className="w-6 h-6" />}
                      {service.iconName === "Star" && <Star className="w-6 h-6" />}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        service.badge === "الأكثر طلباً"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {service.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[#09090B] group-hover:text-[#059669] transition-colors leading-[1.35]">
                    {service.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{service.shortDesc}</p>
                </div>

                <button
                  onClick={() => setSelectedService(service)}
                  className="relative z-10 w-full py-3 bg-slate-100 hover:bg-[#059669] text-slate-900 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <span>عرض تفاصيل الخدمة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose MKN Section — Flagship Obsidian Dark with Multi-Layer Ambient Mesh */}
      <section id="features" className="relative z-10 py-20 border-b border-white/10 bg-[#09090B] text-white overflow-hidden">
        {/* Frosted noise texture */}
        <div className="absolute inset-0 frosted-noise pointer-events-none opacity-40 -z-10" />

        {/* Ambient mesh orbs behind dark cards */}
        <div className="ambient-glow-orb-primary top-10 right-10 -z-10 opacity-50" />
        <div className="ambient-glow-orb-secondary bottom-10 left-10 -z-10 opacity-40" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-right">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white text-metallic-dark leading-[1.35] tracking-tight">
                لماذا تختار منصة &quot;مكّن&quot; لإدارة نشاطك التجاري على الخريطة؟
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                نجمع بين الخبرة التقنية العميقة في SEO المحلي وفهم سلوك العميل في المملكة لتقديم نتائج سريعة وملموسة.
              </p>

              <div className="space-y-4 pt-2">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: ONEPLUS_EASE }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                  }}
                  className="flex items-start gap-4 p-4 specular-glass-dark spotlight-card rounded-2xl hover:border-emerald-500/50 transition-colors shadow-lg"
                >
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 border border-emerald-500/30 relative z-10">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-sm text-white">متوافق 100% مع السياسات المحلية والسعودية</h3>
                    <p className="text-xs text-zinc-400 mt-1">نتبع أفضل الممارسات البرمجية بدون مخالطة الثغرات أو التقييمات الوهمية الضارة.</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: ONEPLUS_EASE }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                  }}
                  className="flex items-start gap-4 p-4 specular-glass-dark spotlight-card rounded-2xl hover:border-emerald-500/50 transition-colors shadow-lg"
                >
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 border border-emerald-500/30 relative z-10">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-sm text-white">دعم حزمة المناسبات الدينية والوطنية 🇸🇦</h3>
                    <p className="text-xs text-zinc-400 mt-1">إمكانية تفعيل واجهات احتفالية لنشاطك التجاري في اليوم الوطني، يوم التأسيس، رمضان، والأعياد.</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: ONEPLUS_EASE }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                  }}
                  className="flex items-start gap-4 p-4 specular-glass-dark spotlight-card rounded-2xl hover:border-emerald-500/50 transition-colors shadow-lg"
                >
                  <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl shrink-0 border border-sky-500/30 relative z-10">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-sm text-white">محادثة مباشرة ومتابعة لحظية لكل طلب</h3>
                    <p className="text-xs text-zinc-400 mt-1">نظام تواصل متكامل يربط صاحب النشاط التجاري بمدير الطلب لإرسال التحديثات والاستفسارات.</p>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Feature Image / Graphic with Specular Glass & Oversized Display Metrics */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, ease: ONEPLUS_EASE }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
              }}
              className="p-8 specular-glass-dark spotlight-card rounded-3xl space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
                <h3 className="font-bold text-base text-white">إحصائيات التأثير المحقق</h3>
                <span className="text-xs text-emerald-400 font-bold px-3 py-1 bg-emerald-500/15 rounded-full border border-emerald-500/30">
                  تقرير النمو 2026
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="p-5 bg-black/40 rounded-2xl border border-white/10 text-center space-y-1 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
                  <div className="font-display text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 tabular-nums tracking-tight">
                    <AnimatedCounter target={350} prefix="+" suffix="%" />
                  </div>
                  <div className="text-xs text-zinc-400 font-medium pt-1">زيادة الاتصالات المباشرة</div>
                </div>
                <div className="p-5 bg-black/40 rounded-2xl border border-white/10 text-center space-y-1 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
                  <div className="font-display text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-400 to-amber-500 tabular-nums tracking-tight">
                    <AnimatedCounter target={4.9} decimals={1} suffix=" / 5" />
                  </div>
                  <div className="text-xs text-zinc-400 font-medium pt-1">متوسط رضا أصحاب الأنشطة التجارية</div>
                </div>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-between text-xs relative z-10">
                <span className="text-zinc-400">سرعة بدء تنفيذ الطلب:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 font-display">
                  <span>خلال</span>
                  <AnimatedCounter target={24} suffix=" ساعة" className="font-extrabold tabular-nums text-sm text-emerald-400" />
                  <span>من التقديم</span>
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Section — Clean Soft Alabaster with Specular Glass */}
      <section id="contact" data-section="light" className="relative z-10 py-20 bg-[#F8FAFC] border-b border-slate-200/80 overflow-hidden">
        {/* Soft tinted frosted background */}
        <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-[#09090B] leading-[1.35]">تواصل مع فريق منصة &quot;مكّن&quot;</h2>
            <p className="text-slate-600 text-sm">أدخل بياناتك وسيستجيب فريقنا الفني خلال ساعات قليلة.</p>
          </div>

          <form
            onSubmit={handleSubmit(onContactSubmit)}
            className="bg-white/95 backdrop-blur-2xl border-t border-emerald-400/30 border-x border-b border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl shadow-slate-900/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">الاسم الكامل</label>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="عبدالرحمن الشمري"
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-colors"
                />
                {errors.name && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">البريد الإلكتروني</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="name@company.sa"
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-colors"
                />
                {errors.email && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.email.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">تفاصيل النشاط التجاري أو الاستفسار</label>
              <textarea
                {...register("message")}
                rows={4}
                placeholder="أذكر اسم نشاطك التجاري ومدينتك وما هي الخدمة المطلوبة لتحسين خريطتك..."
                className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-colors"
              />
              {errors.message && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.message.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submittingContact}
              className="w-full py-4 font-bold text-white rounded-xl shadow-xl shadow-emerald-500/25 ring-1 ring-white/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: activeOccasion === "none" ? "var(--primary-accent)" : occasionDetails.accentColor }}
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
