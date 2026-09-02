"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2, Megaphone, Sparkles, Save, PauseCircle, PlayCircle, Rocket, Link2, Unlink } from "lucide-react";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";
import SaasUpgradeNotice from "@/components/SaasUpgradeNotice";

type AdPlatformId = "meta_ctwa" | "google_ads" | "snapchat" | "tiktok";
type AdCreativeVariant = { headline: string; primaryText: string; cta: string; prefilledMessage: string };
type AdCreative = {
  selectedIndex: number;
  variants: AdCreativeVariant[];
  negativeKeywords: string[];
  dialect: "gulf" | "fusha";
  imageDataUrl?: string;
};
type AdCampaign = {
  id: string;
  platform: AdPlatformId;
  campaignName: string;
  status: string;
  dailyBudgetHalalas: number;
  spentHalalas: number;
  radiusKm: number;
  adCreative: AdCreative;
  metrics: { impressions: number; clicks: number; conversations: number; bookings: number };
};

const PLATFORM_LABELS: Record<AdPlatformId, string> = {
  meta_ctwa: "واتساب ميتا (انقر للمحادثة)",
  google_ads: "إعلانات جوجل المحلية",
  snapchat: "سناب شات",
  tiktok: "تيك توك",
};

const LIVE_PLATFORMS: AdPlatformId[] = ["meta_ctwa", "google_ads"];

type GoogleAccount = {
  customerId: string;
  name: string;
  manager?: boolean;
  testAccount?: boolean;
  currency?: string;
  loginCustomerId?: string;
};

const RADII = [5, 8, 10, 15];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "نشطة",
  PAUSED: "متوقفة",
  COMPLETED: "مكتملة",
  FAILED: "فشلت",
};

