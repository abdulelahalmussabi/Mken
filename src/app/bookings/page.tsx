"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import {
  Stethoscope,
  Scissors,
  Building2,
  CalendarCheck,
  Clock,
  User,
  Phone,
  Sparkles,
  CheckCircle2,
  Send,
  X,
  Star,
  MapPin,
  MessageCircle,
  Tag,
  ShieldCheck
} from "lucide-react";

interface BookingOption {
  id: string;
  category: "clinic" | "salon" | "hotel";
  categoryBadge: string;
  title: string;
  provider: string;
  location: string;
  price: string;
  duration: string;
  description: string;
  features: string[];
  rating: string;
  image: string;
  popular?: boolean;
}

const BOOKING_SERVICES: BookingOption[] = [
  // 1. Clinics
  {
    id: "clinic-dental",
    category: "clinic",
    categoryBadge: "عيادة طبية 🩺",
    title: "كشف واستشارة طب الأسنان والابتسامة",
    provider: "عيادات النخبة التخصصية",
    location: "الرياض - طريق الملك فهد",
    price: "150 ر.س",
    duration: "45 دقيقة",
    description: "فحص شامل بالآشعة البانورامية، تنظيف وتلميع الأسنان، وخطة علاجية تجميلية متكاملة.",
    features: [
      "أحدث أجهزة الكشف الرقمي والبانوراما",
      "جلسة تنظيف وتلميع وإزالة الجير",
      "استشارة طبيب استشاري تركيبات وزراعة",
      "خطة علاجية مخصصة مع الخصم الفوري"
    ],
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
    popular: true
  },
  {
    id: "clinic-derma",
    category: "clinic",
    categoryBadge: "جلدية وتجميل ✨",
    title: "جلسة نضارة البشرة والهيدرافيشل VIP",
    provider: "مركز ريفان للجلدية والليزر",
    location: "جدة - حي الروضة",
    price: "280 ر.س",
    duration: "60 دقيقة",
    description: "تنظيف عميق للبشرة، تقشير ماسي، حقن سيرومات الفيتامينات، وماسك الكولاجين الملكي.",
    features: [
      "تنظيف مسام عميق وإزالة الرؤوس السوداء",
      "سيرومات نضارة إيطالية أصلية",
      "جلسة ليزر كربوني لتفتيح ونضارة البشرة",
      "استشارة مجانية مع طبيبة الجلدية"
    ],
    rating: "4.8",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "clinic-physio",
    category: "clinic",
    categoryBadge: "علاج طبيعي وتأهيل 🌿",
    title: "جلسة علاج طبيعي وتأهيل عظام وعمود فقري",
    provider: "مركز التعافي المتقدم",
    location: "المدينة المنورة - طريق سلطانة",
    price: "200 ر.س",
    duration: "50 دقيقة",
    description: "جلسة علاج يدوي وأجهزة كهرومغناطيسية لعلاج آلام الظهر والمفاصل وتأهيل الإصابات الرياضية.",
    features: [
      "تقييم حركي شامل وتشخيص موضع الألم",
      "أجهزة موجات صوتية وعلاج بالتبريد",
      "تمارين تأهيلية بإشراف أخصائي معتمد",
      "برنامج منزلي للمحافظة على التحسن"
    ],
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80"
  },

  // 2. Salons
  {
    id: "salon-vip",
    category: "salon",
    categoryBadge: "صالون وعناية 💈",
    title: "باقة العناية الملكية الشاملة (VIP Grooming)",
    provider: "صالون النخبة للرجال",
    location: "الرياض - حي الربيع",
    price: "120 ر.س",
    duration: "50 دقيقة",
    description: "حلاقة شعر وتصفيف، عناية باللحية بالبخار الساخن، سنفرة وتنظيف بشرة، ومساج استرخائي.",
    features: [
      "قص وتحديد احترافي بأحدث صيحات الموضة",
      "جلسة بخار ساخن وترطيب لحية بزيوت إيطالية",
      "تنظيف وجه بأقنعة الطين البركاني",
      "مشروب ضيافة قهوة سعودية فاخر مجاناً"
    ],
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
    popular: true
  },
  {
    id: "salon-home",
    category: "salon",
    categoryBadge: "خدمة منزلية 🏠",
    title: "خدمة حلاقة وتجميل منزلية VIP",
    provider: "خدمة مكّن هوم VIP",
    location: "كافة أحياء الرياض وجدة",
    price: "180 ر.س",
    duration: "60 دقيقة",
    description: "حلاق ومختص عناية يصلك أينما كنت في بيتك أو مكتبك مع حقيبة معقمة بالكامل لمرة واحدة.",
    features: [
      "وصول للعميل في الوقت المحدد بدقة",
      "أدوات ومناشف استخدام لمرة واحدة (معقمة)",
      "حلاقة شعر ولحية وبخار كاملة",
      "راحة وخصوصية تامة بدون انتظار"
    ],
    rating: "4.8",
    image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80"
  },

  // 3. Hotel Rooms & Suites
  {
    id: "hotel-deluxe",
    category: "hotel",
    categoryBadge: "شقق وغرف فندقية 🏨",
    title: "جناح ديلوكس فندقي فاخر (Deluxe Suite)",
    provider: "المحروسة للشقق المخدومة",
    location: "المدينة المنورة - حي ابو كبير",
    price: "420 ر.س",
    duration: "حجز ليلة كاملة",
    description: "غرفة نوم ماستر + صالة جلوس مستقلة، إطلالة بانورامية، آلة اسبريسو، وخدمة الغرف 24/7.",
    features: [
      "سرير كينج ملكي مريح جداً مع خيارات الوسائد",
      "شاشة ذكية 65 بوصة مع اشتراكات الترفيه",
      "مطبخ تحضيري متكامل وآلة قهوة",
      "موقف سيارة مغطى وخدمة توصيل للمسجد النبوي"
    ],
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    popular: true
  },
  {
    id: "hotel-royal",
    category: "hotel",
    categoryBadge: "جناح عائلي 🏰",
    title: "جناح ملكي عائلي 3 غرف (Royal Family)",
    provider: "المحروسة للشقق المخدومة",
    location: "المدينة المنورة - حي ابو كبير",
    price: "680 ر.س",
    duration: "حجز ليلة كاملة",
    description: "جناح واسع للعائلات يضم 3 غرف نوم + 2 حمام + صالة كبيرة ومطبخ مجهز بالكامل.",
    features: [
      "3 غرف نوم مجهزة بأفخم المفارش",
      "صالة عائلية فسيحة ومنطقة طعام",
      "خدمة تنظيف يومية وشاملة",
      "خصم خاص للإقامات التي تزيد عن 3 ليالٍ"
    ],
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
  }
];

