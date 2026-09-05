"use client";

import React, { useEffect, useState } from "react";
import { napSkipReasonLabel, type NapReport, type NapStatus } from "@/lib/mken/nap";
import type { GbpCompetitor } from "@/lib/mken/gbp";

function napLabel(status: NapStatus): string {
  if (status === "match") return "متطابق";
  if (status === "mismatch") return "اختلاف";
  if (status === "missing_site") return "ناقص في الموقع";
  if (status === "missing_gbp") return "ناقص في جوجل";
  if (status === "missing_both") return "—";
  return "معلومة";
}

function napClass(status: NapStatus): string {
  if (status === "match") return "text-emerald-300";
  if (status === "mismatch") return "text-rose-300";
  if (status === "missing_site" || status === "missing_gbp") return "text-amber-300";
  return "text-slate-400";
}

export default function GbpSeoPanel({
  query,
  locationId,
  mapsBound,
  busy,
  setBusy,
  onToast,
}: {
  query: string;
  locationId: string;
  mapsBound?: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const [report, setReport] = useState<NapReport | null>(null);
  const [postPrompt, setPostPrompt] = useState("");
  const [postText, setPostText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState("5");
  const [replyText, setReplyText] = useState("");
  const [competitors, setCompetitors] = useState<GbpCompetitor[]>([]);
  const [competitorSource, setCompetitorSource] = useState("");
  const [competitorQuery, setCompetitorQuery] = useState("");
  const [includeName, setIncludeName] = useState(false);
  const [skipped, setSkipped] = useState<{ field: string; label: string; reason: string }[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceTitles, setServiceTitles] = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<Array<{ id: string; title: string; price: string }>>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showServices, setShowServices] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [reverseFields, setReverseFields] = useState({ phone: true, city: true, name: false });
  const canAudit = Boolean(locationId || mapsBound);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/services${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        const rows = ((data.services || []) as Array<{
          id?: string;
          enabled?: boolean;
          available?: boolean;
          title?: string;
          price?: string;
          priceLabel?: string;
          overrides?: { title?: string; price?: string };
        }>)
          .filter((service) => service.enabled && service.available)
          .map((service) => ({
            id: service.id || "",
            title: service.overrides?.title || service.title || "",
            price: service.overrides?.price || service.price || service.priceLabel || "",
          }))
          .filter((service) => service.id && service.title);
        setCatalogServices(rows);
        setServiceTitles(rows.map((service) => service.title));
        setSelectedServiceIds(rows.map((service) => service.id));
      })
      .catch(() => {
        /* keep empty */
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const postJson = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/google-business${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, locationId, ...extra }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "فشل الطلب");
    }
    return data;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "تعذّر التنفيذ", "error");
    } finally {
      setBusy(false);
    }
  };

  const fetchCompetitors = async () => {
    const data = await postJson("competitors");
    setCompetitors(data.competitors || []);
    setCompetitorSource(data.source || "");
    setCompetitorQuery(data.query || "");
    onToast(
      data.source === "gemini_simulation"
        ? "نتائج تقديرية — ليست من خرائط جوجل مباشرة"
        : "تم جلب المنافسين من خرائط جوجل",
      "success"
    );
  };

  return (
    <div className="space-y-4 pt-3 border-t border-slate-800">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !canAudit}
          onClick={() =>
            run(async () => {
              const data = await postJson("nap-audit");
              setReport(data.report);
              setSkipped([]);
              onToast("تم فحص NAP", "success");
            })
          }
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
        >
          فحص NAP
        </button>
        <button
          type="button"
          disabled={busy || !locationId}
          onClick={() =>
            run(async () => {
              if (includeName) {
                const ok = window.confirm(
                  "تغيير اسم المنشأة على جوجل قد يعرّض الصفحة للتعليق. هل تريد تضمين الاسم في هذه المزامنة؟"
                );
                if (!ok) return;
              }
              const data = await postJson("sync-nap", { includeName });
              setReport(data.report);
              setSkipped(Array.isArray(data.skipped) ? data.skipped : []);
              const nameHeld = (data.skipped || []).some(
                (item: { reason?: string }) => item.reason === "name_protected"
              );
              onToast(
                nameHeld
                  ? `${data.message || "تمت المزامنة"} — اسم المنشأة لم يُحدَّث حمايةً للحساب.`
                  : data.message || "تمت المزامنة",
                "success"
              );
            })
          }
          className="px-3 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
        >
          مزامنة NAP إلى جوجل
        </button>
        <button
          type="button"
          disabled={busy || !canAudit}
          onClick={() => setShowReverse((open) => !open)}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
        >
          استيراد من جوجل إلى مكّن
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(fetchCompetitors)}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
        >
          جلب المنافسين
        </button>
        <button
          type="button"
          disabled={busy || !locationId}
          onClick={() => setShowServices((open) => !open)}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
        >
          مزامنة الخدمات إلى جوجل
        </button>
      </div>

      {showReverse ? (
        <div className="p-3 rounded-2xl border border-sky-500/30 bg-sky-950/20 space-y-2">
          <p className="text-[11px] font-bold text-sky-100">استيراد من جوجل إلى مكّن</p>
          <p className="text-[11px] text-slate-400">
            الهاتف الموثّق والمدينة واسم العلامة فقط. ساعات العمل والعنوان التفصيلي لا تُستورد تلقائياً.
          </p>
          {([
            ["phone", "رقم الهاتف الموثّق"] as const,
            ["city", "المدينة"] as const,
            ["name", "اسم العلامة"] as const,
          ]).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-[11px] text-slate-200">
              <input
                type="checkbox"
                checked={reverseFields[key]}
                onChange={(e) => setReverseFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="mt-0.5 shrink-0"
              />
              <span>
                {label}
                {key === "name" ? (
                  <span className="block text-amber-200">سيستبدل اسم المنشأة في مكّن، دون تغيير الاسم على جوجل.</span>
                ) : null}
              </span>
            </label>
          ))}
          <button
            type="button"
            disabled={busy || !canAudit}
            onClick={() =>
              run(async () => {
                const selectedFields = (Object.keys(reverseFields) as Array<keyof typeof reverseFields>).filter(
                  (key) => reverseFields[key]
                );
                const data = await postJson("sync-nap-reverse", { selectedFields });
                setReport(data.report);
                setSkipped(Array.isArray(data.skipped) ? data.skipped : []);
                setShowReverse(false);
                onToast(data.message || "تم الاستيراد إلى مكّن", "success");
              })
            }
            className="px-3 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
          >
            تطبيق الاستيراد
          </button>
        </div>
      ) : null}

      {showServices ? (
        <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
          <p className="text-[11px] font-bold text-emerald-100">اختر الخدمات للمزامنة مع السعر بالريال ورابط الحجز</p>
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {catalogServices.map((service) => (
              <label key={service.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-200">
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={(e) =>
                      setSelectedServiceIds((prev) =>
                        e.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id)
                      )
                    }
                  />
                  <span className="truncate">{service.title}</span>
                </span>
                <span className="shrink-0 text-slate-400">{service.price || "بدون سعر"}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !locationId || !selectedServiceIds.length}
            onClick={() =>
              run(async () => {
                const data = await postJson("sync-services", { serviceIds: selectedServiceIds });
                setShowServices(false);
                onToast(`تمت مزامنة ${data.count || 0} خدمة إلى جوجل بالسعر ورابط الحجز`, "success");
              })
            }
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
          >
            مزامنة المحددة
          </button>
        </div>
      ) : null}

      <label
        className={`flex items-start gap-2 p-3 rounded-2xl border text-[11px] leading-relaxed ${
          includeName
            ? "border-rose-500/40 bg-rose-950/30 text-rose-100"
            : "border-amber-500/30 bg-amber-500/10 text-amber-100"
        }`}
      >
        <input
          type="checkbox"
          checked={includeName}
          onChange={(e) => setIncludeName(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <span>
          <span className="block font-bold">تضمين اسم المنشأة في المزامنة</span>
          مغلق افتراضياً. تغيير الاسم على جوجل قد يؤدي إلى تعليق الصفحة — لا تفعّله إلا إذا كان الاسم في مكّن هو الاسم الرسمي المعتمد.
        </span>
      </label>

      {report ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            تطابق {report.summary.scorePercent}% — {report.summary.matched}/{report.summary.total}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2">الحقل</th>
                  <th className="p-2">مكّن</th>
                  <th className="p-2">جوجل</th>
                  <th className="p-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="p-2 text-slate-300">{item.label}</td>
                    <td className="p-2 text-slate-400">{item.siteValue}</td>
                    <td className="p-2 text-slate-400">{item.gbpValue}</td>
                    <td className={`p-2 font-bold ${napClass(item.status)}`} title={item.hint}>
                      {napLabel(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {skipped.length ? (
            <ul className="text-[11px] text-slate-400 space-y-0.5">
              {skipped.map((item) => (
                <li key={`${item.field}-${item.reason}`}>
                  {item.label}: {napSkipReasonLabel(item.reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {competitors.length ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">
            {competitorSource === "google_places"
              ? "المصدر: خرائط جوجل"
              : "المصدر: تقدير تقريبي — ليست بيانات خرائط مباشرة"}
            {competitorQuery ? ` — البحث: ${competitorQuery}` : ""}
          </p>
          <ul className="space-y-1.5">
            {competitors.map((comp) => (
              <li
                key={`${comp.placeId || comp.name}-${comp.address}`}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <span className="font-bold">{comp.name}</span>
                <span className="text-slate-500"> — {comp.rating}★ ({comp.userRatingsTotal})</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{comp.address}</p>
                {comp.mapsUrl ? (
                  <a
                    href={comp.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-[11px] font-bold text-sky-300 hover:text-sky-200"
                  >
                    معاينة في خرائط جوجل
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">توليد منشور سيو محلي</label>
          {serviceTitles.length ? (
            <select
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
            >
              <option value="">خدمة مستهدفة (اختياري)</option>
              {serviceTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            value={postPrompt}
            onChange={(e) => setPostPrompt(e.target.value)}
            rows={3}
            placeholder="فكرة العرض أو المناسبة…"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await postJson("generate-post", { prompt: postPrompt, serviceName });
                  setPostText(data.text || "");
                  onToast("تم توليد المنشور", "success");
                })
              }
              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
            >
              توليد منشور
            </button>
            <button
              type="button"
              disabled={busy || !postText}
              onClick={() => {
                void navigator.clipboard.writeText(postText);
                onToast("تم نسخ المنشور", "success");
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              نسخ
            </button>
            <button
              type="button"
              disabled={busy || !locationId || !postText}
              onClick={() =>
                run(async () => {
                  await postJson("publish-post", { text: postText });
                  onToast("نُشر المنشور على جوجل بيزنس", "success");
                })
              }
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
            >
              نشر على جوجل
            </button>
          </div>
          {postText ? (
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">رد على تقييم</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
          >
            {["5", "4", "3", "2", "1"].map((value) => (
              <option key={value} value={value}>
                {value} نجوم
              </option>
            ))}
          </select>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            placeholder="نص تقييم العميل…"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const data = await postJson("generate-reply", { reviewText, rating });
                setReplyText(data.text || "");
                onToast("تم توليد الرد", "success");
              })
            }
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          >
            توليد رد
          </button>
          {replyText ? (
            <textarea
              readOnly
              value={replyText}
              rows={5}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
