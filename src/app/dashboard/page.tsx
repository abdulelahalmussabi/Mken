"use client";

import React from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { OrderStatus } from "@/types/database";
import {
  Store,
  Clock,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  ChevronLeft,
  Sparkles,
  Gift,
  Calendar,
  Zap,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { user, orders, messages } = useApp();
  const { activeOccasion, occasionDetails, openModal } = useOccasion();

  if (!user) return null;

  const totalOrders = orders.length;
  const inProgressCount = orders.filter((o) => o.status === "in_progress").length;
  const completedCount = orders.filter((o) => o.status === "completed").length;

  const totalMessagesCount = Object.values(messages).reduce(
    (acc, msgList) => acc + msgList.length,
    0
  );

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[11px] font-bold rounded-full">
            <Hourglass className="w-3 h-3" />
            قيد الانتظار
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-950/60 border border-sky-800/80 text-sky-300 text-[11px] font-bold rounded-full animate-pulse">
            <Clock className="w-3 h-3" />
            قيد التنفيذ
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] font-bold rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            مكتمل
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Occasion Welcome Banner */}
        <div className={`p-6 sm:p-8 rounded-3xl border ${activeOccasion !== "none" ? occasionDetails.badgeBg : "bg-slate-900/80 border-slate-800"} shadow-xl space-y-3 relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{activeOccasion === "none" ? "نظرة عامة على النشاط" : `ثيم ${occasionDetails.shortName}`}</span>
            </div>

            <button
              onClick={openModal}
              className="text-xs font-bold text-slate-200 hover:text-white bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-700 flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>تعديل ثيم المناسبة</span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {occasionDetails.greetingTemplate(user.full_name)}
          </h1>
          <p className="text-slate-200 text-xs sm:text-sm">
            {occasionDetails.slogan} — تابع حالات طلبات تحسين الخرائط لمؤسستك واستمتع بخصومات المناسبات.
          </p>

          {/* Special Occasion Discount Offer Pill */}
          {activeOccasion !== "none" && (
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-950/60 rounded-2xl border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>كوبون المناسبة المتاح: <code className="font-mono text-amber-300 font-bold">{occasionDetails.couponCode}</code> ({occasionDetails.discountText})</span>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                مطبق تلقائياً على الطلبات الجديدة
              </span>
            </div>
          )}
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>إجمالي الطلبات</span>
              <Store className="w-4 h-4" style={{ color: occasionDetails.accentColor }} />
            </div>
            <div className="text-2xl font-black text-white">{totalOrders}</div>
            <p className="text-[10px] text-slate-500">طلبات المحلات المقدمة</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>قيد التنفيذ</span>
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-sky-400">{inProgressCount}</div>
            <p className="text-[10px] text-slate-500">جاري العمل عليها الآن</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>طلبات مكتملة</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{completedCount}</div>
            <p className="text-[10px] text-slate-500">تم التفعيل والتأكيد</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>الرسائل والردود</span>
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{totalMessagesCount}</div>
            <p className="text-[10px] text-slate-500">سجل محادثات الطلبات</p>
          </div>
        </div>

        {/* Recent Orders Overview */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="font-extrabold text-slate-100 text-base">أحدث الطلبات المقدمة</h2>
              <p className="text-xs text-slate-400">قائمة بأحدث طلبات تحسين الخرائط الخاصة بمحلاتك</p>
            </div>
            <Link
              href="/dashboard/requests"
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              عرض الجميع ({totalOrders})
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-8 space-y-2 text-slate-400 text-xs">
              <p>لا توجد طلبات بعد.</p>
              <Link
                href="/dashboard/requests"
                className="inline-block text-amber-400 font-bold hover:underline"
              >
                انقر لتقديم طلب جديد
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{order.store_name}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-xs text-slate-400 font-mono dir-ltr text-right">
                      {order.maps_url}
                    </p>
                  </div>

                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-all shrink-0"
                  >
                    <span>المحادثة والتفاصيل</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
