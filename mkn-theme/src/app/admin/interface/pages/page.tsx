"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, FileText, Save } from "lucide-react";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";
import {
  STOREFRONT_PAGE_IDS,
  STOREFRONT_PAGE_META,
  emptyPages,
  isToggleablePageId,
  type StorefrontPagesPublic,
  type ToggleablePageId,
} from "@/lib/mken/pages";

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500/80" : "bg-slate-700"
      }`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "right-0.5" : "right-5"}`} />
    </button>
  );
}

function linesOf<T extends object>(items: T[], keys: (keyof T)[]): string {
  return items.map((item) => keys.map((key) => String(item[key] ?? "")).join(" | ")).join("\n");
}

function parseLines(text: string, keys: string[]): Array<Record<string, string>> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const row: Record<string, string> = {};
      keys.forEach((key, index) => {
        row[key] = parts[index] || "";
      });
      return row;
    });
}

export default function InterfacePagesPage() {
  const { tenant, query } = useAdminTenant();
  const { showToast } = useApp();
  const [pages, setPages] = useState<StorefrontPagesPublic>(emptyPages());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [heroVideoUrl, setHeroVideoUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [featuredIds, setFeaturedIds] = useState("");
  const [statsText, setStatsText] = useState("");
  const [partnersText, setPartnersText] = useState("");
  const [story, setStory] = useState("");
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");
  const [valuesText, setValuesText] = useState("");
  const [teamText, setTeamText] = useState("");
  const [credentialsText, setCredentialsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [showPrices, setShowPrices] = useState(true);
  const [galleryText, setGalleryText] = useState("");
  const [casesText, setCasesText] = useState("");
  const [testimonialsText, setTestimonialsText] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [mapEnabled, setMapEnabled] = useState(true);
  const [hoursNote, setHoursNote] = useState("");

  const hydrate = (data: StorefrontPagesPublic) => {
    setPages(data);
    setHeroVideoUrl(data.home.heroVideoUrl);
    setCtaLabel(data.home.ctaLabel);
    setCtaHref(data.home.ctaHref);
    setFeaturedIds(data.home.featuredServiceIds.join("\n"));
    setStatsText(linesOf(data.home.stats, ["value", "label"]));
    setPartnersText(linesOf(data.home.partners, ["name", "image"]));
    setStory(data.about.story);
    setVision(data.about.vision);
    setMission(data.about.mission);
    setValuesText(linesOf(data.about.values, ["title", "text"]));
    setTeamText(linesOf(data.about.team, ["name", "role", "image"]));
    setCredentialsText(linesOf(data.about.credentials, ["title", "text"]));
    setStepsText(linesOf(data.services.processSteps, ["title", "text"]));
    setShowPrices(data.services.showPrices);
    setGalleryText(linesOf(data.work.gallery, ["image", "caption"]));
    setCasesText(linesOf(data.work.cases, ["title", "challenge", "solution", "result"]));
    setTestimonialsText(linesOf(data.work.testimonials, ["name", "text", "rating"]));
    setFormEnabled(data.contact.formEnabled);
    setMapEnabled(data.contact.mapEnabled);
    setHoursNote(data.contact.hoursNote);
  };

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pages${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الصفحات");
        return;
      }
      hydrate(data.pages);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query]);

  useEffect(() => {
    load();
  }, [load]);

  const put = async (payload: unknown, message: string, key: string) => {
    setSaving(key);
    try {
      const res = await fetch(`/api/pages${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الحفظ", "error");
        return;
      }
      hydrate(data.pages);
      showToast(message, "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving("");
    }
  };

  const togglePage = async (id: ToggleablePageId, next: boolean) => {
    await put({ enabled: { [id]: next } }, next ? `تم فتح صفحة ${STOREFRONT_PAGE_META[id].label}` : `تم إغلاق صفحة ${STOREFRONT_PAGE_META[id].label}`, `toggle-${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-lg font-extrabold text-white">صفحات موقع العميل</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              افتح أو أغلق أي صفحة حسب حاجة النشاط. الصفحة المغلقة تختفي من القائمة وتعيد 404 للزائر.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-32 rounded-2xl bg-slate-950 border border-slate-800 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-rose-300 font-bold">{error}</p>
        ) : (
          <div className="space-y-3">
            {STOREFRONT_PAGE_IDS.map((id) => {
              const meta = STOREFRONT_PAGE_META[id];
              const on = pages.enabled[id];
              const locked = meta.locked;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white flex items-center gap-2">
                      {meta.label}
                      {locked ? <span className="text-[10px] text-slate-500">دائمة</span> : null}
                      {!on && !locked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <EyeOff className="w-3 h-3" /> مغلقة
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{meta.description}</p>
                  </div>
                  <Toggle
                    on={on}
                    disabled={locked || saving === `toggle-${id}`}
                    onChange={() => {
                      if (!isToggleablePageId(id)) return;
                      void togglePage(id, !on);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && !error ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void put(
                {
                  home: {
                    heroVideoUrl,
                    ctaLabel,
                    ctaHref,
                    featuredServiceIds: featuredIds.split("\n").map((id) => id.trim()).filter(Boolean),
                    stats: parseLines(statsText, ["value", "label"]).map((row) => ({
                      value: row.value,
                      label: row.label,
                    })),
                    partners: parseLines(partnersText, ["name", "image"]).map((row) => ({
                      name: row.name,
                      image: row.image,
                    })),
                  },
                },
                "تم حفظ محتوى الرئيسية",
                "home"
              );
            }}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-sm font-extrabold text-white">محتوى الرئيسية</h2>
            <label className="block text-xs font-bold text-slate-300">رابط فيديو الواجهة (اختياري)</label>
            <input className={ADMIN_INPUT} value={heroVideoUrl} onChange={(e) => setHeroVideoUrl(e.target.value)} placeholder="https://..." />
            <label className="block text-xs font-bold text-slate-300">نص زر الدعوة</label>
            <input className={ADMIN_INPUT} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="احجز استشارة" />
            <label className="block text-xs font-bold text-slate-300">رابط الزر (اتركه فارغاً لفتح الحجز)</label>
            <input className={ADMIN_INPUT} value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">معرّفات الخدمات المميزة (سطر لكل خدمة)</label>
            <textarea className={ADMIN_INPUT} rows={3} value={featuredIds} onChange={(e) => setFeaturedIds(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">الإحصائيات: القيمة | العنوان</label>
            <textarea className={ADMIN_INPUT} rows={3} value={statsText} onChange={(e) => setStatsText(e.target.value)} placeholder="15 سنة | خبرة" />
            <label className="block text-xs font-bold text-slate-300">الشركاء: الاسم | رابط الصورة</label>
            <textarea className={ADMIN_INPUT} rows={3} value={partnersText} onChange={(e) => setPartnersText(e.target.value)} />
            <button disabled={saving === "home"} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" />
              حفظ الرئيسية
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void put(
                {
                  about: {
                    story,
                    vision,
                    mission,
                    values: parseLines(valuesText, ["title", "text"]).map((row) => ({ title: row.title, text: row.text })),
                    team: parseLines(teamText, ["name", "role", "image"]).map((row) => ({
                      name: row.name,
                      role: row.role,
                      image: row.image,
                    })),
                    credentials: parseLines(credentialsText, ["title", "text"]).map((row) => ({
                      title: row.title,
                      text: row.text,
                    })),
                  },
                },
                "تم حفظ صفحة من نحن",
                "about"
              );
            }}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-sm font-extrabold text-white">محتوى من نحن</h2>
            <textarea className={ADMIN_INPUT} rows={4} value={story} onChange={(e) => setStory(e.target.value)} placeholder="قصة النشاط" />
            <textarea className={ADMIN_INPUT} rows={3} value={vision} onChange={(e) => setVision(e.target.value)} placeholder="الرؤية" />
            <textarea className={ADMIN_INPUT} rows={3} value={mission} onChange={(e) => setMission(e.target.value)} placeholder="الرسالة" />
            <label className="block text-xs font-bold text-slate-300">القيم: العنوان | النص</label>
            <textarea className={ADMIN_INPUT} rows={3} value={valuesText} onChange={(e) => setValuesText(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">الفريق: الاسم | الدور | رابط الصورة</label>
            <textarea className={ADMIN_INPUT} rows={3} value={teamText} onChange={(e) => setTeamText(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">الاعتمادات: العنوان | النص</label>
            <textarea className={ADMIN_INPUT} rows={3} value={credentialsText} onChange={(e) => setCredentialsText(e.target.value)} />
            <button disabled={saving === "about"} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" />
              حفظ من نحن
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void put(
                {
                  services: {
                    showPrices,
                    processSteps: parseLines(stepsText, ["title", "text"]).map((row) => ({
                      title: row.title,
                      text: row.text,
                    })),
                  },
                },
                "تم حفظ صفحة الخدمات",
                "services"
              );
            }}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-sm font-extrabold text-white">محتوى الخدمات</h2>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              إظهار الأسعار على الصفحة
              <Toggle on={showPrices} onChange={() => setShowPrices(!showPrices)} />
            </label>
            <label className="block text-xs font-bold text-slate-300">خطوات آلية العمل: العنوان | النص</label>
            <textarea className={ADMIN_INPUT} rows={4} value={stepsText} onChange={(e) => setStepsText(e.target.value)} placeholder="اطلب الخدمة | تواصل معنا أو احجز" />
            <p className="text-[11px] text-slate-500">تفاصيل كل خدمة تُعدّ من تبويب الخدمات.</p>
            <button disabled={saving === "services"} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" />
              حفظ الخدمات
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void put(
                {
                  work: {
                    gallery: parseLines(galleryText, ["image", "caption"]).map((row) => ({
                      image: row.image,
                      caption: row.caption,
                    })),
                    cases: parseLines(casesText, ["title", "challenge", "solution", "result"]).map((row) => ({
                      title: row.title,
                      challenge: row.challenge,
                      solution: row.solution,
                      result: row.result,
                    })),
                    testimonials: parseLines(testimonialsText, ["name", "text", "rating"]).map((row) => ({
                      name: row.name,
                      text: row.text,
                      rating: row.rating,
                    })),
                  },
                },
                "تم حفظ صفحة أعمالنا",
                "work"
              );
            }}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-sm font-extrabold text-white">محتوى أعمالنا</h2>
            <label className="block text-xs font-bold text-slate-300">المعرض: رابط الصورة | التعليق</label>
            <textarea className={ADMIN_INPUT} rows={3} value={galleryText} onChange={(e) => setGalleryText(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">دراسات الحالة: العنوان | التحدي | الحل | النتيجة</label>
            <textarea className={ADMIN_INPUT} rows={4} value={casesText} onChange={(e) => setCasesText(e.target.value)} />
            <label className="block text-xs font-bold text-slate-300">آراء العملاء: الاسم | النص | التقييم</label>
            <textarea className={ADMIN_INPUT} rows={3} value={testimonialsText} onChange={(e) => setTestimonialsText(e.target.value)} />
            <button disabled={saving === "work"} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" />
              حفظ أعمالنا
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void put(
                { contact: { formEnabled, mapEnabled, hoursNote } },
                "تم حفظ صفحة اتصل بنا",
                "contact"
              );
            }}
            className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
          >
            <h2 className="text-sm font-extrabold text-white">محتوى اتصل بنا</h2>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              نموذج التواصل
              <Toggle on={formEnabled} onChange={() => setFormEnabled(!formEnabled)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              خريطة الموقع
              <Toggle on={mapEnabled} onChange={() => setMapEnabled(!mapEnabled)} />
            </label>
            <label className="block text-xs font-bold text-slate-300">ملاحظة ساعات العمل</label>
            <textarea className={ADMIN_INPUT} rows={2} value={hoursNote} onChange={(e) => setHoursNote(e.target.value)} placeholder="السبت–الخميس 9 صباحاً حتى 10 مساءً" />
            <p className="text-[11px] text-slate-500">الهاتف وواتساب والعنوان والخريطة تُقرأ من إعدادات المنشأة.</p>
            <button disabled={saving === "contact"} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
              <Save className="w-4 h-4" />
              حفظ اتصل بنا
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
