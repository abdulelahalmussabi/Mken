"use client";

import React, { useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import {
  Palette,
  Check,
  ExternalLink,
  Gift,
  Info,
  ShieldCheck,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Save,
  Tag,
} from "lucide-react";

const occasionsList = Object.values(SAUDI_OCCASIONS);

export default function ClientAdminPage() {
  const { session, clients, getClientTheme, setClientTheme, updateClient, isSuperAdmin } = useAdmin();
  const { showToast } = useApp();

  // Get the client for this admin
  const myClient = clients.find((c) => c.slug === session?.clientSlug);
  const currentTheme = getClientTheme(session?.clientSlug || "") || "national_day";
  const currentOcc = SAUDI_OCCASIONS[currentTheme];

  // Editable Form State
  const [name, setName] = useState(myClient?.name || "");
  const [tagline, setTagline] = useState(myClient?.tagline || "");
  const [subtitle, setSubtitle] = useState(myClient?.subtitle || "");
  const [phone, setPhone] = useState(myClient?.phone || "");
  const [whatsapp, setWhatsapp] = useState(myClient?.whatsapp || "");
  const [location, setLocation] = useState(myClient?.location || "");
  const [couponCode, setCouponCode] = useState(myClient?.couponCode || currentOcc.couponCode);
  const [discountText, setDiscountText] = useState(myClient?.discountText || currentOcc.discountText);
  const [discountEnabled, setDiscountEnabled] = useState(myClient?.discountEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);

  if (isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="text-center py-20 space-y-4">
          <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-slate-300 font-bold">أنت سوبر أدمن، استخدم</p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg"
          >
            لوحة التحكم الرئيسية
          </Link>
        </div>
      </AdminLayout>
    );
  }

  if (!myClient) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-slate-400">
          <p>لم يتم العثور على بيانات العميل الخاص بك.</p>
        </div>
      </AdminLayout>
    );
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      updateClient(myClient.slug, {
        name,
        tagline,
        subtitle,
        phone,
        whatsapp,
        location,
        couponCode,
        discountText,
        discountEnabled,
      });
      setIsSaving(false);
      showToast("تم حفظ وتحديث بيانات وإعدادات العروض بنجاح ✨", "success");
    }, 600);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 text-right">
        {/* Header */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href={`/subscriber/${myClient.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              معاينة صفحة الزوار
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة تحكم المنشأة</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{myClient.name}</h1>
          <p className="text-slate-400 text-xs">
            إيميل الأدمن: <code className="text-blue-400 font-mono">{session?.email}</code>
            {" · "}
            المسار: <code className="text-slate-300 font-mono">/subscriber/{myClient.slug}</code>
          </p>
        </div>

        {/* Store Settings Form */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-extrabold text-white">إعدادات المنشأة وبيانات التواصل</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">اسم المنشأة التجاري *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">العنوان الفرعي / السلوجان</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">الوصف التعريفي بالمنشأة</label>
              <textarea
                rows={2}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>رقم الهاتف المباشر</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>رقم الواتساب بالحجم الدولي</span>
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="9665XXXXXXXX"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>العنوان والموقع الجغرافي</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: حي العليا - الرياض، المملكة العربية السعودية"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Coupon and Discount Management */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-extrabold text-white">إدارة العروض وكوبونات الخصم</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={(e) => setDiscountEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
                />
                <span>تفعيل شريط العرض والخصم في الصفحة</span>
              </label>
            </div>

            {discountEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">كود الخصم المخصص</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="مثال: MAHRUSA20"
                    dir="ltr"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">نص الخصم / العرض</label>
                  <input
                    type="text"
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    placeholder="مثال: خصم 20% حصري لمستخدمي المنصة"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "جاري الحفظ..." : "حفظ التغييرات والعروض"}</span>
            </button>
          </div>
        </form>

        {/* Theme Selector */}
        <section id="theme" className="space-y-5">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-extrabold text-white">اختر ثيم صفحتك للمناسبات</h2>
          </div>

          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              الثيم الذي تختاره سيُطبَّق على صفحة <strong>/subscriber/{myClient.slug}</strong> فوراً لجميع زوار صفحتك.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {occasionsList.map((occ) => {
              const isActive = currentTheme === occ.id;
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => {
                    setClientTheme(myClient.slug, occ.id as OccasionId);
                    showToast(`تم تغيير الثيم إلى: ${occ.shortName}`, "success");
                  }}
                  className={`p-5 rounded-3xl border text-right transition-all relative ${
                    isActive
                      ? "bg-slate-900 border-amber-500 shadow-xl ring-2 ring-amber-500/30"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      مُفعَّل
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0"
                      style={{ backgroundColor: occ.accentColor }}
                    />
                    <span className="font-extrabold text-sm text-white">{occ.name}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                    {occ.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Gift className="w-3 h-3 text-amber-400" />
                    <span className="text-slate-500">كود الخصم:</span>
                    <code className="font-mono font-bold text-amber-300">{couponCode || occ.couponCode}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Services & Accommodations Section */}
        <section id="services" className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-extrabold text-white">
                {myClient.type === "hotel" ? "خيارات الإقامة والغرف المعروضة" : "إدارة الخدمات والأسعار"}
              </h2>
            </div>
            <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800 font-medium">
              نوع المنشأة: {myClient.type === "hotel" ? "شقق وفنادق 🏢" : "صالون وعناية 💈"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myClient.type === "hotel" ? (
              <>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">قياسية 🛏️</span>
                    <span className="text-xs font-extrabold text-white">250 ر.س / ليلة</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">غرفة قياسية (Standard)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">سرير مزدوج، شاشة 55 بوصة ذكية، واي فاي سريع، خدمة الغرف 24/7</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/70 border border-amber-500/40 space-y-3 relative">
                  <div className="absolute top-3 left-3 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">الأكثر طلباً</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">ديلوكس ✨</span>
                    <span className="text-xs font-extrabold text-white">420 ر.س / ليلة</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">جناح ديلوكس (Deluxe Suite)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">غرفة نوم + صالة جلوس، إطلالة بانورامية، آلة اسبريسو، موقف خاص</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">ملكي 🏰</span>
                    <span className="text-xs font-extrabold text-white">680 ر.س / ليلة</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">جناح عائلي فاخر (Royal Family)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">2 غرفة نوم + 2 حمام + مطبخ مجهز، منطقة ألعاب، خدمة تنظيف يومية</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">حلاقة 💈</span>
                    <span className="text-xs font-extrabold text-white">70 ر.س</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">حلاقة شعر احترافية وتصفيف</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">قص وتحديد احترافي، غسيل واستشوار، منتجات عناية إيطالية</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">لحية 🧔</span>
                    <span className="text-xs font-extrabold text-white">50 ر.س</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">عناية باللحية وتحديد بالبخار</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">تحديد بالبخار، زيوت ومقشرات ترطيب، منشفة حارة استرخائية</p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">منزل VIP 🏠</span>
                    <span className="text-xs font-extrabold text-white">150 ر.س</span>
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-100">خدمة حلاقة وتجميل منزلية</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">حقيبة معقمة بالكامل، خدمة منزلية VIP بأحدث الأدوات</p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Incoming Bookings Section */}
        <section id="bookings" className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-extrabold text-white">طلبات الحجز والمواعيد الواردة</h2>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-full font-bold">
              تصلك مباشرة على الواتساب المعتمد
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
            <p className="font-bold text-slate-200">📌 كيف تعمل طلبات الحجز؟</p>
            <p className="leading-relaxed">
              عندما ينقر الزائر على &quot;احجز وادخل بدون انتظار&quot; في صفحتك المعتمدة، يتم توجيهه مباشرة إلى محادثة الواتساب الخاصة بك ({myClient.whatsapp}) محملة بالبيانات الكاملة (الاسم، الجوال، الخدمة المختارة، وكود الخصم المطبق).
            </p>
          </div>
        </section>

        {/* Mken Subscription Services Overview */}
        <section id="subscription" className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-extrabold text-white">خدمات واشتراكات منصة مكّن المفعلة</h2>
            </div>
            <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
              اشتراك موثق ومفعل ✅
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                <span>حزمة تحسين خرائط Google Local SEO</span>
                <span>مُفعَّلة</span>
              </div>
              <p className="text-xs text-slate-300 font-bold">الظهور الجغرافي والكلمات المفتاحية</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                تهيئة بيانات النشاط التجاري (NAP Consistency)، استهداف كلمات البحث الأكثر ربحية لسكان مدينتك، وإدارة التقييمات.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                <span>حزمة واجهات المناسبات السعودية</span>
                <span>مُفعَّلة</span>
              </div>
              <p className="text-xs text-slate-300 font-bold">اليوم الوطني، يوم التأسيس، يوم العلم والأعياد</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                واجهات تفاعلية تتغير بنقرة زر واحدة لتفعيل الثيم السعودي المناسب وإتاحة كوبونات الخصم للعملاء.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
