"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useOccasion, SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import {
  Palette,
  Sparkles,
  Check,
  Gift,
  Copy,
  Layout,
  History,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export default function DashboardThemesPage() {
  const { activeOccasion, setOccasion, copyCoupon } = useOccasion();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const occasionsList = Object.values(SAUDI_OCCASIONS);

  const handleCopy = (code: string) => {
    copyCoupon(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Palette className="w-3.5 h-3.5" />
            <span>حزمة واجهات المناسبات السعودية 🇸🇦</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            مركز تخصيص وإدارة ثيمات المناسبات
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-3xl">
            اختر المناسبة المطلوبة لتطبيق ثيمها البصري فوراً عبر كافة صفحات الموقع، لوحة التحكم، والمحادثات. يمكنك التبديل بنقرة واحدة بين كافة المناسبات الدينية والوطنية.
          </p>
        </div>

        {/* Occasions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {occasionsList.map((occ) => {
            const isActive = activeOccasion === occ.id;
            return (
              <div
                key={occ.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-5 relative overflow-hidden ${
                  isActive
                    ? "bg-slate-900 border-amber-500 shadow-2xl ring-2 ring-amber-500/30"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Active Tag Badge */}
                {isActive && (
                  <div className="absolute top-4 left-4 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>الثيم المطبق حالياً</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Occasion Header */}
                  <div className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white/20 shrink-0 shadow-md"
                      style={{ backgroundColor: occ.accentColor }}
                    />
                    <div>
                      <h2 className="font-extrabold text-white text-base">{occ.name}</h2>
                      <p className="text-xs text-amber-300 font-semibold">{occ.shortName}</p>
                    </div>
                  </div>

                  {/* Slogan */}
                  <p className="text-xs text-slate-300 font-medium bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                    &quot;{occ.slogan}&quot;
                  </p>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {occ.description}
                  </p>

                  {/* Promo Code Pill */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-400">الكود:</span>
                      <code className="font-mono font-bold text-amber-300">{occ.couponCode}</code>
                    </div>
                    <button
                      onClick={() => handleCopy(occ.couponCode)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                      title="نسخ كود الخصم"
                    >
                      {copiedCode === occ.couponCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => setOccasion(occ.id as OccasionId)}
                  disabled={isActive}
                  className={`w-full py-3.5 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                    isActive
                      ? "bg-slate-800 text-slate-400 cursor-default border border-slate-700"
                      : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>مُفعل الآن على الموقع</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تطبيق الثيم الآن</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
