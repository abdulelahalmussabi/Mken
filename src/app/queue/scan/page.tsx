"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  QrCode,
  Loader2,
  HeartHandshake,
  Clock,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Sparkles,
  MapPin
} from "lucide-react";
import type { IntakeEvaluation } from "@/lib/mken/queue";

export default function QueueScanSelfServicePage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("reception");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intake status state
  const [intakeState, setIntakeState] = useState<IntakeEvaluation | null>(null);
  const [checkingIntake, setCheckingIntake] = useState(true);

  const departments = [
    { id: "reception", name: "الاستقبال والاستفسارات العامة", prefix: "A" },
    { id: "contracts", name: "إدارة العقود والاتفاقيات", prefix: "A" },
    { id: "finance", name: "المالية والمدفوعات", prefix: "B" },
    { id: "services", name: "خدمات العملاء والمستفيدين", prefix: "A" },
  ];

  const fetchIntakeStatus = async (dept: string) => {
    setCheckingIntake(true);
    try {
      const res = await fetch(`/api/queue/intake/status?department=${dept}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.evaluation) {
        setIntakeState(data.evaluation);
      }
    } catch {
      // Ignored
    } finally {
      setCheckingIntake(false);
    }
  };

  useEffect(() => {
    fetchIntakeStatus(departmentId);
    const interval = setInterval(() => fetchIntakeStatus(departmentId), 10000);
    return () => clearInterval(interval);
  }, [departmentId]);

  const handleIssueTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const selectedDept = departments.find((d) => d.id === departmentId);
      const res = await fetch("/api/queue/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: "default",
          departmentId,
          departmentName: selectedDept?.name || "الاستقبال",
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          priorityCategory: "none",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذّر إصدار التذكرة");
      }

      router.push(`/queue/ticket/${data.ticket.id}` as any);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إصدار التذكرة");
    } finally {
      setLoading(false);
    }
  };

  const isClosed = intakeState && !intakeState.isOpen;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans">
      <header className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-black text-slate-950 text-xl">
            م
          </div>
          <div>
            <h1 className="font-black text-lg">صالة خدمات مكّن</h1>
            <p className="text-xs text-slate-400">سحب تذكرة انتظار ذاتية (QR)</p>
          </div>
        </div>
        <QrCode className="w-6 h-6 text-orange-400" />
      </header>

      <main className="max-w-md mx-auto w-full p-6 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Ticket className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-white">أهلاً بك في صالتنا</h2>
            <p className="text-xs text-slate-400">
              أدخل بياناتك للحصول على تذكرة المتابعة على جوالك ومتابعة شاشة الصالة
            </p>
          </div>

          {/* Department Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              الخدمة أو القسم المطلوب
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-orange-500 cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Intake Status Header Banner */}
          {intakeState && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                intakeState.isOpen
                  ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                  : "bg-amber-950/30 border-amber-800/40 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${intakeState.isOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className="font-bold">
                  {intakeState.isOpen ? "الاستقبال متاح الآن" : "الاستقبال معلق حالياً"}
                </span>
              </div>
              <span className="text-[11px] opacity-80">
                {intakeState.isOpen
                  ? `متبقي اليوم: ${Math.max(0, intakeState.stats.dailyCapacity - intakeState.stats.todayActive)} حصة`
                  : intakeState.closeReason}
              </span>
            </div>
          )}

          {/* SCENARIO: INTAKE IS CLOSED -> Show Context-Aware Polite Guidance Card */}
          {isClosed ? (
            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-amber-500/40 text-right space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  {intakeState.closeReasonType === "schedule" ? (
                    <Clock className="w-5 h-5" />
                  ) : intakeState.closeReasonType === "capacity" ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-300">
                    {intakeState.closeReason}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mt-2">
                    {intakeState.contextMessage}
                  </p>
                </div>
              </div>

              {/* Actionable Alternatives based on close scenario */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {intakeState.closeReasonType === "buffer" && (
                  <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span>سيُعاد الفحص تلقائياً خلال دقائق:</span>
                    <button
                      onClick={() => fetchIntakeStatus(departmentId)}
                      className="text-orange-400 hover:text-white flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> إعادة فحص
                    </button>
                  </div>
                )}

                {intakeState.closeReasonType === "capacity" && (
                  <div className="flex flex-col gap-2 pt-1 text-xs">
                    <span className="text-slate-400">خيارات بديلة متاحة:</span>
                    <button
                      onClick={() => alert("سيتم توجيهك إلى صفحة الحجز الإلكتروني المسبق لصباح الغد")}
                      className="w-full py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold flex items-center justify-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      الحجز المسبق لصباح الغد
                    </button>
                  </div>
                )}

                {intakeState.closeReasonType === "schedule" && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>مواعيد العمل: الأحد إلى الخميس من 08:00 ص إلى 04:00 م</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SCENARIO: INTAKE IS OPEN -> Show Ticket Form */
            <form onSubmit={handleIssueTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الاسم الكريم (اختياري)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: عبدالله الشمري"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رقم الجوال لتنبيهك لحظة النداء
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm outline-none focus:border-orange-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || checkingIntake}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-base shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                سحب تذكرتي الآن
              </button>
            </form>
          )}

          {/* Assurance on Fair Scheduling and Priority */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <HeartHandshake className="w-4 h-4 text-amber-400" />
              مسار الرعاية الخاصة (كبار السن وذوو الإعاقة)
            </div>
            <p className="leading-relaxed text-[11px] text-slate-400">
              يتم التحقق وتقديم الأولوية تلقائياً بمجرد الملاحظة المباشرة لدى موظف الاستقبال أو عند التوجه للكاونتر لضمان أقصى درجات العناية.
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center text-xs text-slate-500 border-t border-slate-800">
        منظومة مكّن لإدارة الصالات المركزية • الطابور الذكي العادل
      </footer>
    </div>
  );
}
