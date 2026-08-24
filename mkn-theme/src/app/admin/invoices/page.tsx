"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SaasUpgradeNotice from "@/components/SaasUpgradeNotice";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { SAAS_FEATURE_MESSAGES } from "@/lib/mken/saas";
import {
  INVOICE_PAYMENT_STATUSES,
  type Invoice,
  type InvoicePaymentStatus,
  type InvoiceTotals,
} from "@/lib/mken/invoices";
import {
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Phone,
  FileText,
} from "lucide-react";

type Filter = "all" | "invoice" | "estimate" | "unpaid";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "invoice", label: "فواتير" },
  { id: "estimate", label: "عروض سعر" },
  { id: "unpaid", label: "غير مدفوعة" },
];

const PAYMENT_LABELS: Record<InvoicePaymentStatus, string> = {
  unpaid: "غير مدفوعة",
  partial: "مدفوعة جزئيًا",
  paid: "مدفوعة",
};

const PAYMENT_CLASSES: Record<InvoicePaymentStatus, string> = {
  unpaid: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  partial: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  paid: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
};

const money = (value: number) => `${value.toLocaleString("ar-SA")} ر.س`;

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

export default function AdminInvoicesPage() {
  const { session, isSuperAdmin, clients, saas } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totals, setTotals] = useState<InvoiceTotals | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";
  const query = isSuperAdmin && tenant ? `?client=${encodeURIComponent(tenant)}` : "";

  useEffect(() => {
    if (isSuperAdmin && !selectedTenant && clients.length) setSelectedTenant(clients[0].slug);
  }, [isSuperAdmin, selectedTenant, clients]);

  const load = useCallback(async () => {
    if (!tenant) return;
    if (!isSuperAdmin && !saas.hasInvoices) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/invoices${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setInvoices([]);
        setTotals(null);
        setError(data.message || "تعذّر تحميل الفواتير");
      } else {
        setInvoices(data.invoices || []);
        setTotals(data.totals || null);
        setTableMissing(Boolean(data.tableMissing));
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, isSuperAdmin, saas.hasInvoices]);

  useEffect(() => {
    load();
  }, [load]);

  const changePayment = async (id: string, paymentStatus: InvoicePaymentStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/invoices/${id}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر تحديث الفاتورة", "error");
        return;
      }

      setInvoices((prev) => prev.map((i) => (i.id === id ? data.invoice : i)));
      showToast(`تم التحديث إلى: ${PAYMENT_LABELS[paymentStatus]}`, "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    const term = search.trim();
    return invoices.filter((invoice) => {
      if (filter === "invoice" && invoice.type !== "invoice") return false;
      if (filter === "estimate" && invoice.type !== "estimate") return false;
      if (filter === "unpaid" && (invoice.type !== "invoice" || invoice.paymentStatus === "paid")) {
        return false;
      }
      if (!term) return true;
      return (
        invoice.customerName.includes(term) ||
        invoice.customerPhone.includes(term) ||
        invoice.id.includes(term)
      );
    });
  }, [invoices, filter, search]);

  const cards = totals
    ? [
        { label: "الإيرادات المحصّلة", value: money(totals.revenue) },
        { label: "مبالغ مستحقة", value: money(totals.outstanding) },
        { label: "ضريبة القيمة المضافة", value: money(totals.tax) },
        { label: "فواتير مُبلّغة لهيئة الزكاة", value: `${totals.zatcaReported} / ${totals.invoices}` },
      ]
    : [];

  return (
    <>
      {!isSuperAdmin && !saas.hasInvoices ? (
        <SaasUpgradeNotice title="الفواتير غير متاحة" message={SAAS_FEATURE_MESSAGES.invoices} />
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-bold">
              <Receipt className="w-3.5 h-3.5" />
              <span>الفواتير</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white">فواتير العملاء وعروض السعر</h1>

          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">المنشأة</label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
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
                placeholder="ابحث باسم العميل أو الجوال أو رقم الفاتورة"
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

        {tableMissing && (
          <div className="p-5 rounded-3xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs font-bold space-y-1 text-right">
            <p>جدول الفواتير غير مُنشأ في قاعدة البيانات لهذا المشروع.</p>
            <p className="font-normal text-amber-300/80">
              نفّذ القسم الخاص بـ mken_invoices من scripts/setup-db.sql لتفعيل الفوترة وربطها
              بهيئة الزكاة والضريبة.
            </p>
          </div>
        )}

        {totals && !tableMissing && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-right"
              >
                <p className="text-lg font-black text-white">{card.value}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">
              {invoices.length === 0 ? "لا توجد فواتير بعد" : "لا توجد نتائج مطابقة"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((invoice) => (
              <div
                key={invoice.id}
                className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-bold ${PAYMENT_CLASSES[invoice.paymentStatus]}`}
                    >
                      {PAYMENT_LABELS[invoice.paymentStatus]}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[11px] font-bold ${
                        invoice.type === "estimate"
                          ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                          : "bg-violet-500/10 border-violet-500/30 text-violet-300"
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      {invoice.type === "estimate" ? "عرض سعر" : "فاتورة ضريبية مبسطة"}
                    </span>
                    {invoice.zatcaStatus && (
                      <span
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[11px] font-bold bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        title={invoice.zatcaUuid || undefined}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {invoice.zatcaStatus}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="font-extrabold text-white flex items-center gap-2 justify-end">
                      {invoice.customerName || "—"}
                      <User className="w-4 h-4 text-amber-400" />
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 justify-end flex-wrap">
                      {invoice.customerPhone && (
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          {invoice.customerPhone}
                          <Phone className="w-3 h-3 text-emerald-400" />
                        </span>
                      )}
                      <span>{formatDate(invoice.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {invoice.items.length > 0 && (
                  <ul className="space-y-1 bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3">
                    {invoice.items.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between text-xs text-slate-300"
                      >
                        <span className="text-slate-400">
                          {item.total != null ? money(Number(item.total)) : ""}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <strong className="text-amber-400">× {item.quantity ?? 1}</strong>
                          {item.title || item.serviceTitle || "بند"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-end justify-between gap-4 flex-wrap pt-3 border-t border-slate-800">
                  <select
                    value={invoice.paymentStatus}
                    disabled={busyId === invoice.id}
                    onChange={(e) =>
                      changePayment(invoice.id, e.target.value as InvoicePaymentStatus)
                    }
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    {INVOICE_PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {PAYMENT_LABELS[status]}
                      </option>
                    ))}
                  </select>

                  <div className="text-right space-y-0.5 text-xs text-slate-400">
                    <p>
                      الإجمالي قبل الضريبة: <span className="text-slate-200">{money(invoice.subtotal)}</span>
                    </p>
                    {invoice.discount > 0 && (
                      <p>
                        الخصم: <span className="text-slate-200">{money(invoice.discount)}</span>
                      </p>
                    )}
                    <p>
                      الضريبة: <span className="text-slate-200">{money(invoice.taxAmount)}</span>
                    </p>
                    <p className="text-base font-black text-white pt-1">
                      {money(invoice.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </>
  );
}
