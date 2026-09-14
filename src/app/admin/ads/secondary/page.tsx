"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { ADMIN_INPUT, useAppearanceEditor } from "@/components/AdminPageTabs";
import { riyadhTodayYmd, type SecondaryAd } from "@/lib/mken/appearance";

function emptyAd(): SecondaryAd {
  return {
    id: `ad-${Date.now().toString(36)}`,
    enabled: true,
    title: "",
    text: "",
    image: "",
    href: "",
    features: [],
    badge: "",
    price: "السعر عند الطلب",
    ctaLabel: "احجز هذه الخدمة الآن",
    startDate: "",
    endDate: "",
  };
}

function featuresText(ad: SecondaryAd): string {
  return (ad.features || []).join("\n");
}

function parseFeatures(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function scheduleStatus(ad: SecondaryAd): string {
  const today = riyadhTodayYmd();
  if (!ad.enabled) return "مخفي";
  if (ad.startDate && today < ad.startDate) return "لم يبدأ بعد";
  if (ad.endDate && today > ad.endDate) return "انتهت مدته";
  if (!ad.startDate && !ad.endDate) return "بدون تاريخ — ظاهر دائماً";
  return "ظاهر ضمن المدة";
}

export default function AdsSecondaryPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const [ads, setAds] = useState<SecondaryAd[]>([]);
  const [scheduleOn, setScheduleOn] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!appearance) return;
    setAds(appearance.ads.secondary);
    const flags: Record<string, boolean> = {};
    for (const ad of appearance.ads.secondary) {
      flags[ad.id] = Boolean(ad.startDate || ad.endDate);
    }
    setScheduleOn(flags);
  }, [appearance]);

  const patch = (index: number, field: Partial<SecondaryAd>) => {
    setAds((prev) => prev.map((ad, i) => (i === index ? { ...ad, ...field } : ad)));
  };

  const toggleSchedule = (index: number, on: boolean) => {
    const ad = ads[index];
    if (!ad) return;
    setScheduleOn((prev) => ({ ...prev, [ad.id]: on }));
    if (!on) patch(index, { startDate: "", endDate: "" });
  };

  const persist = () => {
    const next = ads.map((ad) => {
      if (scheduleOn[ad.id]) return ad;
      return { ...ad, startDate: "", endDate: "" };
    });
    save({ ads: { secondary: next } }, "تم حفظ الإعلانات الثانوية");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-white">الإعلانات الثانوية</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            بطاقات حجز على صفحة الزائر. يمكن ترك التاريخ فارغاً ليبقى الإعلان ظاهراً، أو تحديد نهاية ليختفي تلقائياً.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => {
            const ad = emptyAd();
            setAds((prev) => [...prev, ad]);
            setScheduleOn((prev) => ({ ...prev, [ad.id]: false }));
          }}
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
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={ad.enabled}
                    onChange={(e) => patch(index, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
                  />
                  ظاهر للزوار
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">{scheduleStatus(ad)}</span>
                  <button
                    type="button"
                    onClick={() => setAds((prev) => prev.filter((_, i) => i !== index))}
                    className="text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className={ADMIN_INPUT}
                  placeholder="العنوان"
                  value={ad.title}
                  onChange={(e) => patch(index, { title: e.target.value })}
                />
                <input
                  className={ADMIN_INPUT}
                  placeholder="الشريحة (مثال: طب عام)"
                  value={ad.badge}
                  onChange={(e) => patch(index, { badge: e.target.value })}
                />
                <input
                  className={ADMIN_INPUT}
                  placeholder="السعر"
                  value={ad.price}
                  onChange={(e) => patch(index, { price: e.target.value })}
                />
                <input
                  className={ADMIN_INPUT}
                  placeholder="نص زر الحجز"
                  value={ad.ctaLabel}
                  onChange={(e) => patch(index, { ctaLabel: e.target.value })}
                />
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
                <textarea
                  className={`${ADMIN_INPUT} md:col-span-2`}
                  rows={4}
                  placeholder="بنود الإعلان — بند في كل سطر"
                  value={featuresText(ad)}
                  onChange={(e) => patch(index, { features: parseFeatures(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(scheduleOn[ad.id])}
                  onChange={(e) => toggleSchedule(index, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
                />
                تحديد مدة للإعلان
              </label>
              {scheduleOn[ad.id] ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="block text-[11px] text-slate-500">تاريخ البداية (اختياري)</span>
                    <input
                      className={ADMIN_INPUT}
                      type="date"
                      dir="ltr"
                      value={ad.startDate}
                      onChange={(e) => patch(index, { startDate: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-[11px] text-slate-500">تاريخ النهاية (يختفي بعده)</span>
                    <input
                      className={ADMIN_INPUT}
                      type="date"
                      dir="ltr"
                      value={ad.endDate}
                      onChange={(e) => patch(index, { endDate: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">بدون تاريخ: يبقى ظاهراً ما دام مفعّلاً.</p>
              )}
            </section>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={persist}
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
