"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import SaasUpgradeNotice from "@/components/SaasUpgradeNotice";
import { useAdminTenant } from "@/components/AdminPageTabs";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { writeStoredAdminClient } from "@/lib/mken/admin-client";
import { SAAS_FEATURE_MESSAGES } from "@/lib/mken/saas";
import {
  EVENT_LABELS,
  PROVIDER_LABELS,
  inboundWebhookUrl,
  type WhatsappApiPublic,
  type WhatsappLog,
  type WhatsappStats,
} from "@/lib/mken/whatsapp";
import {
  MessageCircle,
  RefreshCw,
  Trash2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Save,
  Send,
  Copy,
} from "lucide-react";

type Filter = "all" | "inbound" | "outbound" | "failed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "inbound", label: "واردة" },
  { id: "outbound", label: "صادرة" },
  { id: "failed", label: "فاشلة" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function readApiJson(res: Response): Promise<{ ok: boolean; message?: string; data: Record<string, unknown> }> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return {
      ok: res.ok && data.success !== false,
      message: typeof data.message === "string" ? data.message : undefined,
      data,
    };
  } catch {
    return { ok: false, message: `تعذّر قراءة رد الخادم (${res.status})`, data: {} };
  }
}

export default function AdminMessagesPage() {
  const { saas } = useAdmin();
  const { tenant, query, isSuperAdmin, clients, authLoading } = useAdminTenant();
  const router = useRouter();
  const { showToast } = useApp();
  const webhookUrl = tenant ? inboundWebhookUrl(tenant) : "";

  const [logs, setLogs] = useState<WhatsappLog[]>([]);
  const [stats, setStats] = useState<WhatsappStats | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waConfig, setWaConfig] = useState<WhatsappApiPublic | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [gatewayTokenInput, setGatewayTokenInput] = useState("");
  const [savingWa, setSavingWa] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testBody, setTestBody] = useState("رسالة تجريبية من مكّن");
  const [sendingTest, setSendingTest] = useState(false);
  const [campaignTarget, setCampaignTarget] = useState<"all" | "booking" | "order">("all");
  const [campaignBody, setCampaignBody] = useState(
    "مرحباً {customerName}، يسعدنا إعلامك بوجود عروض مميزة لدينا في {brandName}."
  );
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [replyPhone, setReplyPhone] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [linkingInbound, setLinkingInbound] = useState(false);

  const tenantQuery = query;

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLogs([]);
      setStats(null);
      setWaConfig(null);
      setLoading(false);
      setError(isSuperAdmin ? "اختر المنشأة أولاً" : "");
      return;
    }
    if (!isSuperAdmin && !saas.hasWhatsApp) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/whatsapp-logs${tenantQuery}`);
      const parsed = await readApiJson(res);

      if (!parsed.ok) {
        setLogs([]);
        setStats(null);
        setError(parsed.message || "تعذّر تحميل السجلات");
      } else {
        setLogs((parsed.data.logs as WhatsappLog[]) || []);
        setStats((parsed.data.stats as WhatsappStats) || null);
      }

      const waRes = await fetch(`/api/whatsapp-settings${tenantQuery}`);
      const wa = await readApiJson(waRes);
      if (wa.ok && wa.data.config) {
        setWaConfig(wa.data.config as WhatsappApiPublic);
        setTokenInput("");
        setGatewayTokenInput("");
      } else if (wa.message) {
        setError((prev) => prev || wa.message || "تعذّر تحميل إعدادات واتساب");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, tenantQuery, isSuperAdmin, saas.hasWhatsApp, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/whatsapp-logs/${id}${query}`, { method: "DELETE" });
      const parsed = await readApiJson(res);

      if (!parsed.ok) {
        showToast(parsed.message || "تعذّر حذف السجل", "error");
        return;
      }

      setLogs((prev) => prev.filter((l) => l.id !== id));
      showToast("تم حذف السجل", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const saveWhatsapp = async (): Promise<boolean> => {
    if (!waConfig) {
      showToast("لا توجد إعدادات للحفظ. اختر المنشأة أولاً", "error");
      return false;
    }
    setSavingWa(true);
    try {
      const res = await fetch(`/api/whatsapp-settings${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...waConfig,
          token: tokenInput.trim() || undefined,
          gatewayToken: gatewayTokenInput.trim() || undefined,
        }),
      });
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        showToast(parsed.message || "تعذّر حفظ إعدادات واتساب", "error");
        return false;
      }
      setWaConfig(parsed.data.config as WhatsappApiPublic);
      setTokenInput("");
      setGatewayTokenInput("");
      showToast("تم حفظ إعدادات واتساب", "success");
      const webhook = parsed.data.webhook as { ok?: boolean; message?: string } | undefined;
      if (webhook?.message) {
        showToast(webhook.message, webhook.ok ? "success" : "error");
      }
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم", "error");
      return false;
    } finally {
      setSavingWa(false);
    }
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      const saved = await saveWhatsapp();
      if (!saved) return;
      const res = await fetch(`/api/whatsapp-logs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, body: testBody }),
      });
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        showToast(parsed.message || "فشل الإرسال التجريبي", "error");
        await load();
        return;
      }
      showToast("أُرسلت الرسالة التجريبية", "success");
      setTestPhone("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم", "error");
    } finally {
      setSendingTest(false);
    }
  };

  const sendCampaign = async () => {
    if (!window.confirm("إطلاق الحملة الآن؟ ستُرسل رسائل جماعية للعملاء المستهدفين (حتى 40 رقماً فريداً).")) {
      return;
    }
    setSendingCampaign(true);
    try {
      const res = await fetch(`/api/whatsapp-logs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "campaign",
          target: campaignTarget,
          body: campaignBody,
        }),
      });
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        showToast(parsed.message || "فشل إطلاق الحملة", "error");
        await load();
        return;
      }
      const extra = parsed.data.truncated ? " (أُوقف عند 40 مستلماً)" : "";
      showToast(`أُرسلت ${parsed.data.sent} وفشل ${parsed.data.failed} من ${parsed.data.total}${extra}`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم", "error");
    } finally {
      setSendingCampaign(false);
    }
  };

  const sendReply = async () => {
    setSendingReply(true);
    try {
      const res = await fetch(`/api/whatsapp-logs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "crm-reply",
          phone: replyPhone,
          body: replyBody,
        }),
      });
      const parsed = await readApiJson(res);
      if (!parsed.ok) {
        showToast(parsed.message || "فشل إرسال الرد", "error");
        await load();
        return;
      }
      showToast("تم إرسال الرد", "success");
      setReplyBody("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم", "error");
    } finally {
      setSendingReply(false);
    }
  };

  const linkInbound = async () => {
    setLinkingInbound(true);
    try {
      const res = await fetch(`/api/whatsapp-settings${query}`, { method: "POST" });
      const parsed = await readApiJson(res);
      showToast(parsed.message || (parsed.ok ? "تم ربط الوارد" : "تعذّر ربط الوارد"), parsed.ok ? "success" : "error");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذّر الاتصال بالخادم", "error");
    } finally {
      setLinkingInbound(false);
    }
  };

  const visible = useMemo(() => {
    const term = search.trim();
    return logs.filter((log) => {
      if (filter === "inbound" && !log.inbound) return false;
      if (filter === "outbound" && log.inbound) return false;
      if (filter === "failed" && (log.inbound || log.status !== "failed")) return false;
      if (!term) return true;
      return log.phone.includes(term) || log.body.includes(term);
    });
  }, [logs, filter, search]);

  const cards = stats
    ? [
        { label: "رسائل صادرة", value: stats.outbound },
        { label: "رسائل واردة", value: stats.inbound },
        { label: "تم الإرسال", value: stats.success },
        { label: "فشل الإرسال", value: stats.failed },
      ]
    : [];

  return (
    <>
      {!isSuperAdmin && !saas.hasWhatsApp ? (
        <SaasUpgradeNotice title="واتساب غير متاح" message={SAAS_FEATURE_MESSAGES.whatsapp} />
      ) : (
      <div className="space-y-6 text-right">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>الرسائل والواتساب</span>
            </div>
          </div>

          {stats && stats.outbound > 0 && stats.inbound === 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm leading-relaxed space-y-3">
              <p className="font-bold">الإرسال يعمل، والرد الآلي لا يصل لأن ميتا لا ترسل الوارد إلى مكّن.</p>
              <p className="text-amber-200/90 text-xs">
                من جوالك أرسل رسالة جديدة إلى رقم واتساب المنشأة (ليس الرد داخل إشعار فقط). إذا بقي تبويب «واردة» فارغاً
                فالويب هوك غير مربوط.
              </p>
              {waConfig?.provider === "whatsapp_business" && (
                <button
                  type="button"
                  onClick={() => void linkInbound()}
                  disabled={linkingInbound}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {linkingInbound ? "جاري الربط…" : "ربط وارد ميتا الآن"}
                </button>
              )}
            </div>
          )}

          <h1 className="text-2xl font-extrabold text-white">سجل رسائل واتساب</h1>

          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">المنشأة</label>
              <select
                value={tenant}
                onChange={(e) => {
                  const slug = e.target.value;
                  writeStoredAdminClient(slug);
                  router.replace((slug ? `/admin/messages?client=${encodeURIComponent(slug)}` : "/admin/messages") as Route);
                }}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">اختر المنشأة</option>
                {clients.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="relative flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برقم الجوال أو نص الرسالة"
                className="w-full px-4 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filter === item.id
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {waConfig && (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={saveWhatsapp}
                disabled={savingWa}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                حفظ الإعدادات
              </button>
              <h2 className="text-sm font-extrabold text-white">إعداد بوابة واتساب</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
                تفعيل الإرسال
                <input
                  type="checkbox"
                  checked={waConfig.enabled}
                  onChange={(e) => setWaConfig({ ...waConfig, enabled: e.target.checked })}
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-300">المزود</span>
                <select
                  value={waConfig.provider}
                  onChange={(e) =>
                    setWaConfig({ ...waConfig, provider: e.target.value as WhatsappApiPublic["provider"] })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                >
                  <option value="none">غير محدد</option>
                  <option value="whatsapp_business">WhatsApp Cloud API</option>
                  <option value="ultramsg">UltraMsg</option>
                  <option value="twilio">Twilio</option>
                  <option value="custom">n8n / Webhook مخصص</option>
                </select>
              </label>
              <div className="md:col-span-2 space-y-1.5">
                <span className="block text-xs font-bold text-slate-300">Webhook الوارد (Meta / Twilio → مكّن)</span>
                <div className="flex items-center gap-2">
                  <code
                    dir="ltr"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-300 text-left break-all"
                  >
                    {webhookUrl || "اختر المنشأة لعرض الرابط"}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (!webhookUrl) return;
                      void navigator.clipboard.writeText(webhookUrl);
                      showToast("تم نسخ رابط الوارد", "success");
                    }}
                    className="p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white"
                    title="نسخ"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {waConfig.provider === "custom" && (
                <>
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="block text-xs font-bold text-slate-300">رابط Webhook الصادر (n8n)</span>
                    <input
                      value={waConfig.url}
                      onChange={(e) => setWaConfig({ ...waConfig, url: e.target.value })}
                      placeholder={waConfig.n8nWebhookExample}
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-300">بوابة الإرسال الفعلية لـ n8n</span>
                    <select
                      value={waConfig.gateway.provider}
                      onChange={(e) =>
                        setWaConfig({
                          ...waConfig,
                          gateway: {
                            ...waConfig.gateway,
                            provider: e.target.value as WhatsappApiPublic["gateway"]["provider"],
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                    >
                      <option value="">اختر البوابة</option>
                      <option value="ultramsg">UltraMsg</option>
                      <option value="twilio">Twilio</option>
                    </select>
                  </label>
                  {waConfig.gateway.provider === "ultramsg" && (
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-slate-300">Gateway Instance ID</span>
                      <input
                        value={waConfig.gateway.instanceId}
                        onChange={(e) =>
                          setWaConfig({
                            ...waConfig,
                            gateway: { ...waConfig.gateway, instanceId: e.target.value },
                          })
                        }
                        dir="ltr"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                      />
                    </label>
                  )}
                  {waConfig.gateway.provider === "twilio" && (
                    <>
                      <label className="space-y-1.5">
                        <span className="block text-xs font-bold text-slate-300">Gateway Account SID</span>
                        <input
                          value={waConfig.gateway.accountSid}
                          onChange={(e) =>
                            setWaConfig({
                              ...waConfig,
                              gateway: { ...waConfig.gateway, accountSid: e.target.value },
                            })
                          }
                          dir="ltr"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="block text-xs font-bold text-slate-300">Gateway From</span>
                        <input
                          value={waConfig.gateway.fromNumber}
                          onChange={(e) =>
                            setWaConfig({
                              ...waConfig,
                              gateway: { ...waConfig.gateway, fromNumber: e.target.value },
                            })
                          }
                          dir="ltr"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                        />
                      </label>
                    </>
                  )}
                  {waConfig.gateway.provider ? (
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-slate-300">
                        توكن البوابة {waConfig.gateway.tokenSet ? "(محفوظ — اتركه فارغاً للإبقاء)" : ""}
                      </span>
                      <input
                        type="password"
                        value={gatewayTokenInput}
                        onChange={(e) => setGatewayTokenInput(e.target.value)}
                        placeholder={waConfig.gateway.tokenSet ? "••••••••" : "توكن UltraMsg / Twilio"}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                      />
                    </label>
                  ) : null}
                  <p className="md:col-span-2 text-[11px] text-slate-500">
                    استورد <code>data/n8n-whatsapp-dispatch-workflow.json</code> في n8n، عيّن
                    SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY، ثم الصق رابط الـ webhook أعلاه. التذكيرات المجدولة
                    تعمل يومياً عبر <code>/api/cron/whatsapp</code> على مشروع mkn.
                  </p>
                </>
              )}
              {waConfig.provider === "ultramsg" && (
                <label className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-300">Instance ID</span>
                  <input
                    value={waConfig.instanceId}
                    onChange={(e) => setWaConfig({ ...waConfig, instanceId: e.target.value })}
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                  />
                </label>
              )}
              {waConfig.provider === "whatsapp_business" && (
                <label className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-300">Phone Number ID</span>
                  <input
                    value={waConfig.phoneNumberId}
                    onChange={(e) => setWaConfig({ ...waConfig, phoneNumberId: e.target.value })}
                    placeholder="مثال: 1164287383444283"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                  />
                  <span className="block text-[11px] text-slate-500 leading-relaxed">
                    من شاشة WhatsApp → API Setup فقط — ليس WhatsApp Business account ID. التوكن يجب أن يُولَّد من
                    نفس هذه الشاشة ثم يُلصق أدناه ويُحفظ.
                  </span>
                </label>
              )}
              {waConfig.provider === "twilio" && (
                <>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-300">Account SID</span>
                    <input
                      value={waConfig.accountSid}
                      onChange={(e) => setWaConfig({ ...waConfig, accountSid: e.target.value })}
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-300">From</span>
                    <input
                      value={waConfig.fromNumber}
                      onChange={(e) => setWaConfig({ ...waConfig, fromNumber: e.target.value })}
                      dir="ltr"
                      placeholder="+1415..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                    />
                  </label>
                </>
              )}
              {waConfig.provider !== "none" && (
                <label className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-300">
                    التوكن {waConfig.tokenSet ? "(محفوظ — اتركه فارغاً للإبقاء)" : ""}
                  </span>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={waConfig.tokenSet ? "••••••••" : "الصق التوكن هنا"}
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
                  />
                </label>
              )}
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
                تأكيد الحجز
                <input
                  type="checkbox"
                  checked={waConfig.sendConfirmation}
                  onChange={(e) => setWaConfig({ ...waConfig, sendConfirmation: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
                تذكير الموعد
                <input
                  type="checkbox"
                  checked={waConfig.sendReminder}
                  onChange={(e) => setWaConfig({ ...waConfig, sendReminder: e.target.checked })}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">الإرسال التجريبي يحفظ إعدادات هذه المنشأة أولاً ثم يرسل.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
              />
              <input
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={sendingTest || !waConfig.enabled}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                إرسال تجريبي
              </button>
            </div>
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h3 className="text-xs font-extrabold text-white">حملة تسويقية</h3>
              <p className="text-[11px] text-slate-500">
                يُرسل لكل رقم فريد من الحجوزات و/أو الطلبات. الحد الأقصى 40 مستلماً في كل إطلاق.
                المتغيرات: {"{customerName}"} و {"{brandName}"}
              </p>
              <select
                value={campaignTarget}
                onChange={(e) => setCampaignTarget(e.target.value as typeof campaignTarget)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
              >
                <option value="all">كل العملاء (حجوزات وطلبات)</option>
                <option value="booking">عملاء الحجوزات فقط</option>
                <option value="order">عملاء الطلبات فقط</option>
              </select>
              <textarea
                value={campaignBody}
                onChange={(e) => setCampaignBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right"
              />
              <button
                type="button"
                onClick={sendCampaign}
                disabled={sendingCampaign || !waConfig.enabled}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
              >
                {sendingCampaign ? "جاري الإرسال…" : "إطلاق الحملة"}
              </button>
            </div>
          </div>
        )}

        {waConfig?.enabled ? (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
            <h2 className="text-sm font-extrabold text-white">رد مباشر (CRM)</h2>
            <p className="text-[11px] text-slate-500">
              اختر رقماً من سجل وارد أو اكتبه هنا، ثم أرسل رداً يُحفظ كـ crm_reply.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={replyPhone}
                onChange={(e) => setReplyPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left"
              />
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="نص الرد للعميل"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={sendingReply || !replyPhone.trim() || !replyBody.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingReply ? "جاري الإرسال…" : "إرسال الرد"}
              </button>
            </div>
          </div>
        ) : null}

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-right"
              >
                <p className="text-2xl font-black text-white">{card.value}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <MessageCircle className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">
              {logs.length === 0 ? "لا توجد رسائل بعد" : "لا توجد نتائج مطابقة"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((log) => {
              const failed = !log.inbound && log.status === "failed";

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 flex-wrap ${
                    failed
                      ? "bg-rose-950/20 border-rose-900/50"
                      : log.inbound
                        ? "bg-sky-950/20 border-sky-900/40"
                        : "bg-slate-900/70 border-slate-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => remove(log.id)}
                    disabled={busyId === log.id}
                    className="p-2 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                    title="حذف السجل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {log.phone ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyPhone(log.phone);
                        setSearch(log.phone);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-700 text-slate-300 hover:text-white"
                    >
                      رد
                    </button>
                  ) : null}

                  <div className="flex-1 min-w-[220px] space-y-1.5">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <span className="text-[11px] text-slate-500">{formatDate(log.createdAt)}</span>
                      <span className="text-[11px] text-slate-500">
                        {PROVIDER_LABELS[log.provider] || log.provider || "—"}
                      </span>
                      <span className="text-[11px] font-bold text-slate-300">
                        {EVENT_LABELS[log.eventType] || log.eventType || "أخرى"}
                      </span>
                      <span className="font-mono text-xs text-slate-200" dir="ltr">
                        {log.phone || "—"}
                      </span>
                      {log.inbound ? (
                        <ArrowDownLeft className="w-4 h-4 text-sky-400" />
                      ) : (
                        <ArrowUpRight
                          className={`w-4 h-4 ${failed ? "text-rose-400" : "text-emerald-400"}`}
                        />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">
                      {log.body || "—"}
                    </p>

                    {failed && log.errorMessage && (
                      <p className="text-[11px] text-rose-300 flex items-center gap-1 justify-end">
                        {log.errorMessage}
                        <AlertTriangle className="w-3 h-3" />
                      </p>
                    )}

                    {log.retryCount > 0 && (
                      <p className="text-[11px] text-amber-300">
                        محاولات إعادة الإرسال: {log.retryCount}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </>
  );
}
