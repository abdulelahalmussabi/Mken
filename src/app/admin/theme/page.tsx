"use client";

import { Check, Gift, Info, Palette } from "lucide-react";
import { SAUDI_OCCASIONS } from "@/context/OccasionContext";
import { useAppearanceEditor } from "@/components/AdminPageTabs";

const occasionsList = Object.values(SAUDI_OCCASIONS);

export default function ThemeLibraryPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const activeId = appearance?.resolvedTheme || "none";
  const customThemes = appearance?.customThemes || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Palette className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">مكتبة الثيمات</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            فعّل هوية منشأتك أو مناسبة جاهزة فوراً، أو عد للمظهر القياسي (أبيض مطفي). الوضع الموسمي والثيم الداكن من تبويب التخصيص.
          </p>
        </div>
      </div>

      {appearance?.mode === "seasonal" && (
        <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-300 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            الوضع الحالي موسمي. اختيار ثيم من هنا يحوّل التفعيل إلى يدوي ويقفل الجدول حتى تعود للوضع الموسمي.
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ mode: "manual", forceId: "none" }, "تم تفعيل المظهر القياسي")}
            className={`p-5 rounded-3xl border text-right transition-all relative disabled:opacity-60 ${
              activeId === "none"
                ? "bg-slate-900 border-amber-500 shadow-xl ring-2 ring-amber-500/30"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-600"
            }`}
          >
            {activeId === "none" && (
              <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                <Check className="w-3 h-3" />
                مُفعَّل
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0 bg-[#f2f0eb]" />
              <span className="font-extrabold text-sm text-white">المظهر القياسي</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
              أبيض مطفي دافئ مع تراكوتا. الثيم الداكن اختياري من تبويب التخصيص.
            </p>
          </button>
          {customThemes.map((theme) => {
            const isActive = activeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                disabled={saving}
                onClick={() => save({ mode: "manual", forceId: theme.id }, `تم تفعيل ${theme.name}`)}
                className={`p-5 rounded-3xl border text-right transition-all relative disabled:opacity-60 ${
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
                    style={{ backgroundColor: theme.accentColor }}
                  />
                  <span className="font-extrabold text-sm text-white">{theme.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                  ثيم هوية المنشأة — يلوّن الأزرار والشارات بلون الهوية بدل مظهر مكّن القياسي.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Palette className="w-3 h-3 text-amber-400" />
                  <span className="font-bold">هوية</span>
                </div>
              </button>
            );
          })}
          {occasionsList.filter((occ) => occ.id !== "none").map((occ) => {
            const isActive = activeId === occ.id;
            return (
              <button
                key={occ.id}
                type="button"
                disabled={saving}
                onClick={() => save({ mode: "manual", forceId: occ.id }, `تم تفعيل ثيم ${occ.shortName}`)}
                className={`p-5 rounded-3xl border text-right transition-all relative disabled:opacity-60 ${
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
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">{occ.description}</p>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Gift className="w-3 h-3 text-amber-400" />
                  <code className="font-mono font-bold text-amber-300">{occ.couponCode}</code>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
