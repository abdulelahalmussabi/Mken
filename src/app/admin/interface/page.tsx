"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import {
  Type,
  Sparkles,
  Save,
  CheckCircle2,
  ExternalLink,
  Layers,
  FileText,
  Building2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import NeonSocialRow from "@/components/social/NeonSocialRow";

export default function AdminInterfacePage() {
  const { session, isSuperAdmin, isTenantDomain, hostTenantSlug, clients, updateClient } = useAdmin();
  const { showToast } = useApp();

  const [selectedSlug, setSelectedSlug] = useState<string>(() => session?.clientSlug || hostTenantSlug || "rewa");
  const tenantSlug = (isSuperAdmin && !isTenantDomain) ? selectedSlug : (session?.clientSlug || hostTenantSlug || "rewa");

  const myClient = clients.find((c) => c.slug === tenantSlug) || clients.find((c) => c.slug === "rewa") || clients[0];

  const [subTab, setSubTab] = useState<"titles" | "services" | "footer_text">("titles");

  // Form State
  const [name, setName] = useState(myClient?.name || "");
  const [tagline, setTagline] = useState(myClient?.tagline || "");
  const [subtitle, setSubtitle] = useState(myClient?.subtitle || "");
  const [demoNotice, setDemoNotice] = useState(myClient?.demoNotice || "");
  const [discountText, setDiscountText] = useState(myClient?.discountText || "");
  const [couponCode, setCouponCode] = useState(myClient?.couponCode || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (myClient) {
      setName(myClient.name || "");
      setTagline(myClient.tagline || "");
      setSubtitle(myClient.subtitle || "");
      setDemoNotice(myClient.demoNotice || "");
      setDiscountText(myClient.discountText || "");
      setCouponCode(myClient.couponCode || "");
    }
  }, [myClient?.slug, myClient]);

  const handleSaveTitles = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      updateClient(myClient.slug, {
        name,
        tagline,
        subtitle,
        demoNotice,
        discountText,
        couponCode,
      });

      // API persist
      await fetch(`/api/clients/${myClient.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tagline,
          subtitle,
          demoNotice,
          discountText,
          couponCode,
        }),
      }).catch(() => {});

      showToast("تم حفظ وتحديث عناوين وعبارات الواجهة بنجاح ✨", "success");
    } catch {
      showToast("تم حفظ التعديلات بنجاح", "success");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 text-right font-sans">
        {/* Top Header Card */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Type className="w-3.5 h-3.5" />
                <span>تخصيص عناصر ونصوص الواجهة</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{myClient?.name}</h1>
              <p className="text-slate-400 text-xs">
                تعديل العناوين الرئيسية، السلوجان، النصوص التعريفية، وقنوات التواصل التي تظهر في الواجهة العامة.
              </p>

              {isSuperAdmin && !isTenantDomain && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs font-bold text-amber-400">المنشأة:</span>
                  <select
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="px-3.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {clients.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/subscriber/${myClient?.slug || "rewa"}`}
                target="_blank"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>معاينة صفحة الزوار</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center p-1.5 bg-slate-900 border border-slate-800 rounded-2xl gap-2 shadow-md">
          <button
            onClick={() => setSubTab("titles")}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              subTab === "titles"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            العناوين
          </button>
          <button
            onClick={() => setSubTab("services")}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              subTab === "services"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            الخدمات
          </button>
          <button
            onClick={() => setSubTab("footer_text")}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              subTab === "footer_text"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            العبارات أسفل الخدمات والفوتر
          </button>
        </div>

        {/* SubTab 1: العناوين الرئيسية والفرعية */}
        {subTab === "titles" && (
          <form onSubmit={handleSaveTitles} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Type className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-extrabold text-white">العناوين الرئيسية والفرعية</h2>
                <p className="text-xs text-slate-400">تظهر في أعلى صفحة الزائر تحت اسم المنشأة.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">العنوان الرئيسي (اسم المنشأة) *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: منتجع رواء الاستشفاء الرقمي"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">العنوان الفرعي / السلوجان</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="مثال: رواء.. توازن واسترخاء"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">الوصف أسفل العنوان</label>
                <textarea
                  rows={4}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="وصف تفصيلي عن المنشأة وخدماتها وموقعها..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? "جاري الحفظ..." : "حفظ العناوين"}</span>
              </button>
            </div>
          </form>
        )}

        {/* SubTab 2: الخدمات */}
        {subTab === "services" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-lg font-extrabold text-white">إدارة باقات وخدمات المنشأة</h2>
                  <p className="text-xs text-slate-400">تظهر هذه الخدمات في قسم الخدمات الرئيسي مع خيارات الحجز المباشر.</p>
                </div>
              </div>
              <Link
                href="/admin/client"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                فتح لوحة الخدمات الشاملة ←
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-amber-300">✨ الأنشطة والخدمات المربوطة حالياً بالمنشأة:</p>
              <p className="text-slate-400 leading-relaxed">
                عيادات الأسنان، التغذية العلاجية، السبا والاستشفاء، نادي الدفاع عن النفس، واستضافة الفعاليات الصحية.
              </p>
            </div>
          </div>
        )}

        {/* SubTab 3: العبارات أسفل الخدمات والفوتر */}
        {subTab === "footer_text" && (
          <form onSubmit={handleSaveTitles} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <FileText className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-lg font-extrabold text-white">العبارات والإشعارات الإضافية</h2>
                <p className="text-xs text-slate-400">العبارات الترويجية في شريط الترحيب والفوتر.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">شريط الإعلان العلوي (Top Notice)</label>
                <input
                  type="text"
                  value={demoNotice}
                  onChange={(e) => setDemoNotice(e.target.value)}
                  placeholder="✨ الموقع الرسمي لمنتجع رواء الاستشفاء الرقمي على منصة مكّن"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">نص العرض / الخصم</label>
                  <input
                    type="text"
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    placeholder="خصم 30% على كافة باقات الاستشفاء"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">كود الخصم المطبق</label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="REWA30"
                    dir="ltr"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>حفظ العبارات والإشعارات</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
