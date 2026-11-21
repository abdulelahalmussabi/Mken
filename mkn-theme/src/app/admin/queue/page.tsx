"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import {
  ListOrdered,
  RefreshCw,
  Ticket,
  Monitor,
  Pause,
  Lock,
  Play,
  PhoneCall,
  Check,
} from "lucide-react";

type Ticket = {
  id: string;
  ticket_number: string;
  status: string;
  priority_level?: string;
  customer_name?: string;
  customer_phone?: string;
};

type QueueLane = {
  id: string;
  name: string;
  prefix?: string;
  waitingCount: number;
  estimatedWaitMinutes: number;
  activeCountersCount: number;
  waitingTickets: Ticket[];
};

type Counter = {
  id: string;
  name: string;
  counter_number: number;
  status: string;
  operator_name?: string;
  assigned_queue_ids?: string[];
  current_ticket_number?: string | null;
  completed_today_count?: number;
};

type Settings = {
  service_mode?: string;
  is_enabled?: boolean;
};

type OverrideState = {
  is_force_locked_today?: boolean;
  paused_until?: string | null;
  pause_reason?: string | null;
  lock_reason?: string | null;
};

const SERVICE_MODES = [
  { value: "hybrid", label: "مواعيد وطابور" },
  { value: "queue", label: "طابور فقط" },
  { value: "booking", label: "مواعيد فقط" },
];

const STATUS_LABELS: Record<string, string> = {
  waiting: "منتظر",
  bumped: "مؤمّن",
  snoozed: "مؤجل",
  on_hold: "معلّق",
  sync_watch: "مراقب",
  called: "تم نداؤه",
};

const PRIORITY_OPTIONS = [
  { value: "immediate_next", label: "أولوية فورية" },
  { value: "fair_fifo", label: "أسبقية عادلة" },
  { value: "standard", label: "ذيل الطابور" },
];

function messageOf(data: { error?: string; message?: string }): string {
  return data.error || data.message || "تعذّر تنفيذ الإجراء";
}

