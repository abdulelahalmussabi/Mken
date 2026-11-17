"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageCircleHeart,
  QrCode,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Star,
  ShieldCheck,
} from "lucide-react";
import { useAdminTenant } from "@/components/AdminPageTabs";
import { generateQrSvg } from "@/lib/mken/qr-svg";

const STATUS: Record<string, string> = {
  PENDING: "بانتظار الإرسال",
  SENT: "أُرسل عبر واتساب",
  RATED_GOOGLE: "وُجّه لخرائط جوجل",
  RATED_INTERNAL: "ملاحظة ومراجعة",
  FAILED: "فشل الإرسال",
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
  const [copied, setCopied] = useState(false);

  const reviewShortUrl = useMemo(() => {
    if (!tenant) return "https://mken.live/r/";
    return `https://mken.live/r/${tenant}`;
  }, [tenant]);

  const qrSvg = useMemo(() => {
    if (!tenant) return "";
    return generateQrSvg(reviewShortUrl, {
      size: 190,
      margin: 2,
      darkColor: "#0f172a",
      lightColor: "#ffffff",
    });
  }, [tenant, reviewShortUrl]);

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

  const copyUrl = () => {
    if (!reviewShortUrl) return;
    navigator.clipboard.writeText(reviewShortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrintCard = () => {
    window.print();
  };

  const waShareUrl = useMemo(() => {
    const text = `مرحباً بك! يسعدنا ويشرفنا مشاركتنا رأيك وتجربتك معنا على خرائط جوجل عبر هذا الرابط:\n${reviewShortUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [reviewShortUrl]);

  return (
    <div className="space-y-8" dir="rtl">
      {/* 1. قسم كود ورابط التقييم المباشر (Google Maps Direct Review Hub) */}
      <section className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                رابط وكود جمع التقييمات السريع
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                  توجيه مباشر 307
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                رابط ذكي دائم يوجّه عميلك فوراً إلى صندوق كتابة المراجعة على خرائط جوجل بدون شروط أو تصفية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintCard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              طباعة استند الطاولة / الكرت
            </button>
            <a
              href={waShareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-xs font-semibold text-white transition shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              مشاركة عبر واتساب
            </a>
          </div>
        </div>

        {/* عرض الرابط المختصر والـ QR Code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* صندوق الرابط */}
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">الرابط المباشر للتقييم على Google:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={reviewShortUrl}
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5 shrink-0 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
                <a
                  href={reviewShortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white shrink-0 transition"
                  title="تجربة فتح الرابط في نافذة جديدة"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* بطاقة الامتثال لسياسات Google وحماية المستهلك */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-5 text-slate-300 space-y-1">
                <span className="font-bold text-white block">
                  معتمد ومطابق لسياسات Google وحماية المستهلك السعودي (Zero Review Gating):
                </span>
                <p className="text-slate-400">
                  يتم فتح نافذة التقييم الحقيقية لجميع العملاء دون اشتراط نجوم مسبقة أو حجب أي رأي، مما يحمي ملفك من
                  العقوبات اليدوية (Manual Action) من Google ويمنح نشاطك ثقة ومصداقية كاملة.
                </p>
              </div>
            </div>
          </div>

          {/* معاينة رمز الـ QR Code */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white text-slate-950 shadow-md">
            {qrSvg ? (
              <div
                className="w-44 h-44 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                جاري توليد الرمز...
              </div>
            )}
            <div className="mt-2 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-[11px] font-bold text-slate-800">امسح الكود لتقييمنا على Google</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. جدول سجل رسائل الواتساب */}
      <section className="space-y-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <MessageCircleHeart className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white">سجل استبيانات المواعيد السابقة</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              قائمة رسائل ما بعد الموعد المنفذة عبر النظام. يتم عزل البيانات تماماً وفق ضوابط نظام حماية البيانات الشخصية (PDPL).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-28 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-rose-300 font-bold p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80">
            <p className="text-sm text-slate-400">لا توجد طلبات تقييم سابقة مسجلة لهذه المنشأة بعد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <th className="p-3.5">العميل</th>
                  <th className="p-3.5">الجوال</th>
                  <th className="p-3.5">التقييم</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">تاريخ الإرسال</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800/60 hover:bg-slate-800/30 transition">
                    <td className="p-3.5 text-slate-200 font-medium">{row.customerName || "عميل مكّن"}</td>
                    <td className="p-3.5 text-slate-400 font-mono" dir="ltr">
                      {row.phone || "—"}
                    </td>
                    <td className="p-3.5">
                      {row.stars ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                          {row.stars}
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {STATUS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {row.sentAt ? new Date(row.sentAt).toLocaleString("ar-SA") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. كرت الطباعة المخفي المخصص لاستند الطاولة أو الفاتورة (@media print) */}
      <div className="hidden print:flex print:fixed print:inset-0 print:bg-white print:z-[99999] flex-col items-center justify-center p-8 text-center text-slate-900 font-sans" dir="rtl">
        <div className="max-w-md w-full border-4 border-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-1.5 text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />
            ))}
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">رأيك يصنع الفرق!</h1>
          <p className="text-sm text-slate-600">
            امسح الكود بكاميرا جوالك وشاركنا تجربتك وتقييمك على خرائط Google
          </p>

          <div
            className="w-56 h-56 p-2 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center shadow-sm"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800" dir="ltr">
              {reviewShortUrl}
            </p>
            <p className="text-[11px] text-slate-500">شكراً لزيارتكم ونسعد بخدمتكم دائماً</p>
          </div>
        </div>
      </div>
    </div>
  );
}
