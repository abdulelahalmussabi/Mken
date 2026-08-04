"use client";

import React from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/context/AppContext";
import { OrderStatus } from "@/types/database";
import {
  Store,
  Clock,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  ChevronLeft,
  MapPin,
  TrendingUp,
  Sparkles,
  Plus,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { user, orders, messages } = useApp();

  if (!user) return null;

  const totalOrders = orders.length;
  const pendingCount = orders.filter((o) => o.status === "pending").length;
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
        {/* Welcome Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full border border-orange-800/40">
            <Sparkles className="w-3.5 h-3.5" />
            نظرة عامة على النشاط
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            مرحباً بك، {user.full_name} 🇸🇦
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            تابع حالات طلبات تحسين خرائط قوقل والرسائل المباشرة مع فريق الدعم والتحسين.
          </p>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>إجمالي الطلبات</span>
              <Store className="w-4 h-4 text-orange-400" />
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
              className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
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
                className="inline-block text-orange-400 font-bold hover:underline"
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
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-400 font-bold text-xs rounded-xl border border-orange-500/30 transition-all shrink-0"
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