export default function BookingsPage() {
  const { occasionDetails, openModal } = useOccasion();
  const { showToast } = useApp();

  const [activeCategory, setActiveCategory] = useState<"all" | "clinic" | "salon" | "hotel">("all");
  const [selectedService, setSelectedService] = useState<BookingOption | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("16:00");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredServices =
    activeCategory === "all"
      ? BOOKING_SERVICES
      : BOOKING_SERVICES.filter((s) => s.category === activeCategory);

  const handleOpenBooking = (srv: BookingOption) => {
    setSelectedService(srv);
    setModalOpen(true);
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !bookingDate) {
      showToast("يرجى تعبئة الاسم، الجوال، وتاريخ الحجز", "error");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalOpen(false);
      showToast(`تم تأكيد حجز موعدك في ${selectedService?.title} بنجاح!`, "success");

      const msg = encodeURIComponent(
        `السلام عليكم، أود تأكيد موعد حجز في *${selectedService?.title}* (${selectedService?.provider}):\n` +
          `• السعر: ${selectedService?.price} (${selectedService?.duration})\n` +
          `• التاريخ والوقت: ${bookingDate} - الساعة ${bookingTime}\n` +
          `• الاسم: ${clientName}\n` +
          `• الجوال: ${clientPhone}\n` +
          (notes ? `• ملاحظات: ${notes}\n` : "") +
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
            <span>نظام الحجوزات والمواعيد الفورية — منصة مكّن 🇸🇦</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            احجز موعدك في العيادات، الصالونات، والغرف الفندقية
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            اختر الخدمة، حدد الوقت المناسب، واستمتع بتأكيد الحجز الفوري عبر الواتساب مع تطبيق الخصومات الوطنية المعتمدة.
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

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-xl mx-auto shadow-xl">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "all"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            كافة الحجوزات ({BOOKING_SERVICES.length})
          </button>

          <button
            onClick={() => setActiveCategory("clinic")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "clinic"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>العيادات والمراكز</span>
          </button>

          <button
            onClick={() => setActiveCategory("salon")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "salon"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>الصالونات والعناية</span>
          </button>

          <button
            onClick={() => setActiveCategory("hotel")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "hotel"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>الغرف والشقق الفندقية</span>
          </button>
        </div>
      </section>

      {/* Services Grid */}
      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredServices.map((srv) => (
            <div
              key={srv.id}
              className={`rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xl group text-right ${
                srv.popular
                  ? "bg-slate-900/95 border-amber-500/80 shadow-amber-500/10 ring-1 ring-amber-500/40 hover:-translate-y-1.5"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:-translate-y-1"
              }`}
            >
              <div>
                <div className="relative h-48 overflow-hidden bg-slate-950">
                  <img
                    src={srv.image}
                    alt={srv.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  <span className="absolute top-3 right-3 px-3 py-1 bg-slate-950/85 backdrop-blur-md rounded-full text-[11px] font-bold text-amber-300 border border-amber-500/30">
                    {srv.categoryBadge}
                  </span>
                  {srv.popular && (
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase">
                      الأكثر طلباً
                    </span>
                  )}
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {srv.location}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {srv.rating}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold text-white group-hover:text-amber-400 transition-colors">
                    {srv.title}
                  </h3>

                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-amber-300">{srv.price}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {srv.duration}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{srv.description}</p>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    {srv.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => handleOpenBooking(srv)}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>احجز موعد في هذه الخدمة</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Booking Modal */}
      {modalOpen && selectedService && (
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
                <span>{selectedService.categoryBadge}</span>
              </div>
              <h3 className="text-xl font-black text-white">حجز موعد: {selectedService.title}</h3>
              <p className="text-xs text-slate-400">
                المنشأة: <strong className="text-slate-200">{selectedService.provider}</strong> • السعر: <strong className="text-amber-300">{selectedService.price}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صالح العمري"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التاريخ المفضل *</label>
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
                    <option value="10:00">10:00 صباحاً</option>
                    <option value="12:00">12:00 ظهراً</option>
                    <option value="16:00">04:00 مساءً</option>
                    <option value="18:00">06:00 مساءً</option>
                    <option value="20:00">08:00 مساءً</option>
                    <option value="22:00">10:00 مساءً</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات أو طلبات خاصة</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل خاصة بالأعراض، طلب أخصائي محدد، أو تفضيلات الغرفة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Coupon Info */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                <span>خصم المناسبة ({occasionDetails.shortName}): <strong>{occasionDetails.couponCode}</strong></span>
                <span className="font-bold">{occasionDetails.discountText}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>جاري تأكيد الموعد...</span>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span>تأكيد الحجز والإرسال عبر الواتساب</span>
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
