"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import type { Appointment, AppointmentStatus } from "@/lib/mken/appointments";
import {
  CalendarDays,
  Check,
  X,
  Clock,
  Phone,
  MapPin,
  User,
  Moon,
  Users,
  RefreshCw,
  Wallet,
} from "lucide-react";

const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  confirmed: {
    label: "مؤكد",
    className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  },
  pending: {
    label: "قيد الانتظار",
    className: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  },
  cancelled: {
    label: "ملغي",
    className: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  },
};

const PAYMENT_LABELS: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  refunded: "مُسترد",
};

type Filter = "all" | AppointmentStatus;

export default function AdminAppointmentsPage() {
  const { session, isSuperAdmin, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";

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
      const query = isSuperAdmin ? `?client=${encodeURIComponent(tenant)}` : "";
      const res = await fetch(`/api/appointments${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAppointments([]);
        setError(data.message || "تعذّر تحميل المواعيد");
      } else {
        setAppointments(data.appointments || []);
      }
    } catch {
      setAppointments([]);
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (id: string, status: AppointmentStatus) => {
    setBusyId(id);
    try {
      const query = isSuperAdmin ? `?client=${encodeURIComponent(tenant)}` : "";
      const res = await fetch(`/api/appointments/${id}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر تحديث الموعد", "error");
        return;
      }

      setAppointments((prev) => prev.map((a) => (a.id === id ? data.appointment : a)));
      showToast(`تم تحديث الحالة إلى: ${STATUS_META[status].label}`, "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    return appointments.reduce(
      (acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      },
      { pending: 0, confirmed: 0, cancelled: 0 } as Record<AppointmentStatus, number>
    );
  }, [appointments]);

  const visible = useMemo(
    () => (filter === "all" ? appointments : appointments.filter((a) => a.status === filter)),
    [appointments, filter]
  );

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
              <CalendarDays className="w-3.5 h-3.5" />
              <span>المواعيد والتقويم</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white">حجوزات ومواعيد المنشأة</h1>

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

        {/* Status filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([
            { id: "all" as Filter, label: "الكل", value: appointments.length },
            { id: "pending" as Filter, label: "قيد الانتظار", value: counts.pending },
            { id: "confirmed" as Filter, label: "مؤكد", value: counts.confirmed },
            { id: "cancelled" as Filter, label: "ملغي", value: counts.cancelled },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`p-4 rounded-2xl border text-right transition-all ${
                filter === tab.id
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600"
              }`}
            >
              <p className="text-2xl font-black">{tab.value}</p>
              <p className="text-xs font-bold mt-1">{tab.label}</p>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">لا توجد مواعيد في هذا التصنيف</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((apt) => {
              const meta = STATUS_META[apt.status];
              return (
                <div
                  key={apt.id}
                  className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${meta.className}`}
                    >
                      {meta.label}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-extrabold text-white">{apt.customerName || "—"}</span>
                        <User className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 justify-end flex-wrap">
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          {apt.phone || "—"}
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                        <span className="flex items-center gap-1">
                          {apt.date} · {apt.time}
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap justify-end">
                    {apt.stayBooking && apt.nights ? (
                      <span className="flex items-center gap-1">
                        {apt.nights} {apt.stayUnit || "ليلة"}
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      </span>
                    ) : null}
                    {apt.partySize ? (
                      <span className="flex items-center gap-1">
                        {apt.partySize} أشخاص
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                      </span>
                    ) : null}
                    {apt.district || apt.locationAddress ? (
                      <span className="flex items-center gap-1">
                        {apt.district || apt.locationAddress}
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      {PAYMENT_LABELS[apt.paymentStatus] || apt.paymentStatus}
                      {apt.paymentAmount ? ` · ${apt.paymentAmount} ر.س` : ""}
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3">
                      {apt.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800 justify-end">
                    {apt.status !== "confirmed" && (
                      <button
                        type="button"
                        disabled={busyId === apt.id}
                        onClick={() => changeStatus(apt.id, "confirmed")}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-950/40 border border-emerald-800/50 hover:bg-emerald-900/50 text-emerald-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        تأكيد
                      </button>
                    )}
                    {apt.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={busyId === apt.id}
                        onClick={() => changeStatus(apt.id, "cancelled")}
                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 text-rose-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        إلغاء
                      </button>
                    )}
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
