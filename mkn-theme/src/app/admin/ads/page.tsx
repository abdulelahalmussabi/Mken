"use client";

import { useEffect, useState } from "react";
import { Megaphone, Save } from "lucide-react";
import { ADMIN_INPUT, useAppearanceEditor } from "@/components/AdminPageTabs";
import { SAUDI_OCCASIONS, type OccasionId } from "@/context/OccasionContext";
import type { PrimaryAd } from "@/lib/mken/appearance";

export default function AdsPrimaryPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const [draft, setDraft] = useState<PrimaryAd>({
    enabled: false,
    title: "",
    text: "",
    image: "",
    ctaLabel: "",
    ctaHref: "",
    couponCode: "",
    startDate: "",
    endDate: "",
  });
  const [scheduleOn, setScheduleOn] = useState(false);

  useEffect(() => {
    if (!appearance) return;
    const primary = appearance.ads.primary;
    const occId = appearance.resolvedTheme as OccasionId;
    const occ =
      appearance.themeKind === "occasion" && occId !== "none" && occId in SAUDI_OCCASIONS
        ? SAUDI_OCCASIONS[occId]
        : null;
    setDraft({
      enabled: primary.enabled,
      title: primary.title || occ?.slogan || "",
      text: primary.text || occ?.discountText || "",
      image: primary.image || "",
      ctaLabel: primary.ctaLabel || "الاستفادة من العرض والتسجيل الآن",
      ctaHref: primary.ctaHref || "",
      couponCode: primary.couponCode || occ?.couponCode || "",
      startDate: primary.startDate || "",
      endDate: primary.endDate || "",
    });
    setScheduleOn(Boolean(primary.startDate || primary.endDate));
  }, [appearance]);

  const patch = (field: keyof PrimaryAd, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          {
            ads: {
              primary: scheduleOn ? draft : { ...draft, startDate: "", endDate: "" },
            },
          },
          "تم حفظ الإعلان الرئيسي"
        );
      }}
      className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">الإعلان الرئيسي</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            هذا هو الإعلان الأول في نافذة العروض للزائر. ثيم المناسبة يلوّن الشريط فقط — النص والكود يُحرَّران من هنا.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl bg-slate-950 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch("enabled", e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
            />
            إظهار شريط الإعلان أعلى الصفحة
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">عنوان الإعلان</label>
              <input className={ADMIN_INPUT} value={draft.title} onChange={(e) => patch("title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">كود الخصم</label>
              <input className={ADMIN_INPUT} dir="ltr" value={draft.couponCode} onChange={(e) => patch("couponCode", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-300">نص الإعلان</label>
              <textarea className={ADMIN_INPUT} rows={2} value={draft.text} onChange={(e) => patch("text", e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-300">صورة الإعلان / الـ Hero</label>
              <input className={ADMIN_INPUT} dir="ltr" value={draft.image} onChange={(e) => patch("image", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">نص الزر</label>
              <input className={ADMIN_INPUT} value={draft.ctaLabel} onChange={(e) => patch("ctaLabel", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">رابط الزر</label>
              <input className={ADMIN_INPUT} dir="ltr" value={draft.ctaHref} onChange={(e) => patch("ctaHref", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 md:col-span-2">
              <input
                type="checkbox"
                checked={scheduleOn}
                onChange={(e) => {
                  const on = e.target.checked;
                  setScheduleOn(on);
                  if (!on) setDraft((prev) => ({ ...prev, startDate: "", endDate: "" }));
                }}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-950"
              />
              تحديد مدة للإعلان
            </label>
            {scheduleOn ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">تاريخ البداية (اختياري)</label>
                  <input
                    className={ADMIN_INPUT}
                    type="date"
                    dir="ltr"
                    value={draft.startDate}
                    onChange={(e) => patch("startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">تاريخ النهاية (يختفي بعده)</label>
                  <input
                    className={ADMIN_INPUT}
                    type="date"
                    dir="ltr"
                    value={draft.endDate}
                    onChange={(e) => patch("endDate", e.target.value)}
                  />
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 md:col-span-2">بدون تاريخ: يبقى الشريط ظاهراً ما دام مفعّلاً.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ الإعلان الرئيسي"}
          </button>
        </>
      )}
    </form>
  );
}
