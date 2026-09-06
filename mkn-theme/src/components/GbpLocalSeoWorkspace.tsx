"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import GbpSeoPanel from "@/components/GbpSeoPanel";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import type { GbpLocation } from "@/lib/mken/gbp";

export default function GbpLocalSeoWorkspace() {
  const { tenant, query, isSuperAdmin, authLoading } = useAdminTenant();
  const { session } = useAdmin();
  const { showToast } = useApp();
  const [brandName, setBrandName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [gbpBusy, setGbpBusy] = useState(false);
  const [gbpLocations, setGbpLocations] = useState<GbpLocation[]>([]);
  const [gbpLocationId, setGbpLocationId] = useState("");
  const [gbpLocationError, setGbpLocationError] = useState("");
  const [mapsUrlInput, setMapsUrlInput] = useState("");
  const [mapsBound, setMapsBound] = useState(false);
  const [mapsAuditGen, setMapsAuditGen] = useState(0);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [gbpRes, settingsRes, domainRes] = await Promise.all([
        fetch(`/api/google-business${query}`),
        fetch(`/api/settings${query}`),
        fetch(`/api/admin/domains${query}`),
      ]);
      const gbp = await gbpRes.json();
      const connected = Boolean(gbpRes.ok && gbp.success && gbp.connected);
      setGbpConnected(connected);
      setGbpLocations(Array.isArray(gbp.locations) ? gbp.locations : []);
      setGbpLocationId(gbp.selectedLocationId || "");
      setMapsUrlInput(typeof gbp.mapsUrl === "string" ? gbp.mapsUrl : "");
      setMapsBound(Boolean(gbp.mapsUrl || gbp.mapsPlaceId));
      if (!connected) {
        setGbpLocationError("");
      } else if (gbp.locations?.length) {
        setGbpLocationError("");
      } else if (!gbp.selectedLocationId) {
        setGbpLocationError("اضغط «جلب الفروع» مرة واحدة لاختيار صفحة الخرائط.");
      } else {
        setGbpLocationError("");
      }

      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.success) {
        setBrandName(settingsData.settings?.brand?.name || tenant);
      } else {
        setBrandName(tenant);
      }

      const domainData = await domainRes.json();
      const activeHost =
        domainRes.ok && domainData.success
          ? (domainData.domains || []).find((row: { status?: string; hostname?: string }) => row.status === "active")
              ?.hostname
          : "";
      setSiteUrl(activeHost ? `https://${activeHost}/` : `https://${tenant}.mken.live/`);
    } catch {
      setBrandName(tenant);
      setSiteUrl(tenant ? `https://${tenant}.mken.live/` : "");
    } finally {
      setLoading(false);
    }
  }, [authLoading, tenant, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_connect");
    if (!status) return;
    if (status === "success") {
      showToast("تم الربط. انتظر دقيقة إن لزم ثم اضغط «جلب الفروع» — لا تلغِ الربط.", "success");
      setGbpConnected(true);
      void load();
    } else {
      showToast(`فشل ربط حساب جوجل: ${params.get("error_desc") || "خطأ غير معروف"}`, "error");
    }
    params.delete("google_connect");
    params.delete("error_desc");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [load, showToast]);

  const connectGbp = async () => {
    const slug = (
      isSuperAdmin
        ? new URLSearchParams(window.location.search).get("client") || ""
        : session?.clientSlug || ""
    )
      .trim()
      .toLowerCase();
    if (!slug) {
      showToast("اختر المنشأة من القائمة أولاً. الربط يتبع ?client= في الرابط فقط.", "error");
      return;
    }
    const label = brandName || slug;
    if (
      !window.confirm(
        `سيتم ربط Google Business بهذه المنشأة فقط:\n${label}\n(${slug})\n\nإذا كنت تقصد منشأة أخرى، اضغط إلغاء ثم اخترها من القائمة.`
      )
    ) {
      return;
    }
    setGbpBusy(true);
    try {
      const res = await fetch(`/api/google-business?action=auth-url&client=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        showToast(data.message || "تعذّر توليد رابط الربط", "error");
        return;
      }
      if (data.tenant && data.tenant !== slug) {
        showToast(`رُفض الربط: الخادم جهّز ${data.tenant} بينما الصفحة ${slug}`, "error");
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGbpBusy(false);
    }
  };

  const disconnectGbp = async () => {
    if (!window.confirm("إلغاء ربط Google Business لهذه المنشأة؟")) return;
    setGbpBusy(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إلغاء الربط", "error");
        return;
      }
      setGbpConnected(false);
      setGbpLocations([]);
      setGbpLocationId("");
      showToast("تم إلغاء ربط حساب جوجل", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGbpBusy(false);
    }
  };

  const loadGbpLocations = async (refresh = false) => {
    if (!tenant) return;
    setGbpBusy(true);
    try {
      const locQuery = new URLSearchParams();
      if (isSuperAdmin && tenant) locQuery.set("client", tenant);
      locQuery.set("action", "locations");
      if (refresh) locQuery.set("refresh", "1");
      const locRes = await fetch(`/api/google-business?${locQuery}`);
      const loc = await locRes.json();
      if (locRes.ok && loc.success) {
        setGbpLocations(loc.locations || []);
        if (loc.selectedLocationId) setGbpLocationId(loc.selectedLocationId);
        const message = loc.locations?.length ? "" : loc.message || "لا توجد فروع في الحساب";
        setGbpLocationError(message);
        if (loc.locations?.length) showToast("تم جلب الفروع", "success");
        else if (loc.message) showToast(loc.message, "error");
      } else {
        setGbpLocations([]);
        setGbpLocationError(loc.message || "تعذّر جلب فروع جوجل");
        showToast(loc.message || "تعذّر جلب فروع جوجل", "error");
      }
    } catch {
      setGbpLocationError("تعذّر الاتصال بالخادم");
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGbpBusy(false);
    }
  };

  const saveGbpLocation = async (syncWebsite: boolean) => {
    if (!gbpLocationId) {
      showToast("اختر فرعاً أولاً", "error");
      return;
    }
    setGbpBusy(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select-location",
          locationId: gbpLocationId,
          syncWebsite,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حفظ الفرع", "error");
        return;
      }
      showToast(syncWebsite ? "تم حفظ الفرع ومزامنة رابط الموقع" : "تم حفظ الفرع", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGbpBusy(false);
    }
  };

  const bindMapsUrl = async () => {
    if (!mapsUrlInput.trim()) {
      showToast("الصق رابط خرائط جوجل أولاً", "error");
      return;
    }
    setGbpBusy(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bind-maps-url", mapsUrl: mapsUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حفظ رابط الخرائط", "error");
        return;
      }
      setMapsBound(true);
      setMapsAuditGen((n) => n + 1);
      showToast(data.message || "تم حفظ رابط الخرائط", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGbpBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="h-40 rounded-3xl bg-slate-900/80 border border-slate-800 animate-pulse" />;
  }

  if (!tenant) {
    return <p className="text-sm text-amber-300 font-bold">اختر المنشأة أولاً لفتح التواجد المحلي.</p>;
  }

  return (
    <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
      <h1 className="text-lg font-extrabold text-white flex items-center gap-2 justify-end">
        التواجد المحلي وخرائط جوجل
        <Link2 className="w-5 h-5 text-amber-400" />
      </h1>
      <p className="text-xs font-bold text-amber-300">
        الربط الحالي للمنشأة: {brandName} ({tenant})
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {gbpConnected ? (
            <button
              type="button"
              onClick={() => void disconnectGbp()}
              disabled={gbpBusy}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-rose-900/50 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
            >
              إلغاء الربط
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectGbp()}
              disabled={gbpBusy || !tenant}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {gbpBusy ? "جاري التحضير…" : "ربط حساب جوجل"}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {gbpConnected
            ? "اختر الفرع ثم افحص NAP أو ولّد منشوراً. المدينة والساعات تُقرأ من إعدادات المنشأة."
            : "ابدأ الربط هنا. اكتمال OAuth يعود إلى هذه الصفحة."}
        </p>
      </div>
      {gbpConnected ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">فرع جوجل</label>
            <select
              value={gbpLocationId}
              onChange={(e) => setGbpLocationId(e.target.value)}
              disabled={gbpBusy || (gbpLocations.length === 0 && !gbpLocationId)}
              className={ADMIN_INPUT}
            >
              <option value="">
                {gbpLocations.length
                  ? "اختر فرعاً"
                  : gbpLocationError
                    ? "تعذّر جلب الفروع الآن"
                    : "لا توجد فروع — اضغط جلب الفروع"}
              </option>
              {gbpLocationId && !gbpLocations.some((loc) => loc.id === gbpLocationId) ? (
                <option value={gbpLocationId}>الفرع المحفوظ — اضغط جلب الفروع لعرض الاسم</option>
              ) : null}
              {gbpLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.title}
                  {loc.city ? ` — ${loc.city}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadGbpLocations(true)}
              disabled={gbpBusy}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              {gbpBusy ? "جاري الجلب…" : "جلب الفروع"}
            </button>
            {gbpLocationError ? (
              <p className="text-[11px] text-amber-400 font-bold">{gbpLocationError}</p>
            ) : null}
            {/صلاحية ربط جوجل انتهت|GOOGLE_CLIENT_SECRET|سر عميل جوجل/.test(gbpLocationError) ? (
              <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-2 text-[11px] text-rose-100 leading-relaxed">
                <p className="font-bold">الفروع لا تظهر لأن توكن جوجل لم يعد صالحاً — ليست مشكلة قائمة الفروع.</p>
                <p>اضغط «إلغاء الربط» ثم «ربط حساب جوجل» بحساب مدير ملف المحروسة، ووافق على كل الصلاحيات.</p>
              </div>
            ) : null}
            {/حصّة 0|صفراً|حد طلبات جوجل|Basic API Access/.test(gbpLocationError) ? (
              <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-2 text-[11px] text-amber-100 leading-relaxed">
                <p className="font-bold">هذا قرار جوجل على المشروع، ليس خطأ ربط المحروسة.</p>
                <p dir="ltr">Project number: 529822765960</p>
                <ol className="list-decimal pr-4 space-y-1">
                  <li>افتح النموذج وسجّل بحساب مالك/مدير ملف المحروسة على الخرائط (موثّق منذ أكثر من 60 يوماً).</li>
                  <li>
                    من القائمة اختر{" "}
                    <span dir="ltr" className="font-bold">
                      Application for Basic API Access
                    </span>
                    .
                  </li>
                  <li>أدخل رقم المشروع أعلاه، وموقع المنشأة كما هو مكتوب في ملف جوجل.</li>
                  <li>بعد الموافقة تفتح الحصّة إلى 300. راقبها من Cloud Console → Quotas. ثم اضغط جلب الفروع مرة واحدة.</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://support.google.com/business/contact/api_default"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold"
                  >
                    فتح نموذج طلب الوصول
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://console.cloud.google.com/apis/api/mybusinessbusinessinformation.googleapis.com/quotas?project=529822765960"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-500/40 font-bold"
                  >
                    فحص الحصّة
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
          {gbpLocations.length === 0 ? (
            <div className="p-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 space-y-2">
              <p className="text-xs font-bold text-sky-100">لا توجد فروع يمكن لمكّن قراءتها تلقائياً</p>
              <p className="text-[11px] text-sky-100/80 leading-relaxed">
                الصق رابط صفحة المنشأة على خرائط جوجل. بعدها يعمل فحص NAP وجلب المنافسين فوراً. مزامنة الخدمات إلى جوجل ما
                زالت تحتاج فرعاً من حساب بيزنس.
              </p>
              <input
                value={mapsUrlInput}
                onChange={(e) => setMapsUrlInput(e.target.value)}
                placeholder="https://maps.app.goo.gl/… أو place_id"
                dir="ltr"
                className={ADMIN_INPUT}
              />
              <button
                type="button"
                onClick={() => void bindMapsUrl()}
                disabled={gbpBusy || !mapsUrlInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                {gbpBusy ? "جاري الحفظ…" : "حفظ رابط الخرائط"}
              </button>
              {mapsBound ? (
                <p className="text-[11px] font-bold text-emerald-300">تم الربط عبر الخرائط — يمكنك فحص NAP الآن.</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-[11px] text-slate-500" dir="ltr">
            الموقع: {siteUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveGbpLocation(false)}
              disabled={gbpBusy || !gbpLocationId}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              حفظ الفرع
            </button>
            <button
              type="button"
              onClick={() => void saveGbpLocation(true)}
              disabled={gbpBusy || !gbpLocationId}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
            >
              حفظ ومزامنة رابط الموقع
            </button>
          </div>
          <GbpSeoPanel
            query={query}
            locationId={gbpLocationId}
            mapsBound={mapsBound}
            auditNonce={mapsAuditGen}
            websiteUrl={siteUrl}
            busy={gbpBusy}
            setBusy={setGbpBusy}
            onToast={showToast}
          />
        </div>
      ) : null}
    </section>
  );
}
