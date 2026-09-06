"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { useAdminTenant } from "@/components/AdminPageTabs";

const STATUS: Record<string, string> = {
  PENDING: "بانتظار الإرسال",
  SENT: "أُرسل عبر واتساب",
  RATED_GOOGLE: "وُجّه لخرائط جوجل",
  RATED_INTERNAL: "ملاحظة داخلية",
  FAILED: "فشل",
  SKIPPED: "تخطّي",
};

type RequestRow = {
  id: string;
  phone: string;
  customerName: string;
  stars: number | null;
  status: string;
  appointmentId: string;
  sentAt: string;
  ratedAt: string;
};

export default function LocalReviewRequestsPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/google-business?action=review-requests${query ? `&${query.slice(1)}` : ""}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل طلبات التقييم");
        setRows([]);
      } else {
        setError("");
        setRows(data.requests || []);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-start gap-3">
          <MessageCircleHeart className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">طلبات التقييم</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              هذه قائمة واتساب بعد الموعد من <span dir="ltr">mken_review_requests</span>. لا نخزّن نص تقييمات Places ولا
              نمرّرها إلى نموذج لغوي. صندوق مراجعات خرائط جوجل ينتظر GBP Reviews API بعد فتح الحصّة — ليس جدول الدراسة
              <span dir="ltr"> google_reviews_analytics</span>.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          عزل الصفوف هنا عبر <span dir="ltr">tenant_slug</span> وجلسة الإدارة + service role. لا نستخدم{" "}
          <span dir="ltr">current_setting(&apos;app.current_tenant_id&apos;)</span>.
        </p>
      </section>

      {loading ? (
        <div className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">لا طلبات تقييم واتساب بعد لهذه المنشأة.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-800">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="text-slate-500 bg-slate-900/80">
                <th className="p-3">العميل</th>
                <th className="p-3">الجوال</th>
                <th className="p-3">النجوم</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">أُرسل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800 bg-slate-950/40">
                  <td className="p-3 text-slate-200">{row.customerName || "—"}</td>
                  <td className="p-3 text-slate-400" dir="ltr">
                    {row.phone || "—"}
                  </td>
                  <td className="p-3 text-amber-300 font-bold">{row.stars ?? "—"}</td>
                  <td className="p-3 text-slate-300">{STATUS[row.status] || row.status}</td>
                  <td className="p-3 text-slate-500">
                    {row.sentAt ? new Date(row.sentAt).toLocaleString("ar-SA") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
