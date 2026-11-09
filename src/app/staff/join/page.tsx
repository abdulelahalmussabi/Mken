"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Smartphone,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCcw,
} from "lucide-react";

interface StaffJoinState {
  id: string;
  name: string;
  phone: string;
  pairingCode: string;
  pairingCodeExpiresAt: string;
  status: "pending_approval" | "active" | "rejected" | "off_duty";
  assignedDeskName?: string | null;
  assignedServiceId?: string | null;
  assignedRole?: string | null;
  sessionToken?: string | null;
}

export default function StaffJoinPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState("default");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active onboarding request state
  const [activeRequest, setActiveRequest] = useState<StaffJoinState | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [isSuccessRedirecting, setIsSuccessRedirecting] = useState(false);

  // 1. Resolve tenant & check state recovery in localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get("tenant") || params.get("store") || "default";
    setTenantSlug(tenantParam.toLowerCase());

    // State Recovery Check: Did the phone turn off or reload while already assigned?
    try {
      const savedSession = localStorage.getItem(`mken_staff_session_${tenantParam.toLowerCase()}`);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.id && parsed.status === "active") {
          // Direct recovery!
          router.push(`/staff/queue?desk=${encodeURIComponent(parsed.assignedDeskName || "")}&service=${encodeURIComponent(parsed.assignedServiceId || "")}` as any);
          return;
        }
      }

      // Check if there was an active pending request in this browser session
      const savedPending = localStorage.getItem(`mken_pending_staff_${tenantParam.toLowerCase()}`);
      if (savedPending) {
        const parsed = JSON.parse(savedPending);
        if (parsed.id && new Date(parsed.pairingCodeExpiresAt).getTime() > Date.now()) {
          setActiveRequest(parsed);
        }
      }
    } catch {
      // storage error ignore
    }
  }, [router]);

  // 2. Countdown timer for pairing code expiry (5 minutes)
  useEffect(() => {
    if (!activeRequest) return;

    const timer = setInterval(() => {
      const diffMs = new Date(activeRequest.pairingCodeExpiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setSecondsRemaining(secs);

      if (secs <= 0) {
        setError("انتهت صلاحية كود الإقران (5 دقائق). يرجى تقديم طلب جديد.");
        setActiveRequest(null);
        try {
          localStorage.removeItem(`mken_pending_staff_${tenantSlug}`);
        } catch {}
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRequest, tenantSlug]);

  // 3. Real-Time Status Polling: Detects Admin Approval Instantly
  useEffect(() => {
    if (!activeRequest || activeRequest.status === "active") return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/staff/join?id=${encodeURIComponent(activeRequest.id)}&tenant=${encodeURIComponent(tenantSlug)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.success && data.staff) {
          const current = data.staff as StaffJoinState;

          if (current.status === "active") {
            setIsSuccessRedirecting(true);
            setActiveRequest(current);

            // Save for State Recovery
            try {
              localStorage.setItem(`mken_staff_session_${tenantSlug}`, JSON.stringify(current));
              localStorage.removeItem(`mken_pending_staff_${tenantSlug}`);
            } catch {}

            // Immediate Zero-Friction Redirect to their assigned console
            setTimeout(() => {
              const desk = current.assignedDeskName || "كاونتر 1";
              const service = current.assignedServiceId || "reception";
              router.push(`/staff/queue?desk=${encodeURIComponent(desk)}&service=${encodeURIComponent(service)}` as any);
            }, 1200);
          }
        }
      } catch {
        // network retry ignore
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeRequest, tenantSlug, router]);

  // Submit join request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("يرجى كتابة الاسم ورقم الجوال");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/staff/join?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذر إرسال طلب الانضمام");
        setLoading(false);
        return;
      }

      setActiveRequest(data.staff);
      try {
        localStorage.setItem(`mken_pending_staff_${tenantSlug}`, JSON.stringify(data.staff));
      } catch {}
      setLoading(false);
    } catch {
      setError("تعذر الاتصال بالخادم، يرجى المحاولة ثانية");
      setLoading(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden" dir="rtl">
      {/* Background Ambience */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-orange-500/20">
            <Users className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white">انضمام كادر العمل</h1>
            <p className="text-[11px] text-slate-400 font-mono">منصة مَكَن • {tenantSlug}</p>
          </div>
        </div>
        <Link
          href={"/staff/login" as any}
          className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          <KeyRound className="w-3.5 h-3.5" />
          بوابة PIN
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        {/* State A: Staff Waiting for Admin Approval */}
        {activeRequest ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center backdrop-blur-md">
            {isSuccessRedirecting ? (
              <div className="space-y-4 py-6 animate-pulse">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-white">تم اعتمادك بنجاح!</h2>
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm space-y-1">
                  <p className="font-bold">المكتب: {activeRequest.assignedDeskName || "كاونتر 1"}</p>
                  <p className="text-xs text-emerald-400/80">القسم: {activeRequest.assignedServiceId || "العام"}</p>
                </div>
                <p className="text-xs text-slate-400">جاري نقلك فوراً إلى شاشة الكاونتر الخاصة بك...</p>
              </div>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold mx-auto">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  بانتظار تعيين المشرف
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-black text-white">مرحباً {activeRequest.name}</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تم إرسال طلبك للوحة المشرف. أظهر هذا الكود لمدير الصالة لتعيين كاونترك:
                  </p>
                </div>

                {/* 2-Digit Pairing Code Display */}
                <div className="py-6 px-4 rounded-3xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-orange-500/40 shadow-inner space-y-2">
                  <span className="text-[11px] font-extrabold text-orange-400 uppercase tracking-widest">
                    كود الإقران السريع
                  </span>
                  <div className="text-6xl md:text-7xl font-black tracking-widest text-white font-mono drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                    {activeRequest.pairingCode}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono pt-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    ينتهي خلال: <span className="text-amber-300 font-bold">{timeFormatted}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                  <p className="text-slate-300 font-bold flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    حماية ضد التلاعب والإقران الوهمي
                  </p>
                  <p>ستتحول شاشة جوالك تلقائياً إلى كونسول الكاونتر فور اعتماد المشرف للكود.</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRequest(null);
                    try {
                      localStorage.removeItem(`mken_pending_staff_${tenantSlug}`);
                    } catch {}
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center justify-center gap-1 mx-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  إلغاء الطلب والبدء من جديد
                </button>
              </>
            )}
          </div>
        ) : (
          /* State B: Initial Join Form */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur-md">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-400 mx-auto flex items-center justify-center shadow-lg">
                <Smartphone className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-white">تسجيل حضور كادر العمل</h2>
              <p className="text-xs text-slate-400">
                امسح الباركود، أدخل اسمك وجوالك، وسيتم ربطك بمكتبك الميداني فوراً.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  الاسم الكامل للموظف <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: صالح الأحمد"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  رقم الجوال <span className="text-orange-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-orange-500 transition"
                />
                <span className="text-[10px] text-slate-500">يُستخدم لتثبيت جلستك واسترجاعها تلقائياً.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm transition shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    جاري إرسال الطلب...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    بدء الوردية وطلب كود الإقران
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-4 border-t border-slate-900 text-[11px] text-slate-600">
        نظام الطابور الذكي وإدارة الصالات • منصة مَكَن 2026
      </footer>
    </div>
  );
}
