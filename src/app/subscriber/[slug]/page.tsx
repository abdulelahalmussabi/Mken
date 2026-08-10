"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import { useAdmin } from "@/context/AdminContext";
import {
  Building2,
  Bed,
  Sparkles,
  Phone,
  CalendarCheck,
  MessageCircle,
  Share2,
  MapPin,
  Star,
  CheckCircle2,
  Download,
  X,
  Scissors,
  User,
  Clock,
  ArrowRight,
  Send,
  Zap,
} from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  badge: string;
  price: string;
  features: string[];
  image: string;
  popular?: boolean;
}

const HOTEL_SERVICES: ServiceOption[] = [
  {
    id: "std",
    name: "غرفة قياسية (Standard)",
    badge: "قياسية 🛏️",
    price: "250 ر.س / ليلة",
    features: ["سرير مزدوج أو ثنائي", "شاشة 55 بوصة ذكية", "واي فاي سريع جداً", "خدمة الغرف 24/7"],
    image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "deluxe",
    name: "جناح ديلوكس (Deluxe Suite)",
    badge: "ديلوكس ✨",
    price: "420 ر.س / ليلة",
    features: ["غرفة نوم + صالة جلوس واسعة", "إطلالة بانورامية مميزة", "آلة قهوة اسبريسو ومشروبات", "موقف سيارة خاص مغطى"],
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    popular: true,
  },
  {
    id: "family",
    name: "جناح عائلي فاخر (Royal Family)",
    badge: "ملكي 🏰",
    price: "680 ر.س / ليلة",
    features: ["2 غرفة نوم + 2 حمام + مطبخ مجهز", "منطقة ألعاب أطفال صغيرة", "خدمة تنظيف يومية وشاملة", "خصم خاص للإقامات الطويلة"],
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
  },
];

const SALON_SERVICES: ServiceOption[] = [
  {
    id: "cut",
    name: "حلاقة شعر احترافية وتصفيف",
    badge: "حلاقة 💈",
    price: "70 ر.س",
    features: ["قص وتحديد احترافي", "غسيل شعر واستشوار", "منتجات عناية إيطالية", "مشروب ضيافة فاخر مجاني"],
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
    popular: true,
  },
  {
    id: "beard",
    name: "عناية باللحية وتحديد بالبخار",
    badge: "لحية 🧔",
    price: "50 ر.س",
    features: ["تحديد واستشوار بالبخار", "زيوت ومقشرات ترطيب", "منشفة حارة استرخائية", "تنظيف شنب ولحية بالكامل"],
    image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "kids",
    name: "حلاقة وتنظيف أطفال",
    badge: "أطفال 🧒",
    price: "40 ر.س",
    features: ["مقاعد أطفال ملونة ومريحة", "شاشات عرض ألعاب ورسوم", "قصة وتحديد لطيف ومناسب", "هدية وألعاب للطفل بعد الحلاقة"],
    image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "home",
    name: "خدمة حلاقة وتجميل منزلية VIP",
    badge: "حلاقة منزل 🏠",
    price: "150 ر.س",
    features: ["وصول الحلاق إلى بيتك بأحدث أدوات المعالجة", "حقيبة معقمة بالكامل لمرة واحدة", "حلاقة شعر ولحية وبخار منزلي", "مرونة عالية في تحديد الوقت"],
    image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
  },
];

