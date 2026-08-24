"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useOccasion } from "@/context/OccasionContext";
import { useApp } from "@/context/AppContext";
import { OccasionSymbolsStrip } from "@/components/occasions/OccasionSymbolsStrip";
import {
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Building2,
  ArrowRight,
  ShieldCheck,
  Tag,
  Send,
  MessageCircle,
  Download,
  X,
  Loader2,
} from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  duration: string;
  price: string;
  desc: string;
}

function BookAppointmentContent() {
  const searchParams = useSearchParams();
  const { currentSlug, occasionDetails, openModal } = useOccasion();
  const querySlug = searchParams.get("tenant") || searchParams.get("store") || searchParams.get("client");
  const tenantSlug = (currentSlug || querySlug || "").trim().toLowerCase();
  const tenantHome = (tenantSlug ? `/subscriber/${tenantSlug}` : "/") as Route;

  const { showToast } = useApp();

  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [catalogServices, setCatalogServices] = useState<ServiceOption[]>([]);
  const [tenantWhatsapp, setTenantWhatsapp] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("16:00");
  const [clientName, setClientName] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [couponInput, setCouponInput] = useState<string>(occasionDetails.couponCode);
  const [couponApplied, setCouponApplied] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAppBanner, setShowAppBanner] = useState<boolean>(true);
  const [tenantName, setTenantName] = useState<string>("منصة مكّن");

  // Sync coupon when occasion changes
  useEffect(() => {
    setCouponInput(occasionDetails.couponCode);
  }, [occasionDetails]);

  useEffect(() => {
    if (!tenantSlug) {
      setTenantName("منصة مكّن");
      return;
    }

    let cancelled = false;
    fetch(`/api/clients/${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const name = data?.client?.name;
        setTenantName(typeof name === "string" && name.trim() ? name : `منشأة ${tenantSlug}`);
        const wa = data?.client?.whatsapp;
        setTenantWhatsapp(typeof wa === "string" ? wa.replace(/\D/g, "") : "");
        const services = Array.isArray(data?.catalog?.services)
          ? data.catalog.services.map((item: { id: string; name: string; duration?: string; price?: string; description?: string }) => ({
              id: item.id,
              name: item.name,
              duration: item.duration || "",
              price: item.price || "السعر عند الطلب",
              desc: item.description || "",
            }))
          : [];
        setCatalogServices(services);
        setSelectedService((current) => current || services[0] || null);
      })
      .catch(() => {
        if (!cancelled) setTenantName(`منشأة ${tenantSlug}`);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponInput.trim().toUpperCase() === occasionDetails.couponCode) {
      setCouponApplied(true);
      showToast(`تم تطبيق كود الخصم (${occasionDetails.couponCode}) بنجاح!`, "success");
    } else {
      setCouponApplied(false);
      showToast("كود الخصم المدخل غير صحيح", "error");
    }
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim() || !selectedDate || !selectedService) {
      showToast("يرجى تعبئة كافة الحقول المطلوبة (الاسم، الجوال، والتاريخ)", "error");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast(`تم إرسال حجزك إلى ${tenantName} بنجاح!`, "success");

      // Generate WhatsApp Confirmation Link
      const text = encodeURIComponent(
        `السلام عليكم، أود تأكيد موعد حجز في *${tenantName}*:\n` +
          `• الخدمة: ${selectedService.name} (${selectedService.price})\n` +
          `• التاريخ: ${selectedDate} - الساعة ${selectedTime}\n` +
          `• الاسم: ${clientName}\n` +
          `• الجوال: ${clientPhone}\n` +
          (notes ? `• الملاحظات: ${notes}\n` : "") +
          `• كود الخصم: ${couponApplied ? occasionDetails.couponCode : "بدون"} (${occasionDetails.discountText})`
      );

      window.open(`https://wa.me/${tenantWhatsapp || "966500000000"}?text=${text}`, "_blank");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-theme-main text-slate-100 font-sans transition-colors duration-500 relative">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href={tenantHome} className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xl text-white shadow-lg transition-transform group-hover:scale-105"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              🏢
            </div>
            <div className="flex flex-col text-right">
              <span className="font-black text-xl text-slate-100 flex items-center gap-2">
                {tenantName}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  حجز موعد اونلاين
                </span>
              </span>
              <span className="text-xs text-slate-400">خدمات الضيافة والإقامة المباشرة</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={tenantHome}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>موقع المنشأة</span>
            </Link>

            <a
              href={tenantWhatsapp ? `https://wa.me/${tenantWhatsapp}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">تواصل واتساب</span>
            </a>
          </div>
        </div>
      </header>

      {/* Occasion Active Coupon Notification */}
      <div
        className="w-full py-2.5 px-4 text-center text-xs font-bold border-b border-slate-800/80 flex items-center justify-center gap-2 transition-colors duration-500"
        style={{
          background: `linear-gradient(90deg, rgba(15,23,42,0.95) 0%, ${occasionDetails.accentColor}25 50%, rgba(15,23,42,0.95) 100%)`,
        }}
      >
        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
        <span>
          {occasionDetails.slogan} — <strong>{occasionDetails.discountText}</strong>
        </span>
        <button onClick={openModal} className="underline text-amber-300 mr-2 hover:opacity-80">
          تغيير الثيم 🇸🇦
        </button>
      </div>

      {/* Main Booking Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right">
        {/* Title */}
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
            احجز موعدك في {tenantName}
          </h1>
          <p className="text-sm text-slate-400">
            اختر الخدمة والموعد المناسب – سنؤكد موعدك فوراً عبر الواتساب مع تطبيق الخصم المستحق.
          </p>
          <OccasionSymbolsStrip className="justify-center pt-2" />
        </div>

        <form onSubmit={handleSubmitBooking} className="space-y-8">
          {/* Step 1: Select Service */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black">
                1
              </span>
              اختر الخدمة أو جناح الإقامة المطلوب *
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {catalogServices.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد خدمات معزولة لهذه المنشأة بعد.</p>
              ) : (
                catalogServices.map((srv) => {
                const isSelected = selectedService?.id === srv.id;
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? "bg-slate-800/90 border-amber-500 shadow-lg ring-1 ring-amber-500"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-100">{srv.name}</h3>
                      <span className="text-xs font-extrabold text-amber-400">{srv.price}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{srv.desc}</p>
                    <div className="text-[11px] text-slate-500 font-medium">{srv.duration}</div>
                  </div>
                );
              })
              )}
            </div>
          </div>

          {/* Step 2: Date & Time Picker */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black">
                2
              </span>
              اختر التاريخ والوقت المناسب *
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">تاريخ الحجز أو الوصول *</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">وقت الحجز المفصل *</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="14:00">02:00 مساءً (تسليم مبكر)</option>
                  <option value="16:00">04:00 مساءً (الوقت القياسي)</option>
                  <option value="18:00">06:00 مساءً</option>
                  <option value="20:00">08:00 مساءً</option>
                  <option value="22:00">10:00 مساءً (وصول متأخر)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Customer Information & Coupon */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black">
                3
              </span>
              معلوماتك الشخصية وكوبون الخصم
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الاسم الثلاثي *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="مثال: عبدالله الفهد"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم الجوال (الواتساب) *</label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات أو طلبات خاصة (اختياري)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أية تفضيلات خاصة بالأسرة، التجهيزات، أو المشروبات..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Coupon Apply Card */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                كوبون الخصم الخاص بالمناسبة ({occasionDetails.shortName})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="ادخل كود الخصم..."
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 uppercase tracking-wider font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                >
                  تطبيق
                </button>
              </div>

              {couponApplied && (
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم تطبيق خصم {occasionDetails.shortName}: {occasionDetails.discountText}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 text-slate-950 font-black text-base rounded-2xl shadow-xl transition-transform hover:scale-102 flex items-center justify-center gap-2"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              <Send className="w-5 h-5" />
              {isSubmitting ? "جاري تجهيز وتأكيد الطلب..." : `تأكيد حجز الموعد في ${tenantName}`}
            </button>
          </div>
        </form>
      </main>

      {/* Floating App Installation Banner */}
      {showAppBanner && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full bg-slate-900/95 border border-slate-700/90 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl space-y-3 animate-fade-in text-right mx-auto">
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
                showToast(`جاري تثبيت تطبيق ${tenantName} على جهازك...`, "success");
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
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
          <div className="flex items-center gap-3 text-amber-400 font-bold">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>جاري تحميل نظام حجز المواعيد للمشتركين...</span>
          </div>
        </div>
      }
    >
      <BookAppointmentContent />
    </Suspense>
  );
}
