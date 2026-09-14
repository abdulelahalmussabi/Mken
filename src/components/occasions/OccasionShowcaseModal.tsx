"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOccasion, SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import { useAdmin } from "@/context/AdminContext";
import { isAdminPathname } from "@/lib/mken/admin-path";
import { X, Sparkles, Check, Copy, Layers, Layout, Palette, Calendar, Gift, History, Lightbulb } from "lucide-react";

export const OccasionShowcaseModal: React.FC = () => {
  const { showModal, closeModal, activeOccasion, setOccasion, copyCoupon, currentSlug } = useOccasion();
  const { isAdmin, session, setClientTheme, setGlobalTheme } = useAdmin();
  const pathname = usePathname();
  const [selectedTab, setSelectedTab] = useState<OccasionId>(activeOccasion);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (showModal) setSelectedTab(activeOccasion);
  }, [showModal, activeOccasion]);

  if (!showModal || !isAdmin || !isAdminPathname(pathname)) return null;

  const persistTheme = (id: OccasionId) => {
    setOccasion(id);
    if (currentSlug) {
      void setClientTheme(currentSlug, id);
      return;
    }
    if (session?.role === "client" && session.clientSlug) {
      void setClientTheme(session.clientSlug, id);
      return;
    }
    if (session?.role === "super") setGlobalTheme(id);
  };

  const currentDetails = SAUDI_OCCASIONS[selectedTab];

  const handleCopy = (code: string) => {
    copyCoupon(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const handleApplyTheme = () => {
    persistTheme(selectedTab);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>دراسة حزمة واجهات المناسبات السعودية 🇸🇦</span>
              </h2>
              <p className="text-xs text-slate-400">
                دليل التصميم، الألوان، الرموز الثقافية، وتفاصيل الواجهات الشاملة للموقع والتطبيق
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Occasion Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto p-3 bg-slate-950/60 border-b border-slate-800 no-scrollbar">
          {Object.values(SAUDI_OCCASIONS).map((occ) => {
            const isActive = selectedTab === occ.id;
            return (
              <button
                key={occ.id}
                onClick={() => {
                  setSelectedTab(occ.id as OccasionId);
                  setOccasion(occ.id as OccasionId);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/30"
                  style={{ backgroundColor: occ.accentColor }}
                />
                <span>{occ.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Main Showcase Hero for Selected Occasion */}
          <div className={`p-5 rounded-2xl border ${currentDetails.badgeBg} backdrop-blur-sm space-y-3`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold">{currentDetails.name}</span>
                </div>
                <p className="text-sm font-semibold mt-1 opacity-90">{currentDetails.slogan}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyTheme}
                  className="bg-white text-slate-950 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Palette className="w-4 h-4 text-amber-600" />
                  <span>تطبيق هذا الثيم الآن</span>
                </button>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-200">{currentDetails.description}</p>
            {currentDetails.officialSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentDetails.officialSymbols.map((sym) => (
                  <span
                    key={sym}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-black/25 border border-white/10"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Color & Symbolism Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>لوحة الألوان والهوية البصرية</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl">
                  <span className="text-slate-400">اللون الرئيس للتمييز (Accent):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{currentDetails.accentColor}</span>
                    <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: currentDetails.accentColor }} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl">
                  <span className="text-slate-400">كود الخصم المتاح:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono font-bold text-amber-300">{currentDetails.couponCode}</code>
                    <button
                      onClick={() => handleCopy(currentDetails.couponCode)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-300"
                    >
                      {copiedCode === currentDetails.couponCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl">
                  <span className="text-slate-400 block mb-1">عرض المناسبة:</span>
                  <span className="text-amber-300 font-medium">{currentDetails.discountText}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-400" />
                <span>البعد التراثي والثقافي</span>
              </h3>
              <p className="text-xs leading-relaxed text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800">
                {currentDetails.historicNote}
              </p>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">ملصقات التهاني والتواصل الفوري:</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentDetails.stickers.map((stk, i) => (
                    <span key={i} className="px-2.5 py-1 bg-slate-800 text-amber-300 rounded-lg text-xs font-medium border border-slate-700">
                      {stk}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Page-by-Page Integration Study */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layout className="w-4 h-4 text-amber-400" />
              <span>تطبيق الثيم عبر كافة صفحات الموقع والتطبيق:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>1. الصفحة الرئيسية (Landing)</span>
                </div>
                <p className="text-slate-300">هيرو تفاعلي بمشهد خلفية {currentDetails.shortName} وشريط عروض الخصم المضيء.</p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>2. لوحة التحكم (Dashboard)</span>
                </div>
                <p className="text-slate-300">ترحيب مخصص باسم العميل وحالة العداد التنازلي وإحصائيات الثيم الملونة.</p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>3. تسجيل الدخول والمصادقة</span>
                </div>
                <p className="text-slate-300">خلفية زخرفية تراثية وشارات ترحيبية احتفالية بالألوان الموسمية.</p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>4. إدارة الطلبات والخدمات</span>
                </div>
                <p className="text-slate-300">شارات حالة الطلب الموسومة بختم {currentDetails.shortName} وحقل إدخال الكوبون.</p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>5. المحادثات المباشرة</span>
                </div>
                <p className="text-slate-300">أزرار ملصقات سريعة لإرسال تهنئة {currentDetails.shortName} داخل الشات.</p>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <span>6. جزيئات الخلفية الحية</span>
                </div>
                <p className="text-slate-300">تساقط جزيئات وتأثيرات ضوئية مخصصة عبر شاشات الموقع دون الإضرار بالأداء.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            تم إعداد هذه الدراسة وتفعيل الواجهات وفقاً لأعلى معايير تجربة المستخدم (UI/UX).
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={handleApplyTheme}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg hover:scale-105 active:scale-95"
            >
              تطبيق الثيم ({currentDetails.shortName})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