export default function AdsCampaignsPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const searchParams = useSearchParams();
  const { showToast } = useApp();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [platform, setPlatform] = useState<AdPlatformId>("meta_ctwa");
  const [metaReady, setMetaReady] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [capiReady, setCapiReady] = useState(false);
  const [adsAllowed, setAdsAllowed] = useState(true);
  const [genUsed, setGenUsed] = useState(0);
  const [genLimit, setGenLimit] = useState(12);
  const [intelNote, setIntelNote] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);
  const [googleBlockers, setGoogleBlockers] = useState<string[]>([]);
  const [geoLabel, setGeoLabel] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [googleCustomerId, setGoogleCustomerId] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleName, setGoogleName] = useState("");
  const [pendingAccounts, setPendingAccounts] = useState<GoogleAccount[]>([]);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [error, setError] = useState("");

  const [serviceName, setServiceName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dailyBudgetSar, setDailyBudgetSar] = useState(30);
  const [radiusKm, setRadiusKm] = useState(5);
  const [dialect, setDialect] = useState<"gulf" | "fusha">("gulf");
  const [creative, setCreative] = useState<AdCreative | null>(null);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ads/campaigns${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الحملات");
        setCampaigns([]);
      } else {
        setCampaigns(data.campaigns || []);
        setMetaReady(Boolean(data.metaReady));
        setGoogleReady(Boolean(data.googleReady));
        setCapiReady(Boolean(data.capiReady));
        setAdsAllowed(data.adsAllowed !== false);
        setGenUsed(Number(data.generateCredits?.used) || 0);
        setGenLimit(Number(data.generateCredits?.limit) || 12);
        const intel = data.intel && typeof data.intel === "object" ? data.intel : null;
        setIntelNote(
          intel
            ? `MCS ${intel.mcs}/100 · ${intel.gridNote || ""}${
                Array.isArray(intel.winnerHeadlines) && intel.winnerHeadlines.length
                  ? ` · نسخ رابحة: ${intel.winnerHeadlines.join(" · ")}`
                  : ""
              }`
            : ""
        );
        setBlockers(Array.isArray(data.blockers) ? data.blockers : []);
        setGoogleBlockers(Array.isArray(data.googleBlockers) ? data.googleBlockers : []);
        setAdAccountId(typeof data.adsMeta?.adAccountId === "string" ? data.adsMeta.adAccountId : "");
        setPageId(typeof data.adsMeta?.pageId === "string" ? data.adsMeta.pageId : "");
        setGoogleCustomerId(typeof data.adsGoogle?.customerId === "string" ? data.adsGoogle.customerId : "");
        setGoogleConnected(Boolean(data.adsGoogle?.connected));
        setGoogleName(typeof data.adsGoogle?.descriptiveName === "string" ? data.adsGoogle.descriptiveName : "");
        setPendingAccounts(Array.isArray(data.adsGoogle?.pendingAccounts) ? data.adsGoogle.pendingAccounts : []);
        const geo = data.geo && typeof data.geo === "object" ? data.geo : null;
        setGeoLabel(
          geo && Number.isFinite(Number(geo.lat))
            ? `${geo.city || "الفرع"} · ${Number(geo.lat).toFixed(4)}، ${Number(geo.lng).toFixed(4)}`
            : ""
        );
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

  useEffect(() => {
    const status = searchParams.get("google");
    if (!status) return;
    if (status === "ok") showToast("رُبط حساب إعلانات جوجل. الإنفاق على وسيلة دفع ذلك الحساب.", "success");
    if (status === "pick") showToast("اختر حساب إعلانات المنشأة من القائمة. لا تختر حساب مدير.", "success");
    if (status === "error") showToast(searchParams.get("googleMsg") || "تعذّر ربط حساب جوجل Ads", "error");
  }, [searchParams, showToast]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", serviceName, dialect, platform }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر توليد الإعلان", "error");
        if (data.generateCredits) {
          setGenUsed(Number(data.generateCredits.used) || 0);
          setGenLimit(Number(data.generateCredits.limit) || genLimit);
        }
        return;
      }
      setCreative(data.creative);
      if (data.generateCredits) {
        setGenUsed(Number(data.generateCredits.used) || 0);
        setGenLimit(Number(data.generateCredits.limit) || genLimit);
      }
      if (!campaignName.trim()) {
        setCampaignName(`${serviceName.trim() || "حملة"} — ${PLATFORM_LABELS[platform]}`);
      }
      showToast("تم توليد 3 نصوص إعلانية", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!creative) {
      showToast("ولّد النصوص أولاً", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          platform,
          campaignName,
          objective: platform === "google_ads" ? "LOCAL_LEADS" : "MESSAGES",
          dailyBudgetSar,
          radiusKm,
          serviceName,
          creative,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حفظ المسودة", "error");
        return;
      }
      showToast(
        platform === "google_ads"
          ? "حُفظت الحملة كمسودة. انشرها على جوجل من القائمة أدناه عند جاهزية الحساب."
          : "حُفظت الحملة كمسودة. انشرها على ميتا من القائمة أدناه عند جاهزية التوكن.",
        "success"
      );
      setCreative(null);
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    const target = campaigns.find((item) => item.id === id);
    const res = await fetch(`/api/ads/campaigns${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "تعذّر النشر", "error");
      if (data.campaign) await load();
      return;
    }
    showToast(
      target?.platform === "google_ads" ? "نُشرت الحملة على إعلانات جوجل المحلية" : "نُشرت الحملة على ميتا (انقر للواتساب)",
      "success"
    );
    await load();
  };

  const pause = async (id: string) => {
    const res = await fetch(`/api/ads/campaigns${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "تعذّر الإيقاف", "error");
      return;
    }
    showToast("تم إيقاف الحملة", "success");
    await load();
  };

  const resume = async (id: string) => {
    const res = await fetch(`/api/ads/campaigns${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "تعذّر الاستئناف", "error");
      return;
    }
    showToast("استُؤنفت الحملة", "success");
    await load();
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveMeta", adAccountId, pageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حفظ ربط ميتا", "error");
        return;
      }
      showToast("حُفظ حساب الإعلانات لهذه المنشأة", "success");
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSavingMeta(false);
    }
  };

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}${query ? "&" : "?"}action=googleAuthUrl`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        showToast(data.message || "تعذّر بدء ربط جوجل Ads", "error");
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setConnectingGoogle(false);
    }
  };

  const saveGoogle = async (account?: GoogleAccount) => {
    const customerId = account?.customerId || googleCustomerId;
    setSavingGoogle(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveGoogle",
          customerId,
          loginCustomerId: account?.loginCustomerId || "",
          descriptiveName: account?.name || googleName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حفظ حساب جوجل", "error");
        return;
      }
      showToast("حُفظ حساب إعلانات جوجل لهذه المنشأة. التكاليف على وسيلة دفعه.", "success");
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSavingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    setSavingGoogle(true);
    try {
      const res = await fetch(`/api/ads/campaigns${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnectGoogle" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إلغاء الربط", "error");
        return;
      }
      showToast("أُلغي ربط حساب إعلانات جوجل", "success");
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSavingGoogle(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {!adsAllowed && (
        <SaasUpgradeNotice
          title="حملات الإعلانات المحلية"
          message="توليد الإعلانات والنشر يتطلبان الباقة المتقدمة أو أعلى."
        />
      )}
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
        <div className="flex items-start gap-3">
          <Megaphone className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">إطلاق حملة بضغطة</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              اختر الخدمة والميزانية والنطاق. التوليد يستخدم رانك الخرائط ومؤشر MCS ونصوص الحملات التي جلبت محادثات.
              ميتا: إطار بصري يُرفع عند النشر. جوجل: إعلان بحث محلي بنطاق القرب من الفرع.
            </p>
            {intelNote ? <p className="text-[11px] text-slate-500 mt-2 leading-5">{intelNote}</p> : null}
          </div>
        </div>

        {!(platform === "google_ads" ? googleReady : metaReady) && (
          <div className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 space-y-1">
            {(platform === "google_ads" ? googleBlockers : blockers).length ? (
              (platform === "google_ads" ? googleBlockers : blockers).map((item) => <p key={item}>{item}</p>)
            ) : (
              <p>أكمل ربط الحساب وموقع الفرع قبل النشر. المسودات تُحفظ الآن.</p>
            )}
            {platform === "meta_ctwa" ? (
              capiReady ? (
                <p>تتبع التحويلات (CAPI) جاهز.</p>
              ) : (
                <p>أضف META_PIXEL_ID لتفعيل CAPI عند الحجز والدفع.</p>
              )
            ) : (
              <p>جوجل يسجّل النقرات والتحويلات من الحساب المرتبط. لا يُرسل إلى ميتا.</p>
            )}
            <p>
              موقع الفرع:{" "}
              {geoLabel ? (
                geoLabel
              ) : (
                <Link href={`/admin/settings${query}` as Route} className="underline">
                  افتح الإعدادات واحفظ خط العرض والطول
                </Link>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl bg-slate-950 border border-slate-800 p-4">
          {platform === "google_ads" ? (
            <>
              <div className="md:col-span-2 space-y-3">
                <p className="text-xs text-slate-300 leading-6">
                  كل منشأة تربط حساب إعلانات جوجل الخاص بها. الميزانية والإنفاق تُخصم من وسيلة الدفع في ذلك الحساب، وليست من حساب مكّن.
                </p>
                {googleConnected && googleCustomerId ? (
                  <p className="text-[11px] text-emerald-300">
                    مربوط: {googleName || "حساب إعلانات"} · {googleCustomerId}
                  </p>
                ) : googleConnected ? (
                  <p className="text-[11px] text-amber-200">الحساب مربوط. اختر حساب المنشأة أدناه.</p>
                ) : (
                  <p className="text-[11px] text-slate-500">لم يُربط حساب بعد.</p>
                )}
                {pendingAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {pendingAccounts
                      .filter((item) => !item.manager)
                      .map((item) => (
                        <button
                          key={item.customerId}
                          type="button"
                          disabled={savingGoogle}
                          onClick={() => saveGoogle(item)}
                          className="w-full text-right px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-200"
                        >
                          {item.name || item.customerId}
                          {item.currency ? ` · ${item.currency}` : ""}
                          {item.testAccount ? " · تجريبي" : ""}
                        </button>
                      ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={connectingGoogle || loading}
                    onClick={connectGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-100 font-bold text-xs rounded-xl disabled:opacity-50"
                  >
                    {connectingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    {googleConnected ? "إعادة ربط حساب جوجل Ads" : "ربط حساب إعلانات جوجل"}
                  </button>
                  {googleConnected ? (
                    <button
                      type="button"
                      disabled={savingGoogle || loading}
                      onClick={disconnectGoogle}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl disabled:opacity-50"
                    >
                      {savingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                      إلغاء الربط
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500">
                  الاستهداف:{" "}
                  {geoLabel ? (
                    geoLabel
                  ) : (
                    <Link href={`/admin/settings${query}` as Route} className="underline text-amber-200">
                      احفظ موقع الفرع في الإعدادات
                    </Link>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">حساب إعلانات ميتا لهذه المنشأة</span>
            <input
              className={ADMIN_INPUT}
              dir="ltr"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              placeholder="act_1234567890"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">معرّف صفحة فيسبوك</span>
            <input
              className={ADMIN_INPUT}
              dir="ltr"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="Page ID"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={savingMeta || loading}
              onClick={saveMeta}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-100 font-bold text-xs rounded-xl disabled:opacity-50"
            >
              {savingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ ربط ميتا للمنشأة
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              الاستهداف:{" "}
              {geoLabel ? (
                geoLabel
              ) : (
                <Link href={`/admin/settings${query}` as Route} className="underline text-amber-200">
                  احفظ موقع الفرع في الإعدادات
                </Link>
              )}
            </p>
          </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 px-3 py-3">
            <p className="text-[10px] text-slate-500">مسودات</p>
            <p className="text-lg font-extrabold text-white">{campaigns.filter((c) => c.status === "DRAFT").length}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 px-3 py-3">
            <p className="text-[10px] text-slate-500">نشطة</p>
            <p className="text-lg font-extrabold text-emerald-300">{campaigns.filter((c) => c.status === "ACTIVE").length}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 px-3 py-3">
            <p className="text-[10px] text-slate-500">توليد اليوم</p>
            <p className="text-lg font-extrabold text-white">
              {genUsed}/{genLimit}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 px-3 py-3">
            <p className="text-[10px] text-slate-500">CAPI</p>
            <p className="text-lg font-extrabold text-white">{capiReady ? "مفعّل" : "غير مربوط"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">المنصة</span>
            <select
              className={ADMIN_INPUT}
              value={platform}
              onChange={(e) => {
                const next = LIVE_PLATFORMS.includes(e.target.value as AdPlatformId)
                  ? (e.target.value as AdPlatformId)
                  : "meta_ctwa";
                setPlatform(next);
                setCreative(null);
                if (!campaignName.trim() || campaignName.includes("—")) {
                  setCampaignName(`${serviceName.trim() || "حملة"} — ${PLATFORM_LABELS[next]}`);
                }
              }}
            >
              {LIVE_PLATFORMS.map((id) => (
                <option key={id} value={id}>
                  {PLATFORM_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">الخدمة أو العرض</span>
            <input
              className={ADMIN_INPUT}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="مثال: حلاقة أطفال — حي الروضة"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">الميزانية اليومية (ريال)</span>
            <input
              className={ADMIN_INPUT}
              dir="ltr"
              type="number"
              min={15}
              max={500}
              value={dailyBudgetSar}
              onChange={(e) => setDailyBudgetSar(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">نطاق الاستهداف حول الفرع</span>
            <select className={ADMIN_INPUT} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              {RADII.map((km) => (
                <option key={km} value={km}>
                  دائرة {km} كم
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">لهجة النص</span>
            <select
              className={ADMIN_INPUT}
              value={dialect}
              onChange={(e) => setDialect(e.target.value === "fusha" ? "fusha" : "gulf")}
            >
              <option value="gulf">لهجة سعودية بيضاء</option>
              <option value="fusha">فصحى مهذبة</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-300">اسم الحملة</span>
            <input className={ADMIN_INPUT} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={generating || loading || !adsAllowed || genUsed >= genLimit}
            onClick={generate}
            className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "جاري التوليد..." : "ولّد 3 نصوص إعلانية"}
          </button>
          <button
            type="button"
            disabled={saving || !creative || !adsAllowed}
            onClick={saveDraft}
            className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ كمسودة"}
          </button>
          <p className="text-[11px] text-slate-500">متبقٍ اليوم {Math.max(0, genLimit - genUsed)} توليداً</p>
        </div>

        {creative && (
          <div className="space-y-3">
            {creative.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creative.imageDataUrl}
                alt="إطار الإعلان"
                className="w-28 h-28 rounded-2xl object-cover border border-slate-800"
              />
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {creative.variants.map((variant, index) => (
              <button
                key={`${variant.headline}-${index}`}
                type="button"
                onClick={() => setCreative({ ...creative, selectedIndex: index })}
                className={`text-right p-4 rounded-2xl border ${
                  creative.selectedIndex === index
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                {index === creative.selectedIndex ? (
                  <p className="text-[10px] text-amber-300 mb-1">موصى بها حسب المحادثات</p>
                ) : null}
                <p className="text-sm font-extrabold text-white">{variant.headline}</p>
                <p className="text-xs text-slate-400 mt-2 leading-6">{variant.primaryText}</p>
                <p className="text-[11px] text-emerald-300 mt-3" dir="ltr">
                  {variant.prefilledMessage}
                </p>
              </button>
            ))}
            </div>
          </div>
        )}
        {creative?.negativeKeywords?.length ? (
          <p className="text-[11px] text-slate-500">
            كلمات سلبية مقترحة: {creative.negativeKeywords.join(" · ")}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-white">الحملات المحفوظة</h2>
        {loading ? (
          <div className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-rose-300 font-bold">{error}</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد حملات بعد. ولّد نصاً ثم احفظ مسودة.</p>
        ) : (
          campaigns.map((campaign) => (
            <article key={campaign.id} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-white">{campaign.campaignName}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {PLATFORM_LABELS[campaign.platform]} · {STATUS_LABEL[campaign.status] || campaign.status} ·{" "}
                    {(campaign.dailyBudgetHalalas / 100).toFixed(0)} ر.س / يوم · {campaign.radiusKm} كم
                    {(campaign.status === "ACTIVE" || campaign.status === "PAUSED") && (
                      <>
                        {" · "}أُنفق {((campaign.spentHalalas || 0) / 100).toFixed(0)} ر.س · ظهور{" "}
                        {campaign.metrics?.impressions || 0} · نقر {campaign.metrics?.clicks || 0} · محادثة{" "}
                        {campaign.metrics?.conversations || 0}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(campaign.status === "DRAFT" || campaign.status === "FAILED") &&
                    LIVE_PLATFORMS.includes(campaign.platform) &&
                    adsAllowed && (
                    <button
                      type="button"
                      onClick={() => publish(campaign.id)}
                      className="inline-flex items-center gap-1 text-xs text-amber-300"
                    >
                      <Rocket className="w-4 h-4" />
                      {campaign.platform === "google_ads" ? "نشر على جوجل" : "نشر على ميتا"}
                    </button>
                  )}
                  {campaign.status === "PAUSED" && LIVE_PLATFORMS.includes(campaign.platform) && adsAllowed && (
                    <button
                      type="button"
                      onClick={() => resume(campaign.id)}
                      className="inline-flex items-center gap-1 text-xs text-emerald-300"
                    >
                      <PlayCircle className="w-4 h-4" />
                      استئناف
                    </button>
                  )}
                  {campaign.status === "ACTIVE" && adsAllowed && (
                    <button
                      type="button"
                      onClick={() => pause(campaign.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-300"
                    >
                      <PauseCircle className="w-4 h-4" />
                      إيقاف
                    </button>
                  )}
                </div>
              </div>
              {campaign.adCreative.variants[campaign.adCreative.selectedIndex] && (
                <p className="text-xs text-slate-300 leading-6">
                  {campaign.adCreative.variants[campaign.adCreative.selectedIndex].headline}
                  {" — "}
                  {campaign.adCreative.variants[campaign.adCreative.selectedIndex].primaryText}
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
