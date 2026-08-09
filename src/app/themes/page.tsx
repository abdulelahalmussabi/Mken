"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useOccasion, SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import {
  Palette,
  Sparkles,
  Check,
  Gift,
  Copy,
  CheckCircle2,
  ArrowRight,
  Eye,
} from "lucide-react";

export default function StandaloneThemesPage() {
  const { activeOccasion, setOccasion, copyCoupon, openModal } = useOccasion();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const occasionsList = Object.values(SAUDI_OCCASIONS);

  const handleCopy = (code: string) => {
    copyCoupon(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-theme-main text-slate-100 font-sans transition-colors duration-500">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للصفحة الرئيسية
        </Link>

        {/* Page Header */}
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-4 text-right">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Palette className="w-4 h-4" />
            <span>حزمة واجهات المناسبات السعودية 🇸🇦</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            مركز اختيار وتخصيص ثيمات المناسبات
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
            اختر أي من المناسبات السعودية الدينية والوطنية أدناه لتطبيق ثيمها البصري فوراً على كامل صفحات منصة مكّن، مع الاطلاع على أكواد الخصومات والدراسة الشاملة.
          </p>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>فتح دراسة الحزمة والدليل البصري الكامل</span>
          </button>
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
                {isActive && (
                  <div className="absolute top-4 left-4 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>الثيم المُفعل</span>
                  </div>
                )}

                <div className="space-y-4">
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

                  <p className="text-xs text-slate-300 font-medium bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                    &quot;{occ.slogan}&quot;
                  </p>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {occ.description}
                  </p>

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
                      <span>مُفعل الآن</span>
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
      </main>

      <Footer />
    </div>
  );
}
