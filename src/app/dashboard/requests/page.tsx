"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import NewOrderModal from "@/components/NewOrderModal";
import { useApp } from "@/context/AppContext";
import { OrderStatus } from "@/types/database";
import {
  Plus,
  Store,
  MapPin,
  Clock,
  ChevronLeft,
  MessageSquare,
  CheckCircle2,
  Hourglass,
  XCircle,
  Search,
  Layers,
} from "lucide-react";

export default function RequestsPage() {
  const { user, orders } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!user) return null;

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch =
      order.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-bold rounded-full">
            <Hourglass className="w-3.5 h-3.5" />
            قيد الانتظار
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-950/60 border border-sky-800/80 text-sky-300 text-xs font-bold rounded-full animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            قيد التنفيذ
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-bold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            مكتمل
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-bold rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            ملغى
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-950/40 px-3 py-1 rounded-full border border-orange-800/40">
              <Store className="w-3.5 h-3.5" />
              إدارة الطلبات
            </div>
            <h1 className="text-2xl font-extrabold text-white">طلبات تحسين المحلات التجاري</h1>
            <p className="text-slate-400 text-xs">
              استعرض طلبات المحلات الخاصة بك وتابع الحالات بشكل مباشر.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            طلب جديد
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 text-xs font-medium">
            {[
              { id: "all", label: "جميع الطلبات" },
              { id: "pending", label: "قيد الانتظار" },
              { id: "in_progress", label: "قيد التنفيذ" },
              { id: "completed", label: "مكتملة" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute top-3.5 right-3.5" />
            <input
              type="text"
              placeholder="البحث باسم المحل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Requests List */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 max-w-md mx-auto">
            <Store className="w-10 h-10 text-orange-400 mx-auto" />
            <p className="text-sm font-bold text-slate-200">لا توجد طلبات في هذه القائمة</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20"
            >
              <Plus className="w-4 h-4" />
              إضافة طلب جديد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="group p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/50 transition-all shadow-xl flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500 dir-ltr bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      #{order.id}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>

                  <h3 className="font-extrabold text-slate-100 text-base leading-snug group-hover:text-orange-400 transition-colors">
                    {order.store_name}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-400 dir-ltr justify-end truncate">
                    <span className="truncate text-right dir-rtl">{order.maps_url}</span>
                    <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {new Date(order.created_at).toLocaleDateString("ar-SA")}
                  </span>

                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-400 font-bold text-xs rounded-xl border border-orange-500/30 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>التفاصيل والمحادثة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </DashboardLayout>
  );
}