export default function SubscriberStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug?.toLowerCase() || "almahrusa";

  const { activeOccasion, occasionDetails, openModal } = useOccasion();
  const { showToast } = useApp();
  const { clients } = useAdmin();

  // Try to get client data from AdminContext (dynamic)
  const adminClient = clients.find((c) => c.slug === slug);
  const isSalon = adminClient
    ? adminClient.type === "salon"
    : slug === "demo" || slug === "salon" || slug === "barber";

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAppBanner, setShowAppBanner] = useState<boolean>(true);
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);

  // Booking Form
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("16:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentServices = isSalon ? SALON_SERVICES : HOTEL_SERVICES;

  // Store Metadata — dynamic from AdminContext, with hardcoded fallback
  const storeInfo = adminClient
    ? {
        name: adminClient.name,
        tagline: adminClient.tagline || "احجز وادخل بدون انتظار",
        subtitle: adminClient.subtitle || "",
        location: adminClient.location || "المملكة العربية السعودية",
        phone: adminClient.phone || "0500000000",
        whatsapp: adminClient.whatsapp || "966500000000",
        rating: adminClient.rating || "4.9",
        reviewsCount: adminClient.reviewsCount || "0 تقييم",
        heroImage:
          adminClient.heroImage ||
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
        demoNotice: adminClient.demoNotice || `✨ عرض تجريبي — ${adminClient.name} على منصة مكّن`,
      }
    : isSalon
    ? {
        name: "صالون النخبة",
        tagline: "احجز وادخل بدون انتظار",
        subtitle: "في صالون النخبة نوفر حلاقة رجالية ونسائية، عناية باللحية، وتجميل – احجز موعدك أونلاين واختر الوقت المناسب.",
        location: "حي الربيع - الرياض، المملكة العربية السعودية",
        phone: "0543530333",
        whatsapp: "966543530333",
        rating: "4.9",
        reviewsCount: "512 تقييم موثق",
        heroImage: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
        demoNotice: "🚀 عرض تجريبي حي – مثال: صالون النخبة على مكّن. جرب 14 يوماً مجاناً",
      }
    : {
        name: "مجموعة المحروسة",
        tagline: "إقامة مميزة وخدمة استثنائية",
        subtitle: "في مجموعة المحروسة غرف وأجنحة بمعايير ضيافة عالية – احجز مسبقاً واستمتع بإقامة مريحة في قلب الرياض.",
        location: "حي العليا - الرياض، المملكة العربية السعودية",
        phone: "0551234567",
        whatsapp: "966551234567",
        rating: "4.9",
        reviewsCount: "382 تقييم موثق",
        heroImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
        demoNotice: "✨ عرض تجريبي حي – مثال: مجموعة المحروسة للشقق الفندقية على منصة مكّن",
      };

  const handleOpenBooking = (srv?: ServiceOption) => {
    setSelectedService(srv || currentServices[0]);
    setBookingModalOpen(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      showToast("يرجى ملء كافة البيانات المطلوب إدخالها", "error");
      return;
    }
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setBookingModalOpen(false);
      showToast(`تم تأكيد طلب حجزك في ${storeInfo.name} بنجاح!`, "success");

      const msg = encodeURIComponent(
        `السلام عليكم، أود تأكيد موعد حجز في *${storeInfo.name}*:\n` +
          `• الخدمة: ${selectedService?.name || "خدمة عامة"}\n` +
          `• السعر: ${selectedService?.price}\n` +
          `• التاريخ والوقت: ${bookingDate || "اليوم"} - الساعة ${bookingTime}\n` +
          `• الاسم: ${clientName}\n` +
          `• الجوال: ${clientPhone}\n` +
          `• كود الخصم المطبق: ${occasionDetails.couponCode} (${occasionDetails.discountText})`
      );
      window.open(`https://wa.me/${storeInfo.whatsapp}?text=${msg}`, "_blank");
    }, 1000);
  };

  const filteredServices =
    selectedCategory === "all"
      ? currentServices
      : currentServices.filter((s) => s.id === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-theme-main text-slate-100 font-sans transition-colors duration-500 relative">
      {/* Top Demo Bar */}
      <div className="w-full py-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 text-white text-xs font-bold text-center flex items-center justify-center gap-2 px-4 shadow-md">
        <span>{storeInfo.demoNotice}</span>
      </div>

      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              {isSalon ? "💈" : "🏢"}
            </div>
            <div>
              <h1 className="font-extrabold text-xl sm:text-2xl text-slate-100 tracking-tight flex items-center gap-2">
                {storeInfo.name}
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-normal hidden sm:inline-block">
                  موقع موثق 🇸🇦
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium -mt-0.5">{storeInfo.tagline}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-full border border-slate-800">
            <a href="#hero" className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white rounded-full hover:bg-slate-800 transition">
              الرئيسية
            </a>
            <a href="#services" className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white rounded-full hover:bg-slate-800 transition">
              خدمات الصالون / المتوفرة
            </a>
            <Link href={`/book?tenant=${slug}`} className="px-3.5 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full transition flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5" />
              حجز موعد أونلاين
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <Link
              href={`/book?tenant=${slug}`}
              className="px-4 py-2 text-xs font-bold text-slate-950 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-1.5"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">احجز موعدك أونلاين</span>
              <span className="sm:hidden">احجز</span>
            </Link>

            <a
              href={`https://wa.me/${storeInfo.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">واتساب</span>
            </a>
          </div>
        </div>
      </header>

      {/* Festive Occasion Top Banner */}
      <div
        className="w-full py-2.5 px-4 text-center text-xs font-bold border-b border-slate-800/80 flex items-center justify-center gap-2 transition-colors duration-500"
        style={{
          background: `linear-gradient(90deg, rgba(15,23,42,0.95) 0%, ${occasionDetails.accentColor}25 50%, rgba(15,23,42,0.95) 100%)`,
        }}
      >
        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
        <span>عرض مناسبة {occasionDetails.shortName}: <strong>{occasionDetails.discountText}</strong></span>
        <button onClick={openModal} className="underline text-amber-300 mr-2 hover:opacity-80">
          كود الخصم: <strong className="font-mono">{occasionDetails.couponCode}</strong> 🇸🇦
        </button>
      </div>

      {/* Main Hero Section */}
      <section id="hero" className="relative overflow-hidden pt-12 pb-20 border-b border-slate-800/60">
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none -z-10 opacity-25 transition-colors duration-500"
          style={{ backgroundColor: occasionDetails.accentColor }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Text Content */}
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-bold shadow-lg">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>ترحيب احتفالي بمناسبة {occasionDetails.shortName}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-100 leading-tight tracking-tight">
                {storeInfo.name} <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${occasionDetails.accentColor} 100%)`,
                  }}
                >
                  {storeInfo.tagline}
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
                {storeInfo.subtitle}
              </p>

              {/* Service Badges Filter */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    selectedCategory === "all"
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  الخدمات المتوفرة
                </button>
                {currentServices.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedCategory(srv.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedCategory === srv.id
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    {srv.badge}
                  </button>
                ))}
              </div>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => handleOpenBooking()}
                  className="px-7 py-4 text-slate-950 font-extrabold text-base rounded-2xl shadow-xl transition-transform hover:scale-105 flex items-center gap-2"
                  style={{ backgroundColor: occasionDetails.accentColor }}
                >
                  <CalendarCheck className="w-5 h-5" />
                  احجز وادخل بدون انتظار
                </button>

                <Link
                  href={`/book?tenant=${slug}`}
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-base rounded-2xl transition flex items-center gap-2"
                >
                  <Clock className="w-5 h-5 text-amber-400" />
                  احجز موعد أونلاين
                </Link>

                <a
                  href={`https://wa.me/${storeInfo.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-4 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/80 rounded-2xl font-bold text-sm transition flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  واتساب
                </a>
              </div>
            </div>

            {/* Hero Image Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-2xl p-4 space-y-4">
                <img
                  src={storeInfo.heroImage}
                  alt={storeInfo.name}
                  className="w-full h-64 object-cover rounded-2xl shadow-md"
                />

                <div className="space-y-2 text-right p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {storeInfo.rating} ({storeInfo.reviewsCount})
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {storeInfo.location}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-100">{storeInfo.name} - خيارك الأول</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    خدمات احترافية بمقاييس عالية مع الالتزام الكامل بالنظافة وتوفير أرقى منتجات العناية.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services List Section */}
      <section id="services" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            {isSalon ? "خدمات الصالون المتوفرة" : "خيارات الإقامة والخدمات"}
          </h2>
          <p className="text-sm text-slate-400">
            اختر الخدمة المطلوبة وتصفح أسعارها واستفد من خصم {occasionDetails.shortName} المباشر
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredServices.map((srv) => (
            <div
              key={srv.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl hover:-translate-y-1"
            >
              <div>
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={srv.image}
                    alt={srv.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30">
                    {srv.badge}
                  </div>
                  {srv.popular && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      الأكثر طلباً
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4 text-right">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-slate-100">{srv.name}</h3>
                    <span className="text-sm font-black text-amber-400">{srv.price}</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300">
                    {srv.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => handleOpenBooking(srv)}
                  className="w-full py-3 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-transform hover:scale-102 flex items-center justify-center gap-2"
                  style={{ backgroundColor: occasionDetails.accentColor }}
                >
                  <CalendarCheck className="w-4 h-4" />
                  احجز هذه الخدمة الآن
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating App Install Banner */}
      {showAppBanner && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-slate-700/90 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl space-y-3 animate-fade-in text-right">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => setShowAppBanner(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-100">ثبت التطبيق الخاصة بالمنشأة</span>
                <span className="text-[11px] text-slate-400">وصول أسرع وإشعارات لتذكير بمواعيدك وحجوزاتك</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Download className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAppBanner(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
            >
              لاحقاً
            </button>
            <button
              onClick={() => {
                showToast(`جاري تثبيت تطبيق ${storeInfo.name} على جهازك...`, "success");
                setShowAppBanner(false);
              }}
              className="px-4 py-1.5 text-slate-950 font-bold text-xs rounded-lg shadow-md"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              تثبيت
            </button>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${storeInfo.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 left-5 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110"
        title="تواصل معنا عبر واتساب"
      >
        <MessageCircle className="w-7 h-7 fill-white text-emerald-500" />
      </a>

      {/* Interactive Booking Modal */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-right relative">
            <button
              onClick={() => setBookingModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
                حجز موعد في {storeInfo.name}
              </h3>
              <p className="text-xs text-slate-400">
                الخدمة المختارة: <strong className="text-amber-300">{selectedService?.name}</strong> ({selectedService?.price})
              </p>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="مثال: محمد الشمري"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال (واتساب) *</label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الوقت المفضل *</label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="14:00">02:00 مساءً</option>
                    <option value="16:00">04:00 مساءً</option>
                    <option value="18:00">06:00 مساءً</option>
                    <option value="20:00">08:00 مساءً</option>
                    <option value="22:00">10:00 مساءً</option>
                  </select>
                </div>
              </div>

              {/* Coupon Discount Info */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                <span>خصم المناسبة ({occasionDetails.shortName}): <strong>{occasionDetails.couponCode}</strong></span>
                <span className="font-bold">{occasionDetails.discountText}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl transition flex items-center justify-center gap-2"
                style={{ backgroundColor: occasionDetails.accentColor }}
              >
                {isSubmitting ? "جاري إرسال الطلب..." : "تأكيد الحجز ومتابعة عبر الواتساب"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
