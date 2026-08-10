"use client";

import React from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import { Palette, Check, ExternalLink, Gift, Info, ShieldCheck } from "lucide-react";

const occasionsList = Object.values(SAUDI_OCCASIONS);

export default function ClientAdminPage() {
  const { session, clients, getClientTheme, setClientTheme, isSuperAdmin } = useAdmin();

  // Get the client for this admin
  const myClient = clients.find((c) => c.slug === session?.clientSlug);
  const currentTheme = getClientTheme(session?.clientSlug || "") || "national_day";
  const currentOcc = SAUDI_OCCASIONS[currentTheme];

  if (isSuperAdmin) {
    // Super admin should be on /admin, not /admin/client
    return (
      <AdminLayout>
        <div className="text-center py-20 space-y-4">
          <ShieldCheck className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-slate-300 font-bold">أنت سوبر أدمن، استخدم</p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg"
          >
            لوحة التحكم الرئيسية
          </Link>
        </div>
      </AdminLayout>
    );
  }

  if (!myClient) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-slate-400">
          <p>لم يتم العثور على بيانات العميل الخاص بك.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 text-right">
        {/* Header */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>لوحة تحكم: {myClient.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{myClient.name}</h1>
          <p className="text-slate-400 text-xs">
            إيميل الأدمن: <code className="text-blue-400 font-mono">{session?.email}</code>
            {" · "}
            المسار: <code className="text-slate-300 font-mono">/subscriber/{myClient.slug}</code>
          </p>

          {/* Client Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-[10px] text-slate-500">الثيم الحالي</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: currentOcc?.accentColor }}
                />
                <p className="text-xs font-bold text-white">{currentOcc?.shortName}</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-[10px] text-slate-500">نوع المنشأة</p>
              <p className="text-xs font-bold text-white mt-1">{myClient.type}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-[10px] text-slate-500">التقييم</p>
              <p className="text-xs font-bold text-white mt-1">⭐ {myClient.rating}</p>
            </div>
          </div>
        </div>

        {/* Theme Selector */}
        <section id="theme" className="space-y-5">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-extrabold text-white">اختر ثيم صفحتك</h2>
          </div>

          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-800/30 text-xs text-blue-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              الثيم الذي تختاره سيُطبَّق على صفحة <strong>/subscriber/{myClient.slug}</strong> فوراً لجميع زوار صفحتك.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {occasionsList.map((occ) => {
              const isActive = currentTheme === occ.id;
              return (
                <button
                  key={occ.id}
                  onClick={() => setClientTheme(myClient.slug, occ.id as OccasionId)}
                  className={`p-5 rounded-3xl border text-right transition-all relative ${
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

                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                    {occ.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Gift className="w-3 h-3 text-amber-400" />
                    <span className="text-slate-500">كود الخصم:</span>
                    <code className="font-mono font-bold text-amber-300">{occ.couponCode}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Preview Link */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-200">معاينة صفحة العميل</p>
            <p className="text-xs text-slate-400">شاهد كيف تبدو صفحتك للزوار بالثيم المختار</p>
          </div>
          <Link
            href={`/subscriber/${myClient.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all hover:scale-105"
          >
            <ExternalLink className="w-4 h-4" />
            فتح الصفحة
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
