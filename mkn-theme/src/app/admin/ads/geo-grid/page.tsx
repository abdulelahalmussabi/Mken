"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";

type GridSize = "3x3" | "5x5" | "7x7";
type GridCell = { lat: number; lng: number; rank: number | null; inPack: boolean };
type RankScan = {
  id: string;
  keyword: string;
  gridSize: GridSize;
  averageRank: number | null;
  top3Percentage: number | null;
  cells: GridCell[];
  cached?: boolean;
};
type GeoCredits = {
  remaining: number;
  limit: number;
  allowedSizes: GridSize[];
};

function cellClass(cell: GridCell): string {
  if (cell.rank == null) return "bg-slate-800 text-slate-500";
  if (cell.rank <= 3) return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
  if (cell.rank <= 10) return "bg-amber-500/20 text-amber-200 border-amber-400/40";
  return "bg-rose-500/20 text-rose-200 border-rose-400/40";
}

export default function GeoGridPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const { showToast } = useApp();
  const [credits, setCredits] = useState<GeoCredits | null>(null);
  const [scans, setScans] = useState<RankScan[]>([]);
  const [scan, setScan] = useState<RankScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState<GridSize>("3x3");
  const [radiusKm, setRadiusKm] = useState(5);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ads/geo-grid${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الرانك");
      } else {
        setError("");
        setCredits(data.credits);
        setScans(data.scans || []);
        setScan((data.scans || [])[0] || null);
        setReady(Boolean(data.dataforseoReady));
        const allowed = (data.credits?.allowedSizes || ["3x3"]) as GridSize[];
        if (!allowed.includes(gridSize)) setGridSize(allowed[0] || "3x3");
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/ads/geo-grid${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, gridSize, radiusKm }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الفحص", "error");
        if (data.credits) setCredits(data.credits);
        return;
      }
      setScan(data.scan);
      setCredits(data.credits);
      setScans((prev) => [data.scan, ...prev.filter((item) => item.id !== data.scan.id)]);
      showToast(data.scan.cached ? "نتيجة محفوظة اليوم (بدون خصم رصيد)" : "اكتمل فحص الشبكة", "success");
    } finally {
      setRunning(false);
    }
  };

  const dim = scan?.gridSize === "7x7" ? 7 : scan?.gridSize === "5x5" ? 5 : 3;

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-start gap-3">
          <MapPinned className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">تتبع الرانك الجغرافي (Geo-Grid)</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              يحاكي البحث من نقاط حول الفرع عبر DataForSEO. الأرصدة حسب الباقة: أساسي 2 / متقدم 8 / احترافي 40 فحصاً شهرياً.
              3×3 = رصيد واحد، 5×5 = 2، 7×7 = 4. نفس الكلمة في نفس اليوم تُجلب من الكاش.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 py-3">
            <p className="text-[10px] text-slate-500">المتبقي</p>
            <p className="text-lg font-extrabold text-white">{credits ? `${credits.remaining}/${credits.limit}` : "—"}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 py-3">
            <p className="text-[10px] text-slate-500">متوسط الرانك</p>
            <p className="text-lg font-extrabold text-amber-300">{scan?.averageRank ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 py-3">
            <p className="text-[10px] text-slate-500">ظهور 3-Pack</p>
            <p className="text-lg font-extrabold text-emerald-300">{scan?.top3Percentage != null ? `${scan.top3Percentage}%` : "—"}</p>
          </div>
        </div>

        {!ready && (
          <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            DATAFORSEO_LOGIN و DATAFORSEO_PASSWORD غير معيّنين — الفحص الحي متوقف حتى إضافتهما على Vercel.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={ADMIN_INPUT} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="كلمة البحث مثل: صالون حلاقة الروضة" />
          <select className={ADMIN_INPUT} value={gridSize} onChange={(e) => setGridSize(e.target.value as GridSize)}>
            {(credits?.allowedSizes || ["3x3"]).map((size) => (
              <option key={size} value={size}>
                شبكة {size}
              </option>
            ))}
          </select>
          <select className={ADMIN_INPUT} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
            {[5, 8, 10, 15].map((km) => (
              <option key={km} value={km}>
                نصف قطر {km} كم
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={running || loading || !keyword.trim()}
          onClick={run}
          className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPinned className="w-4 h-4" />}
          {running ? "جاري الفحص..." : "فحص الشبكة"}
        </button>
      </section>

      {error ? <p className="text-sm text-rose-300 font-bold">{error}</p> : null}

      {scan?.cells?.length ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }}
        >
          {scan.cells.map((cell, index) => (
            <div key={`${cell.lat}-${index}`} className={`rounded-xl border px-2 py-4 text-center text-sm font-extrabold ${cellClass(cell)}`}>
              {cell.rank ?? "—"}
            </div>
          ))}
        </div>
      ) : null}

      {scans.length > 1 ? (
        <p className="text-[11px] text-slate-500">آخر الفحوصات: {scans.slice(0, 5).map((item) => item.keyword).join(" · ")}</p>
      ) : null}
    </div>
  );
}
