"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import type { LicenseRow } from "@/lib/mken/licenses";
import { KeyRound, RefreshCw, Copy, ExternalLink } from "lucide-react";

const emptyForm = {
  customerName: "",
  phone: "",
  email: "",
  crNumber: "",
  taxNumber: "",
  plan: "Lite",
  billingCycle: "annual",
  months: "12",
  maxDevices: "1",
  notes: "",
};

export default function AdminLicensesPage() {
  const { isSuperAdmin } = useAdmin();
  const { showToast } = useApp();
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/licenses?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLicenses([]);
        showToast(data.message || "تعذّر تحميل التراخيص", "error");
      } else {
        setLicenses(data.licenses || []);
      }
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  }, [status, q, showToast]);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: licenses.length,
      active: licenses.filter((row) => row.status === "active").length,
      suspended: licenses.filter((row) => row.status === "suspended").length,
      revoked: licenses.filter((row) => row.status === "revoked").length,
      devices: licenses.reduce((sum, row) => sum + (row.device_count || 0), 0),
      expiring: licenses.filter((row) => {
        if (!row.expires_at || row.status !== "active") return false;
        const exp = new Date(row.expires_at).getTime();
        return exp > now && exp - now < 30 * 86400000;
      }).length,
    };
  }, [licenses]);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          customerName: form.customerName,
          phone: form.phone,
          email: form.email,
          crNumber: form.crNumber,
          taxNumber: form.taxNumber,
          plan: form.plan,
          billingCycle: form.billingCycle,
          months: Number(form.months),
          maxDevices: Number(form.maxDevices),
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الإصدار", "error");
        return;
      }
      const key = data.license?.license_key;
      if (key) {
        try {
          await navigator.clipboard.writeText(key);
        } catch {
          /* ignore */
        }
        showToast(`تم إصدار الترخيص: ${key}`, "success");
      }
      setForm(emptyForm);
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const setRowStatus = async (licenseKey: string, action: "suspend" | "resume" | "revoke") => {
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, licenseKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر التحديث", "error");
        return;
      }
      showToast("تم التحديث", "success");
      await load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
        إدارة التراخيص للسوبر أدمن فقط
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100";

  return (
    <div className="space-y-6 text-right">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <a
              href="https://license.mken.live"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              لوحة license.mken.live
            </a>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold">
            <KeyRound className="w-3.5 h-3.5" />
            تراخيص Mken Lite
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-white">إدارة التراخيص</h1>
        <p className="text-xs text-slate-500">
          نفس جدول <code>mken_licenses</code> المستخدم في license.mken.live. تفعيل الأجهزة يبقى عبر{" "}
          <code>/api/license</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ["الإجمالي", stats.total],
          ["فعّالة", stats.active],
          ["موقوفة", stats.suspended],
          ["ملغاة", stats.revoked],
          ["أجهزة", stats.devices],
          ["تنتهي خلال 30 يوم", stats.expiring],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={issue}
        className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4"
      >
        <h2 className="text-sm font-extrabold text-white">إصدار ترخيص جديد</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            required
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            placeholder="اسم العميل *"
            className={inputClass}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="الجوال"
            dir="ltr"
            className={inputClass}
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="البريد"
            dir="ltr"
            className={inputClass}
          />
          <input
            required
            value={form.crNumber}
            onChange={(e) => setForm({ ...form, crNumber: e.target.value })}
            placeholder="السجل التجاري / العمل الحر *"
            dir="ltr"
            className={inputClass}
          />
          <input
            value={form.taxNumber}
            onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
            placeholder="الرقم الضريبي (15 رقم)"
            dir="ltr"
            className={inputClass}
          />
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
            className={inputClass}
          >
            <option>Lite</option>
            <option>Pro</option>
            <option>Business</option>
          </select>
          <select
            value={form.billingCycle}
            onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
            className={inputClass}
          >
            <option value="annual">سنوي</option>
            <option value="perpetual">دائم</option>
            <option value="trial">تجريبي</option>
          </select>
          <input
            value={form.months}
            onChange={(e) => setForm({ ...form, months: e.target.value })}
            placeholder="الأشهر"
            className={inputClass}
          />
          <input
            value={form.maxDevices}
            onChange={(e) => setForm({ ...form, maxDevices: e.target.value })}
            placeholder="أقصى أجهزة"
            className={inputClass}
          />
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="ملاحظات"
            className={`${inputClass} md:col-span-2`}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold disabled:opacity-50"
        >
          إصدار ونسخ المفتاح
        </button>
      </form>

      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالمفتاح أو الاسم أو الجوال"
            className="flex-1 min-w-[200px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs"
          >
            <option value="">كل الحالات</option>
            <option value="active">فعّال</option>
            <option value="suspended">موقوف</option>
            <option value="revoked">ملغى</option>
          </select>
        </div>

        {loading ? (
          <div className="h-32 rounded-2xl bg-slate-950 border border-slate-800 animate-pulse" />
        ) : licenses.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">لا توجد تراخيص.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2">المفتاح</th>
                  <th className="p-2">العميل</th>
                  <th className="p-2">الباقة</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">الأجهزة</th>
                  <th className="p-2">الانتهاء</th>
                  <th className="p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((row) => (
                  <tr key={row.license_key} className="border-t border-slate-800">
                    <td className="p-2 font-mono text-amber-300" dir="ltr">
                      {row.license_key}
                    </td>
                    <td className="p-2">
                      <p className="font-bold text-slate-100">{row.customer_name || "—"}</p>
                      <p className="text-slate-500" dir="ltr">
                        {row.customer_phone}
                      </p>
                    </td>
                    <td className="p-2">{row.plan}</td>
                    <td className="p-2">{row.status}</td>
                    <td className="p-2">
                      {row.device_count} / {row.max_devices}
                    </td>
                    <td className="p-2">
                      {row.expires_at ? new Date(row.expires_at).toLocaleDateString("ar-SA") : "—"}
                    </td>
                    <td className="p-2 space-x-1 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(row.license_key)}
                        className="p-1.5 text-slate-400 hover:text-white"
                        title="نسخ"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {row.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setRowStatus(row.license_key, "suspend")}
                          className="text-amber-400"
                        >
                          إيقاف
                        </button>
                      )}
                      {row.status === "suspended" && (
                        <button
                          type="button"
                          onClick={() => setRowStatus(row.license_key, "resume")}
                          className="text-emerald-400"
                        >
                          تفعيل
                        </button>
                      )}
                      {row.status !== "revoked" && (
                        <button
                          type="button"
                          onClick={() => setRowStatus(row.license_key, "revoke")}
                          className="text-rose-400"
                        >
                          إلغاء
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
