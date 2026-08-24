"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowRight,
} from "lucide-react";

const occasionsList = Object.values(SAUDI_OCCASIONS);

export default function ClientDetailPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const { clients, clientsLoading, getClientTheme, setClientTheme, updateClient, session, authLoading } =
    useAdmin();
  const { showToast } = useApp();
  const router = useRouter();

  const targetClient = clients.find((c) => c.slug === slug);
  const currentTheme = getClientTheme(slug) || "national_day";
  const currentOcc = SAUDI_OCCASIONS[currentTheme];

  useEffect(() => {
    if (authLoading) return;
    if (session?.role === "client" && session.clientSlug && session.clientSlug !== slug) {
      router.replace("/admin/client");
    }
  }, [authLoading, session, slug, router]);

  // Editable Form State
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [location, setLocation] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (targetClient) {
      setName(targetClient.name || "");
      setTagline(targetClient.tagline || "");
      setSubtitle(targetClient.subtitle || "");
      setPhone(targetClient.phone || "");
      setWhatsapp(targetClient.whatsapp || "");
      setLocation(targetClient.location || "");
      setCouponCode(targetClient.couponCode || currentOcc?.couponCode || "");
      setDiscountText(targetClient.discountText || currentOcc?.discountText || "");
      setDiscountEnabled(targetClient.discountEnabled ?? true);
    }
  }, [targetClient, currentOcc]);

  if (clientsLoading || authLoading) {
    return (
      <>
        <p className="text-center py-20 text-slate-400 text-sm">جاري تحميل بيانات المنشأة…</p>
      </>
    );
  }

  if (!targetClient) {
    return (
      <>
        <div className="text-center py-20 space-y-4">
          <Info className="w-12 h-12 text-slate-500 mx-auto" />
          <p className="text-slate-300 font-bold">لم يتم العثور على المنشأة المطلوبة ({slug})</p>
          <Link
            href={session?.role === "client" ? "/admin/client" : "/admin"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للوحة التحكم
          </Link>
        </div>
      </>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const result = await updateClient(targetClient.slug, {
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
    if (result.success) {
      showToast("تم حفظ وتحديث بيانات العميل بنجاح ✨", "success");
    } else {
      showToast(result.message || "تعذّر حفظ التغييرات", "error");
    }
  };

  return (
    <>
      <div className="space-y-8 text-right">
        {/* Header */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href={`/subscriber/${targetClient.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              معاينة صفحة العميل
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>إدارة العميل: {targetClient.slug}</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{targetClient.name}</h1>
          <p className="text-slate-400 text-xs">
            معرف العميل: <code className="text-blue-400 font-mono">{targetClient.slug}</code>
            {" · "}
            المسار: <code className="text-slate-300 font-mono">/subscriber/{targetClient.slug}</code>
          </p>
        </div>

        {/* Form Settings */}
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
                <span>رقم الواتساب</span>
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
                placeholder="حي العليا - الرياض، المملكة العربية السعودية"
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
                    placeholder="MAHRUSA20"
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
                    placeholder="خصم 20% حصري للمستخدمين"
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
            <h2 className="text-lg font-extrabold text-white">ثيم الصفحة للمناسبات</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {occasionsList.map((occ) => {
              const isActive = currentTheme === occ.id;
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={async () => {
                    const result = await setClientTheme(targetClient.slug, occ.id as OccasionId);
                    if (result.success) {
                      showToast(`تم تغيير الثيم إلى: ${occ.shortName}`, "success");
                    } else {
                      showToast(result.message || "تعذّر تغيير الثيم", "error");
                    }
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
      </div>
    </>
  );
}
