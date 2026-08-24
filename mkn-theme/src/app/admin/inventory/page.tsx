"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SaasUpgradeNotice from "@/components/SaasUpgradeNotice";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import { SAAS_FEATURE_MESSAGES } from "@/lib/mken/saas";
import type { InventoryItem, InventoryTotals } from "@/lib/mken/inventory";
import {
  Package,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Save,
} from "lucide-react";

type Filter = "all" | "low";

const money = (value: number) => `${value.toLocaleString("ar-SA")} ر.س`;

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  costPrice: "0",
  sellPrice: "0",
  quantity: "0",
  minStockAlert: "0",
};

export default function AdminInventoryPage() {
  const { session, isSuperAdmin, clients, saas } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totals, setTotals] = useState<InventoryTotals | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

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
      const res = await fetch(`/api/inventory${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setItems([]);
        setTotals(null);
        setError(data.message || "تعذّر تحميل المخزون");
      } else {
        setItems(data.items || []);
        setTotals(data.totals || null);
        setTableMissing(Boolean(data.tableMissing));
        setQtyDraft(
          Object.fromEntries((data.items || []).map((i: InventoryItem) => [i.id, String(i.quantity)]))
        );
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

  const visible = useMemo(() => {
    const term = search.trim();
    return items.filter((item) => {
      if (filter === "low" && !item.lowStock) return false;
      if (!term) return true;
      return (
        item.name.includes(term) ||
        item.sku.includes(term) ||
        item.barcode.includes(term)
      );
    });
  }, [items, filter, search]);

  const create = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sku: form.sku,
          barcode: form.barcode,
          costPrice: Number(form.costPrice),
          sellPrice: Number(form.sellPrice),
          quantity: Number(form.quantity),
          minStockAlert: Number(form.minStockAlert),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إضافة الصنف", "error");
        return;
      }

      setItems((prev) => [...prev, data.item].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setQtyDraft((prev) => ({ ...prev, [data.item.id]: String(data.item.quantity) }));
      setForm(emptyForm);
      setShowForm(false);
      showToast("تم إضافة الصنف", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveQuantity = async (id: string) => {
    const quantity = Number(qtyDraft[id]);
    if (!Number.isFinite(quantity) || quantity < 0) {
      showToast("الكمية غير صحيحة", "error");
      return;
    }

    setBusyId(id);
    try {
      const res = await fetch(`/api/inventory/${id}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر تحديث الكمية", "error");
        return;
      }

      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      showToast("تم تحديث الكمية", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الصنف؟")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/inventory/${id}${query}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حذف الصنف", "error");
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast("تم حذف الصنف", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {!isSuperAdmin && !saas.hasInvoices ? (
        <SaasUpgradeNotice title="المخزون غير متاح" message={SAAS_FEATURE_MESSAGES.invoices} />
      ) : (
      <div className="space-y-6 text-right">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                تحديث
              </button>
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                disabled={tableMissing}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة صنف
              </button>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-bold">
              <Package className="w-3.5 h-3.5" />
              <span>المخزون</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white">أصناف المستودع</h1>

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
                placeholder="ابحث بالاسم أو SKU أو الباركود"
                className="w-full px-4 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "all", label: "الكل" },
                  { id: "low", label: "تنبيه نقص" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filter === item.id
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400"
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
            <p>جدول المخزون غير مُنشأ في قاعدة البيانات لهذا المشروع.</p>
            <p className="font-normal text-amber-300/80">
              نفّذ القسم الخاص بـ mken_inventory_items من scripts/setup-db.sql لتفعيل المستودع.
            </p>
          </div>
        )}

        {totals && !tableMissing && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "عدد الأصناف", value: String(totals.count) },
              { label: "تحت حد التنبيه", value: String(totals.lowStock) },
              { label: "قيمة التكلفة", value: money(totals.stockValueCost) },
              { label: "قيمة البيع", value: money(totals.stockValueSell) },
            ].map((card) => (
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

        {showForm && (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-amber-500/30 space-y-4">
            <h2 className="text-sm font-bold text-amber-300">صنف جديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم الصنف *"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="SKU"
                dir="ltr"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-left focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="الباركود"
                dir="ltr"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-left focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                placeholder="سعر التكلفة"
                type="number"
                min={0}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                placeholder="سعر البيع"
                type="number"
                min={0}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="الكمية"
                type="number"
                min={0}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.minStockAlert}
                onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
                placeholder="حد تنبيه النقص"
                type="number"
                min={0}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={create}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">
              {items.length === 0 ? "لا توجد أصناف بعد" : "لا توجد نتائج مطابقة"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((item) => (
              <div
                key={item.id}
                className={`p-5 rounded-3xl border space-y-3 ${
                  item.lowStock
                    ? "bg-rose-950/20 border-rose-900/50"
                    : "bg-slate-900/80 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={busyId === item.id}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {item.lowStock && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        نقص مخزون
                      </span>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <p className="font-extrabold text-white">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 justify-end flex-wrap">
                      {item.sku && (
                        <span className="font-mono" dir="ltr">
                          SKU: {item.sku}
                        </span>
                      )}
                      {item.barcode && (
                        <span className="font-mono" dir="ltr">
                          {item.barcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveQuantity(item.id)}
                      disabled={busyId === item.id || qtyDraft[item.id] === String(item.quantity)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl disabled:opacity-40"
                      title="حفظ الكمية"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <input
                      value={qtyDraft[item.id] ?? String(item.quantity)}
                      onChange={(e) =>
                        setQtyDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      type="number"
                      min={0}
                      className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-500">
                      تنبيه عند ≤ {item.minStockAlert}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-0.5 text-right">
                    <p>
                      التكلفة: <span className="text-slate-200">{money(item.costPrice)}</span>
                    </p>
                    <p>
                      البيع:{" "}
                      <span className="text-amber-300 font-bold">{money(item.sellPrice)}</span>
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
