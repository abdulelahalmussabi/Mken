"use client";

import { useEffect, useState } from "react";
import { Save, Type } from "lucide-react";
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
        </>
      )}
    </form>
  );
}
