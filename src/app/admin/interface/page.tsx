"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Save, Type, Sparkles, ArrowLeft } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";

export default function InterfaceTitlesPage() {
  const { tenant } = useAdminTenant();
  const { clients, updateClient } = useAdmin();
  const { showToast } = useApp();
  const client = clients.find((c) => c.slug === tenant);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;
    setName(client.name || "");
    setTagline(client.tagline || "");
    setSubtitle(client.subtitle || "");
  }, [client]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    const result = await updateClient(tenant, { name, tagline, subtitle });
    setSaving(false);
    if (result.success) showToast("تم حفظ العناوين", "success");
    else showToast(result.message || "تعذّر الحفظ", "error");
  };

  return (
    <form onSubmit={handleSave} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
      <div className="flex items-center gap-2">
        <Type className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">العناوين الرئيسية والفرعية</h1>
          <p className="text-xs text-slate-400 mt-0.5">تظهر في أعلى صفحة الزائر تحت اسم المنشأة.</p>
        </div>
      </div>

      {!client ? (
        <p className="text-sm text-slate-400">جاري تحميل بيانات المنشأة...</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">العنوان الرئيسي (اسم المنشأة)</label>
            <input className={ADMIN_INPUT} required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">العنوان الفرعي / السلوجان</label>
            <input className={ADMIN_INPUT} value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">الوصف أسفل العنوان</label>
            <textarea className={ADMIN_INPUT} rows={3} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ العناوين"}
          </button>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between gap-4 flex-wrap bg-slate-950/60 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">شارات الخدمات في قسم الهيرو</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  حدد الخدمات المعروضة أسفل العنوان كأزرار تصفية سريعة، أو قم بإخفائها.
                </p>
              </div>
            </div>
            <Link
              href={"/admin/interface/pages" as Route}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl transition"
            >
              <span>تعديل خدمات وشارات الهيرو</span>
              <ArrowLeft className="w-4 h-4 text-amber-400" />
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