export default function AdminQueuePage() {
  const { session, isSuperAdmin, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [queues, setQueues] = useState<QueueLane[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [override, setOverride] = useState<OverrideState | null>(null);
  const [serviceMode, setServiceMode] = useState("hybrid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [manualQueueId, setManualQueueId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const [transferPriority, setTransferPriority] = useState<Record<string, string>>({});

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";
  const clientQuery = isSuperAdmin && tenant ? `&client=${encodeURIComponent(tenant)}` : "";

  useEffect(() => {
    if (isSuperAdmin && !selectedTenant && clients.length) setSelectedTenant(clients[0].slug);
  }, [isSuperAdmin, selectedTenant, clients]);

  const load = useCallback(async () => {
    if (isSuperAdmin && !tenant) return;
    setError("");
    try {
      const [boardRes, configRes] = await Promise.all([
        fetch(`/api/v1/queue?action=staff-board${clientQuery}`, { credentials: "same-origin" }),
        fetch(`/api/v1/queue?action=staff-config${clientQuery}`, { credentials: "same-origin" }),
      ]);
      const board = await boardRes.json();
      const config = await configRes.json();
      if (!boardRes.ok || board.ok === false) {
        setQueues([]);
        setError(messageOf(board));
        return;
      }
      if (!configRes.ok || config.ok === false) {
        setCounters([]);
        setError(messageOf(config));
      } else {
        setCounters(config.counters || []);
      }
      setQueues(board.queues || []);
      setSettings(board.settings || config.settings || {});
      setServiceMode((board.settings || config.settings || {}).service_mode || "hybrid");
      setOverride(board.override || null);
      const firstQueue = (board.queues || [])[0];
      setManualQueueId((current) => current || firstQueue?.id || "");
    } catch {
      setError("تعذّر الاتصال بمحرك الطابور");
    } finally {
      setLoading(false);
    }
  }, [clientQuery, isSuperAdmin, tenant]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const waitingTotal = useMemo(
    () => queues.reduce((sum, queue) => sum + (queue.waitingCount || 0), 0),
    [queues]
  );
  const activeCounters = counters.filter((counter) => counter.status === "active").length;
  const servedToday = counters.reduce((sum, counter) => sum + (counter.completed_today_count || 0), 0);

  const post = async (action: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/v1/queue?action=${encodeURIComponent(action)}${clientQuery}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false || (data.error && data.ok !== true)) {
      throw new Error(messageOf(data));
    }
    return data as { message?: string; ticket?: { ticket_number?: string } | null };
  };

  const run = async (key: string, action: string, body: Record<string, unknown>, okText: string) => {
    setBusy(key);
    try {
      const data = await post(action, body);
      showToast(data.message || okText, data.ticket === null ? "info" : "success");
      await load();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر تنفيذ الإجراء", "error");
      return false;
    } finally {
      setBusy("");
    }
  };

  const issueTicket = async () => {
    if (!manualQueueId) return;
    const ok = await run("manual", "manual-ticket", {
      queueId: manualQueueId,
      customerName: manualName,
      customerPhone: manualPhone,
    }, "تم إصدار التذكرة");
    if (ok) {
      setManualName("");
      setManualPhone("");
    }
  };

  const saveMode = () =>
    run("mode", "save-config", { settings: { ...settings, service_mode: serviceMode } }, "تم حفظ وضع الخدمة");

  const overrideAction = (actionType: string, label: string) =>
    run(actionType, "manual-override", {
      action_type: actionType,
      delta_value: actionType === "PAUSE_QUEUE" ? 15 : 0,
      reason: label,
      idempotency_key: crypto.randomUUID(),
    }, label);

  const countersFor = (queueId: string) =>
    counters.filter(
      (counter) =>
        counter.status !== "on_break" &&
        (!counter.assigned_queue_ids?.length || counter.assigned_queue_ids.includes(queueId))
    );

  const paused =
    Boolean(override?.paused_until) && new Date(override?.paused_until || 0).getTime() > Date.now();

  return (
    <div className="space-y-6 text-right">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
            <a
              href="/queue.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs rounded-xl"
            >
              <Ticket className="w-3.5 h-3.5" />
              شاشة العميل
            </a>
            <a
              href="/queue-display.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs rounded-xl"
            >
              <Monitor className="w-3.5 h-3.5" />
              شاشة الصالة
            </a>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <ListOrdered className="w-3.5 h-3.5" />
            <span>إدارة الطوابير</span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white">نظام الطابور</h1>
        <p className="text-sm text-slate-400">
          متابعة المسارات، نداء الدور التالي، إصدار تذكرة يدوية، وتعليق الاستقبال.
        </p>

        {isSuperAdmin && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">المنشأة</label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {clients.map((client) => (
                <option key={client.slug} value={client.slug}>
                  {client.name} ({client.slug})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">وضع الخدمة</label>
            <select
              value={serviceMode}
              onChange={(e) => setServiceMode(e.target.value)}
              className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {SERVICE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy === "mode"}
            onClick={saveMode}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
          >
            حفظ الوضع
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => overrideAction("PAUSE_QUEUE", "تم تعليق إصدار التذاكر 15 دقيقة")}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 text-amber-200 font-bold text-xs rounded-xl disabled:opacity-50"
          >
            <Pause className="w-3.5 h-3.5" />
            تعليق 15 د
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => overrideAction("FORCE_LOCK", "تم إغلاق الاستقبال لهذا اليوم")}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-950/50 text-rose-300 font-bold text-xs rounded-xl disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5" />
            إغلاق اليوم
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => overrideAction("RESUME_OR_UNLOCK", "تم استئناف استقبال الطابور")}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/15 text-emerald-300 font-bold text-xs rounded-xl disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            استئناف
          </button>
        </div>

        {(override?.is_force_locked_today || paused) && (
          <p className="text-xs font-bold text-rose-300">
            {override?.is_force_locked_today
              ? `الاستقبال مغلق: ${override.lock_reason || "قرار إداري"}`
              : `الاستقبال معلّق: ${override?.pause_reason || "تمهيد الصالة"}`}
          </p>
        )}
        {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "بانتظار النداء", value: waitingTotal },
          { label: "كاونترات نشطة", value: activeCounters },
          { label: "أُنجزت اليوم", value: servedToday },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-right">
            <p className="text-2xl font-black text-white">{loading ? "—" : card.value}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <h2 className="text-sm font-extrabold text-white">تذكرة يدوية</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={manualQueueId}
            onChange={(e) => setManualQueueId(e.target.value)}
            className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100"
          >
            {queues.map((queue) => (
              <option key={queue.id} value={queue.id}>
                {queue.name}
              </option>
            ))}
          </select>
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="اسم المراجع (اختياري)"
            className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right"
          />
          <input
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            placeholder="الجوال (اختياري)"
            className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right"
            dir="ltr"
          />
          <button
            type="button"
            disabled={busy === "manual" || !manualQueueId}
            onClick={issueTicket}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
          >
            إصدار تذكرة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-white">المسارات والانتظار</h2>
          {queues.map((queue) => (
            <article key={queue.id} className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-white">{queue.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {queue.waitingCount} منتظر · انتظار تقديري {queue.estimatedWaitMinutes} د · {queue.activeCountersCount} كاونتر
                  </p>
                </div>
                <span className="text-xs font-black text-amber-300">{queue.prefix || ""}</span>
              </div>
              {(queue.waitingTickets || []).length === 0 && (
                <p className="text-xs text-slate-500">لا يوجد منتظرون في هذا المسار.</p>
              )}
              {(queue.waitingTickets || []).map((ticket) => {
                const options = countersFor(queue.id);
                const fallback = queues.find((item) => item.id !== queue.id)?.id || "";
                const target = transferTarget[ticket.id] ?? fallback;
                return (
                  <div key={ticket.id} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-white" dir="ltr">
                          {ticket.ticket_number}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {STATUS_LABELS[ticket.status] || ticket.status}
                          {ticket.customer_name ? ` · ${ticket.customer_name}` : ""}
                          {ticket.customer_phone ? ` · ${ticket.customer_phone}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy) || !options[0]}
                        onClick={() =>
                          run(`call-${ticket.id}`, "dispatch-call", {
                            counterId: options[0].id,
                            ticketId: ticket.id,
                          }, `تم نداء ${ticket.ticket_number}`)
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-xl disabled:opacity-50"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        نداء
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={target}
                        onChange={(e) => setTransferTarget((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                        className="flex-1 min-w-[8rem] px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-100"
                      >
                        {queues
                          .filter((item) => item.id !== queue.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              تحويل إلى {item.name}
                            </option>
                          ))}
                      </select>
                      <select
                        value={transferPriority[ticket.id] || "standard"}
                        onChange={(e) =>
                          setTransferPriority((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-100"
                      >
                        {PRIORITY_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={Boolean(busy) || !target}
                        onClick={() =>
                          run(`move-${ticket.id}`, "transfer-ticket", {
                            ticketId: ticket.id,
                            toQueueId: target,
                            priorityLevel: transferPriority[ticket.id] || "standard",
                          }, `تم تحويل ${ticket.ticket_number}`)
                        }
                        className="px-3 py-2 bg-slate-800 text-slate-200 font-bold text-[11px] rounded-xl disabled:opacity-50"
                      >
                        تحويل
                      </button>
                    </div>
                  </div>
                );
              })}
            </article>
          ))}
          {!loading && queues.length === 0 && !error && (
            <p className="text-sm text-slate-400">لا توجد مسارات طابور لهذه المنشأة.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-white">الكاونترات</h2>
          {counters.map((counter) => (
            <article key={counter.id} className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-white">{counter.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {counter.operator_name || "بدون مشغّل"} · {counter.status === "on_break" ? "استراحة" : "نشط"} ·{" "}
                    {counter.completed_today_count || 0} اليوم
                  </p>
                </div>
                <span className="text-xs font-black text-slate-300">#{counter.counter_number}</span>
              </div>
              <p className="text-sm font-bold text-amber-200">
                {counter.current_ticket_number
                  ? `يخدم التذكرة ${counter.current_ticket_number}`
                  : "لا توجد تذكرة حالية"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy) || counter.status === "on_break"}
                  onClick={() =>
                    run(`next-${counter.id}`, "call-next", { counterId: counter.id }, `نداء التالي على ${counter.name}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-xl disabled:opacity-50"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  التالي
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy) || !counter.current_ticket_number}
                  onClick={() =>
                    run(
                      `done-${counter.id}`,
                      "complete-service",
                      { counterId: counter.id },
                      `أُنجزت ${counter.current_ticket_number}`
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 text-emerald-300 font-bold text-[11px] rounded-xl disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  إنهاء
                </button>
              </div>
            </article>
          ))}
          {!loading && counters.length === 0 && !error && (
            <p className="text-sm text-slate-400">لا توجد كاونترات لهذه المنشأة.</p>
          )}
        </section>
      </div>
    </div>
  );
}
