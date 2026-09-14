"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import {
  BASE_ORDER_STATUSES,
  TAILORING_ACTIVITIES,
  TAILORING_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/mken/orders";
import {
  Inbox,
  Phone,
  MapPin,
  User,
  RefreshCw,
  Wallet,
  MessageCircle,
  ShoppingCart,
} from "lucide-react";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  measurements_pending: "بانتظار القياسات",
  cutting: "مرحلة القص",
  stitching: "تحت الخياطة",
  ironing_packaging: "الكي والتجهيز",
  ready: "جاهز للتسليم",
  completed: "تم التسليم",
  cancelled: "ملغي",
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  confirmed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  measurements_pending: "bg-orange-500/10 border-orange-500/30 text-orange-300",
  cutting: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  stitching: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  ironing_packaging: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
  ready: "bg-teal-500/10 border-teal-500/30 text-teal-300",
  completed: "bg-emerald-600/10 border-emerald-600/30 text-emerald-300",
  cancelled: "bg-rose-500/10 border-rose-500/30 text-rose-300",
};

const PAYMENT_LABELS: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  failed: "فشل الدفع",
  refunded: "مُسترد",
};

export default function AdminOrdersPage() {
  const { session, isSuperAdmin, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";
  const query = isSuperAdmin ? `?client=${encodeURIComponent(tenant)}` : "";

  useEffect(() => {
    if (isSuperAdmin && !selectedTenant && clients.length) {
      setSelectedTenant(clients[0].slug);
    }
  }, [isSuperAdmin, selectedTenant, clients]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/orders${isSuperAdmin ? `?client=${encodeURIComponent(tenant)}` : ""}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setOrders([]);
        setError(data.message || "تعذّر تحميل الطلبات");
      } else {
        setOrders(data.orders || []);
      }
    } catch {
      setOrders([]);
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (id: string, status: OrderStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/orders/${id}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر تحديث الطلب", "error");
        return;
      }

      setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
      showToast(`تم تحديث الحالة إلى: ${STATUS_LABELS[status]}`, "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const totals = useMemo(() => {
    const paid = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + (o.paymentAmount || 0), 0);
    return {
      count: orders.length,
      open: orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
      paid,
    };
  }, [orders]);

  return (
    <>
      <div className="space-y-8 text-right">
        {/* Header */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
              <Inbox className="w-3.5 h-3.5" />
              <span>الطلبات الواردة</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white">طلبات المنشأة</h1>

          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">المنشأة</label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {clients.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "إجمالي الطلبات", value: totals.count },
            { label: "طلبات قيد التنفيذ", value: totals.open },
            { label: "المبالغ المدفوعة (ر.س)", value: totals.paid },
          ].map((card) => (
            <div
              key={card.label}
              className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 text-right"
            >
              <p className="text-2xl font-black text-white">{card.value}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">لا توجد طلبات بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isTailoring = TAILORING_ACTIVITIES.includes(order.activityId || "");
              const statusOptions: OrderStatus[] = isTailoring
                ? ["pending", ...TAILORING_STATUSES, "completed", "cancelled"]
                : [...BASE_ORDER_STATUSES];
              const digits = order.phone.replace(/\D/g, "");

              return (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-bold ${STATUS_CLASSES[order.status]}`}
                    >
                      {STATUS_LABELS[order.status]}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-extrabold text-white">
                          {order.customerName || "—"}
                        </span>
                        <User className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 justify-end flex-wrap">
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          {order.phone || "—"}
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                        {order.activityTitle && (
                          <span className="text-slate-500">{order.activityTitle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {order.items.length > 0 && (
                    <ul className="space-y-1 bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3">
                      {order.items.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between text-xs text-slate-300"
                        >
                          <span className="text-slate-500">{item.priceLabel || ""}</span>
                          <span className="flex items-center gap-1.5">
                            <strong className="text-amber-400">× {item.quantity ?? 1}</strong>
                            {item.serviceTitle}
                            <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap justify-end">
                    {order.district || order.locationAddress ? (
                      <span className="flex items-center gap-1">
                        {order.district || order.locationAddress}
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
                      {order.paymentAmount ? ` · ${order.paymentAmount} ر.س` : ""}
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                  </div>

                  {order.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3">
                      {order.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800 justify-end flex-wrap">
                    {digits && (
                      <a
                        href={`https://wa.me/${digits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-950/40 border border-emerald-800/50 hover:bg-emerald-900/50 text-emerald-400 rounded-xl text-xs font-bold transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        واتساب
                      </a>
                    )}
                    <select
                      value={order.status}
                      disabled={busyId === order.id}
                      onChange={(e) => changeStatus(order.id, e.target.value as OrderStatus)}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
