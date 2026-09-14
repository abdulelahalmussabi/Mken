"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { OrderStatus } from "@/types/database";
import {
  ArrowRight,
  Clock,
  Send,
  MessageSquare,
  Hourglass,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Loader2,
  FileText,
  Sparkles,
  Smile,
} from "lucide-react";

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { user, getOrderById, messages, addMessage } = useApp();
  const { activeOccasion, occasionDetails } = useOccasion();
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const order = getOrderById(orderId);
  const orderMessages = messages[orderId] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [orderMessages.length]);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
        <Navbar />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-slate-400">يرجى تسجيل الدخول للوصول لتفاصيل الطلب والمحادثة.</p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-amber-500 text-slate-950 font-bold text-sm rounded-xl"
          >
            تسجيل الدخول
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
        <Navbar />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-200">الطلب غير موجود</h1>
          <p className="text-slate-400 text-sm">لم نتمكن من العثور على الطلب برقم #{orderId}.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-slate-200 font-bold text-sm rounded-xl"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للوحة التحكم
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || newMsg;
    if (!textToSend.trim() || sending) return;

    setSending(true);
    try {
      await addMessage(orderId, textToSend.trim());
      if (!customText) setNewMsg("");
    } catch {
      // Handled
    } finally {
      setSending(false);
    }
  };

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
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة الطلبات في لوحة التحكم
        </Link>

        {/* Order Info Summary Header */}
        <div className={`p-6 sm:p-8 rounded-3xl ${activeOccasion !== "none" ? occasionDetails.badgeBg : "bg-slate-900/90 border-slate-800"} border shadow-xl space-y-6`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-300 dir-ltr bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  #{order.id}
                </span>
                {getStatusBadge(order.status)}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{order.store_name}</h1>
            </div>

            <a
              href={order.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all dir-ltr"
            >
              <ExternalLink className="w-4 h-4" />
              <span>فتح خريطة المحل</span>
            </a>
          </div>

          {/* Details Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">رابط الخريطة المعتمد:</span>
              <p className="text-slate-300 font-mono text-[11px] truncate dir-ltr text-right">
                {order.maps_url}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">تاريخ تقديم الطلب:</span>
              <p className="text-slate-200 font-bold">
                {new Date(order.created_at).toLocaleString("ar-SA")}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">حالة المعالجة والتحديث:</span>
              <p className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                محمي بسياسات RLS Supabase
              </p>
            </div>
          </div>

          {order.notes && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                ملاحظات ومواصفات العميل:
              </span>
              <p className="leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* MESSAGING CHAT SECTION */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6 flex flex-col h-[560px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <h2 className="font-extrabold text-slate-100 text-lg">المحادثة والمراسلة المباشرة</h2>
            </div>
            <span className="text-xs text-slate-400">مرتبطة بالطلب #{order.id}</span>
          </div>

          {/* Messages Scrollable Container */}
          <div className="flex-1 overflow-y-auto space-y-4 px-2 py-1 dir-rtl">
            {orderMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
                <MessageSquare className="w-10 h-10 text-slate-700" />
                <p className="text-sm font-bold text-slate-400">لا توجد رسائل سابقة</p>
                <p className="text-xs max-w-xs">يمكنك كتابة استفسارك أدناه للبدء في المراسلة مع فريق التحسين والدعم.</p>
              </div>
            ) : (
              orderMessages.map((msg) => {
                const isMe = msg.sender_id === user.id || msg.sender_id === "usr-sa-101";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-start" : "items-end"} space-y-1`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                      <span className="font-bold text-slate-300">
                        {isMe ? "أنت (العميل)" : msg.sender_name || "فريق مكّن"}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`max-w-md p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                        isMe
                          ? "bg-amber-500 text-slate-950 font-medium rounded-tr-none"
                          : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Festive Quick Reaction Stickers Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 font-bold text-[11px] shrink-0 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>ملصقات {occasionDetails.shortName}:</span>
            </span>
            {occasionDetails.stickers.map((sticker, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(undefined, sticker)}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-lg text-amber-300 font-semibold text-xs transition-all shrink-0 hover:scale-105"
              >
                {sticker}
              </button>
            ))}
          </div>

          {/* Send Input Box */}
          <form onSubmit={(e) => handleSend(e)} className="pt-2 border-t border-slate-800 flex gap-3">
            <input
              type="text"
              placeholder="اكتب استفسارك أو رسالتك للطلب..."
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              disabled={sending}
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={sending || !newMsg.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg disabled:opacity-50 cursor-pointer transition-all shrink-0 active:scale-95"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>إرسال</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
