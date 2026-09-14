"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { writeStoredAdminClient } from "@/lib/mken/admin-client";
import {
  buildSocialUrl,
  EMAIL_TYPES,
  SOCIAL_PLATFORMS,
  type TenantSettings,
} from "@/lib/mken/settings";
import { BrandLogoUploader } from "@/components/BrandLogoUploader";
import {
  Building2,
  Save,
  RefreshCw,
  Share2,
  Mail,
  MapPin,
  ExternalLink,
  Phone,
  Globe,
  FileBadge,
  Trash2,
  Bell,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500 transition-colors";

function vapidKeyBytes(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  ssl_ready: boolean;
  dns_records?: Array<{ type: string; name: string; value: string; hint: string }>;
  expires_at?: string | null;
};

const DOMAIN_STATUS: Record<string, string> = {
  pending_dns: "بانتظار DNS",
  verified: "تم التحقق",
  active: "نشط",
  suspended: "موقوف",
};

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500/80" : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
          on ? "right-0.5" : "right-5"
        }`}
      />
    </button>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
      <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 justify-end">
        {title}
        <Icon className="w-4 h-4 text-amber-400" />
      </h2>
      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const { session, isSuperAdmin, clients, logoutAdmin } = useAdmin();
  const { showToast } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlClient = (searchParams.get("client") || "").trim().toLowerCase();

  const tenant = isSuperAdmin ? urlClient : session?.clientSlug || "";
  const query = isSuperAdmin && tenant ? `?client=${encodeURIComponent(tenant)}` : "";
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [domainEntitled, setDomainEntitled] = useState(false);
  const [domainMessage, setDomainMessage] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState("");
  const [erasing, setErasing] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && tenant) writeStoredAdminClient(tenant);
  }, [isSuperAdmin, tenant]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/settings${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSettings(null);
        setError(data.message || "تعذّر تحميل الإعدادات");
      } else {
        setSettings(data.settings);
      }

      const domainRes = await fetch(`/api/admin/domains${query}`);
      const domainData = await domainRes.json();
      if (domainRes.ok && domainData.success) {
        setDomains(domainData.domains || []);
        setDomainEntitled(Boolean(domainData.entitled));
        setDomainMessage(domainData.entitledMessage || "");
      } else {
        setDomains([]);
        setDomainEntitled(false);
        setDomainMessage(domainData.message || "");
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query]);

  useEffect(() => {
    load();
  }, [load]);

  const persistSettings = async (next: TenantSettings, toast = true) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/settings${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: next.brand,
          phone: next.phone,
          heroImage: next.heroImage,
          commercialRegistryName: next.commercialRegistryName,
          commercialRegistryNumber: next.commercialRegistryNumber,
          social: next.social,
          emails: next.emails,
          serviceArea: next.serviceArea,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الحفظ", "error");
        return;
      }
      setSettings(data.settings);
      if (toast) showToast("تم حفظ إعدادات المنشأة", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!settings) return;
    await persistSettings(settings);
  };

  const socialSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchSocial = (
    id: string,
    partial: Partial<TenantSettings["social"][string]>,
    debounce: boolean
  ) => {
    if (!settings) return;
    const current = settings.social[id] || { enabled: false, value: "" };
    const entry = {
      ...current,
      ...partial,
      ...(typeof partial.value === "string" && partial.value.trim() ? { enabled: true } : {}),
    };
    const next = { ...settings, social: { ...settings.social, [id]: entry } };
    setSettings(next);
    if (!entry.enabled || entry.value.trim()) {
      if (socialSaveTimer.current) clearTimeout(socialSaveTimer.current);
      const run = () => void persistSettings(next, false);
      if (debounce) socialSaveTimer.current = setTimeout(run, 700);
      else run();
    }
  };

  const persistLogo = async (logo: string) => {
    if (!settings) return { success: false, message: "لا توجد إعدادات" };
    const res = await fetch(`/api/settings${query}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: { ...settings.brand, logo } }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || "تعذّر حفظ الشعار" };
    }
    setSettings(data.settings);
    showToast(logo ? "تم حفظ الشعار" : "تم إزالة الشعار", "success");
    return { success: true };
  };

  const addCustomDomain = async () => {
    if (!domainInput.trim()) {
      showToast("أدخل النطاق أولاً", "error");
      return;
    }
    setDomainBusy(true);
    try {
      const res = await fetch(`/api/admin/domains${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: domainInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إضافة النطاق", "error");
        return;
      }
      setDomainInput("");
      showToast(
        data.paired
          ? "أُضيف النطاق مع www تلقائياً — أكمل سجلات DNS ثم اضغط تحقق"
          : "أُضيف النطاق — أكمل سجلات DNS ثم اضغط تحقق",
        "success"
      );
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setDomainBusy(false);
    }
  };

  const verifyCustomDomain = async (id: string) => {
    setDomainBusy(true);
    try {
      const res = await fetch(`/api/admin/domains${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "ما زال DNS غير مكتمل", "error");
        return;
      }
      const status = data.domain?.status;
      showToast(
        status === "active" ? "النطاق نشط" : "سُجّل التحقق — انتظر انتشار DNS ثم أعد المحاولة",
        "success"
      );
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setDomainBusy(false);
    }
  };

  const removeCustomDomain = async (id: string, hostname: string) => {
    if (!window.confirm(`إزالة ${hostname} من المنشأة؟`)) return;
    setDomainBusy(true);
    try {
      const res = await fetch(`/api/admin/domains?${new URLSearchParams({
        ...(tenant && isSuperAdmin ? { client: tenant } : {}),
        id,
      }).toString()}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الحذف", "error");
        return;
      }
      showToast("أُزيل النطاق", "success");
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setDomainBusy(false);
    }
  };

  const patch = (updates: Partial<TenantSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...updates } : prev));

  return (
    <>
      <div className="space-y-6 text-right">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading || saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                تحديث
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading || !settings}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
              </button>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>إعدادات المنشأة</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-white">الهوية ووسائل التواصل</h1>
            {settings?.updatedAt && (
              <p className="text-xs text-slate-500 mt-1">
                آخر تحديث: {new Date(settings.updatedAt).toLocaleString("ar-SA")}
              </p>
            )}
          </div>

          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">المنشأة</label>
              <select
                value={tenant}
                onChange={(e) => {
                  const slug = e.target.value;
                  writeStoredAdminClient(slug);
                  const params = new URLSearchParams(searchParams.toString());
                  if (slug) params.set("client", slug);
                  else params.delete("client");
                  const qs = params.toString();
                  router.replace((qs ? `/admin/settings?${qs}` : "/admin/settings") as Route);
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
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error || !settings ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error || "لا توجد إعدادات"}
          </div>
        ) : (
          <>
            <Section title="تنبيهات المتصفح" icon={Bell}>
              <p className="text-xs text-slate-400 leading-relaxed text-right">
                اشترك على هذا الجهاز لاستلام إشعارات بعنوان ونص (مواعيد، طلبات). يتطلب HTTPS وصلاحية الإشعارات.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={pushBusy || !tenant}
                  onClick={async () => {
                    setPushBusy(true);
                    try {
                      const statusRes = await fetch(`/api/v1/push${query}`, { credentials: "include" });
                      const status = await statusRes.json();
                      if (!statusRes.ok || !status.configured || !status.publicKey) {
                        showToast(status.error || "مفاتيح VAPID غير مُعدّة على الخادم", "error");
                        return;
                      }
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") {
                        showToast("لم يُسمح بالإشعارات في المتصفح", "error");
                        return;
                      }
                      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
                      await navigator.serviceWorker.ready;
                      const sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: vapidKeyBytes(status.publicKey) as BufferSource,
                      });
                      const json = sub.toJSON();
                      const saveRes = await fetch(`/api/v1/push-subscribe${query}`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          endpoint: json.endpoint,
                          keys: json.keys,
                          label: "admin",
                          userAgent: navigator.userAgent,
                        }),
                      });
                      const saved = await saveRes.json();
                      if (!saveRes.ok) {
                        showToast(saved.error || "تعذّر حفظ الاشتراك", "error");
                        return;
                      }
                      showToast("تم اشتراك هذا الجهاز في التنبيهات", "success");
                    } catch {
                      showToast("تعذّر تفعيل التنبيهات على هذا المتصفح", "error");
                    } finally {
                      setPushBusy(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold disabled:opacity-40"
                >
                  {pushBusy ? "جارٍ…" : "اشتراك هذا الجهاز"}
                </button>
                <button
                  type="button"
                  disabled={pushBusy || !tenant}
                  onClick={async () => {
                    setPushBusy(true);
                    try {
                      const res = await fetch(`/api/v1/push-test${query}`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: "{}",
                      });
                      const data = await res.json();
                      showToast(data.message || data.error || "تعذّر الاختبار", res.ok ? "success" : "error");
                    } catch {
                      showToast("تعذّر الاتصال بالخادم", "error");
                    } finally {
                      setPushBusy(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-bold disabled:opacity-40"
                >
                  إرسال إشعار تجريبي
                </button>
              </div>
            </Section>
            <Section title="هوية المنشأة" icon={Building2}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">اسم المنشأة</label>
                  <input
                    value={settings.brand.name}
                    onChange={(e) => patch({ brand: { ...settings.brand, name: e.target.value } })}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    الجوال الرئيسي
                  </label>
                  <div className="relative">
                    <input
                      value={settings.phone}
                      onChange={(e) => patch({ phone: e.target.value })}
                      placeholder="966543530333"
                      dir="ltr"
                      className={`${inputClass} text-left pl-10`}
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300">
                    الوصف التعريفي
                  </label>
                  <input
                    value={settings.brand.tagline}
                    onChange={(e) =>
                      patch({ brand: { ...settings.brand, tagline: e.target.value } })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <BrandLogoUploader
                    value={settings.brand.logo}
                    onPersist={persistLogo}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">اسم السجل التجاري</label>
                  <input
                    value={settings.commercialRegistryName}
                    onChange={(e) => patch({ commercialRegistryName: e.target.value })}
                    placeholder="الاسم كما في السجل التجاري"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">رقم السجل التجاري</label>
                  <input
                    value={settings.commercialRegistryNumber}
                    onChange={(e) => patch({ commercialRegistryNumber: e.target.value })}
                    placeholder="7043321418"
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 md:col-span-2 flex items-center gap-1.5 justify-end">
                  يظهر اسم ورقم السجل التجاري في تذييل الموقع العام.
                  <FileBadge className="w-3.5 h-3.5" />
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    صورة الواجهة الرئيسية
                  </label>
                  <input
                    value={settings.heroImage}
                    onChange={(e) => patch({ heroImage: e.target.value })}
                    placeholder="assets/hero.png"
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </div>
              </div>
            </Section>

            <Section title="الدومين الخاص" icon={Globe}>
              <p className="text-xs text-slate-400">
                اربط نطاقاً تملكه (مثل example.com). أضف سجلات DNS ثم اضغط تحقق. يبقى {tenant}.mken.live يعمل.
              </p>
              {!domainEntitled ? (
                <p className="text-xs text-amber-400 font-bold">
                  {domainMessage || "فعّل إضافة الدومين الخاص من خيارات الاشتراك أولاً."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="www.example.com"
                    dir="ltr"
                    className={`${inputClass} text-left flex-1 min-w-[200px]`}
                    disabled={domainBusy}
                  />
                  <button
                    type="button"
                    onClick={addCustomDomain}
                    disabled={domainBusy}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                  >
                    {domainBusy ? "جارٍ…" : "إضافة النطاق"}
                  </button>
                </div>
              )}
              {domains.length > 0 && (
                <div className="space-y-3">
                  {domains.map((row) => (
                    <div
                      key={row.id}
                      className="p-3 rounded-2xl border border-slate-800 bg-slate-950/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-100" dir="ltr">
                          {row.hostname}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {DOMAIN_STATUS[row.status] || row.status}
                          {row.ssl_ready ? " · SSL جاهز" : ""}
                        </span>
                      </div>
                      {(row.dns_records || []).map((rec) => (
                        <p key={`${rec.type}-${rec.name}`} className="text-[11px] text-slate-500" dir="ltr">
                          {rec.type} {rec.name} → {rec.value}
                        </p>
                      ))}
                      <div className="flex gap-2">
                        {row.status !== "suspended" && (
                          <button
                            type="button"
                            onClick={() => verifyCustomDomain(row.id)}
                            disabled={domainBusy}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                          >
                            تحقق DNS
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCustomDomain(row.id, row.hostname)}
                          disabled={domainBusy}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-rose-900/50 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="التواجد المحلي" icon={MapPin}>
              <p className="text-xs text-slate-400 leading-relaxed">
                فحص NAP، ربط الخرائط، المنافسون، ومزامنة الخدمات انتقلت إلى قسم الإعلانات حتى تبقى إعدادات المنشأة للهوية والنطاق.
              </p>
              <Link
                href={`/admin/ads/local-seo${query}` as Route}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
              >
                فتح التواجد المحلي
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Section>

            <Section title="حسابات التواصل" icon={Share2}>
              <p className="text-[11px] text-slate-500 mb-2">
                اكتب اسم الحساب فيُفعَّل تلقائياً ويظهر في الموقع بعد الحفظ. الحسابات المفعّلة تظهر في الصفحة الرئيسية والتذييل.
              </p>
              <div className="space-y-2">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const entry = settings.social[platform.id];
                  const url = entry.value.trim() ? buildSocialUrl(platform.id, entry.value) : "";

                  return (
                    <div
                      key={platform.id}
                      className={`p-3 rounded-2xl border flex items-center gap-3 flex-wrap ${
                        entry.enabled
                          ? "bg-slate-950/60 border-slate-700"
                          : "bg-slate-950/30 border-slate-800"
                      }`}
                    >
                      <Toggle
                        on={entry.enabled}
                        disabled={saving}
                        onChange={() =>
                          patchSocial(platform.id, { enabled: !entry.enabled }, false)
                        }
                      />
                      <div className="w-28 shrink-0 text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{platform.icon}</span>
                        {platform.name}
                      </div>
                      <input
                        value={entry.value}
                        onChange={(e) => patchSocial(platform.id, { value: e.target.value }, true)}
                        placeholder={platform.placeholder}
                        inputMode={platform.inputMode === "tel" ? "tel" : "text"}
                        dir="ltr"
                        className="flex-1 min-w-[180px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left focus:outline-none focus:border-amber-500"
                      />
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title={url}
                          className="p-2 text-slate-500 hover:text-amber-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="عناوين البريد" icon={Mail}>
              <div className="space-y-2">
                {EMAIL_TYPES.map((type) => {
                  const entry = settings.emails[type.id];

                  return (
                    <div
                      key={type.id}
                      className={`p-3 rounded-2xl border flex items-center gap-3 flex-wrap ${
                        entry.enabled
                          ? "bg-slate-950/60 border-slate-700"
                          : "bg-slate-950/30 border-slate-800"
                      }`}
                    >
                      <Toggle
                        on={entry.enabled}
                        disabled={saving}
                        onChange={() =>
                          patch({
                            emails: {
                              ...settings.emails,
                              [type.id]: { ...entry, enabled: !entry.enabled },
                            },
                          })
                        }
                      />
                      <div className="w-28 shrink-0 text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{type.icon}</span>
                        {type.name}
                      </div>
                      <input
                        value={entry.value}
                        onChange={(e) =>
                          patch({
                            emails: {
                              ...settings.emails,
                              [type.id]: { ...entry, value: e.target.value },
                            },
                          })
                        }
                        placeholder={type.placeholder}
                        dir="ltr"
                        type="email"
                        className="flex-1 min-w-[180px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-left focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-slate-500 hidden lg:block">{type.hint}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="نطاق الخدمة" icon={MapPin}>
              <div className="flex items-center gap-6 flex-wrap justify-end">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  عرضه في الصفحة الرئيسية
                  <Toggle
                    on={settings.serviceArea.displayOnHomepage}
                    disabled={saving}
                    onChange={() =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          displayOnHomepage: !settings.serviceArea.displayOnHomepage,
                        },
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  تغطية المدينة كاملة
                  <Toggle
                    on={settings.serviceArea.showAsFullCity}
                    disabled={saving}
                    onChange={() =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          showAsFullCity: !settings.serviceArea.showAsFullCity,
                        },
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  تمكين نطاق الخدمة
                  <Toggle
                    on={settings.serviceArea.enabled}
                    disabled={saving}
                    onChange={() =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          enabled: !settings.serviceArea.enabled,
                        },
                      })
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">المدينة</label>
                  <input
                    value={settings.serviceArea.city}
                    onChange={(e) =>
                      patch({ serviceArea: { ...settings.serviceArea, city: e.target.value } })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    نطاق التغطية (كم)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.serviceArea.radiusKm}
                    onChange={(e) =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          radiusKm: Number(e.target.value),
                        },
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">خط العرض</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={settings.serviceArea.center.lat}
                    onChange={(e) =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          center: {
                            ...settings.serviceArea.center,
                            lat: Number(e.target.value),
                          },
                        },
                      })
                    }
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">خط الطول</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={settings.serviceArea.center.lng}
                    onChange={(e) =>
                      patch({
                        serviceArea: {
                          ...settings.serviceArea,
                          center: {
                            ...settings.serviceArea.center,
                            lng: Number(e.target.value),
                          },
                        },
                      })
                    }
                    dir="ltr"
                    className={`${inputClass} text-left`}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-bold text-slate-300">ملاحظة التغطية</label>
                  <input
                    value={settings.serviceArea.coverageNote}
                    onChange={(e) =>
                      patch({
                        serviceArea: { ...settings.serviceArea, coverageNote: e.target.value },
                      })
                    }
                    placeholder="نصل إلى جميع أحياء المدينة خلال ساعتين"
                    className={inputClass}
                  />
                </div>
                <p className="text-[11px] text-slate-500 md:col-span-2 lg:col-span-4">
                  خط العرض والطول المحفوظان هنا إلزاميان لنشر حملات واتساب ميتا. بدونها يُرفض النشر ولا يُستخدم موقع افتراضي.
                </p>
              </div>
            </Section>

            {!isSuperAdmin && tenant ? (
              <section className="p-6 rounded-3xl bg-red-950/30 border border-red-900/60 shadow-lg space-y-4">
                <h2 className="text-sm font-bold text-red-200 flex items-center gap-2 justify-end">
                  حذف بيانات المنشأة (PDPL)
                  <Trash2 className="w-4 h-4 text-red-400" />
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed text-right">
                  يحذف المواعيد والمحادثات والموظفين والرموز، ويُجهَّل اسم العميل على الفواتير المحتفظ
                  بها نظامياً. لا يمكن التراجع. اكتب DELETE ثم أكّد.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input
                    dir="ltr"
                    value={eraseConfirm}
                    onChange={(e) => setEraseConfirm(e.target.value)}
                    placeholder="DELETE"
                    className={`${inputClass} sm:max-w-xs text-left`}
                  />
                  <button
                    type="button"
                    disabled={erasing || eraseConfirm !== "DELETE"}
                    onClick={async () => {
                      if (!window.confirm("تأكيد حذف بيانات المنشأة؟ لا يمكن التراجع.")) return;
                      setErasing(true);
                      try {
                        const res = await fetch("/api/privacy/erase", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ tenantSlug: tenant, confirm: eraseConfirm }),
                        });
                        const data = await res.json();
                        if (!res.ok || !data.success) {
                          showToast(data.error || "تعذّر الحذف", "error");
                          return;
                        }
                        await logoutAdmin();
                        router.push("/" as Route);
                      } catch {
                        showToast("تعذّر الاتصال بالخادم", "error");
                      } finally {
                        setErasing(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-sm font-bold"
                  >
                    {erasing ? "جارٍ الحذف…" : "حذف بيانات المنشأة"}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
