"use client";

import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import {
  Layers,
  Sparkles,
  Save,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  Building2,
} from "lucide-react";
import Link from "next/link";

export default function AdminServicesPage() {
  const { session, isSuperAdmin, isTenantDomain, hostTenantSlug, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedSlug, setSelectedSlug] = useState<string>(() => session?.clientSlug || hostTenantSlug || "rewa");
  const tenantSlug = (isSuperAdmin && !isTenantDomain) ? selectedSlug : (session?.clientSlug || hostTenantSlug || "rewa");
  const myClient = clients.find((c) => c.slug === tenantSlug) || clients.find((c) => c.slug === "rewa") || clients[0];

  return (
    <AdminLayout>
      <div className="space-y-8 text-right font-sans">
        {/* Top Header Card */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Layers className="w-3.5 h-3.5" />
                <span>أنشطة المنشأة وخدماتها</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إدارة الخدمات والأنشطة — {myClient?.name}</h1>
              <p className="text-slate-400 text-xs">
                التغييرات تُحفظ في تهيئة المنشأة وتظهر فوراً على الموقع العام وحجوزات العملاء.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/admin/client"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <span>لوحة التحكم الشاملة</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Services List Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-extrabold text-white">الخدمات المفعلة في الصفحة الرئيسية</h2>
            <Link
              href="/admin/client"
              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md transition"
            >
              + إضافة أو تعديل باقة
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-400">عيادة طب الأسنان 🦷</span>
              <p className="text-xs text-slate-300">كشف شامل، تبييض ليزر، وابتسامة هوليود الفاخرة</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400">السبا والاستشفاء 🌿</span>
              <p className="text-xs text-slate-300">مسار الأحجار العلاجية، ساونا، جاكوزي وجلسات ديتوكس</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-sky-400">التغذية العلاجية 🥗</span>
              <p className="text-xs text-slate-300">استشارات سمنة ونحافة وفحص InBody ونحت القوام</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-purple-400">الدفاع عن النفس 🥋</span>
              <p className="text-xs text-slate-300">تدريب لياقة وفنون قتالية للكبار والصغار</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
