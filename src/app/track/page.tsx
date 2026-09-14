"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2, Search, Package } from "lucide-react";

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  cancelled: "ملغى",
  completed: "مكتمل",
  measurements_pending: "بانتظار المقاسات",
  cutting: "قص القماش",
  stitching: "خياطة",
  ironing_packaging: "كي وتغليف",
  ready: "جاهز للتسليم",
};

export default function TrackPage() {
  const [id, setId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    id: string;
    activityTitle: string;
    status: string;
    createdAt: string | null;
    items: { serviceTitle?: string; quantity?: number }[];
  } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/track?id=${encodeURIComponent(id.trim())}&phone=${encodeURIComponent(phone.trim())}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "تعذّر العثور على الطلب");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-12 space-y-6">
        <h1 className="text-2xl font-bold">تتبع الطلب</h1>
        <p className="text-sm text-muted">أدخل رقم الطلب ورقم الجوال المسجّل عليه.</p>
        <form onSubmit={onSubmit} className="space-y-3 border border-line rounded-2xl p-5 bg-surface">
          <label className="block text-xs font-bold">
            رقم الطلب
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-line"
            />
          </label>
          <label className="block text-xs font-bold">
            الجوال
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              className="mt-1 w-full px-3 py-2 rounded-xl bg-background border border-line"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-slate-950 font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            تتبع
          </button>
        </form>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {order && (
          <div className="border border-line rounded-2xl p-5 space-y-2 bg-surface">
            <div className="flex items-center gap-2 font-bold">
              <Package className="w-4 h-4" />
              {order.id}
            </div>
            <p className="text-sm">{order.activityTitle || "طلب"}</p>
            <p className="text-sm">الحالة: {STATUS_AR[order.status] || order.status}</p>
            {order.items?.length ? (
              <ul className="text-sm text-muted list-disc pr-5">
                {order.items.map((item, i) => (
                  <li key={`${item.serviceTitle || "item"}-${i}`}>
                    {item.serviceTitle || "صنف"} {item.quantity ? `× ${item.quantity}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
