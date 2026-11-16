"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import MagicPreviewForm from "@/components/MagicPreviewForm";
import { ServiceItem } from "@/types/database";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapPin,
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
  Receipt,
} from "lucide-react";

const SERVICES_DATA: ServiceItem[] = [
  {
    id: "srv-1",
    title: "فوترة إلكترونية متوافقة مع الزكاة",
    shortDesc: "فاتورتك نظامية: مرحلة الزكاة، رمز QR، وإبلاغ من لوحة منشأتك.",
    fullDesc:
      "أصدر فواتير إلكترونية متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك، مع رمز QR وإبلاغ من لوحة الإدارة — بدون أدوات خارجية معقّدة.",
    features: [
      "فاتورتك نظامية ومتوافقة مع الزكاة",
      "رمز QR على كل فاتورة",
      "إعداد الشهادة من اللوحة",
      "تتبع الفواتير حسب الباقة",
    ],
    iconName: "Receipt",
    badge: "امتثال",
  },
  {
    id: "srv-2",
    title: "واتساب CRM وحجز مواعيد",
    shortDesc: "عملاؤك يحجزون من واتساب — ردود ذكية وتتبع لكل محادثة.",
    fullDesc:
      "اربط واتساب بمنشأتك ليرد النظام على الأسئلة الشائعة، يذكّر بالمواعيد، ويحفظ المحادثة لكل عميل داخل لوحة واحدة.",
    features: [
      "عملاؤك يحجزون من واتساب",
      "تذكير مواعيد تلقائي",
      "تتبع المحادثة لكل مستأجر",
      "إعلان انقر للمحادثة على ميتا",
    ],
    iconName: "MessageSquare",
    badge: "تشغيل يومي",
  },
  {
    id: "srv-3",
    title: "خرائط جوجل ومعاينة الموقع",
    shortDesc: "موقع منشأتك مربوط بخرائط جوجل — معاينة فورية بموافقة المالك.",
    fullDesc:
      "اربط نشاطك على خرائط جوجل وجهّز معاينة موقع غير مفهرسة حتى المطالبة، ثم انشر صفحة منشأتك للزوار ومحركات البحث.",
    features: [
      "ربط Google Business",
      "معاينة بموافقة المالك",
      "صفحة منشأة جاهزة للفهرسة بعد المطالبة",
      "ظهور محلي حسب الباقة",
    ],
    iconName: "MapPin",
    badge: "الظهور المحلي",
  },
];

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
  const { activeOccasion, occasionDetails, copyCoupon } = useOccasion();

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
    <div className="min-h-screen flex flex-col bg-transparent text-foreground font-sans transition-colors duration-500">
      <Navbar />

      <section
        className={`relative z-10 overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 border-b border-line ${
          activeOccasion === "national_day" ? "bg-national-pattern bg-sadu-pattern" : ""
        }`}
      >
        <div
          className="absolute top-1/4 right-10 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-30 transition-colors duration-500"
          style={{ backgroundColor: occasionDetails.accentColor }}
        />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-line text-foreground text-xs font-bold shadow-lg">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "8s" }} />
                <span>
                  {activeOccasion === "none"
                    ? "المنصة الأولى المخصصة للسوق السعودي 🇸🇦"
                    : `${occasionDetails.name} — ${occasionDetails.slogan}`}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
                شغّل منشأتك على{" "}
                <span
                  className="bg-clip-text text-transparent underline underline-offset-8 decoration-wavy transition-colors duration-500"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${occasionDetails.accentColor}, #fbbf24, ${occasionDetails.accentColor})`,
                    textDecorationColor: occasionDetails.accentColor,
                  }}
                >
                  منصة واحدة
                </span>
              </h1>

              <p className="text-muted text-base sm:text-lg leading-relaxed max-w-2xl">
                فاتورتك نظامية، عملاؤك يحجزون من واتساب، وموقعك مربوط بخرائط جوجل — لمحلات ومنشآت المملكة، مع معاينة فورية بموافقة المالك.
              </p>

              {activeOccasion !== "none" && (
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg ${
                    activeOccasion === "national_day"
                      ? "bg-[#043d28]/90 border-emerald-600/40 text-emerald-50"
                      : occasionDetails.badgeBg
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-black/25 rounded-xl border border-white/15">
                      <Gift className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">عرض {occasionDetails.shortName}</div>
                      <div className="text-xs text-slate-300">{occasionDetails.discountText}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCoupon}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border bg-slate-900 border-slate-700 hover:bg-slate-800 text-amber-300"
                  >
                    <code>{occasionDetails.couponCode}</code>
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href={"/register" as Route}
                  className="flex items-center justify-center gap-2.5 px-7 py-4 font-extrabold text-base text-slate-950 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 text-center"
                  style={{ backgroundColor: occasionDetails.accentColor }}
                >
                  <span>ابدأ تجربة 14 يوماً</span>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <Link
                  href={"/pricing" as Route}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-surface hover:bg-surface-2 border border-line rounded-2xl text-foreground text-sm font-bold transition-all"
                >
                  <span>قارن الباقات والأسعار</span>
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>حلول موثوقة وعالية الجودة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>سرعة وسهولة التفعيل</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>خدمة مخصصة للأعمال</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md bg-surface/90 border border-line rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">صانع المعاينة الفورية</h3>
                      <p className="text-xs text-muted">بموافقة المالك — بدون رسائل باردة</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-extrabold">
                    PDPL
                  </span>
                </div>
                <MagicPreviewForm compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="relative z-10 py-20 bg-surface/70 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>خدماتنا المتخصصة</span>
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-foreground">ثلاث ركائز لتشغيل المنشأة</h3>
            <p className="text-muted text-sm leading-relaxed">
              منصة واحدة للفوترة والواتساب والحجز والخرائط — وليست خدمة SEO منفصلة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES_DATA.map((service) => (
              <div
                key={service.id}
                className="bg-surface/90 border border-line hover:border-amber-500/50 rounded-3xl p-6 shadow-xl transition-all hover:-translate-y-1.5 flex flex-col justify-between space-y-6 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-2xl text-slate-950 flex items-center justify-center font-bold shadow-lg"
                      style={{ backgroundColor: occasionDetails.accentColor }}
                    >
                      {service.iconName === "Receipt" && <Receipt className="w-6 h-6" />}
                      {service.iconName === "MessageSquare" && <MessageSquare className="w-6 h-6" />}
                      {service.iconName === "MapPin" && <MapPin className="w-6 h-6" />}
                      {service.iconName === "Star" && <Star className="w-6 h-6" />}
                    </div>
                    <span className="px-3 py-1 bg-surface-2 text-muted rounded-full text-xs font-semibold border border-line">
                      {service.badge}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-foreground group-hover:text-amber-700 transition-colors">
                    {service.title}
                  </h4>
                  <p className="text-muted text-sm leading-relaxed">{service.shortDesc}</p>
                </div>
                <button
                  onClick={() => setSelectedService(service)}
                  className="w-full py-3 bg-surface-2 hover:bg-amber-500 hover:text-slate-950 text-foreground font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span>عرض تفاصيل الخدمة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 py-20 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-right">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight">
                لماذا تختار منصة &quot;مكّن&quot; لتشغيل منشأتك؟
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                لوحة واحدة للمستأجر: فواتير، واتساب، حجز، خرائط، وترخيص — بدون تعقيد أدوات متعددة.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4 p-4 bg-surface/70 border border-line rounded-2xl">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">فاتورتك نظامية من اللوحة</h3>
                    <p className="text-xs text-muted mt-1">
                      إعداد الشهادة وإبلاغ الفاتورة من لوحة الفواتير دون أدوات خارجية.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-surface/70 border border-line rounded-2xl">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">دعم حزمة المناسبات الدينية والوطنية 🇸🇦</h3>
                    <p className="text-xs text-muted mt-1">
                      واجهات احتفالية لمحلك في اليوم الوطني، يوم التأسيس، رمضان، والأعياد.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-surface/70 border border-line rounded-2xl">
                  <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">عملاؤك يحجزون من واتساب</h3>
                    <p className="text-xs text-muted mt-1">
                      ربط واتساب ودفع آمن ومسار حجز على نفس نطاق منشأتك.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-surface/90 border border-line rounded-3xl space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <h3 className="font-bold text-base text-foreground">ما هو جاهز في المنصة اليوم</h3>
                <span className="text-xs text-amber-700 font-bold">بدون أرقام غير مقيسة</span>
              </div>
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <span>موقع للمنشأة مربوط برابط خرائط جوجل، مع معاينة غير مفهرسة حتى المطالبة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                  <span>عملاؤك يحجزون من واتساب، مع إعلان انقر للمحادثة على ميتا.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>فاتورتك نظامية ومتوافقة مع الزكاة من اللوحة (حسب الباقة).</span>
                </li>
              </ul>
              <p className="text-xs text-muted leading-relaxed">
                ننشر متوسط نتائج الظهور والحجز بعد اكتمال عيّنة كافية من منشآت مربوطة فعلياً — لا نعرض أرقاماً فارغة هنا.
              </p>
              <Link
                href={"/pricing" as Route}
                className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-600"
              >
                اطّلع على الباقات والأسعار
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 py-20 bg-surface/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-foreground">تواصل مع فريق منصة &quot;مكّن&quot;</h2>
            <p className="text-muted text-sm">أدخل بياناتك وسيستجيب فريقنا الفني خلال ساعات قليلة.</p>
          </div>

          <form onSubmit={handleSubmit(onContactSubmit)} className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted">الاسم الكامل</label>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="عبدالرحمن الشمري"
                  className="w-full px-4 py-3 bg-background border border-line focus:border-amber-500 rounded-xl text-foreground text-sm outline-none transition-colors"
                />
                {errors.name && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted">البريد الإلكتروني</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="name@company.sa"
                  className="w-full px-4 py-3 bg-background border border-line focus:border-amber-500 rounded-xl text-foreground text-sm outline-none transition-colors"
                />
                {errors.email && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted">تفاصيل المحل أو الاستفسار</label>
              <textarea
                {...register("message")}
                rows={4}
                placeholder="اسم المنشأة والمدينة: فوترة، واتساب، حجز، أو خرائط..."
                className="w-full px-4 py-3 bg-background border border-line focus:border-amber-500 rounded-xl text-foreground text-sm outline-none transition-colors"
              />
              {errors.message && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.message.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={submittingContact}
              className="w-full py-4 font-bold text-slate-950 rounded-xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              {submittingContact ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>إرسال الرسالة للفريق</span>
            </button>
          </form>
        </div>
      </section>

      {selectedService && (
        <ServiceDetailModal service={selectedService} onClose={() => setSelectedService(null)} />
      )}

      <Footer />
    </div>
  );
}
