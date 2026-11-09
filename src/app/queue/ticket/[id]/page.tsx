"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import {
  Ticket as TicketIcon,
  Bell,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HeartHandshake,
  CheckCircle2
} from "lucide-react";
import type { Ticket, QueueState } from "@/lib/mken/queue";

export default function CustomerMobileTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [waitingAhead, setWaitingAhead] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [hasVibrated, setHasVibrated] = useState(false);
  const [upgradeNotification, setUpgradeNotification] = useState<string | null>(null);

  const prevCategoryRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const loadTicket = async () => {
    try {
      const res = await fetch("/api/queue/tickets?tenant=default", { cache: "no-store" });
      const data: { success: boolean } & QueueState = await res.json();
      if (data.success) {
        // Find ticket in all buckets
        const all = [
          ...(data.nowCalling ? [data.nowCalling] : []),
          ...(data.recentCalls || []),
          ...(data.waitingTickets || []),
        ];

        const found = all.find((t) => t.id === ticketId);
        if (found) {
          // Detect priority upgrade
          if (
            prevCategoryRef.current === "none" &&
            found.priorityCategory !== "none"
          ) {
            setUpgradeNotification("تمت ترقية تذكرتك إلى مسار الرعاية الخاصة بنجاح 🎖️");
            if (typeof window !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate([150, 80, 150]);
            }
          }
          prevCategoryRef.current = found.priorityCategory;

          // Detect call to counter
          if (found.status === "calling" && prevStatusRef.current !== "calling") {
            if (typeof window !== "undefined" && "vibrate" in navigator && !hasVibrated) {
              navigator.vibrate([300, 150, 300, 150, 400]);
              setHasVibrated(true);
            }
          }
          prevStatusRef.current = found.status;

          setTicket(found);

          // Calculate waiting ahead
          const waitingList = data.waitingTickets || [];
          const idx = waitingList.findIndex((t) => t.id === ticketId);
          setWaitingAhead(idx >= 0 ? idx : 0);
        }
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    const interval = setInterval(loadTicket, 2500);
    return () => clearInterval(interval);
  }, [ticketId]);

  const isElderly = ticket?.priorityCategory === "elderly";
  const isSpecial = ticket?.priorityCategory === "special_needs";
  const isPriority = isElderly || isSpecial;
  const isCalling = ticket?.status === "calling" || ticket?.status === "serving";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans">
      {/* Mobile Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <Link href={"/queue/scan" as any} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
          <ArrowRight className="w-3.5 h-3.5" />
          تذكرة جديدة
        </Link>
        <span className="text-xs font-bold text-slate-300">مَكَن | تذكرتي الذكية</span>
        <button onClick={loadTicket} className="text-slate-400 hover:text-white p-1">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col justify-center space-y-4">
        {/* Upgrade Celebration Banner */}
        {upgradeNotification && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2.5 shadow-lg shadow-amber-500/10 animate-in slide-in-from-top-2 duration-300">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 leading-snug">{upgradeNotification}</div>
          </div>
        )}

        {/* Immediate Call to Counter Alert */}
        {isCalling && (
          <div className="p-5 rounded-3xl bg-gradient-to-b from-emerald-950/80 to-slate-900 border-2 border-emerald-500 text-center space-y-3 shadow-2xl animate-pulse ring-4 ring-emerald-500/20">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl">
              🔔
            </div>
            <h2 className="text-2xl font-black text-emerald-400">دورك الآن بالصالة!</h2>
            <div className="text-sm text-slate-200">
              تفضل فوراً بالتوجه إلى:
            </div>
            <div className="text-3xl font-black text-white font-mono bg-slate-950/90 py-3 rounded-2xl border border-slate-700">
              [ {ticket?.counterId || "كاونتر 1"} - {ticket?.departmentName} ]
            </div>
          </div>
        )}

        {/* The Ticket Pass Card */}
        <div
          className={`rounded-3xl p-6 border-2 transition-all duration-500 shadow-2xl relative overflow-hidden ${
            isElderly
              ? "border-amber-500/70 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 shadow-amber-500/10"
              : isSpecial
              ? "border-cyan-500/70 bg-gradient-to-b from-cyan-950/40 via-slate-900 to-slate-950 shadow-cyan-500/10"
              : "border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950"
          }`}
        >
          {/* Top Pass Cutouts for Ticket aesthetic */}
          <div className="flex items-center justify-between pb-4 border-b border-dashed border-slate-800">
            <div>
              <div className="text-xs text-slate-400">القسم / الخدمة</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {ticket?.departmentName || "الاستقبال العام"}
              </div>
            </div>

            {/* Priority Status Badge */}
            {isElderly && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span>👴</span>
                كبار السن
              </span>
            )}
            {isSpecial && (
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span>♿</span>
                احتياجات خاصة
              </span>
            )}
            {!isPriority && (
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold">
                تذكرة عادية
              </span>
            )}
          </div>

          {/* Ticket Number Hero */}
          <div className="py-8 text-center space-y-2">
            <div className="text-xs uppercase tracking-widest text-slate-400">رقم التذكرة</div>
            <div
              className={`text-6xl font-black font-mono tracking-wider ${
                isElderly
                  ? "text-amber-300 drop-shadow"
                  : isSpecial
                  ? "text-cyan-300 drop-shadow"
                  : "text-orange-400"
              }`}
            >
              {ticket?.ticketNumber || (loading ? "..." : "---")}
            </div>
            {ticket?.customerName && (
              <div className="text-sm font-bold text-slate-300 pt-1">
                {ticket.customerName}
              </div>
            )}
          </div>

          {/* Ticket Footer Metrics */}
          <div className="pt-4 border-t border-dashed border-slate-800 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">أمامك بالانتظار</span>
              <span className="text-xl font-bold text-white">
                {isCalling ? "حان دورك!" : `${waitingAhead} مراجع`}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">الوقت التقديري</span>
              <span className="text-xl font-bold text-amber-400">
                {isCalling ? "0 د" : `~${ticket?.waitEstimateMinutes || 8} د`}
              </span>
            </div>
          </div>
        </div>

        {/* Live TV Screen Sync Note */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
          <Bell className="w-5 h-5 text-orange-400 shrink-0" />
          <span>
            يرجى الانتباه أيضاً لشاشة الصالة المركزية الكبيرة، حيث سيتم عرض رقمك صوتياً ومرئياً فور النداء.
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-600 border-t border-slate-800">
        تحديث لحظي مستمر • نظام الصالة الذكية مكّن
      </footer>
    </div>
  );
}
