"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import { ServiceItem } from "@/types/database";
import { useApp } from "@/context/AppContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Clock,
} from "lucide-react";

// Services Data
const SERVICES_DATA: ServiceItem[] = [
  {
    id: "srv-1",
    title: "تحسين وتأكيد خرائط Google",
    shortDesc: "تصدر حزمة الخرائط الثلاثية (Local Pack) واجعل محلك أول ما يراه الزبون القريب.",
    fullDesc:
      "نقوم بتحسين وترتيب نشاطك التجاري على خرائط قوقل بدقة عالية. يشمل ذلك اختيار الفئات الدقيقة، إضافة الكلمات المفتاحية الوصفية، رفع صور عالية الجودة وتأكيد الموقع الجغرافي لضمان الظهور في الترتيب الأول في محيطك.",
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
      "ندرس سلوك البحث المحلي للزبائن في مدينتك (مثل: 'أفضل كافيه بالرياض'، 'أقرب سباك بجدة') ونقوم بتهيئة محرك البحث لمحلك التجاري ليتصدر هذه الجمل المفتاحية بدقة.",
    features: [
      "تحليل كلمات البحث المحلية الأكثر ربحية",
      "تحسين النص الوصفي للمحل والخدمات",
      "ربط المحل بالمناطق والأحياء المجاورة",
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
  const { addContactMessage } = useApp();

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

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 border-b border-slate-800/60">
        {/* Glowing Background Orbs */}
        <div className="absolute top-1/4 right-10 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Right Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-300 text-xs font-bold shadow-lg shadow-orange-950/30">
                <Sparkles className="w-4 h-4 text-orange-400" />
                المنصة الأولى المخصصة للسوق السعودي 🇸🇦
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                اجعل محلك{" "}
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent underline decoration-orange-500/40 decoration-wavy underline-offset-8">
                  الخيار الأول
                </span>{" "}
                في منطقتك
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                نساعد أصحاب المحلات والمتاجر في المملكة العربية السعودية على تصدر خرائط Google ونتائج البحث المحلية، لجلب المزيد من اتصالات العملاء والزيارات المباشرة لفرعك يومياً.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href="/auth"
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all cursor-pointer text-center"
                >
                  <span>قدم طلبك الآن مجاناً</span>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <a
                  href="#services"
                  className="flex items-center justify-center gap-2 px-7 py-4 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-base rounded-2xl transition-all text-center"
                >
                  استكشف خدماتنا
                </a>
              </div>

              {/* Feature Trust Badges */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-800/80">
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white flex items-center gap-1">
                    +300%
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xs text-slate-400">زيادة اتصالات الخريطة</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white flex items-center gap-1">
                    +50k
                    <PhoneCall className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="text-xs text-slate-400">طلب عميل شهرياً</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white flex items-center gap-1">
                    100%
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-xs text-slate-400">ضمان النتائج والسلاسة</div>
                </div>
              </div>
            </div>

            {/* Left Interactive Mock Display */}
            <div className="lg:col-span-5 relative">
              <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">نتائج خرائط Google</h3>
                      <p className="text-xs text-slate-400">الترتيب في حي العليا، الرياض</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-bold rounded-full">
                    #1 الترتيب الأول
                  </span>
                </div>

                {/* Simulated Maps Result Cards */}
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/40 to-slate-900 border border-orange-500/40 shadow-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-sm">متجرك التجاري (مُحسّن بواسطة مكّن)</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        4.9 (148 تقييم)
                      </div>
                    </div>
                    <p className="text-xs text-slate-300">مخبز ومحمصة قهوة اختصاصية • مفتوح الآن</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2.5 py-1 bg-orange-500 text-white font-bold text-[10px] rounded-lg">
                        الموقع الرئيسي
                      </span>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        زيادة 120 اتصال هذا الأسبوع
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 opacity-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-400 text-xs">منافس مجاور (غير مُحسّن)</span>
                      <span className="text-xs text-slate-500">4.1 (12 تقييم)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>لوحة تحكم خفيفة ومباشرة تسمح لك بمتابعة نتائج طلبك وتحديثات الفريق لحظة بلحظة.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-slate-950/80 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-orange-400 text-xs font-bold">
              <Zap className="w-4 h-4" />
              خدمات موجهة لرفع المبيعات
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              خدمات سريعة لتصدر محركات البحث المحلية
            </h2>
            <p className="text-slate-400 text-base">
              اختر الخدمة المناسبة لنشاطك التجاري وابدأ في استقبال الزبائن الجدد فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES_DATA.map((srv) => (
              <div
                key={srv.id}
                className="group relative p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-900/90 transition-all duration-300 flex flex-col justify-between space-y-6 shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600/30 to-amber-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                      {srv.iconName === "MapPin" && <MapPin className="w-6 h-6" />}
                      {srv.iconName === "Search" && <Search className="w-6 h-6" />}
                      {srv.iconName === "Star" && <Star className="w-6 h-6" />}
                    </div>
                    {srv.badge && (
                      <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold rounded-full">
                        {srv.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    {srv.title}
                  </h3>

                  <p className="text-slate-400 text-sm leading-relaxed">{srv.shortDesc}</p>

                  <ul className="space-y-2 pt-2 border-t border-slate-800/80">
                    {srv.features.slice(0, 3).map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-800/60">
                  <button
                    onClick={() => setSelectedService(srv)}
                    className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>تفاصيل الخدمة</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  <Link
                    href="/auth"
                    className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-400 font-bold text-xs rounded-xl border border-orange-500/30 transition-all"
                  >
                    طلب الخدمة
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-[#090d16] border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">لماذا منصة مكّن؟</h2>
            <p className="text-slate-400 text-base">
              صُممت المنصة خصيصاً لتناسب احتياجات السوق السعودي وتضمن لك تجربة سلسة وتواصل مباشر مع المنفذين.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-100 text-base">فريق سعودي خبير</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                معرفة دقيقة بطبيعة الأحياء والمناطق في مدن المملكة وسلوك البحث المحلي للزبائن.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-100 text-base">مراسلة مباشرة لكل طلب</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                نظام محادثة نصية خاص بكل طلب يتيح لك التواصل المباشر مع المسؤول ومتابعة المستجدات.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-100 text-base">أمان وخصوصية</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                بيانات محلك ومحادثاتك محمية بآلية RLS وقواعد أمان عالية عبر قاعدة بيانات Supabase.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-100 text-base">سرعة وتحديث مستمر</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                متابعة دقيقة لحالة طلبك من (قيد الانتظار) إلى (قيد التنفيذ) حتى الاعتماد النهائي.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact" className="py-20 bg-slate-950 border-b border-slate-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-950/60 border border-orange-500/30 text-orange-300 text-xs font-bold">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                تواصل مباشر
              </div>
              <h2 className="text-3xl font-extrabold text-white">هل لديك استفسار قبل البدء؟</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                اكتب رسالتك وسيتواصل معك فريق الاستشارات في مكّن خلال ساعات عمل قليلة.
              </p>
            </div>

            <form onSubmit={handleSubmit(onContactSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-300 mb-1.5">
                    الاسم الكامل <span className="text-orange-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="أدخل اسمك الكريم"
                    {...register("name")}
                    disabled={submittingContact}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
                  />
                  {errors.name && (
                    <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-300 mb-1.5">
                    البريد الإلكتروني <span className="text-orange-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@domain.com"
                    {...register("email")}
                    disabled={submittingContact}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                  />
                  {errors.email && (
                    <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-bold text-slate-300 mb-1.5">
                  الرسالة <span className="text-orange-500">*</span>
                </label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="اكتب استفسارك أو تفاصيل نشاطك التجاري هنا..."
                  {...register("message")}
                  disabled={submittingContact}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm resize-none"
                />
                {errors.message && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.message.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingContact}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                {submittingContact ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    إرسال الرسالة
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Service Detail Modal */}
      <ServiceDetailModal
        service={selectedService}
        onClose={() => setSelectedService(null)}
      />

      <Footer />
    </div>
  );
}
