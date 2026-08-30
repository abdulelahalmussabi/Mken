"use client";

import { useState } from "react";
import { CalendarRange, Moon, Palette, Plus, Save, Sun, Trash2 } from "lucide-react";
import { SAUDI_OCCASIONS } from "@/context/OccasionContext";
import { ADMIN_INPUT, useAppearanceEditor } from "@/components/AdminPageTabs";
import type { CustomTheme, ThemeScheduleItem } from "@/lib/mken/appearance";

function newCustomTheme(): CustomTheme {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: "",
    accentColor: "#f97316",
    badgeBg: "#f97316",
    bgGradient: "#020617",
  };
}

export default function ThemeCustomPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const [draftName, setDraftName] = useState("");
  const [draftAccent, setDraftAccent] = useState("#f97316");
  const [draftBadge, setDraftBadge] = useState("#f59e0b");
  const [draftBg, setDraftBg] = useState("#020617");
  const [editId, setEditId] = useState<string | null>(null);
  const [schedId, setSchedId] = useState("ramadan");
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");

  const customThemes = appearance?.customThemes || [];
  const schedule = appearance?.schedule || [];
  const occasionOptions = Object.values(SAUDI_OCCASIONS);

  const resetDraft = () => {
    setEditId(null);
    setDraftName("");
    setDraftAccent("#f97316");
    setDraftBadge("#f59e0b");
    setDraftBg("#020617");
  };

  const startEdit = (theme: CustomTheme) => {
    setEditId(theme.id);
    setDraftName(theme.name);
    setDraftAccent(theme.accentColor);
    setDraftBadge(theme.badgeBg);
    setDraftBg(theme.bgGradient);
  };

  const persistThemes = (themes: CustomTheme[], message: string) => save({ customThemes: themes }, message);

  const saveDraft = async () => {
    if (!draftName.trim()) return;
    const next: CustomTheme = {
      id: editId || newCustomTheme().id,
      name: draftName.trim(),
      accentColor: draftAccent,
      badgeBg: draftBadge,
      bgGradient: draftBg,
    };
    const themes = editId
      ? customThemes.map((theme) => (theme.id === editId ? next : theme))
      : [...customThemes, next];
    const ok = await persistThemes(themes, editId ? "تم تحديث الثيم المخصص" : "تم إنشاء الثيم المخصص");
    if (ok) resetDraft();
  };

  const themeOptions = [
    ...occasionOptions.map((occ) => ({ id: occ.id, name: occ.shortName })),
    ...customThemes.map((theme) => ({ id: theme.id, name: theme.name })),
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Palette className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">تخصيص الثيم والجدول الموسمي</h1>
          <p className="text-xs text-slate-400 mt-0.5">أنشئ ثيماً خاصاً بمنشأتك أو فعّل ثيماً جاهزاً تلقائياً في موسم محدد.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
          {error}
        </div>
      ) : (
        <>
          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">وضع التفعيل</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["manual", "seasonal"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    save({ mode }, mode === "manual" ? "تم قفل التفعيل اليدوي" : "تم تفعيل الجدول الموسمي")
                  }
                  className={`p-4 rounded-2xl border text-right text-xs font-bold transition ${
                    appearance?.mode === mode
                      ? "border-amber-500 bg-amber-500/10 text-amber-200"
                      : "border-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {mode === "manual" ? "يدوي — يبقى الثيم المختار حتى تغيّره" : "موسمي — يتفعّل تلقائياً حسب الجدول"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              الثيم الحالي: <strong className="text-slate-200">{appearance?.resolvedTheme}</strong>
              {appearance?.mode === "seasonal" ? " (من الجدول)" : " (يدوي)"}
            </p>
          </section>

          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              {appearance?.darkModeEnabled !== false ? (
                <Moon className="w-4 h-4 text-amber-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <h2 className="text-sm font-bold text-white">الثيم الداكن للزوار</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              الثيم العادي أبيض مطفي. إن فعّلت الداكن يظهر زر قمر/شمس في رأس الموقع ليتبدّل الزائر بينهما. إلغاؤه يُبقي الواجهة فاتحة فقط.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ darkModeEnabled: true }, "تم تفعيل الثيم الداكن للزوار")}
                className={`p-4 rounded-2xl border text-right text-xs font-bold transition ${
                  appearance?.darkModeEnabled !== false
                    ? "border-amber-500 bg-amber-500/10 text-amber-200"
                    : "border-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                مفعّل — الزائر يختار الفاتح أو الداكن
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ darkModeEnabled: false }, "تم إلغاء الثيم الداكن")}
                className={`p-4 rounded-2xl border text-right text-xs font-bold transition ${
                  appearance?.darkModeEnabled === false
                    ? "border-amber-500 bg-amber-500/10 text-amber-200"
                    : "border-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                ملغى — الموقع يبقى بالثيم الفاتح فقط
              </button>
            </div>
          </section>

          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">{editId ? "تعديل ثيم مخصص" : "إنشاء ثيم مخصص"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-bold text-slate-300">اسم الثيم</label>
                <input className={ADMIN_INPUT} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">لون التمييز</label>
                <input type="color" className="h-11 w-full rounded-xl bg-slate-950 border border-slate-800" value={draftAccent} onChange={(e) => setDraftAccent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">لون الشارة</label>
                <input type="color" className="h-11 w-full rounded-xl bg-slate-950 border border-slate-800" value={draftBadge} onChange={(e) => setDraftBadge(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">لون الخلفية</label>
                <input type="color" className="h-11 w-full rounded-xl bg-slate-950 border border-slate-800" value={draftBg} onChange={(e) => setDraftBg(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || !draftName.trim()}
                onClick={saveDraft}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {editId ? "حفظ التعديل" : "إنشاء الثيم"}
              </button>
              {editId && (
                <button type="button" onClick={resetDraft} className="px-4 py-2.5 text-xs font-bold text-slate-300 border border-slate-700 rounded-xl">
                  إلغاء
                </button>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {customThemes.length === 0 && <p className="text-xs text-slate-500">لا توجد ثيمات مخصصة بعد.</p>}
              {customThemes.map((theme) => (
                <div key={theme.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: theme.accentColor }} />
                    <span className="text-sm font-bold text-white">{theme.name}</span>
                    {appearance?.resolvedTheme === theme.id && (
                      <span className="text-[10px] font-black text-amber-300">نشط</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => save({ mode: "manual", forceId: theme.id }, `تم تفعيل ${theme.name}`)}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 text-slate-200"
                    >
                      تفعيل يدوي
                    </button>
                    <button type="button" onClick={() => startEdit(theme)} className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-700 text-slate-300">
                      تعديل
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => persistThemes(customThemes.filter((item) => item.id !== theme.id), "تم حذف الثيم")}
                      className="p-1.5 text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">الجدول الموسمي</h2>
            </div>
            <p className="text-[11px] text-slate-500">عند تداخل موسمين يُفعَّل الأحدث بداية. الوضع اليدوي يتجاوز الجدول.</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select className={ADMIN_INPUT} value={schedId} onChange={(e) => setSchedId(e.target.value)}>
                {themeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
              <input type="date" className={ADMIN_INPUT} value={schedStart} onChange={(e) => setSchedStart(e.target.value)} />
              <input type="date" className={ADMIN_INPUT} value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} />
              <button
                type="button"
                disabled={saving || !schedStart || !schedEnd}
                onClick={() => {
                  const item: ThemeScheduleItem = { id: schedId, start: schedStart, end: schedEnd };
                  save({ schedule: [...schedule, item] }, "أُضيف الموسم إلى الجدول");
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 text-slate-100 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة
              </button>
            </div>
            <div className="space-y-2">
              {schedule.length === 0 && <p className="text-xs text-slate-500">لا توجد مواسم مجدولة.</p>}
              {schedule.map((item, index) => {
                const label = themeOptions.find((opt) => opt.id === item.id)?.name || item.id;
                return (
                  <div key={`${item.id}-${item.start}-${index}`} className="flex items-center justify-between p-3 rounded-2xl border border-slate-800 text-xs">
                    <span className="text-slate-200 font-bold">
                      {label} · {item.start} → {item.end}
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        save({ schedule: schedule.filter((_, i) => i !== index) }, "حُذف الموسم من الجدول")
                      }
                      className="text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
