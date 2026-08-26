"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { ADMIN_INPUT, useAppearanceEditor } from "@/components/AdminPageTabs";
import type { SecondaryAd } from "@/lib/mken/appearance";

function emptyAd(): SecondaryAd {
  return {
    id: `ad-${Date.now().toString(36)}`,
    enabled: true,
    title: "",
    text: "",
    image: "",
    href: "",
  };
}

export default function AdsSecondaryPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const [ads, setAds] = useState<SecondaryAd[]>([]);

  useEffect(() => {
    if (appearance) setAds(appearance.ads.secondary);
  }, [appearance]);

  const patch = (index: number, field: Partial<SecondaryAd>) => {
    setAds((prev) => prev.map((ad, i) => (i === index ? { ...ad, ...field } : ad)));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-white">الإعلانات الثانوية</h1>
          <p className="text-xs text-slate-400 mt-0.5">بطاقات تظهر بين الـ Hero وقسم الخدمات على صفحة الزائر.</p>
        </div>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => setAds((prev) => [...prev, emptyAd()])}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-100 font-bold text-xs rounded-xl disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة إعلان
        </button>
      </div>

      {loading ? (
        <div className="h-32 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : ads.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد إعلانات ثانوية.</p>
      ) : (
        <div className="space-y-4">
          {ads.map((ad, index) => (
            <section key={ad.id} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={ad.enabled}
                    onChange={(e) => patch(index, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
                  />
                  ظاهر للزوار
                </label>
                <button type="button" onClick={() => setAds((prev) => prev.filter((_, i) => i !== index))} className="text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={ADMIN_INPUT} placeholder="العنوان" value={ad.title} onChange={(e) => patch(index, { title: e.target.value })} />
                <input className={ADMIN_INPUT} dir="ltr" placeholder="الرابط" value={ad.href} onChange={(e) => patch(index, { href: e.target.value })} />
                <input
                  className={`${ADMIN_INPUT} md:col-span-2`}
                  dir="ltr"
                  placeholder="رابط الصورة"
                  value={ad.image}
                  onChange={(e) => patch(index, { image: e.target.value })}
                />
                <textarea
                  className={`${ADMIN_INPUT} md:col-span-2`}
                  rows={2}
                  placeholder="النص"
                  value={ad.text}
                  onChange={(e) => patch(index, { text: e.target.value })}
                />
              </div>
            </section>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ ads: { secondary: ads } }, "تم حفظ الإعلانات الثانوية")}
            className="inline-flex items-center gap-1.5 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ الإعلانات الثانوية"}
          </button>
        </div>
      )}
    </div>
  );
}
