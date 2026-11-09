"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { QueueState, Ticket } from "@/lib/mken/queue";
import { formatArabicTTS } from "@/lib/mken/queue";
import { generateQRCodeSVG } from "@/lib/mken/qr-svg";

export default function CentralTVSignagePage() {
  const [queueState, setQueueState] = useState<QueueState>({
    tenantSlug: "default",
    nowCalling: null,
    recentCalls: [],
    waitingTickets: [],
    consecutivePriorityCalls: 0,
    stats: { totalWaiting: 0, priorityWaiting: 0, standardWaiting: 0, activeCounters: 3 },
  });

  const [currentTime, setCurrentTime] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [qrSvg, setQrSvg] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const url = `${origin}/queue/scan`;
      const svg = generateQRCodeSVG(url, { sizePx: 44, margin: 1 });
      setQrSvg(svg);
    }
  }, []);

  const lastCalledTicketIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);

  // 1. Digital Clock for TV Header
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Soothing Audio Chime Synthesizer (Web Audio API - Zero external files)
  const playSoothingChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.0);

      // Tone 2: 880.00 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now + 0.25);
      gain2.gain.setValueAtTime(0, now + 0.25);
      gain2.gain.linearRampToValueAtTime(0.35, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.4);
    } catch {
      // Audio autoplay policy handled smoothly
    }
  }, []);

  // 3. Arabic Text-to-Speech (TTS)
  const speakAnnouncement = useCallback((ticketNumber: string, counterName: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const spokenText = formatArabicTTS(ticketNumber, counterName);
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = "ar-SA";
      utterance.rate = 0.88; // Slightly measured pace for public hall clarity
      utterance.pitch = 1.0;

      // Prefer Arabic voice if installed on smart TV
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find((v) => v.lang.startsWith("ar"));
      if (arVoice) utterance.voice = arVoice;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Silent fallback
    }
  }, []);

  // 4. Trigger Audio-Visual Alert on New Call
  const handleNewCall = useCallback(
    (ticket: Ticket) => {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 3500);

      playSoothingChime();
      setTimeout(() => {
        speakAnnouncement(ticket.ticketNumber, ticket.counterId || "كاونتر الاستقبال");
      }, 700);
    },
    [playSoothingChime, speakAnnouncement]
  );

  // 5. Wake Lock API (Prevent Smart TV Screen Saver / Sleep)
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // Ignored if unsupported on older TV
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // 6. Service Worker Registration for 24/7 Resilience
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/tv-signage-sw.js", { scope: "/queue/" }).catch(() => {});
    }
  }, []);

  // 7. Network Monitor & Auto-Reconnect
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 8. Data Polling & Keep-Alive Ping
  useEffect(() => {
    let active = true;

    const fetchState = async () => {
      try {
        const res = await fetch("/api/queue/tickets?tenant=default", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        if (active && data.success) {
          setIsOnline(true);
          setQueueState({
            tenantSlug: data.tenantSlug || "default",
            nowCalling: data.nowCalling,
            recentCalls: data.recentCalls || [],
            waitingTickets: data.waitingTickets || [],
            consecutivePriorityCalls: data.consecutivePriorityCalls || 0,
            stats: data.stats || { totalWaiting: 0, priorityWaiting: 0, standardWaiting: 0, activeCounters: 3 },
          });

          // Check if nowCalling changed
          if (data.nowCalling && data.nowCalling.id !== lastCalledTicketIdRef.current) {
            lastCalledTicketIdRef.current = data.nowCalling.id;
            handleNewCall(data.nowCalling);
          }
        }
      } catch {
        if (active) setIsOnline(false);
      }
    };

    const sendPing = async () => {
      try {
        await fetch("/api/queue/display/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenToken: "central-hall-tv-token",
            screenName: "شاشة الصالة المركزية الرئيسية",
            tenantSlug: "default",
          }),
        });
      } catch {
        // Handled silently
      }
    };

    fetchState();
    sendPing();

    const fetchInterval = setInterval(fetchState, 3000);
    const pingInterval = setInterval(sendPing, 30000);

    return () => {
      active = false;
      clearInterval(fetchInterval);
      clearInterval(pingInterval);
    };
  }, [handleNewCall]);

  const unlockAudio = () => {
    setAudioUnlocked(true);
    playSoothingChime();
  };

  const callingTicket = queueState.nowCalling;
  const isPriority = callingTicket && callingTicket.priorityCategory !== "none";
  const isElderly = callingTicket && callingTicket.priorityCategory === "elderly";
  const isSpecialNeeds = callingTicket && callingTicket.priorityCategory === "special_needs";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 bg-[#090d16] text-white flex flex-col select-none overflow-hidden font-sans"
    >
      {/* Top TV Header Bar */}
      <header className="h-20 bg-[#0f172a]/95 border-b border-slate-800 px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-orange-500/20">
            م
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              مَكَن <span className="text-slate-500 font-normal">|</span>
              <span className="text-slate-200">صالة الخدمات المركزية</span>
            </h1>
          </div>
        </div>

        {/* Network & Live Clock */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-sm">
            <span
              className={`w-3 h-3 rounded-full ${
                isOnline ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" : "bg-amber-400 animate-ping"
              }`}
            />
            <span className={isOnline ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
              {isOnline ? "متصل ومباشر" : "انقطاع مؤقت - استبقاء العرض"}
            </span>
          </div>

          {qrSvg && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white text-slate-950 shadow-md">
              <div
                className="w-10 h-10 flex items-center justify-center p-0.5 bg-white rounded-lg"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="text-right leading-tight">
                <div className="text-[10px] text-slate-600 font-bold">امسح بجوالك</div>
                <div className="text-xs text-orange-600 font-black">سحب تذكرة</div>
              </div>
            </div>
          )}

          <div className="text-3xl font-mono font-extrabold tracking-wider text-orange-400 drop-shadow">
            {currentTime || "16:50:35"}
          </div>

          {!audioUnlocked && (
            <button
              onClick={unlockAudio}
              className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 text-slate-950 font-bold hover:bg-orange-400 transition"
              title="انقر لتفعيل النداء الصوتي على الشاشات الذكية"
            >
              🔊 تفعيل الصوت
            </button>
          )}
        </div>
      </header>

      {/* Main TV Screen Content Grid */}
      <main className="flex-1 grid grid-cols-12 gap-6 p-8 overflow-hidden">
        {/* Left / Center Major Stage: NOW CALLING (النداء الحالي) */}
        <section className="col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-orange-500 animate-ping" />
              <h2 className="text-2xl font-black tracking-wide text-orange-400">
                النداء الحالي <span className="text-sm font-normal text-slate-400 uppercase tracking-widest">(NOW CALLING)</span>
              </h2>
            </div>
            {callingTicket && (
              <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                القسم: <strong className="text-slate-200">{callingTicket.departmentName}</strong>
              </span>
            )}
          </div>

          {/* Massive Display Card */}
          <div
            className={`flex-1 my-4 rounded-3xl border-2 flex flex-col items-center justify-center p-8 transition-all duration-700 relative overflow-hidden shadow-2xl ${
              isFlashing
                ? isPriority
                  ? "border-amber-400 bg-gradient-to-b from-amber-950/60 via-slate-900 to-[#0b1220] ring-8 ring-amber-500/30 scale-[1.01]"
                  : "border-orange-500 bg-gradient-to-b from-orange-950/50 via-slate-900 to-[#0b1220] ring-8 ring-orange-500/20 scale-[1.01]"
                : isElderly
                ? "border-amber-500/50 bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-[#0b1220]"
                : isSpecialNeeds
                ? "border-cyan-500/50 bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-[#0b1220]"
                : "border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/80 to-[#090d16]"
            }`}
          >
            {/* Priority Banner Header if applicable */}
            {isPriority && (
              <div
                className={`absolute top-6 px-6 py-2 rounded-full border text-lg font-black tracking-wide flex items-center gap-3 shadow-lg ${
                  isElderly
                    ? "border-amber-500/70 bg-amber-500/20 text-amber-300 shadow-amber-500/20"
                    : "border-cyan-500/70 bg-cyan-500/20 text-cyan-300 shadow-cyan-500/20"
                }`}
              >
                <span className="text-2xl">{isElderly ? "👴" : "♿"}</span>
                <span>{isElderly ? "مسار رعاية كبار السن" : "مسار ذوي الاحتياجات الخاصة"}</span>
              </div>
            )}

            {callingTicket ? (
              <div className="text-center space-y-6 my-auto">
                <div className="flex items-center justify-center gap-5">
                  <span className="text-6xl animate-bounce">🔔</span>
                  <div
                    className={`text-8xl md:text-9xl font-black font-mono tracking-widest drop-shadow-2xl ${
                      isElderly
                        ? "text-amber-300"
                        : isSpecialNeeds
                        ? "text-cyan-300"
                        : "text-white"
                    }`}
                  >
                    {callingTicket.ticketNumber}
                  </div>
                </div>

                {/* Directing Counter Box */}
                <div className="mt-8 px-12 py-5 rounded-2xl bg-slate-950/90 border border-slate-700/80 shadow-xl inline-block">
                  <p className="text-xl text-slate-400 mb-1">تفضل مباشرة إلى:</p>
                  <p className="text-4xl md:text-5xl font-black text-emerald-400 tracking-tight">
                    [ {callingTicket.counterId || "كاونتر 1"} - {callingTicket.departmentName} ]
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 space-y-4">
                <div className="text-6xl">⏳</div>
                <p className="text-2xl font-bold">بانتظار استدعاء التذكرة التالية...</p>
                <p className="text-sm text-slate-600">سيتم تنبيه الصالة فورياً عند النداء</p>
              </div>
            )}

            {/* Bottom Hall Guidance */}
            <div className="absolute bottom-6 flex items-center gap-6 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                تذكرة أولوية (P): تُقدم تقديراً لكبار السن وذوي الإعاقة
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                تذكرة عامة (A/B): تُستدعى بالتتابع وبانتظام
              </span>
            </div>
          </div>
        </section>

        {/* Right Stage: RECENT CALLS (المستدعى مؤخراً) */}
        <section className="col-span-4 flex flex-col justify-between bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                <span>📋</span>
                المستدعى مؤخراً <span className="text-xs font-normal text-slate-400">(RECENT)</span>
              </h2>
              <span className="text-xs text-slate-500">آخر 5 استدعاءات</span>
            </div>

            {/* Recent Calls Table */}
            <div className="w-full">
              <div className="grid grid-cols-12 text-xs font-bold text-slate-400 pb-2 px-3 border-b border-slate-800">
                <div className="col-span-4">التذكرة</div>
                <div className="col-span-4 text-center">القسم</div>
                <div className="col-span-4 text-left">الكاونتر</div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {queueState.recentCalls.map((t) => {
                  const isE = t.priorityCategory === "elderly";
                  const isS = t.priorityCategory === "special_needs";
                  return (
                    <div
                      key={t.id}
                      className="grid grid-cols-12 items-center py-4 px-3 text-base font-semibold hover:bg-slate-800/40 rounded-xl transition"
                    >
                      <div className="col-span-4 flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-lg ${
                            isE ? "text-amber-400" : isS ? "text-cyan-400" : "text-white"
                          }`}
                        >
                          {t.ticketNumber}
                        </span>
                        {isE && <span title="أولوية كبار السن">👴</span>}
                        {isS && <span title="أولوية ذوي الاحتياجات الخاصة">♿</span>}
                      </div>

                      <div className="col-span-4 text-center text-slate-300 text-sm">
                        {t.departmentName}
                      </div>

                      <div className="col-span-4 text-left text-emerald-400 font-mono text-sm">
                        {t.counterId || "كاونتر 1"}
                      </div>
                    </div>
                  );
                })}

                {queueState.recentCalls.length === 0 && (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    لا توجد استدعاءات سابقة مسجلة اليوم
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Ticker & Hall Status */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-3">
              <span className="text-xl">🟢</span>
              <p className="text-sm font-semibold text-emerald-300">
                الخدمة مستمرة بانسيابية وفق خوارزمية الجدولة العادلة (2:1)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">في الانتظار</div>
                <div className="text-xl font-bold text-orange-400 mt-0.5">
                  {queueState.stats.totalWaiting}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">مسار الرعاية الخاصة</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">
                  {queueState.stats.priorityWaiting}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
