"use client";

import React, { useEffect, useState } from "react";
import type { NapReport, NapStatus } from "@/lib/mken/nap";
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
  busy,
  setBusy,
  onToast,
}: {
  query: string;
  locationId: string;
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
  const [serviceName, setServiceName] = useState("");
  const [serviceTitles, setServiceTitles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/services${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        const titles = ((data.services || []) as Array<{ enabled?: boolean; available?: boolean; title?: string; overrides?: { title?: string } }>)
          .filter((service) => service.enabled && service.available)
          .map((service) => service.overrides?.title || service.title || "")
          .filter(Boolean);
        setServiceTitles(titles);
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
    onToast("تم جلب المنافسين", "success");
  };

  return (
    <div className="space-y-4 pt-3 border-t border-slate-800">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !locationId}
          onClick={() =>
            run(async () => {
              const data = await postJson("nap-audit");
              setReport(data.report);
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
              const data = await postJson("sync-nap");
              setReport(data.report);
              onToast(data.message || "تمت المزامنة", "success");
            })
          }
          className="px-3 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
        >
          مزامنة NAP إلى جوجل
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
          onClick={() =>
            run(async () => {
              const data = await postJson("sync-services");
              onToast(`تمت مزامنة ${data.count || 0} خدمة إلى جوجل`, "success");
            })
          }
          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
        >
          مزامنة الخدمات إلى جوجل
        </button>
      </div>

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
                    <td className={`p-2 font-bold ${napClass(item.status)}`}>{napLabel(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {competitors.length ? (
        <ul className="space-y-1.5">
          {competitors.map((comp) => (
            <li
              key={`${comp.name}-${comp.address}`}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
            >
              <span className="font-bold">{comp.name}</span>
              <span className="text-slate-500"> — {comp.rating}★ ({comp.userRatingsTotal})</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{comp.address}</p>
            </li>
          ))}
        </ul>
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
