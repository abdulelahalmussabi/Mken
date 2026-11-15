"use client";

import React from "react";
import {
  MapPin,
  Star,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";

export interface TenantSeoHeroCardsProps {
  // Card 1: الظهور على الخرائط
  rank: number | null;
  top3Percentage: number | null;
  isMapBound: boolean;
  isConnected: boolean;

  // Card 2: السمعة والتقييم
  ownRating: number | null;
  reviewsCount: number | null;
  competitorsAverageRating: number | null;

  // Card 3: اكتمال الملف وتطابق NAP
  napScore: number | null; // 0 to 100
  servicesCount?: number;
  syncedServicesCount?: number;

  // الإجراءات التفاعلية
  onActionClick?: (actionId: "connect" | "geogrid" | "reviews" | "nap" | "services") => void;
}

export default function TenantSeoHeroCards({
  rank,
  top3Percentage,
  isMapBound,
  isConnected,
  ownRating,
  reviewsCount,
  competitorsAverageRating,
  napScore,
  onActionClick,
}: TenantSeoHeroCardsProps) {
  // ==========================================
  // 1. حساب بطاقة الظهور على الخرائط
  // ==========================================
  let mapBadge = "غير مفهرس";
  let mapBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  let mapValue = "—";
  let mapSubtext = "لم يتم ربط صفحة الخرائط بعد";
  let mapActionText = "اربط صفحة الخرائط لتبدأ الظهور للعملاء";
  let mapActionId: "connect" | "geogrid" = "connect";
  let mapProgress = 10;
  let mapProgressColor = "bg-rose-500";

  if (rank !== null && rank > 0) {
    mapValue = `#${rank.toFixed(1)}`;
    if (rank <= 3) {
      mapBadge = "متصدر (3-Pack)";
      mapBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      mapSubtext = `${top3Percentage ?? 100}% من عمليات البحث تراك في الحزمة الذهبية الأولى`;
      mapActionText = "حافظ على الصدارة: شارك منشوراً دورياً على Google";
      mapActionId = "geogrid";
      mapProgress = 95;
      mapProgressColor = "bg-emerald-500";
    } else if (rank <= 10) {
      mapBadge = "الصفحة الأولى";
      mapBadgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      mapSubtext = `ظهور الحزمة الذهبية ${top3Percentage ?? 0}% — اقتربت من الثلاثة الأوائل`;
      mapActionText = "عزّز ظهورك: أضف صوراً جديدة وساعات عمل الجمعة";
      mapActionId = "geogrid";
      mapProgress = 65;
      mapProgressColor = "bg-amber-500";
    } else {
      mapBadge = "ظهور منخفض";
      mapBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
      mapSubtext = "العملاء القريبون يعثرون على المنافسين في نتائج البحث الأولى";
      mapActionText = "حسّن كلماتك المفتاحية واطلب تقييمات جديدة";
      mapActionId = "geogrid";
      mapProgress = 30;
      mapProgressColor = "bg-rose-500";
    }
  } else if (isConnected || isMapBound) {
    mapBadge = "جاهز للتتبع";
    mapBadgeClass = "bg-sky-500/20 text-sky-300 border-sky-500/40";
    mapValue = "مربوط";
    mapSubtext = "الفرع متصل بالخرائط — شغّل أول فحص جغرافي";
    mapActionText = "افحص ترتيبك في الأحياء المحيطة بفرعك";
    mapActionId = "geogrid";
    mapProgress = 50;
    mapProgressColor = "bg-sky-500";
  }

  // ==========================================
  // 2. حساب بطاقة السمعة والتقييم
  // ==========================================
  let repBadge = "بحاجة تقييمات";
  let repBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  let repValue = "—";
  let repSubtext = "لا توجد تقييمات موثقة مسجلة بعد";
  let repActionText = "أرسل رابط التقييم السريع لآخر 5 عملاء لرفع التقييم";
  let repProgress = 15;
  let repProgressColor = "bg-rose-500";

  if (ownRating !== null && ownRating > 0) {
    repValue = `${ownRating.toFixed(1)} ★`;
    if (ownRating >= 4.5) {
      repBadge = "سمعة ممتازة";
      repBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      repSubtext =
        competitorsAverageRating && competitorsAverageRating > 0
          ? `أعلى من متوسط منافسيك (${competitorsAverageRating.toFixed(1)} ★) · ${reviewsCount ?? 0} تقييم`
          : `${reviewsCount ?? 0} تقييم موثق من عملاء حقيقيين`;
      repActionText = "اطبع كود QR التقييم في صالة الانتظار لمضاعفة الآراء";
      repProgress = 95;
      repProgressColor = "bg-emerald-500";
    } else if (ownRating >= 4.0) {
      repBadge = "تقييم جيد";
      repBadgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      repSubtext =
        competitorsAverageRating && competitorsAverageRating > 0
          ? `متوسط منافسيك في الحي: ${competitorsAverageRating.toFixed(1)} ★ · لديك ${reviewsCount ?? 0} تقييم`
          : `لديك ${reviewsCount ?? 0} تقييم · تفصلك خطوة عن النطاق الممتاز`;
      repActionText = "اطلب 3 تقييمات إيجابية هذا الأسبوع لتصل إلى 4.8";
      repProgress = 70;
      repProgressColor = "bg-amber-500";
    } else {
      repBadge = "يحتاج معالجة";
      repBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
      repSubtext = `التقييم الحالي أقل من المطلوب (${ownRating.toFixed(1)} ★)`;
      repActionText = "ردّ بلباقة على التقييمات السلبية وقدّم حلاً للمشكلات";
      repProgress = 35;
      repProgressColor = "bg-rose-500";
    }
  }

  // ==========================================
  // 3. حساب بطاقة اكتمال الملف وتطابق NAP
  // ==========================================
  let healthBadge = "غير مكتمل";
  let healthBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  let healthValue = "0%";
  let healthSubtext = "بيانات المنشأة تحتاج ربطاً ومزامنة";
  let healthActionText = "أكمل بيانات العنوان والهاتف المعتمد في مكّن";
  let healthActionId: "nap" | "services" = "nap";
  let healthProgress = 10;
  let healthProgressColor = "bg-rose-500";

  const effectiveNap = napScore !== null ? napScore : isConnected || isMapBound ? 60 : 20;

  healthValue = `${effectiveNap}%`;
  healthProgress = effectiveNap;

  if (effectiveNap >= 80) {
    healthBadge = "متطابق تماماً";
    healthBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    healthSubtext = "الهاتف والعنوان وساعات العمل مطابقة لخرائط Google";
    healthActionText = "ملفك جاهز ومحصن: زامِن أي خدمة جديدة بالريال فوراً";
    healthActionId = "services";
    healthProgressColor = "bg-emerald-500";
  } else if (effectiveNap >= 50) {
    healthBadge = "تطابق جزئي";
    healthBadgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
    healthSubtext = "يوجد اختلاف بين ساعات الموقع وبيانات خرائط Google";
    healthActionText = "زامِن الهاتف والعنوان (NAP) مع Google بضغطة واحدة";
    healthActionId = "nap";
    healthProgressColor = "bg-amber-500";
  } else {
    healthBadge = "بيانات ناقصة";
    healthBadgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    healthSubtext = "عدم تطابق الاسم أو الهاتف يقلل من ثقة محرك البحث";
    healthActionText = "افحص تطابق NAP وصحح الاختلافات لرفع الظهور";
    healthActionId = "nap";
    healthProgressColor = "bg-rose-500";
  }

  return (
    <section className="space-y-4" aria-label="لوحة السيو المحلي السريعة">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-white">المؤشرات الحيوية لظهور نشاطك التجاري</h2>
        </div>
        <span className="text-[11px] text-slate-400">تحديث فوري مباشر</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" dir="rtl">
        {/* ==================== البطاقة 1: الظهور ==================== */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">الظهور على الخرائط</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${mapBadgeClass}`}>
                {mapBadge}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">{mapValue}</span>
                <span className="text-xs text-slate-400">متوسط الرانك</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-5">{mapSubtext}</p>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${mapProgressColor}`}
                  style={{ width: `${mapProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onActionClick && onActionClick(mapActionId)}
              className="w-full group flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 text-right transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-amber-300 font-bold">الإجراء المقترح التالي:</p>
                <p className="text-[11px] text-slate-300 group-hover:text-white leading-5 truncate">
                  {mapActionText}
                </p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 mt-0.5" />
            </button>
          </div>
        </div>

        {/* ==================== البطاقة 2: السمعة ==================== */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Star className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">سمعة النشاط والتقييمات</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${repBadgeClass}`}>
                {repBadge}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">{repValue}</span>
                <span className="text-xs text-slate-400">معدل الرضا</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-5">{repSubtext}</p>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${repProgressColor}`}
                  style={{ width: `${repProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onActionClick && onActionClick("reviews")}
              className="w-full group flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/40 text-right transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-sky-300 font-bold">الإجراء المقترح التالي:</p>
                <p className="text-[11px] text-slate-300 group-hover:text-white leading-5 truncate">
                  {repActionText}
                </p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0 mt-0.5" />
            </button>
          </div>
        </div>

        {/* ==================== البطاقة 3: الاكتمال ==================== */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-xl hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">اكتمال الملف وتطابق NAP</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${healthBadgeClass}`}>
                {healthBadge}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tracking-tight">{healthValue}</span>
                <span className="text-xs text-slate-400">تطابق وتوافق</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-5">{healthSubtext}</p>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${healthProgressColor}`}
                  style={{ width: `${healthProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onActionClick && onActionClick(healthActionId)}
              className="w-full group flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 text-right transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-emerald-300 font-bold">الإجراء المقترح التالي:</p>
                <p className="text-[11px] text-slate-300 group-hover:text-white leading-5 truncate">
                  {healthActionText}
                </p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0 mt-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
