"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";
import type { GbpReview } from "@/lib/mken/gbp-reviews";

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
  const { showToast } = useApp();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gbpHint, setGbpHint] = useState("");
  const [gbpApi, setGbpApi] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [replyText, setReplyText] = useState("");

  const selected = reviews.find((row) => row.name === selectedName) || null;

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    try {
      const [reqRes, statusRes] = await Promise.all([
        fetch(`/api/google-business?action=review-requests${query ? `&${query.slice(1)}` : ""}`),
        fetch(`/api/google-business${query}`),
      ]);
      const reqData = await reqRes.json();
      if (!reqRes.ok || !reqData.success) {
        setError(reqData.message || "تعذّر تحميل طلبات التقييم");
        setRows([]);
      } else {
        setError("");
        setRows(reqData.requests || []);
      }

      const status = await statusRes.json();
      const loc = String(status.selectedLocationId || "");
      setLocationId(loc);
      const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
      params.set("action", "gbp-reviews");
      if (loc) params.set("locationId", loc);
      const gbpRes = await fetch(`/api/google-business?${params.toString()}`);
      const gbp = await gbpRes.json();
      setReviews(Array.isArray(gbp.reviews) ? gbp.reviews : []);
      setQuotaBlocked(Boolean(gbp.quotaBlocked));
      setGbpApi(Boolean(gbp.gbpReviewsApi));
      setGbpHint(gbp.message || (!loc ? "اربط فرعاً من تبويب الربط وNAP لنشر الرد على الخرائط." : ""));
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const postJson = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/google-business${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, locationId, ...extra }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "فشل الطلب");
    return data;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر التنفيذ", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-start gap-3">
          <MessageCircleHeart className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">التقييمات والردود</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              تقييمات خرائط جوجل تُجلب من Reviews API وتُنشر عليها. طلبات واتساب بعد الموعد تبقى منفصلة في الجدول
              أسفل الصفحة. لا نخزّن نص تقييمات Places ولا نمرّرها إلى نموذج لغوي من المعاينة.
            </p>
          </div>
        </div>
      </section>

      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <h2 className="text-sm font-extrabold text-white">تقييمات خرائط جوجل</h2>
        {gbpHint ? <p className="text-[11px] text-amber-200/90 leading-relaxed">{gbpHint}</p> : null}
        {gbpApi ? (
          <p className="text-[11px] text-emerald-200">Reviews API متصل. التوليد مسودة — النشر يكتب على الملف.</p>
        ) : quotaBlocked ? (
          <p className="text-[11px] text-amber-200">الحصّة مغلقة. ولّد الرد وانسخه إلى تطبيق بيزنس.</p>
        ) : null}
        {loading ? (
          <div className="h-24 rounded-2xl bg-slate-950/60 border border-slate-800 animate-pulse" />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-400">لا تقييمات من حساب بيزنس لهذه المنشأة بعد.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-500 bg-slate-950/80">
                  <th className="p-3">العميل</th>
                  <th className="p-3">النجوم</th>
                  <th className="p-3">التعليق</th>
                  <th className="p-3">الرد</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((row) => (
                  <tr
                    key={row.name}
                    className={`border-t border-slate-800 cursor-pointer ${
                      selectedName === row.name ? "bg-sky-950/40" : "bg-slate-950/40"
                    }`}
                    onClick={() => {
                      setSelectedName(row.name);
                      setReplyText(row.reply || "");
                    }}
                  >
                    <td className="p-3 text-slate-200">{row.reviewerName}</td>
                    <td className="p-3 text-amber-300 font-bold">{row.starRating || "—"}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{row.comment || "بدون نص"}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{row.reply || "بلا رد"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-300">
              {selected.reviewerName} — {selected.starRating || "—"} نجوم
            </p>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const data = await postJson("generate-reply", {
                      reviewText: selected.comment,
                      rating: String(selected.starRating || 5),
                    });
                    setReplyText(data.text || "");
                    showToast("مسودة جاهزة — لم تُنشر بعد", "success");
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                توليد مسودة
              </button>
              <button
                type="button"
                disabled={busy || !replyText}
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(replyText);
                    showToast("نُسخ الرد", "success");
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
              >
                نسخ
              </button>
              <button
                type="button"
                disabled={busy || quotaBlocked || !locationId || !replyText}
                onClick={() =>
                  void run(async () => {
                    const data = await postJson("publish-review-reply", {
                      reviewName: selected.name,
                      comment: replyText,
                    });
                    showToast(data.message || "نُشر الرد على جوجل", "success");
                    await load();
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                نشر على جوجل
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-white">طلبات واتساب بعد الموعد</h2>
          {rows.length === 0 ? (
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
        </section>
      )}
    </div>
  );
}
