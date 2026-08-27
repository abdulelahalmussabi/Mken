"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  X,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Code2,
} from "lucide-react";
import type { ApiKeyRecord } from "@/lib/mken/api-keys";

export default function AdminApiKeysPage() {
  const { session, currentTenantSlug, hostTenantSlug } = useAdmin();
  const tenantSlug = currentTenantSlug || session?.clientSlug || hostTenantSlug || "rewa";

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // One-time newly created raw key modal state
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch API Keys
  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/api-keys?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();

      if (data.success) {
        setKeys(data.keys || []);
        setTableMissing(!!data.tableMissing);
        if (data.error) setErrorMsg(data.error);
      } else {
        setErrorMsg(data.error || "فشل تحميل مفاتيح الـ API");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      showToast("يرجى إدخال اسم للمفتاح", "error");
      return;
    }

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          key_name: keyName.trim(),
          expires_at: expiresAt || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCreateModalOpen(false);
        setKeyName("");
        setExpiresAt("");
        setCreatedRawKey(data.raw_key);
        showToast("تم إنشاء مفتاح API بنجاح");
        loadApiKeys();
      } else {
        showToast(data.error || "فشل إنشاء المفتاح", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
    }
  };

  const handleDeleteKey = async (keyItem: ApiKeyRecord) => {
    if (!confirm(`هل أنت متأكد من إلغاء وحذف مفتاح الـ API "${keyItem.key_name}"؟ سيتوقف أي تطبيق متصل به فوراً.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/api-keys?id=${keyItem.id}&tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        showToast("تم حذف وإبطال المفتاح بنجاح");
        loadApiKeys();
      } else {
        showToast(data.error || "فشل حذف المفتاح", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء طلب الحذف", "error");
    }
  };

  const handleCopyMasked = (keyItem: ApiKeyRecord) => {
    navigator.clipboard.writeText(keyItem.masked_key || "");
    setCopiedId(keyItem.id);
    showToast("تم نسخ قناع المفتاح إلى الحافظة");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyRawKey = () => {
    if (createdRawKey) {
      navigator.clipboard.writeText(createdRawKey);
      setCopiedRaw(true);
      showToast("تم نسخ مفتاح API الكامل بنجاح");
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 text-right">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`fixed bottom-5 left-5 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 transition-all ${
              toastMessage.type === "success"
                ? "bg-emerald-950 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950 border-rose-500/40 text-rose-200"
            }`}
          >
            {toastMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
                <Key className="w-3.5 h-3.5" />
                <span>الربط والتكامل البرمجي — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إدارة مفاتيح API Keys</h1>
              <p className="text-slate-400 text-xs">
                إنشاء وتأمين مفاتيح الـ API للتكامل البرمجي مع الأنظمة الخارجية وتطبيقات الجوال.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadApiKeys}
                disabled={loading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-all flex items-center gap-1.5"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                إنشاء مفتاح API جديد
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول مفاتيح API غير موجود في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى تشغيل السكربت <code>scripts/setup-db.sql</code> لتوليد جدول <code>mken_api_keys</code>.
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

          {/* Stats Widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Key className="w-4 h-4 text-purple-400" />
                <span>إجمالي المفاتيح</span>
              </div>
              <p className="text-xl font-black text-white">{keys.length} مفتاح</p>
              <p className="text-[10px] text-slate-500">مسجلة للمنشأة</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>حالة الأمان</span>
              </div>
              <p className="text-xl font-black text-emerald-400">مشفرة ومقنّعة</p>
              <p className="text-[10px] text-slate-500">مظهرة بقناع آمن</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Code2 className="w-4 h-4 text-amber-400" />
                <span>نوع الـ API</span>
              </div>
              <p className="text-xl font-black text-amber-400">REST Client API</p>
              <p className="text-[10px] text-slate-500">تكامل آمن متعدد الأطراف</p>
            </div>
          </div>
        </div>

        {/* Keys Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-500" />
              <p>جاري تحميل مفاتيح API...</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3">
              <Key className="w-10 h-10 mx-auto text-slate-600" />
              <p className="font-bold text-slate-300">لا توجد مفاتيح API مسجلة حالياً</p>
              <p className="text-[11px] text-slate-500">
                أنشئ مفتاحاً جديداً لربط متجرك مع تطبيقات الجوال أو الأنظمة الخارجية.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                    <th className="px-5 py-4">اسم المفتاح والوصف</th>
                    <th className="px-5 py-4">مفتاح الـ API المقنّع (Masked Key)</th>
                    <th className="px-5 py-4">تاريخ الإنشاء</th>
                    <th className="px-5 py-4">تاريخ الانتهاء</th>
                    <th className="px-5 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/20 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-bold text-purple-400 shrink-0">
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-100 text-sm">{k.key_name}</p>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {k.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Masked Key */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-purple-300 text-xs">
                          <span>{k.masked_key}</span>
                          <button
                            onClick={() => handleCopyMasked(k)}
                            className="p-1 hover:text-white text-slate-500 transition-colors"
                            title="نسخ القناع"
                          >
                            {copiedId === k.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                        {k.created_at ? new Date(k.created_at).toLocaleDateString("ar-SA") : "—"}
                      </td>

                      {/* Expires At */}
                      <td className="px-5 py-4">
                        {k.expires_at ? (
                          <span className="text-amber-400 font-mono text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(k.expires_at).toLocaleDateString("ar-SA")}
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-[11px]">دائم (بلا انتهاء)</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleDeleteKey(k)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                          title="إلغاء وإبطال المفتاح"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>إلغاء وحذف</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal 1: Create New API Key Form */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-right space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" />
                  إنشاء مفتاح API جديد
                </h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اسم المفتاح / الغرض *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: تطبيق الجوال iOS / ربط سيستم الكاشير"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">تاريخ الانتهاء (اختياري)</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">دعه فارغاً ليكون المفتاح صالساً بشكل دائم.</p>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all"
                  >
                    توليد مفتاح الـ API
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: One-Time Raw Key Display Modal */}
        {createdRawKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4">
            <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-right space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-emerald-400">
                <ShieldCheck className="w-7 h-7 shrink-0" />
                <div>
                  <h3 className="font-black text-lg text-white">تم إنشاء مفتاح الـ API بنجاح!</h3>
                  <p className="text-xs text-slate-400">يرجى نسخ المفتاح وحفظه فوراً في مكان آمن.</p>
                </div>
              </div>

              {/* Warning Alert Box */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>تنبيه أمني هام:</span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  لأسباب أمنية وقواعد حماية البيانات، لن تتمكن من مشاهدة هذا المفتاح كاملاً مرة أخرى بعد إغلاق هذه النافذة (سيتم تقنيعه كـ <code>mkn_live_••••</code>).
                </p>
              </div>

              {/* Raw Key Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">مفتاح API الخاص بك (Full Key):</label>
                <div className="flex items-center gap-2 p-3 bg-slate-950 border border-purple-500/50 rounded-2xl">
                  <code className="flex-1 font-mono text-purple-300 text-xs break-all text-left dir-ltr select-all">
                    {createdRawKey}
                  </code>
                  <button
                    onClick={handleCopyRawKey}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    {copiedRaw ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>نسخ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCreatedRawKey(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl transition-all"
              >
                لقد قمت بنسخ المفتاح وحفظه – إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
