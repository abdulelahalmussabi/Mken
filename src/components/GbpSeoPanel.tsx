"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { napSkipReasonLabel, NAP_ACCEPTANCE_PERCENT, type GbpOperatorProof, type NapReport, type NapStatus } from "@/lib/mken/nap";
import type { GbpCompetitor } from "@/lib/mken/gbp";
import type { GbpReview } from "@/lib/mken/gbp-reviews";

type SyncField = { field: string; label: string; value: string };
type SkipField = { field: string; label: string; reason: string };
type StagingPlan = {
  report: NapReport;
  updated: SyncField[];
  skipped: SkipField[];
  canWrite: boolean;
};

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

function napOverallLabel(overall: NapReport["summary"]["overall"]): string {
  if (overall === "excellent") return "ممتاز";
  if (overall === "good") return "جيد";
  if (overall === "fair") return "متوسط";
  return "يحتاج معالجة";
}

function ratingDelta(own: number, other: number): string {
  if (!own || !other) return "—";
  const diff = Math.round((other - own) * 10) / 10;
  if (diff === 0) return "مساوٍ";
  if (diff > 0) return `أعلى بـ ${diff}`;
  return `أقل بـ ${Math.abs(diff)}`;
}

type GeoScanLite = {
  keyword: string;
  gridSize: string;
  averageRank: number | null;
  top3Percentage: number | null;
  source?: string;
  cells: Array<{ rank: number | null; inPack?: boolean }>;
};

function geoCellClass(rank: number | null): string {
  if (rank == null) return "bg-slate-800 text-slate-500";
  if (rank <= 3) return "bg-emerald-500/20 text-emerald-200";
  if (rank <= 10) return "bg-amber-500/20 text-amber-200";
  return "bg-rose-500/20 text-rose-200";
}

function postSeoScore(text: string, city: string, serviceName: string): { score: number; notes: string[] } {
  const body = text.trim();
  if (!body) return { score: 0, notes: [] };
  const notes: string[] = [];
  let score = 20;
  if (body.length >= 80 && body.length <= 500) {
    score += 25;
    notes.push("طول مناسب لخرائط جوجل");
  } else if (body.length > 500) {
    score += 10;
    notes.push("اختصر النص ليظهر كاملاً على الخرائط");
  } else {
    notes.push("أضف جملة عن العرض أو الموقع");
  }
  if (city && body.includes(city.replace(/^ال/, ""))) {
    score += 20;
    notes.push("المدينة مذكورة");
  } else if (city) {
    notes.push(`أضف «${city}» بشكل طبيعي`);
  }
  if (serviceName && body.includes(serviceName.slice(0, 8))) {
    score += 15;
    notes.push("الخدمة مذكورة");
  }
  if (/احجز|تواصل|اطلب|زرنا|اتصل/.test(body)) {
    score += 20;
    notes.push("حث على الإجراء موجود في النص");
  } else {
    notes.push("أضف فعل حجز أو تواصل");
  }
  return { score: Math.min(100, score), notes };
}

