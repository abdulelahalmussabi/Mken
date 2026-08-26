"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Save } from "lucide-react";
import { ADMIN_INPUT, useAppearanceEditor } from "@/components/AdminPageTabs";

export default function InterfacePhrasesPage() {
  const { appearance, loading, saving, error, save } = useAppearanceEditor();
  const [heading, setHeading] = useState("");
  const [intro, setIntro] = useState("");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    if (!appearance) return;
    setHeading(appearance.interfaceCopy.servicesHeading || "");
    setIntro(appearance.interfaceCopy.servicesIntro || "");
    setFooter(appearance.interfaceCopy.servicesFooter || "");
  }, [appearance]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ interfaceCopy: { servicesHeading: heading, servicesIntro: intro, servicesFooter: footer } }, "تم حفظ العبارات");
      }}
      className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5"
    >
      <div className="flex items-center gap-2">
        <MessageSquareText className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">العبارات أسفل الخدمات</h1>
          <p className="text-xs text-slate-400 mt-0.5">عنوان قسم الخدمات والنصوص فوق البطاقات وتحتها على صفحة الزائر.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-32 rounded-2xl bg-slate-950 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">عنوان قسم الخدمات</label>
            <input className={ADMIN_INPUT} value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="الخدمات المتوفرة" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">العبارة فوق البطاقات</label>
            <textarea className={ADMIN_INPUT} rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">العبارة أسفل البطاقات</label>
            <textarea className={ADMIN_INPUT} rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ العبارات"}
          </button>
        </>
      )}
    </form>
  );
}
