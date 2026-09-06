"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2, Users } from "lucide-react";
import { useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";

type Competitor = {
  name: string;
  rating: number;
  userRatingsTotal: number;
  address?: string;
  mapsUrl?: string;
};

type Audit = {
  id: string;
  category: string;
  city: string;
  competitors: Competitor[];
  own: Competitor | null;
  source: string;
  query: string;
  auditedAt: string;
};

type RankScan = {
  id: string;
  keyword: string;
  gridSize: string;
  averageRank: number | null;
  top3Percentage: number | null;
  scannedAt?: string;
};

export default function LocalCompetitorsPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const { showToast } = useApp();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [scans, setScans] = useState<RankScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const [auditRes, geoRes] = await Promise.all([
        fetch(`/api/google-business?action=competitor-audits${query ? `&${query.slice(1)}` : ""}`),
        fetch(`/api/ads/geo-grid${query}`),
      ]);
      const auditData = await auditRes.json();
      const geoData = await geoRes.json();
      if (!auditRes.ok || !auditData.success) {
        setError(auditData.message || "تعذّر تحميل قائمة المنافسين");
        setAudits([]);
      } else {
        setError("");
        setAudits(auditData.audits || []);
      }
      setScans(geoRes.ok && geoData.success ? geoData.scans || [] : []);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "competitors" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر جلب المنافسين", "error");
        return;
      }
      showToast("حُفظت لقطة المنافسين في الجدول القائم", "success");
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">قائمة المنافسين والرانك</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              تُحفظ لقطات Places في <span dir="ltr">mken_competitor_audits</span> بمفتاح{" "}
              <span dir="ltr">tenant_slug</span>. شبكة الرانك من{" "}
              <span dir="ltr">mken_local_rank_scans</span> — بلا جدول دراسة جديد وبلا{" "}
              <span dir="ltr">tenants(id)</span>.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={refreshing || loading || !tenant}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 px-4 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          جلب وحفظ لقطة
        </button>
      </section>

      {loading ? (
        <div className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : audits.length === 0 ? (
        <p className="text-sm text-slate-400">لا لقطات محفوظة بعد. اضغط جلب وحفظ لقطة.</p>
      ) : (
        audits.map((audit) => (
          <article key={audit.id} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <p className="text-sm font-extrabold text-white">
              {audit.city || "بدون مدينة"} · {audit.category || "نشاط"}
            </p>
            <p className="text-[11px] text-slate-500">
              {audit.auditedAt ? new Date(audit.auditedAt).toLocaleString("ar-SA") : ""}
              {audit.source === "google_places" ? " · خرائط جوجل" : audit.source ? " · تقدير تقريبي" : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2">المنشأة</th>
                    <th className="p-2">التقييم</th>
                    <th className="p-2">عدد التقييمات</th>
                    <th className="p-2">الخريطة</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit.own ? [audit.own, ...audit.competitors] : audit.competitors).map((row, index) => (
                    <tr key={`${audit.id}-${row.placeId || row.name}-${index}`} className="border-t border-slate-800">
                      <td className="p-2 text-slate-200">
                        {row.name}
                        {audit.own && index === 0 ? (
                          <span className="block text-[10px] text-emerald-300">منشأتك</span>
                        ) : null}
                      </td>
                      <td className="p-2 text-slate-300">{row.rating ? row.rating.toFixed(1) : "—"}</td>
                      <td className="p-2 text-slate-400">{row.userRatingsTotal || "—"}</td>
                      <td className="p-2">
                        {row.mapsUrl ? (
                          <a href={row.mapsUrl} target="_blank" rel="noreferrer" className="text-sky-300 font-bold">
                            فتح
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))
      )}

      <section className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-extrabold text-white">فحوصات Geo-Grid المحفوظة</p>
          <Link href={`/admin/ads/geo-grid${query}` as Route} className="text-[11px] font-bold text-sky-300">
            فتح تتبع الرانك
          </Link>
        </div>
        {scans.length === 0 ? (
          <p className="text-xs text-slate-500">لا فحوصات رانك بعد على الجدول القائم.</p>
        ) : (
          <ul className="text-xs text-slate-300 space-y-1">
            {scans.map((scan) => (
              <li key={scan.id}>
                {scan.keyword} · {scan.gridSize} · متوسط {scan.averageRank ?? "—"} · الحزمة الثلاثية{" "}
                {scan.top3Percentage != null ? `${scan.top3Percentage}%` : "—"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