function GbpPostPreview({
  text,
  ctaLabel,
  ctaUrl,
  city,
  serviceName,
}: {
  text: string;
  ctaLabel: string;
  ctaUrl: string;
  city: string;
  serviceName: string;
}) {
  const seo = postSeoScore(text, city, serviceName);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-slate-300">معاينة بطاقة المنشور</p>
      <div className="rounded-2xl border border-slate-700 bg-white p-3 text-right space-y-2">
        <p className="text-[10px] font-bold text-slate-500">Google</p>
        <p className="text-xs leading-6 text-slate-800 whitespace-pre-wrap">{text}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-extrabold text-blue-700">{ctaLabel || "احجز"}</span>
          {ctaUrl ? (
            <span className="text-[10px] text-slate-500 truncate" dir="ltr">
              {ctaUrl.replace(/^https?:\/\//, "").slice(0, 42)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>قوة السيو المحلي</span>
          <span className="font-bold text-slate-200">{seo.score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${seo.score >= 70 ? "bg-emerald-500" : seo.score >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${seo.score}%` }}
          />
        </div>
        <ul className="text-[11px] text-slate-500 space-y-0.5">
          {seo.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {ctaUrl ? (
          <p className="text-[10px] text-slate-500 break-all" dir="ltr">
            CTA: {ctaUrl}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function withPostUtm(url: string, campaign = "gbp_post"): string {
  const name = campaign.trim().slice(0, 80) || "gbp_post";
  if (!url.trim()) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", "google_posts");
    parsed.searchParams.set("utm_medium", "local_pack");
    parsed.searchParams.set("utm_campaign", name);
    return parsed.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}utm_source=google_posts&utm_medium=local_pack&utm_campaign=${encodeURIComponent(name)}`;
  }
}

function formatProofAt(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

export default function GbpSeoPanel({
  query,
  locationId,
  mapsBound,
  mapsUrl,
  auditNonce,
  websiteUrl,
  busy,
  setBusy,
  onToast,
  quotaBlocked,
  operatorProof,
}: {
  query: string;
  locationId: string;
  mapsBound?: boolean;
  mapsUrl?: string;
  auditNonce?: number;
  websiteUrl?: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onToast: (message: string, type: "success" | "error") => void;
  quotaBlocked?: boolean;
  operatorProof?: GbpOperatorProof | null;
}) {
  const [report, setReport] = useState<NapReport | null>(null);
  const [auditError, setAuditError] = useState("");
  const [postPrompt, setPostPrompt] = useState("");
  const [postText, setPostText] = useState("");
  const [postCtaUrl, setPostCtaUrl] = useState("");
  const [postCtaLabel, setPostCtaLabel] = useState("احجز");
  const [postCity, setPostCity] = useState("");
  const [geoScan, setGeoScan] = useState<GeoScanLite | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState("5");
  const [replyText, setReplyText] = useState("");
  const [gbpReviews, setGbpReviews] = useState<GbpReview[]>([]);
  const [selectedReviewName, setSelectedReviewName] = useState("");
  const [reviewsQuota, setReviewsQuota] = useState(false);
  const [reviewsHint, setReviewsHint] = useState("");
  const [competitors, setCompetitors] = useState<GbpCompetitor[]>([]);
  const [ownListing, setOwnListing] = useState<GbpCompetitor | null>(null);
  const [competitorSource, setCompetitorSource] = useState("");
  const [competitorQuery, setCompetitorQuery] = useState("");
  const [includeName, setIncludeName] = useState(false);
  const [confirmNameSend, setConfirmNameSend] = useState(false);
  const [skipped, setSkipped] = useState<SkipField[]>([]);
  const [staging, setStaging] = useState<StagingPlan | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceTitles, setServiceTitles] = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<Array<{ id: string; title: string; price: string }>>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showServices, setShowServices] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [reverseFields, setReverseFields] = useState({ phone: true, city: true, name: false });
  const [proof, setProof] = useState<GbpOperatorProof | null>(operatorProof || null);
  const canAudit = Boolean(locationId || mapsBound || mapsUrl?.trim());
  const canWrite = Boolean(locationId);

  useEffect(() => {
    setProof(operatorProof || null);
  }, [operatorProof]);

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
      body: JSON.stringify({
        action,
        locationId,
        mapsUrl: mapsUrl?.trim() || undefined,
        ...extra,
      }),
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

  useEffect(() => {
    if (!canAudit) return;
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      try {
        const data = await postJson("nap-audit");
        if (cancelled) return;
        setReport(data.report);
        setSkipped([]);
        setAuditError("");
      } catch (err) {
        if (!cancelled) setAuditError(err instanceof Error ? err.message : "تعذّر فحص NAP");
      }
      try {
        const data = await postJson("competitors");
        if (cancelled) return;
        setCompetitors(data.competitors || []);
        setOwnListing(data.own || null);
        setCompetitorSource(data.source || "");
        setCompetitorQuery(data.query || "");
      } catch {
        /* optional on auto-load */
      }
      try {
        const geoRes = await fetch(`/api/ads/geo-grid${query}`);
        const geo = await geoRes.json();
        if (!cancelled && geoRes.ok && geo.success) {
          setGeoScan(geo.mapsScan || (geo.scans || []).find((item: GeoScanLite) => item.source === "dataforseo") || null);
        }
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when bind/location changes, not on every render
  }, [canAudit, locationId, mapsBound, mapsUrl, auditNonce, query]);

  const loadGbpReviews = async () => {
    if (!canWrite) {
      setGbpReviews([]);
      setReviewsQuota(false);
      setReviewsHint("النشر على الخرائط يحتاج فرعاً من حساب بيزنس. يمكنك توليد رد ونسخه إلى تطبيق بيزنس.");
      return;
    }
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    params.set("action", "gbp-reviews");
    params.set("locationId", locationId);
    const res = await fetch(`/api/google-business?${params.toString()}`);
    const data = await res.json();
    setGbpReviews(Array.isArray(data.reviews) ? data.reviews : []);
    setReviewsQuota(Boolean(data.quotaBlocked));
    setReviewsHint(
      data.message ||
        (data.gbpReviewsApi
          ? "اختر تقييماً ثم ولّد الرد. النشر يكتب على خرائط جوجل — التوليد وحده لا ينشر."
          : "")
    );
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadGbpReviews();
      } catch {
        if (!cancelled) setReviewsHint("تعذّر جلب تقييمات جوجل.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, locationId, query]);

  const fetchCompetitors = async () => {
    const data = await postJson("competitors");
    setCompetitors(data.competitors || []);
    setOwnListing(data.own || null);
    setCompetitorSource(data.source || "");
    setCompetitorQuery(data.query || "");
    onToast(
      data.source === "gemini_simulation"
        ? "نتائج تقديرية — ليست من خرائط جوجل مباشرة"
        : "تم جلب المنافسين من خرائط جوجل",
      "success"
    );
  };

  const openStaging = async () => {
    const data = await postJson("preview-sync-nap", { includeName });
    setReport(data.report);
    setSkipped(Array.isArray(data.skipped) ? data.skipped : []);
    setConfirmNameSend(false);
    setStaging({
      report: data.report,
      updated: Array.isArray(data.updated) ? data.updated : [],
      skipped: Array.isArray(data.skipped) ? data.skipped : [],
      canWrite: Boolean(data.canWrite),
    });
  };

  const applyStaging = async () => {
    if (!staging) return;
    if (!staging.canWrite) {
      onToast("الكتابة إلى جوجل تحتاج فرعاً محفوظاً بعد فتح حصّة Business Information API.", "error");
      setStaging(null);
      return;
    }
    const nameQueued = staging.updated.some((item) => item.field === "name");
    if (nameQueued && !confirmNameSend) {
      onToast("أكّد أن اسم المنشأة مطابق للترخيص قبل إرساله إلى جوجل.", "error");
      return;
    }
    const data = await postJson("sync-nap", { includeName });
    setReport(data.report);
    setSkipped(Array.isArray(data.skipped) ? data.skipped : []);
    if (data.proof) setProof(data.proof);
    setStaging(null);
    const nameHeld = (data.skipped || []).some((item: { reason?: string }) => item.reason === "name_protected");
    onToast(
      nameHeld
        ? `${data.message || "تمت المزامنة"} — اسم المنشأة لم يُحدَّث حمايةً للحساب.`
        : data.message || "تمت المزامنة",
      "success"
    );
  };

  const writeHint = canWrite
    ? "الكتابة إلى جوجل متاحة لهذا الفرع: الهاتف والموقع وساعات الأحد–السبت بما فيها الجمعة. العنوان يدوي. لا نعد بترتيب الخرائط."
    : mapsBound
      ? "القراءة عبر رابط الخرائط مفعّلة. إن بقيت حصّة بيزنس 0 استخدم قائمة التحقق أدناه ثم لقطتي قبل/بعد."
      : "الصق رابط الخرائط أو اربط فرعاً لبدء الفحص.";

  const nameQueued = Boolean(staging?.updated.some((item) => item.field === "name"));
  const matrixRows = ownListing ? [ownListing, ...competitors] : competitors;

  return (
    <div className="space-y-4 pt-3 border-t border-slate-800">
      <div className="p-3 rounded-2xl border border-slate-700 bg-slate-950/60 space-y-1">
        <p className="text-[11px] font-bold text-slate-200">صلاحيات الربط</p>
        <p className="text-[11px] leading-relaxed text-slate-400">{writeHint}</p>
        <p className="text-[11px] text-slate-500">
          قراءة: فحص NAP، المنافسون، الاستيراد إلى مكّن. كتابة: مزامنة NAP (هاتف/موقع/جمعة)، الخدمات، نشر المنشور.
        </p>
      </div>

      <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 space-y-2">
        <p className="text-[11px] font-bold text-amber-100">قائمة تحقق المشغّل — حصّة بيزنس 0</p>
        <p className="text-[11px] leading-relaxed text-slate-400">
          حتى تُفتح حصّة Business Information لا تُرسل ساعات الجمعة تلقائياً. صحّح الملف في تطبيق جوجل بيزنس ثم احفظ
          لقطتين. الهدف تطابق NAP ≥ {NAP_ACCEPTANCE_PERCENT}%. هذه الخطوة لا تضمن ظهوراً في الثلاثي المحلي.
        </p>
        <ol className="text-[11px] text-slate-300 space-y-1 list-decimal pr-4">
          <li>احفظ لقطة قبل التعديل.</li>
          <li>حدّث الهاتف والموقع وساعات كل الأيام بما فيها الجمعة (رمضان يدوياً).</li>
          <li>انتظر نحو 5 دقائق ثم احفظ لقطة بعد.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canAudit}
            onClick={() =>
              run(async () => {
                const data = await postJson("save-operator-proof", { phase: "before" });
                if (data.proof) setProof(data.proof);
                if (data.report) setReport(data.report);
                onToast(data.message || "حُفظت لقطة قبل", "success");
              })
            }
            className="px-3 py-2 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
          >
            لقطة قبل
          </button>
          <button
            type="button"
            disabled={busy || !canAudit}
            onClick={() =>
              run(async () => {
                const data = await postJson("save-operator-proof", { phase: "after" });
                if (data.proof) setProof(data.proof);
                if (data.report) setReport(data.report);
                onToast(data.message || "حُفظت لقطة بعد", "success");
              })
            }
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            لقطة بعد
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <p className="text-slate-400">
            قبل:{" "}
            <span className="text-slate-200 font-bold">
              {proof?.before ? `${proof.before.scorePercent}% — ${formatProofAt(proof.before.at)}` : "لا لقطة"}
            </span>
          </p>
          <p className="text-slate-400">
            بعد:{" "}
            <span className="text-slate-200 font-bold">
              {proof?.after ? `${proof.after.scorePercent}% — ${formatProofAt(proof.after.at)}` : "لا لقطة"}
            </span>
          </p>
        </div>
        {quotaBlocked ? (
          <p className="text-[11px] text-amber-200">الحصّة ما زالت مغلقة على مستوى المنصة — أبقِ الربط ورابط الخرائط.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !canAudit}
          onClick={() =>
            run(async () => {
              try {
                const data = await postJson("nap-audit");
                setReport(data.report);
                setSkipped([]);
                setAuditError("");
                onToast("تم فحص NAP", "success");
              } catch (err) {
                setReport(null);
                setAuditError(err instanceof Error ? err.message : "تعذّر فحص NAP");
                throw err;
              }
            })
          }
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
        >
          فحص NAP
        </button>
        <button
          type="button"
          disabled={busy || !canAudit}
          onClick={() => run(openStaging)}
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
          disabled={busy || !canAudit}
          onClick={() => run(fetchCompetitors)}
          className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
        >
          جلب المنافسين
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!canWrite) {
              onToast("مزامنة الخدمات تحتاج فرعاً من حساب بيزنس بعد فتح الحصّة.", "error");
              return;
            }
            setShowServices((open) => !open);
          }}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
        >
          مزامنة الخدمات إلى جوجل
        </button>
      </div>

      {staging ? (
        <div
          className="p-3 rounded-2xl border border-sky-500/40 bg-sky-950/30 space-y-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nap-staging-title"
        >
          <p id="nap-staging-title" className="text-xs font-bold text-sky-100">
            مراجعة المزامنة قبل الإرسال
          </p>
          {staging.canWrite ? (
            <p className="text-[11px] text-slate-400">
              لن يُرسل شيء إلى جوجل حتى تعتمد الحقول. اسم المنشأة يبقى خارجاً ما لم يكن محدّداً أدناه.
            </p>
          ) : (
            <p className="text-[11px] text-amber-200">
              هذه معاينة فقط. لا يوجد فرع قابل للكتابة — أكمل طلب الحصّة ثم اجلب الفروع قبل الإرسال.
            </p>
          )}
          {staging.updated.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-right">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2">سيُرسل</th>
                    <th className="p-2">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {staging.updated.map((item) => (
                    <tr key={item.field} className="border-t border-slate-800 text-slate-200">
                      <td className="p-2">{item.label}</td>
                      <td className="p-2 text-slate-400" dir={item.field === "website" || item.field === "phone" ? "ltr" : undefined}>
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">لا توجد حقول ستُرسل — البيانات متطابقة أو غير قابلة للمزامنة التلقائية.</p>
          )}
          {staging.skipped.length ? (
            <ul className="text-[11px] text-slate-400 space-y-0.5">
              {staging.skipped.map((item) => (
                <li key={`${item.field}-${item.reason}`}>
                  {item.label}: {napSkipReasonLabel(item.reason)}
                </li>
              ))}
            </ul>
          ) : null}
          {nameQueued ? (
            <label className="flex items-start gap-2 p-2 rounded-xl border border-rose-500/40 bg-rose-950/40 text-[11px] text-rose-100">
              <input
                type="checkbox"
                checked={confirmNameSend}
                onChange={(e) => setConfirmNameSend(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>أؤكد أن الاسم مطابق للسجل التجاري أو رخصة البلدية، وأتحمل خطر تعليق الصفحة على الخرائط.</span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStaging(null)}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              إلغاء
            </button>
            {staging.canWrite ? (
              <button
                type="button"
                disabled={busy || (nameQueued && !confirmNameSend)}
                onClick={() => run(applyStaging)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
              >
                اعتماد وإرسال
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStaging(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
              >
                فهمت — بانتظار الحصّة
              </button>
            )}
          </div>
        </div>
      ) : null}

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
            disabled={busy || !canWrite || !selectedServiceIds.length}
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-slate-100">
              تطابق NAP {report.summary.scorePercent}% — {napOverallLabel(report.summary.overall)}
            </p>
            <p className="text-[11px] text-slate-500">
              {report.summary.matched}/{report.summary.total} متطابق · {report.summary.mismatches} اختلاف ·{" "}
              {report.summary.missing} ناقص
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2">الحقل</th>
                  <th className="p-2">مكّن</th>
                  <th className="p-2">جوجل</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800 align-top">
                    <td className="p-2 text-slate-300">{item.label}</td>
                    <td className="p-2 text-slate-400">{item.siteValue}</td>
                    <td className="p-2 text-slate-400">{item.gbpValue}</td>
                    <td className={`p-2 font-bold ${napClass(item.status)}`}>{napLabel(item.status)}</td>
                    <td className="p-2 text-[11px] text-slate-500">{item.hint}</td>
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
      ) : auditError ? (
        <p className="text-[11px] font-bold text-amber-300">{auditError}</p>
      ) : canAudit ? (
        <p className="text-[11px] text-slate-500">جاري فحص NAP…</p>
      ) : null}

      {matrixRows.length ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-slate-200">مصفوفة المنافسين المحليين</p>
            <Link
              href={`/admin/ads/local-seo/competitors${query}` as Route}
              className="text-[11px] font-bold text-sky-300 hover:text-sky-200"
            >
              قائمة الفحوصات
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            {competitorSource === "google_places"
              ? "المصدر: خرائط جوجل"
              : "المصدر: تقدير تقريبي — ليست بيانات خرائط مباشرة"}
            {competitorQuery ? ` — البحث: ${competitorQuery}` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-500">
                  <th className="p-2">المنشأة</th>
                  <th className="p-2">التقييم</th>
                  <th className="p-2">عدد الآراء</th>
                  <th className="p-2">مقابل منشأتك</th>
                  <th className="p-2">الخرائط</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, index) => {
                  const isOwn = Boolean(ownListing && index === 0);
                  return (
                    <tr
                      key={`${row.placeId || row.name}-${row.address}`}
                      className={`border-t border-slate-800 ${isOwn ? "bg-emerald-950/30" : ""}`}
                    >
                      <td className="p-2 text-slate-200">
                        {row.name}
                        {isOwn ? <span className="block text-[10px] text-emerald-300">منشأتك</span> : null}
                      </td>
                      <td className="p-2 text-slate-300">{row.rating ? row.rating.toFixed(1) : "—"}</td>
                      <td className="p-2 text-slate-400">{row.userRatingsTotal || "—"}</td>
                      <td className="p-2 text-slate-400">
                        {isOwn ? "المرجع" : ratingDelta(ownListing?.rating || 0, row.rating)}
                      </td>
                      <td className="p-2">
                        {row.mapsUrl ? (
                          <a
                            href={row.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-sky-300 hover:text-sky-200"
                          >
                            فتح
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {geoScan ? (
        <div className="space-y-2 p-3 rounded-2xl border border-slate-800 bg-slate-950/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-slate-200">آخر لقطة Geo-Grid</p>
            <Link
              href={`/admin/ads/geo-grid${query}` as Route}
              className="text-[11px] font-bold text-sky-300 hover:text-sky-200"
            >
              فتح تتبع الرانك
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            {geoScan.keyword || "بدون كلمة"} · شبكة {geoScan.gridSize} · متوسط الرانك {geoScan.averageRank ?? "—"} · ظهور
            الحزمة الثلاثية {geoScan.top3Percentage != null ? `${geoScan.top3Percentage}%` : "—"}
            {" · DataForSEO"}
          </p>
          {geoScan.cells?.length ? (
            <div
              className="grid gap-1 max-w-xs"
              style={{
                gridTemplateColumns: `repeat(${geoScan.gridSize === "7x7" ? 7 : geoScan.gridSize === "5x5" ? 5 : 3}, minmax(0, 1fr))`,
              }}
            >
              {geoScan.cells.map((cell, index) => (
                <div
                  key={`${geoScan.keyword}-${index}`}
                  className={`rounded-md py-1.5 text-center text-[10px] font-extrabold ${geoCellClass(cell.rank)}`}
                >
                  {cell.rank ?? "—"}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">لا توجد شبكة محفوظة بعد. شغّل فحصاً من تتبع الرانك.</p>
          )}
        </div>
      ) : canAudit ? (
        <p className="text-[11px] text-slate-500">
          لا توجد لقطة رانك بعد.{" "}
          <Link href={`/admin/ads/geo-grid${query}` as Route} className="font-bold text-sky-300">
            افتح تتبع الرانك
          </Link>
        </p>
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
                  setPostCtaUrl(typeof data.ctaUrl === "string" ? data.ctaUrl : "");
                  setPostCtaLabel(typeof data.ctaLabel === "string" && data.ctaLabel ? data.ctaLabel : "احجز");
                  setPostCity(typeof data.city === "string" ? data.city : "");
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
            {postCtaUrl || withPostUtm(websiteUrl || "", serviceName) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const url = postCtaUrl || withPostUtm(websiteUrl || "", serviceName);
                  void navigator.clipboard.writeText(url);
                  onToast("تم نسخ رابط UTM", "success");
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
              >
                نسخ UTM
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || !postText}
              onClick={() =>
                run(async () => {
                  if (!canWrite) {
                    throw new Error("النشر على جوجل يحتاج فرعاً محفوظاً بعد فتح الحصّة. يمكنك نسخ النص الآن.");
                  }
                  await postJson("publish-post", { text: postText, serviceName });
                  onToast("نُشر المنشور على جوجل بيزنس", "success");
                })
              }
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
            >
              نشر على جوجل
            </button>
          </div>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={postText ? 5 : 3}
            placeholder="أو اكتب نص المنشور يدوياً لمعاينة البطاقة…"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
          />
          {postText ? (
            <GbpPostPreview
              text={postText}
              ctaLabel={postCtaLabel}
              ctaUrl={postCtaUrl || withPostUtm(websiteUrl || "", serviceName)}
              city={postCity}
              serviceName={serviceName}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">رد على تقييم خرائط جوجل</label>
          <p className="text-[11px] leading-relaxed text-slate-400">
            التوليد مسودة فقط. النشر عبر Reviews API يكتب الرد على الملف. لا نعد بتحسّن النجوم أو الترتيب.
          </p>
          {reviewsHint ? <p className="text-[11px] text-amber-200/90">{reviewsHint}</p> : null}
          {gbpReviews.length ? (
            <select
              value={selectedReviewName}
              onChange={(e) => {
                const name = e.target.value;
                setSelectedReviewName(name);
                const row = gbpReviews.find((item) => item.name === name);
                if (!row) return;
                setReviewText(row.comment);
                setRating(String(row.starRating || 5));
                setReplyText(row.reply || "");
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
            >
              <option value="">اختر تقييماً من جوجل</option>
              {gbpReviews.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.starRating || "—"}★ {row.reviewerName}
                  {row.reply ? " — تم الرد" : " — بلا رد"}
                </option>
              ))}
            </select>
          ) : null}
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
            placeholder="نص تقييم العميل من جوجل أو للصق مسودة…"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await postJson("generate-reply", { reviewText, rating });
                  setReplyText(data.text || "");
                  onToast("مسودة جاهزة — لم تُنشر بعد", "success");
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
                run(async () => {
                  await navigator.clipboard.writeText(replyText);
                  onToast("نُسخ الرد. الصقه في تطبيق بيزنس إن كانت الحصّة مغلقة.", "success");
                })
              }
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              نسخ
            </button>
            <button
              type="button"
              disabled={busy || !canWrite || reviewsQuota || !selectedReviewName || !replyText}
              onClick={() =>
                run(async () => {
                  const data = await postJson("publish-review-reply", {
                    reviewName: selectedReviewName,
                    comment: replyText,
                  });
                  onToast(data.message || "نُشر الرد على جوجل", "success");
                  await loadGbpReviews();
                })
              }
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
            >
              نشر على جوجل
            </button>
          </div>
          {replyText ? (
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
