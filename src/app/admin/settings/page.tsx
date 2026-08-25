"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  Settings,
  Building2,
  MessageSquare,
  CreditCard,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Globe,
  FileText,
  Copy,
  ExternalLink,
  Trash2,
  Link2,
  Check,
} from "lucide-react";
import type { TenantSettings } from "@/lib/mken/settings";

export default function AdminSettingsPage() {
  const { session } = useAdmin();
  const tenantSlug = session?.clientSlug || "almahrusa";

  const [settings, setSettings] = useState<TenantSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Section Tab
  const [activeTab, setActiveTab] = useState<"facility" | "whatsapp" | "moyasar" | "domain">("facility");

  // Show secret key states
  const [showMoyasarSecret, setShowMoyasarSecret] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);

  // Custom Domain State
  const [customDomain, setCustomDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<string>("not_configured");
  const [domainVerified, setDomainVerified] = useState(false);
  const [isVercelConfigured, setIsVercelConfigured] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; name: string; value: string; description: string }>>([]);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Custom Domain
  const loadDomain = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/domains?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      if (data.success) {
        setCustomDomain(data.domain || "");
        setDomainVerified(Boolean(data.verified));
        setDomainStatus(data.domain ? (data.verified ? "active" : "pending_dns") : "not_configured");
        setDnsRecords(data.dnsRecords || []);
        setIsVercelConfigured(Boolean(data.isVercelConfigured));
      }
    } catch {}
  }, [tenantSlug]);

  // Load Settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/settings?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();

      if (data.success) {
        setSettings(data.settings || {});
        setTableMissing(!!data.tableMissing);
        if (data.error) setErrorMsg(data.error);
      } else {
        setErrorMsg(data.error || "فشل تحميل إعدادات المنشأة");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadSettings();
    loadDomain();
  }, [loadSettings, loadDomain]);

  // Handle Form Change
  const handleChange = (field: keyof TenantSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Save Domain
  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomain.trim()) {
      showToast("يرجى إدخال اسم النطاق", "error");
      return;
    }

    setSavingDomain(true);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          domain: customDomain.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCustomDomain(data.domain);
        setDomainVerified(Boolean(data.verified));
        setDomainStatus(data.status || "pending_dns");
        setDnsRecords(data.dnsRecords || []);
        setIsVercelConfigured(Boolean(data.isVercelConfigured));
        showToast(data.message || "تم حفظ بيانات النطاق بنجاح");
      } else {
        showToast(data.error || "فشل حفظ النطاق", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء حفظ النطاق", "error");
    } finally {
      setSavingDomain(false);
    }
  };

  // Handle Verify Domain
  const handleVerifyDomain = async () => {
    setCheckingDomain(true);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug }),
      });

      const data = await res.json();
      if (data.success) {
        setDomainVerified(Boolean(data.verified));
        setDomainStatus(data.status || "pending_dns");
        if (data.dnsRecords) setDnsRecords(data.dnsRecords);
        showToast(data.message || "تم التحقق من النطاق", data.verified ? "success" : "error");
      } else {
        showToast(data.error || "فشل التحقق من النطاق", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء التحقق من النطاق", "error");
    } finally {
      setCheckingDomain(false);
    }
  };

  // Handle Delete Domain
  const handleDeleteDomain = async () => {
    if (!confirm("هل أنت متأكد من حذف النطاق المخصص؟ سيبقى الرابط الأساسي يعمل دائماً.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/domains?tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setCustomDomain("");
        setDomainVerified(false);
        setDomainStatus("not_configured");
        setDnsRecords([]);
        showToast(data.message || "تم حذف النطاق المخصص بنجاح");
      } else {
        showToast(data.error || "فشل حذف النطاق", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء حذف النطاق", "error");
    }
  };

  // Copy to clipboard helper
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedValue(text);
    showToast("تم النسخ إلى الحافظة");
    setTimeout(() => setCopiedValue(null), 2500);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          ...settings,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSettings(data.settings || settings);
        showToast("تم حفظ وتحديث الإعدادات بنجاح");
      } else {
        showToast(data.error || "فشل حفظ الإعدادات", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال أثناء حفظ الإعدادات", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 text-right">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed bottom-5 left-5 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 transition-all ${
              toastMessage.type === "success"
                ? "bg-emerald-950 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950 border-rose-500/40 text-rose-200"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Settings className="w-3.5 h-3.5" />
                <span>إعدادات النظام والمنشأة — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إعدادات المنشأة والربط الآلي</h1>
              <p className="text-slate-400 text-xs">
                تخصيص البيانات الضريبية، تفعيل أتمتة الواتساب، وضبط إعدادات بوابة الدفع الإلكتروني ميسر Moyasar.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadSettings}
                disabled={loading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-all flex items-center gap-1.5"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول إعدادات العملاء غير موجود في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى تنفيذ السكربت <code>scripts/setup-db.sql</code> لتشغيل جدول <code>mken_saas_clients</code>.
                </p>
              </div>
            </div>
          )}

          {errorMsg && !tableMissing && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab("facility")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === "facility"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>بيانات المنشأة والضريبة</span>
          </button>

          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === "whatsapp"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>أتمتة الواتساب (WhatsApp)</span>
          </button>

          <button
            onClick={() => setActiveTab("moyasar")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === "moyasar"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>دفع ميسر (Moyasar)</span>
          </button>

          <button
            onClick={() => setActiveTab("domain")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === "domain"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>دومين خاص (Custom Domain)</span>
          </button>
        </div>

        {/* Tab 1: Facility & Tax Settings */}
        {activeTab === "facility" && (
          <form onSubmit={handleSave} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Building2 className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-extrabold text-base text-white">البيانات الأساسية والضريبية للمنشأة</h3>
                <p className="text-xs text-slate-400">تستخدم هذه البيانات في إعداد الفواتير الضريبية ZATCA والطباعة.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">اسم المنشأة / التجار *</label>
                <input
                  type="text"
                  required
                  placeholder="مجموعة المحروسة للشقق الفندقية"
                  value={settings.facility_name || ""}
                  onChange={(e) => handleChange("facility_name", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">رقم التواصل الموحد</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="0551234567"
                  value={settings.facility_phone || ""}
                  onChange={(e) => handleChange("facility_phone", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">البريد الإلكتروني للمنشأة</label>
                <input
                  type="email"
                  dir="ltr"
                  placeholder="info@almahrusa.sa"
                  value={settings.facility_email || ""}
                  onChange={(e) => handleChange("facility_email", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">العنوان الوطني / التفصيلي</label>
                <input
                  type="text"
                  placeholder="حي العليا - الرياض، المملكة العربية السعودية"
                  value={settings.facility_address || ""}
                  onChange={(e) => handleChange("facility_address", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">الرقم الضريبي (ZATCA VAT ID)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="300000000000003"
                  value={settings.vat_number || ""}
                  onChange={(e) => handleChange("vat_number", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">رقم السجل التجاري (CR)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="1010000000"
                  value={settings.cr_number || ""}
                  onChange={(e) => handleChange("cr_number", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ بيانات المنشأة</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: WhatsApp Automation */}
        {activeTab === "whatsapp" && (
          <form onSubmit={handleSave} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-base text-white">إعدادات ربط وتأكيد الواتساب</h3>
                  <p className="text-xs text-slate-400">ربط خادم الواتساب لإرسال الإشعارات وتأكيد المواعيد آلياً.</p>
                </div>
              </div>

              {/* Enable Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.whatsapp_enabled}
                  onChange={(e) => handleChange("whatsapp_enabled", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="mr-3 text-xs font-bold text-slate-300">
                  {settings.whatsapp_enabled ? "مفعّل" : "معطّل"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              {/* Provider Selection */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">مزود خدمة الواتساب (Provider)</label>
                <select
                  value={settings.whatsapp_provider || "ultramsg"}
                  onChange={(e) => handleChange("whatsapp_provider", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500 font-bold"
                >
                  <option value="ultramsg">UltraMsg API (مستحسن)</option>
                  <option value="waba">Meta Official WABA Cloud API</option>
                  <option value="taqnyat">تقنيات Taqnyat SMS/WA</option>
                  <option value="evolution">Evolution API</option>
                </select>
              </div>

              {/* WhatsApp Phone */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">رقم الواتساب المربوط</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="966500000000"
                  value={settings.whatsapp_phone || ""}
                  onChange={(e) => handleChange("whatsapp_phone", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left"
                />
              </div>

              {/* Instance ID */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">معرّف الجلسة (Instance ID)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="instance12345"
                  value={settings.whatsapp_instance_id || ""}
                  onChange={(e) => handleChange("whatsapp_instance_id", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left"
                />
              </div>

              {/* Token */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">رمز المرور (API Token)</label>
                <div className="relative">
                  <input
                    type={showWaToken ? "text" : "password"}
                    dir="ltr"
                    placeholder={settings.whatsapp_token_masked || "ادخل الرمز..."}
                    value={settings.whatsapp_token || ""}
                    onChange={(e) => handleChange("whatsapp_token", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaToken(!showWaToken)}
                    className="absolute left-3 top-3 text-slate-500 hover:text-white"
                  >
                    {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto Reminders Toggle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-white">إرسال تذكيرات المواعيد التلقائية</p>
                <p className="text-slate-400 text-[11px] mt-0.5">إرسال رسالة واتساب للعميل قبل موعد الحجز بـ 24 ساعة آلياً.</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.whatsapp_auto_reminders}
                onChange={(e) => handleChange("whatsapp_auto_reminders", e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ إعدادات الواتساب</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Moyasar Payment Gateway */}
        {activeTab === "moyasar" && (
          <form onSubmit={handleSave} className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-extrabold text-base text-white">إعدادات بوابة الدفع الإلكتروني (Moyasar)</h3>
                  <p className="text-xs text-slate-400">قبول البطاقات، مدى Mada، Apple Pay وسداد أونلاين.</p>
                </div>
              </div>

              {/* Enable Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!settings.moyasar_enabled}
                  onChange={(e) => handleChange("moyasar_enabled", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="mr-3 text-xs font-bold text-slate-300">
                  {settings.moyasar_enabled ? "مفعّل" : "معطّل"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              {/* Publishable Key */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">المفتاح المعلن (Publishable Key)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="pk_live_... أو pk_test_..."
                  value={settings.moyasar_publishable_key || ""}
                  onChange={(e) => handleChange("moyasar_publishable_key", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-left"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">المفتاح السري (Secret Key)</label>
                <div className="relative">
                  <input
                    type={showMoyasarSecret ? "text" : "password"}
                    dir="ltr"
                    placeholder={settings.moyasar_secret_key_masked || "sk_live_..."}
                    value={settings.moyasar_secret_key || ""}
                    onChange={(e) => handleChange("moyasar_secret_key", e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMoyasarSecret(!showMoyasarSecret)}
                    className="absolute left-3 top-3 text-slate-500 hover:text-white"
                  >
                    {showMoyasarSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto Receipts Toggle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-white">إصدار سندات وإيصالات استلام تلقائية</p>
                <p className="text-slate-400 text-[11px] mt-0.5">تحديث حالة الفواتير إلى "مدفوعة" وإرسال الإيصال آلياً عند نجاح العملية في ميسر.</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.moyasar_auto_receipts}
                onChange={(e) => handleChange("moyasar_auto_receipts", e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ إعدادات ميسر Moyasar</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Custom Domain Settings */}
        {activeTab === "domain" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-base text-white">إعدادات النطاق المخصص (Custom Domain)</h3>
                  <p className="text-xs text-slate-400">
                    اربط نطاقك الخاص (مثل <code>rewa.care</code>) بصفحة الحجوزات ولوحة التحكم الخاصة بك.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {domainVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    النطاق متصل ونشط
                  </span>
                ) : customDomain ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    بانتظار التحقق من الـ DNS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold">
                    غير معين
                  </span>
                )}
              </div>
            </div>

            {/* Vercel API Status Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              isVercelConfigured
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : "bg-blue-950/30 border-blue-500/30 text-blue-300"
            }`}>
              <Zap className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {isVercelConfigured
                    ? "الربط الآلي مع Vercel مفعّل"
                    : "الربط بدون مفاتيح Vercel API (الوضع اليدوي)"}
                </p>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  {isVercelConfigured
                    ? "يتم تسجيل النطاق وإصدار شهادة SSL تلقائياً عبر Vercel API بمجرد توجيه سجلات DNS."
                    : "بدون مفاتيح Vercel API يتم حفظ النطاق وإظهار تعليمات الـ DNS، ويمكنك إضافته في لوحة تحكم Vercel يدوياً تحت Domains."}
                </p>
              </div>
            </div>

            {/* Domain Form */}
            <form onSubmit={handleSaveDomain} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 text-xs">
                  اسم النطاق المخصص (Custom Domain)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="rewa.care أو booking.yourbrand.com"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingDomain}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {savingDomain ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>حفظ النطاق</span>
                    </button>

                    {customDomain && (
                      <button
                        type="button"
                        onClick={handleVerifyDomain}
                        disabled={checkingDomain}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingDomain ? "animate-spin" : ""}`} />
                        <span>تحقق من الـ DNS</span>
                      </button>
                    )}

                    {customDomain && (
                      <button
                        type="button"
                        onClick={handleDeleteDomain}
                        className="p-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl border border-rose-800/40 text-xs transition-all"
                        title="حذف النطاق المخصص"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {/* DNS Instructions Table */}
            {customDomain && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>سجلات DNS المطلوبة لمزود النطاق الخاص بك (Cloudflare, GoDaddy, Namecheap...)</span>
                  </h4>
                  {domainVerified && (
                    <a
                      href={`https://${customDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
                    >
                      <span>زيارة النطاق</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">النوع (Type)</th>
                        <th className="p-3">الاسم (Host / Name)</th>
                        <th className="p-3">القيمة (Value / Target)</th>
                        <th className="p-3">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dnsRecords.length > 0 ? (
                        dnsRecords.map((rec, i) => (
                          <tr key={i} className="hover:bg-slate-900/30">
                            <td className="p-3 font-mono font-bold text-amber-400">{rec.type}</td>
                            <td className="p-3 font-mono text-slate-300">{rec.name}</td>
                            <td className="p-3 font-mono text-slate-300 dir-ltr text-right">{rec.value}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(rec.value)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition-all"
                              >
                                {copiedValue === rec.value ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>نسخ</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr className="hover:bg-slate-900/30">
                            <td className="p-3 font-mono font-bold text-amber-400">A</td>
                            <td className="p-3 font-mono text-slate-300">@</td>
                            <td className="p-3 font-mono text-slate-300 dir-ltr text-right">76.76.21.21</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => copyToClipboard("76.76.21.21")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                              >
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-900/30">
                            <td className="p-3 font-mono font-bold text-amber-400">CNAME</td>
                            <td className="p-3 font-mono text-slate-300">www</td>
                            <td className="p-3 font-mono text-slate-300 dir-ltr text-right">cname.vercel-dns.com.</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => copyToClipboard("cname.vercel-dns.com.")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                              >
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </button>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Permanent Link Info */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-white">الرابط الافتراضي الدائم للمنشأة</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    الرابط <code>https://{tenantSlug}.mken.live</code> يبقى يعمل دائماً في جميع الأحوال حتى بعد تفعيل الدومين الخاص.
                  </p>
                </div>
              </div>
              <a
                href={`https://${tenantSlug}.mken.live`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                <span>فتح الرابط</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
