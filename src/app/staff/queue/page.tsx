"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Bell,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Tv,
  Phone,
  Clock,
  Shuffle,
  QrCode,
  UserCheck,
  RotateCcw,
  PauseCircle,
  StopCircle,
  UserX,
  XCircle,
  Check,
  SlidersHorizontal,
  Flame,
  Hourglass
} from "lucide-react";
import type { QueueState, Ticket, PriorityCategory, IntakeEvaluation } from "@/lib/mken/queue";

export default function StaffQueueConsolePage() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [lastDispatchInfo, setLastDispatchInfo] = useState<string | null>(null);

  // Counter selection for the staff member
  const [counterId, setCounterId] = useState("كاونتر 1");
  const [staffRole, setStaffRole] = useState<"receptionist" | "counter_agent">("receptionist");

  // Semi-Automated Intake Engine State
  const [intakeDept, setIntakeDept] = useState("contracts");
  const [intakeEval, setIntakeEval] = useState<IntakeEvaluation | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeFeedback, setIntakeFeedback] = useState<string | null>(null);

  // Priority Override Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<PriorityCategory>("none");
  const [overrideFeedback, setOverrideFeedback] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);

  // Direct Issue Ticket Modal State
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [directName, setDirectName] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [directDepartment, setDirectDepartment] = useState("reception");
  const [directPriority, setDirectPriority] = useState<PriorityCategory>("elderly");
  const [issueBusy, setIssueBusy] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/queue/tickets?tenant=default", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setQueueState({
          tenantSlug: data.tenantSlug || "default",
          nowCalling: data.nowCalling,
          recentCalls: data.recentCalls || [],
          waitingTickets: data.waitingTickets || [],
          consecutivePriorityCalls: data.consecutivePriorityCalls || 0,
          stats: data.stats || { totalWaiting: 0, priorityWaiting: 0, standardWaiting: 0, activeCounters: 3 },
        });
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const fetchIntake = async (dept: string) => {
    try {
      const res = await fetch(`/api/queue/intake/status?service=${dept}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.evaluation) {
        setIntakeEval(data.evaluation);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchIntake(intakeDept);
    const interval = setInterval(() => {
      fetchQueue();
      fetchIntake(intakeDept);
    }, 4000);
    return () => clearInterval(interval);
  }, [intakeDept]);

  // Semi-Automated Intake Override Handler
  const handleIntakeAction = async (action: string, value?: number) => {
    setIntakeBusy(true);
    setIntakeFeedback(null);
    try {
      const res = await fetch("/api/queue/intake/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: intakeDept,
          action,
          value,
          staffUserId: "staff-supervisor-active",
        }),
      });
      const data = await res.json();
      if (data.success && data.evaluation) {
        setIntakeEval(data.evaluation);
        setIntakeFeedback(data.message);
        setTimeout(() => setIntakeFeedback(null), 3500);
      }
    } catch {
      setIntakeFeedback("تعذّر تطبيق الإجراء");
    } finally {
      setIntakeBusy(false);
    }
  };

  // Ticket Status & Capacity Recycling Handler
  const handleTicketStatus = async (ticketId: string, status: "completed" | "cancelled" | "no_show") => {
    try {
      await fetch(`/api/queue/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchQueue();
      fetchIntake(intakeDept);
    } catch {
      // Ignored
    }
  };

  // 1. Call Next with 2:1 Anti-Starvation
  const handleCallNext = async () => {
    setCallingInProgress(true);
    setLastDispatchInfo(null);
    try {
      const res = await fetch("/api/queue/call-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: "default",
          counterId,
          staffUserId: "staff-current-user",
        }),
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setLastDispatchInfo(`تم الاستدعاء: ${data.ticket.ticketNumber} — ${data.dispatchReason}`);
        fetchQueue();
        fetchIntake(intakeDept);
      } else {
        setLastDispatchInfo(data.message || "لا توجد تذاكر تنتظر الاستدعاء");
      }
    } catch {
      setLastDispatchInfo("تعذّر الاتصال بخادم الطابور");
    } finally {
      setCallingInProgress(false);
    }
  };

  // 2. Open Priority Override Modal
  const openOverrideModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setSelectedPriority(ticket.priorityCategory);
    setOverrideFeedback(null);
  };

  // 3. Save Priority Override
  const handleSavePriority = async () => {
    if (!selectedTicket) return;
    setOverrideBusy(true);
    setOverrideFeedback(null);
    try {
      const res = await fetch(`/api/queue/tickets/${selectedTicket.id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priorityCategory: selectedPriority,
          staffUserId: "staff-current-user",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOverrideFeedback(data.message);
        setTimeout(() => {
          setSelectedTicket(null);
          fetchQueue();
        }, 1200);
      } else {
        setOverrideFeedback(data.error || "فشل التحديث");
      }
    } catch {
      setOverrideFeedback("خطأ في الاتصال بالخادم");
    } finally {
      setOverrideBusy(false);
    }
  };

  // 4. Direct Priority Ticket Issue by Staff (Receptionist)
  const handleDirectIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueBusy(true);
    try {
      const res = await fetch("/api/queue/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: "default",
          departmentId: directDepartment,
          customerName: directName,
          customerPhone: directPhone,
          priorityCategory: directPriority,
          staffUserId: "staff-receptionist-id",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsDirectModalOpen(false);
        setDirectName("");
        setDirectPhone("");
        fetchQueue();
        fetchIntake(intakeDept);
      }
    } catch {
      // Ignored
    } finally {
      setIssueBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Console Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/staff"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowRight className="w-4 h-4" />
            بوابة الموظفين
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-lg font-black tracking-tight text-white">
              إدارة الطابور والأولوية الإنسانية
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Role & Counter Selector */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">دور الموظف:</span>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as any)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="receptionist" className="bg-slate-900">موظف استقبال</option>
              <option value="counter_agent" className="bg-slate-900">موظف كاونتر</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">موقع الخدمة:</span>
            <select
              value={counterId}
              onChange={(e) => setCounterId(e.target.value)}
              className="bg-transparent text-orange-400 font-bold outline-none cursor-pointer"
            >
              <option value="كاونتر 1" className="bg-slate-900">كاونتر 1 - الاستقبال</option>
              <option value="كاونتر 2" className="bg-slate-900">كاونتر 2 - العقود</option>
              <option value="كاونتر 3" className="bg-slate-900">كاونتر 3 - العقود</option>
              <option value="كاونتر 4" className="bg-slate-900">كاونتر 4 - المالية</option>
            </select>
          </div>

          <Link
            href={"/queue/kiosk" as any}
            target="_blank"
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold transition"
          >
            <QrCode className="w-3.5 h-3.5 text-orange-400" />
            لوحة الباركود والكشك
          </Link>

          <Link
            href={"/queue/display" as any}
            target="_blank"
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition"
          >
            <Tv className="w-3.5 h-3.5 text-orange-400" />
            فتح شاشة الصالة (TV)
          </Link>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* ========================================================================= */}
        {/* 1. RECEPTION DISPATCHER WIDGET: محرك الإغلاق النصف آلي                     */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          {/* Header Row with Department Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  التحكم النصف آلي بالاستقبال
                  <span className="text-slate-500 font-normal">|</span>
                  <span className="text-orange-400">
                    {intakeDept === "contracts"
                      ? "قسم العقود (Service A)"
                      : intakeDept === "finance"
                      ? "قسم المالية (Service B)"
                      : "الاستقبال العام"}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  يدمج بين الجدولة الآلية والسعة الحسابية الديناميكية مع الإشراف والتجاوز البشري المرن
                </p>
              </div>
            </div>

            {/* Department Selector */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400">اختر القسم:</span>
              <select
                value={intakeDept}
                onChange={(e) => setIntakeDept(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value="contracts" className="bg-slate-900">قسم العقود</option>
                <option value="reception" className="bg-slate-900">الاستقبال العام</option>
                <option value="finance" className="bg-slate-900">قسم المالية</option>
                <option value="services" className="bg-slate-900">خدمات المستفيدين</option>
              </select>
            </div>
          </div>

          {/* Operational Status Grid (حالة الاستقبال، الاستيعاب، الازدحام، الإغلاق التنبؤي) */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
            {/* Status Pill */}
            <div className="col-span-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">الحالة التشغيلية</span>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    intakeEval?.isOpen
                      ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"
                      : "bg-amber-400 animate-ping"
                  }`}
                />
                <span
                  className={`text-sm font-black ${
                    intakeEval?.isOpen ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {intakeEval?.manualOverride.active
                    ? `تجاوز يدوي: ${intakeEval.isOpen ? "مفتوح" : "مغلق"}`
                    : intakeEval?.isOpen
                    ? "استقبال مفتوح تلقائياً"
                    : "مغلق آلياً"}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 truncate">
                {intakeEval?.isOpen ? "استقبال التذاكر نشط" : intakeEval?.closeReason}
              </span>
            </div>

            {/* Daily Capacity & Recycling */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">الاستيعاب اليومي</span>
              <div className="text-base font-black font-mono text-white mt-1">
                [ {intakeEval?.stats.todayActive ?? 0} / {intakeEval?.stats.dailyCapacity ?? 100} ]
              </div>
              <span className="text-[10px] text-emerald-400/90 mt-0.5">تدوير الملغي والغائب ✓</span>
            </div>

            {/* Waiting in Hall Buffer */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">المنتظرون بالصالة</span>
              <div className="text-base font-black font-mono text-orange-400 mt-1">
                [ {intakeEval?.stats.activeWaiting ?? 0} / {intakeEval?.stats.waitingBufferLimit ?? 20} ]
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">سقف الازدحام اللحظي</span>
            </div>

            {/* Official Hours */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">الدوام الرسمي</span>
              <div className="text-xs font-black font-mono text-slate-200 mt-1" dir="ltr">
                {intakeEval?.stats.openingTime || "08:00"} ──► {intakeEval?.stats.closingTime || "16:00"}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {intakeEval?.stats.isWorkingDay ? "يوم عمل رسمي" : "عطلة نهاية أسبوع"}
              </span>
            </div>

            {/* Predictive EOD Cut-off */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Hourglass className="w-3 h-3 text-amber-400" />
                الإغلاق الذكي
              </span>
              <div className="text-base font-black font-mono text-amber-300 mt-1">
                {intakeEval?.stats.predictiveCutoffTime || "15:35"} م
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5">حساب عكسي لانتهاء الدوام</span>
            </div>
          </div>

          {/* Quick Manual Override Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                إجراءات التدخل البشري السريع (Manual Override):
              </span>

              {/* Automation Toggle & Reset Button */}
              <div className="flex items-center gap-3">
                {intakeEval?.manualOverride.active && (
                  <button
                    onClick={() => handleIntakeAction("reset_override")}
                    disabled={intakeBusy}
                    className="text-xs px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    إلغاء التدخل والعودة للجدول الآلي
                  </button>
                )}
                <button
                  onClick={() => handleIntakeAction("toggle_automation")}
                  disabled={intakeBusy}
                  className={`text-xs px-3 py-1 rounded-xl border font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    intakeEval?.autoIntakeEnabled
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${intakeEval?.autoIntakeEnabled ? "bg-emerald-400" : "bg-slate-500"}`} />
                  الأتمتة: {intakeEval?.autoIntakeEnabled ? "مفعّلة 🔘" : "معطلة ⚪"}
                </button>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* +10 Capacity Boost */}
              <button
                onClick={() => handleIntakeAction("add_capacity", 10)}
                disabled={intakeBusy}
                className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ➕ زيادة سعة (+10)
              </button>

              {/* +30 Min Time Extension */}
              <button
                onClick={() => handleIntakeAction("extend_time", 30)}
                disabled={intakeBusy}
                className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                ⏰ تمديد وقت (+30 د)
              </button>

              {/* 15 Min Pause */}
              <button
                onClick={() => handleIntakeAction("pause_intake", 15)}
                disabled={intakeBusy}
                className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                <PauseCircle className="w-4 h-4 text-amber-400 shrink-0" />
                ⏸️ إيقاف مؤقت (15 د)
              </button>

              {/* Emergency Close Today */}
              <button
                onClick={() => handleIntakeAction("emergency_close")}
                disabled={intakeBusy}
                className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/50 text-slate-200 hover:text-white transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-rose-400 shrink-0" />
                🛑 قفل إجباري لليوم
              </button>
            </div>

            {intakeFeedback && (
              <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-800/50 text-xs font-semibold text-orange-300 flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                {intakeFeedback}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. ANTI-STARVATION & OPERATIONAL DISPATCH BANNER                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Shuffle className="w-4 h-4" />
                  خوارزمية الجدولة العادلة (2:1 Anti-Starvation)
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  استدعاء التذكرة التالية
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                  النظام يقدم أصحاب مسار الرعاية الخاصة (كبار السن وذوي الإعاقة)، مع ضمان تقديم عميل واحد من المسار العام بعد كل استدعاءين متتاليين للأولوية لمنع تجميد الانتظار.
                </p>
              </div>

              {/* Status pill showing 2:1 ratio state */}
              <div className="text-left bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">حالة التتابع الحالي</div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {queueState?.consecutivePriorityCalls || 0} / 2 أولوية
                </div>
                <div className="text-[10px] text-slate-500">
                  {(queueState?.consecutivePriorityCalls || 0) >= 2 ? "النداء القادم: للمسار العام إجبارياً" : "الأولوية متاحة للرعاية الخاصة"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={handleCallNext}
                disabled={callingInProgress}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-base shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
              >
                <Bell className={`w-5 h-5 ${callingInProgress ? "animate-spin" : ""}`} />
                {callingInProgress ? "جاري الاستدعاء..." : "استدعاء العميل التالي إلى الكاونتر"}
              </button>

              <button
                onClick={() => setIsDirectModalOpen(true)}
                className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                + إصدار تذكرة رعاية / أولوية فورية
              </button>
            </div>

            {lastDispatchInfo && (
              <div className="mt-4 p-3 rounded-xl bg-orange-950/30 border border-orange-800/40 text-xs font-semibold text-orange-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-orange-400" />
                {lastDispatchInfo}
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300">مؤشرات الصالة اللحظية</h3>
              <button
                onClick={() => {
                  fetchQueue();
                  fetchIntake(intakeDept);
                }}
                className="text-slate-500 hover:text-white transition p-1"
                title="تحديث فوري"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400">إجمالي الانتظار</span>
                <div className="text-2xl font-black text-white mt-0.5">
                  {queueState?.stats.totalWaiting ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-900/40">
                <span className="text-xs text-amber-300">مسار الأولوية 👴♿</span>
                <div className="text-2xl font-black text-amber-400 mt-0.5">
                  {queueState?.stats.priorityWaiting ?? 0}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>الكاونترات النشطة:</span>
              <strong className="text-slate-200">{queueState?.stats.activeCounters ?? 3}</strong>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. LIVE QUEUE TABLES (Waiting & Calling with Capacity Recycling Actions)   */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Waiting Tickets List */}
          <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  قائمة الانتظار الحالية (المراجعون بالصالة)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  يمكن لموظف الاستقبال أو الكاونتر تعديل الصفة وترقية أي مراجع، أو إدارة حضوره وتدوير السعة المقعدية
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {queueState?.waitingTickets.length || 0} تذكرة
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {queueState?.waitingTickets.map((t, idx) => {
                const isElderly = t.priorityCategory === "elderly";
                const isSpecial = t.priorityCategory === "special_needs";
                const isPriority = isElderly || isSpecial;

                return (
                  <div
                    key={t.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-2xl transition"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-6 text-center text-xs font-mono text-slate-500">
                        #{idx + 1}
                      </span>

                      {/* Ticket Badge */}
                      <div
                        className={`px-3.5 py-1.5 rounded-xl font-mono font-bold text-lg border ${
                          isElderly
                            ? "border-amber-500/60 bg-amber-950/40 text-amber-300"
                            : isSpecial
                            ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                            : "border-slate-700 bg-slate-800 text-slate-200"
                        }`}
                      >
                        {t.ticketNumber}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {t.customerName || "عميل بدون اسم"}
                          </span>

                          {isElderly && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                              👴 كبار السن
                            </span>
                          )}
                          {isSpecial && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold flex items-center gap-1">
                              ♿ احتياجات خاصة
                            </span>
                          )}
                          {!isPriority && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                              مسار عام
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                          <span>القسم: {t.departmentName}</span>
                          {t.customerPhone && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Phone className="w-3 h-3" /> {t.customerPhone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" /> انتظار ~{t.waitEstimateMinutes} د
                          </span>
                          {t.customerProfile && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                              <UserCheck className="w-3 h-3 text-emerald-400" />
                              مسجل في CRM ({t.customerProfile.visitCount} زيارات)
                              {t.customerProfile.notes ? ` • ${t.customerProfile.notes}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Priority Upgrade + Capacity Recycling (No-Show / Cancel) */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => openOverrideModal(t)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 hover:border-orange-500/50 transition flex items-center gap-1 cursor-pointer"
                        title="ترقية فئة التذكرة"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        أولوية
                      </button>

                      <button
                        onClick={() => handleTicketStatus(t.id, "no_show")}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-[11px] font-bold text-slate-400 hover:text-amber-300 border border-slate-800 transition flex items-center gap-1 cursor-pointer"
                        title="تسجيل غياب العميل وتدوير المقعد للسعة المتاحة"
                      >
                        <UserX className="w-3 h-3 text-amber-400" />
                        غائب
                      </button>

                      <button
                        onClick={() => handleTicketStatus(t.id, "cancelled")}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-[11px] font-bold text-slate-400 hover:text-rose-400 border border-slate-800 transition flex items-center gap-1 cursor-pointer"
                        title="إلغاء التذكرة وإعادة المقعد للسعة"
                      >
                        <XCircle className="w-3 h-3 text-rose-400" />
                        إلغاء
                      </button>
                    </div>
                  </div>
                );
              })}

              {(!queueState?.waitingTickets || queueState.waitingTickets.length === 0) && (
                <div className="py-12 text-center text-slate-500 text-sm">
                  لا يوجد مراجعون في قائمة الانتظار حالياً
                </div>
              )}
            </div>
          </div>

          {/* Active Calling Box & Today's Summary */}
          <div className="lg:col-span-4 space-y-6">
            {/* Currently Calling Card */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-orange-400 animate-bounce" />
                المستدعى الآن في الصالة
              </span>

              {queueState?.nowCalling ? (
                <div className="mt-4 p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <div className="text-5xl font-black font-mono text-orange-400">
                    {queueState.nowCalling.ticketNumber}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {queueState.nowCalling.customerName || "عميل"}
                  </div>
                  <div className="text-xs text-emerald-400 font-semibold">
                    {queueState.nowCalling.counterId || "كاونتر 1"} — {queueState.nowCalling.departmentName}
                  </div>
                  {queueState.nowCalling.priorityCategory !== "none" && (
                    <div className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block font-bold">
                      {queueState.nowCalling.priorityCategory === "elderly" ? "👴 كبار السن" : "♿ احتياجات خاصة"}
                    </div>
                  )}

                  {/* Complete / Finish Button */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleTicketStatus(queueState.nowCalling!.id, "completed")}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      إتمام الخدمة بنجاح
                    </button>
                    <button
                      onClick={() => handleTicketStatus(queueState.nowCalling!.id, "no_show")}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      لم يحضر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
                  لا يوجد نداء نشط الآن
                </div>
              )}
            </div>

            {/* Recent Completed Calls */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <h4 className="text-sm font-bold text-slate-200 mb-3">آخر الاستدعاءات المنفذة</h4>
              <div className="space-y-2">
                {queueState?.recentCalls.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{t.ticketNumber}</span>
                      {t.priorityCategory === "elderly" && <span>👴</span>}
                      {t.priorityCategory === "special_needs" && <span>♿</span>}
                    </div>
                    <span className="text-slate-400">{t.departmentName}</span>
                    <span className="text-emerald-400 font-mono">{t.counterId || "كاونتر"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Staff-Only Priority Category Override Window */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">
                  صلاحية الموظف الميدانية
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  تعديل فئة التذكرة / منح الأولوية
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">رقم التذكرة الحالي:</div>
                <div className="text-2xl font-black font-mono text-orange-400">
                  {selectedTicket.ticketNumber}
                </div>
              </div>
              <div className="text-left text-xs text-slate-400">
                <div>الاسم: {selectedTicket.customerName || "غير محدد"}</div>
                <div>القسم: {selectedTicket.departmentName}</div>
              </div>
            </div>

            {/* Radio Category Choices as specified */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                اختر الفئة المستحقة للمراجع:
              </label>

              {/* Standard */}
              <label
                onClick={() => setSelectedPriority("none")}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                  selectedPriority === "none"
                    ? "border-orange-500 bg-orange-950/20 text-white"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-950"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={selectedPriority === "none"}
                  onChange={() => setSelectedPriority("none")}
                  className="accent-orange-500"
                />
                <span className="text-base">🎫</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">تذكرة عادية (Standard)</div>
                  <div className="text-[11px] text-slate-500">تتبع الطابور القياسي دون تمييز</div>
                </div>
              </label>

              {/* Elderly */}
              <label
                onClick={() => setSelectedPriority("elderly")}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                  selectedPriority === "elderly"
                    ? "border-amber-500 bg-amber-950/30 text-amber-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-950"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={selectedPriority === "elderly"}
                  onChange={() => setSelectedPriority("elderly")}
                  className="accent-amber-500"
                />
                <span className="text-xl">👴</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-amber-300">كبار السن (Senior Citizen)</div>
                  <div className="text-[11px] text-amber-500/80">
                    ترقية فورية إلى P- مع وسم ذهبي والتقديم في النداء
                  </div>
                </div>
              </label>

              {/* Special Needs */}
              <label
                onClick={() => setSelectedPriority("special_needs")}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                  selectedPriority === "special_needs"
                    ? "border-cyan-500 bg-cyan-950/30 text-cyan-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-950"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={selectedPriority === "special_needs"}
                  onChange={() => setSelectedPriority("special_needs")}
                  className="accent-cyan-500"
                />
                <span className="text-xl">♿</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-cyan-300">ذوو الاحتياجات الخاصة (Special Needs)</div>
                  <div className="text-[11px] text-cyan-500/80">
                    شارة الإتاحة الدولية والتقديم وفق نسبة 2:1 المتداخلة
                  </div>
                </div>
              </label>
            </div>

            {overrideFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {overrideFeedback}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSavePriority}
                disabled={overrideBusy}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-sm hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 transition cursor-pointer"
              >
                {overrideBusy ? "جاري الحفظ..." : "حفظ وتحديث التذكرة فوراً"}
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Direct Priority Issuance by Receptionist */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDirectIssue}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  إصدار مباشر من الاستقبال
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  إصدار تذكرة رعاية / أولوية فورية
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم المراجع (اختياري)</label>
              <input
                type="text"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="أبو فهد..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال (اختياري)</label>
              <input
                type="tel"
                value={directPhone}
                onChange={(e) => setDirectPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">القسم المستهدف</label>
              <select
                value={directDepartment}
                onChange={(e) => setDirectDepartment(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-orange-500"
              >
                <option value="reception">الاستقبال العام</option>
                <option value="services">الخدمات</option>
                <option value="contracts">العقود</option>
                <option value="finance">المالية</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">نوع الأولوية</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDirectPriority("elderly")}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    directPriority === "elderly"
                      ? "border-amber-500 bg-amber-950/40 text-amber-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <span className="text-xl">👴</span>
                  كبار السن
                </button>
                <button
                  type="button"
                  onClick={() => setDirectPriority("special_needs")}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    directPriority === "special_needs"
                      ? "border-cyan-500 bg-cyan-950/40 text-cyan-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <span className="text-xl">♿</span>
                  احتياجات خاصة
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                disabled={issueBusy}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm disabled:opacity-50 transition cursor-pointer"
              >
                {issueBusy ? "جاري الإصدار..." : "إصدار التذكرة الآن (P-)"}
              </button>
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
