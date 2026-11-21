"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useApp } from "@/context/AppContext";
import { MessageSquare, Store, ChevronLeft, Send, ArrowRight, User } from "lucide-react";

export default function MessagesHubPage() {
  const { user, orders, messages, addMessage } = useApp();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || "");
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);

  if (!user) return null;

  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const currentMessages = selectedOrderId ? messages[selectedOrderId] || [] : [];

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedOrderId || sending) return;

    setSending(true);
    try {
      await addMessage(selectedOrderId, replyContent.trim());
      setReplyContent("");
    } catch {
      // Handled
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-line shadow-xl space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-950/40 px-3 py-1 rounded-full border border-orange-500/30 dark:border-orange-800/40">
            <MessageSquare className="w-3.5 h-3.5" />
            مركز المحادثات
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">المراسلات المباشرة لطلباتك</h1>
          <p className="text-muted text-xs">
            تواصل مباشرة مع فريق عمل وتحسين مكّن لجميع طلبات أنشطتك التجارية.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-surface border border-line space-y-3">
            <MessageSquare className="w-10 h-10 text-muted mx-auto" />
            <p className="text-sm font-bold text-foreground">لا توجد محادثات نشطة</p>
            <p className="text-xs text-muted">قدم طلب تحسين جديد لبدء المحادثة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Orders Conversations Selector Sidebar */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted px-1">
                الطلبات والمحادثات ({orders.length})
              </h3>
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {orders.map((ord) => {
                  const isSelected = ord.id === selectedOrderId;
                  const msgs = messages[ord.id] || [];
                  const lastMsg = msgs[msgs.length - 1];

                  return (
                    <button
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-right p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-surface border-orange-500/50 shadow-lg shadow-orange-500/10"
                          : "bg-surface-2 border-line hover:border-orange-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono text-muted dir-ltr">
                          #{ord.id}
                        </span>
                        <span className="text-[10px] text-muted">
                          {msgs.length} رسالة
                        </span>
                      </div>
                      <h4 className="font-bold text-foreground text-xs truncate">
                        {ord.store_name}
                      </h4>
                      <p className="text-[11px] text-muted truncate mt-1">
                        {lastMsg ? lastMsg.content : "لا توجد رسائل سابقة..."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversation Active Window */}
            <div className="lg:col-span-8 p-6 rounded-3xl bg-surface border border-line shadow-xl space-y-4 flex flex-col h-[520px]">
              {currentOrder ? (
                <>
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{currentOrder.store_name}</h3>
                      <p className="text-[11px] text-muted dir-ltr text-right">#{currentOrder.id}</p>
                    </div>
                    <Link
                      href={`/orders/${currentOrder.id}`}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-bold flex items-center gap-1"
                    >
                      صفحة التفاصيل الكاملة
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto space-y-3 px-1 py-1">
                    {currentMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center text-xs text-muted">
                        لا توجد رسائل سابقة في هذا الطلب. اكتب رسالتك أدناه.
                      </div>
                    ) : (
                      currentMessages.map((msg) => {
                        const isMe = msg.sender_id === user.id || msg.sender_id === "usr-sa-101";
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? "items-start" : "items-end"} space-y-1`}
                          >
                            <span className="text-[10px] text-muted px-1">
                              {isMe ? "أنت" : msg.sender_name || "فريق مكّن"}
                            </span>
                            <div
                              className={`max-w-xs sm:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                                isMe
                                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-none"
                                  : "bg-surface-2 border border-line text-foreground rounded-tl-none"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply Input */}
                  <form onSubmit={handleQuickSend} className="pt-3 border-t border-line flex gap-2">
                    <input
                      type="text"
                      placeholder="اكتب ردك المباشر هنا..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      disabled={sending}
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyContent.trim()}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-all flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      إرسال
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  اختر طلباً لمشاهدة المحادثة
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
