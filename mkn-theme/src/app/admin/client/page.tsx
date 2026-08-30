"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { SAUDI_OCCASIONS, VISITOR_PROMO_HINT } from "@/context/OccasionContext";
import {
  ExternalLink,
  ShieldCheck,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  Save,
  Tag,
  Palette,
  Type,
  Megaphone,
} from "lucide-react";
import { BrandLogoUploader } from "@/components/BrandLogoUploader";

export default function ClientAdminPage() {
  const { session, clients, getClientTheme, updateClient, isSuperAdmin } = useAdmin();
  const { showToast } = useApp();

  // Get the client for this admin
  const myClient = clients.find((c) => c.slug === session?.clientSlug);
  const currentTheme = getClientTheme(session?.clientSlug || "") || "none";
  const currentOcc = currentTheme in SAUDI_OCCASIONS ? SAUDI_OCCASIONS[currentTheme as keyof typeof SAUDI_OCCASIONS] : SAUDI_OCCASIONS.none;

  // Editable Form State
  const [phone, setPhone] = useState(myClient?.phone || "");
  const [whatsapp, setWhatsapp] = useState(myClient?.whatsapp || "");
  const [location, setLocation] = useState(myClient?.location || "");
  const [couponCode, setCouponCode] = useState(myClient?.couponCode || "");
  const [discountText, setDiscountText] = useState(myClient?.discountText || "");
  const [promoTitle, setPromoTitle] = useState(myClient?.promoTitle || "");
  const [discountEnabled, setDiscountEnabled] = useState(myClient?.discountEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);

  if (isSuperAdmin) {
    return (
      <>
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
      </>
    );
  }

  if (!myClient) {
    return (
      <>
        <div className="text-center py-20 text-slate-400">
          <p>لم يتم العثور على بيانات العميل الخاص بك.</p>
        </div>
      </>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const result = await updateClient(myClient.slug, {
      phone,
      whatsapp,
      location,
      couponCode,
      discountText,
      promoTitle,
      discountEnabled,
    });

    setIsSaving(false);
    if (result.success) {
      showToast("تم حفظ وتحديث بيانات وإعدادات العروض بنجاح ✨", "success");
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
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={"/admin/theme" as Route} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-[11px] font-bold text-slate-200">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              الثيم
            </Link>
            <Link href={"/admin/interface" as Route} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-[11px] font-bold text-slate-200">
              <Type className="w-3.5 h-3.5 text-amber-400" />
              عناصر الواجهة
            </Link>
            <Link href={"/admin/ads" as Route} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-[11px] font-bold text-slate-200">
              <Megaphone className="w-3.5 h-3.5 text-amber-400" />
              الإعلانات
            </Link>
          </div>
        </div>

        {/* Store Settings Form */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-extrabold text-white">إعدادات المنشأة وبيانات التواصل</h2>
          </div>

          <BrandLogoUploader
            value={myClient.logo || ""}
            onPersist={async (logo) => {
              const result = await updateClient(myClient.slug, { logo });
              if (result.success) showToast(logo ? "تم حفظ الشعار على صفحة الزائر" : "تم إزالة الشعار", "success");
              else showToast(result.message || "تعذّر حفظ الشعار", "error");
              return result;
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300">عنوان الإعلان الرئيسي</label>
                  <input
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder={currentTheme === "none" ? VISITOR_PROMO_HINT.title : currentOcc.slogan}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
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
                    placeholder={VISITOR_PROMO_HINT.text}
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
      </div>
    </>
  );
}
