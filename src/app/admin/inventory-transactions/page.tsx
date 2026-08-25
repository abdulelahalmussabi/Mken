"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  History,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import type { InventoryTransaction } from "@/lib/mken/inventory-transactions";
import type { InventoryItem } from "@/lib/mken/inventory";

export default function AdminInventoryTransactionsPage() {
  const { session } = useAdmin();
  const tenantSlug = session?.clientSlug || "almahrusa";

  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [txItemId, setTxItemId] = useState("");
  const [txType, setTxType] = useState<"stock-in" | "stock-out" | "adjustment">("stock-in");
  const [txQty, setTxQty] = useState<number>(1);
  const [txNotes, setTxNotes] = useState("");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Transactions & Items for Selection
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [txRes, itemsRes] = await Promise.all([
        fetch(`/api/inventory-transactions?tenant_slug=${encodeURIComponent(tenantSlug)}`),
        fetch(`/api/inventory?tenant_slug=${encodeURIComponent(tenantSlug)}`),
      ]);

      const txData = await txRes.json();
      const itemsData = await itemsRes.json();

      if (txData.success) {
        setTransactions(txData.transactions || []);
        setTableMissing(!!txData.tableMissing);
        if (txData.error) setErrorMsg(txData.error);
      } else {
        setErrorMsg(txData.error || "فشل تحميل حركات المخزون");
      }

      if (itemsData.success) {
        setItems(itemsData.items || []);
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    let stockInQty = 0;
    let stockOutQty = 0;
    let adjustmentCount = 0;

    transactions.forEach((tx) => {
      if (tx.type === "stock-in") stockInQty += tx.quantity;
      if (tx.type === "stock-out") stockOutQty += tx.quantity;
      if (tx.type === "adjustment") adjustmentCount++;
    });

    return {
      totalCount: transactions.length,
      stockInQty,
      stockOutQty,
      adjustmentCount,
    };
  }, [transactions]);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesType = typeFilter === "all" || tx.type === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tx.item_id.toLowerCase().includes(q) ||
        (tx.item_name && tx.item_name.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.reference_id && tx.reference_id.toLowerCase().includes(q));

      return matchesType && matchesSearch;
    });
  }, [transactions, typeFilter, searchQuery]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txItemId) {
      showToast("يرجى اختيار المنتج", "error");
      return;
    }
    if (txQty <= 0) {
      showToast("يرجى اختيار كمية صالحة", "error");
      return;
    }

    try {
      const res = await fetch("/api/inventory-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          item_id: txItemId,
          type: txType,
          quantity: txQty,
          notes: txNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("تم تسجيل الحركة المخزنية وتحديث الكميات بنجاح");
        setModalOpen(false);
        setTxNotes("");
        setTxQty(1);
        loadData();
      } else {
        showToast(data.error || "فشل تسجيل الحركة", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                <History className="w-3.5 h-3.5" />
                <span>سجل التدقيق والمراجعة — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">حركات المخزون والمستودع</h1>
              <p className="text-slate-400 text-xs">
                متابعة سجل حركات التوريد والصرف والتسويات المخزنية مع مراجعة التدقيق المباشر.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-all flex items-center gap-1.5"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>

              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                تسجيل حركة جديدة
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول حركات المخزون غير موجود في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى تنفيذ السكربت <code>scripts/setup-db.sql</code> لتشغيل جدول <code>mken_inventory_transactions</code>.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>إجمالي الحركات</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalCount} حركة</p>
              <p className="text-[10px] text-slate-500">مسجلة في السجل</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                <span>كميات الوارد (+)</span>
              </div>
              <p className="text-xl font-black text-emerald-400">{stats.stockInQty}</p>
              <p className="text-[10px] text-slate-500">تمت إضافتها للمستودع</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span>كميات الصادر (-)</span>
              </div>
              <p className="text-xl font-black text-rose-400">{stats.stockOutQty}</p>
              <p className="text-[10px] text-slate-500">تم صرفها من المستودع</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>عدد التسويات (=)</span>
              </div>
              <p className="text-xl font-black text-amber-400">{stats.adjustmentCount}</p>
              <p className="text-[10px] text-slate-500">تسويات الجرد</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "all" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              الجميع ({transactions.length})
            </button>
            <button
              onClick={() => setTypeFilter("stock-in")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "stock-in" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              وارد (+)
            </button>
            <button
              onClick={() => setTypeFilter("stock-out")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "stock-out" ? "bg-rose-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              صادر (-)
            </button>
            <button
              onClick={() => setTypeFilter("adjustment")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                typeFilter === "adjustment" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              تسوية (=)
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="بحث باسم المنتج، المعرف، المرجع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Transactions Audit Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
              <p>جاري تحميل سجل حركات المخزون...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3">
              <History className="w-10 h-10 mx-auto text-slate-600" />
              <p className="font-bold text-slate-300">لا توجد حركات مخزنية مطابقة لشروط البحث</p>
              <p className="text-[11px] text-slate-500">قم بتعديل تصفية البحث أو تسجيل حركة مخزنية جديدة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                    <th className="px-5 py-4">التاريخ والوقت</th>
                    <th className="px-5 py-4">المنتج</th>
                    <th className="px-5 py-4">نوع الحركة</th>
                    <th className="px-5 py-4">الكمية</th>
                    <th className="px-5 py-4">المرجع / ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString("ar-SA") : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-100 text-sm">{tx.item_name || "منتج عام"}</p>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {tx.item_id}</span>
                      </td>
                      <td className="px-5 py-4">
                        {tx.type === "stock-in" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                            <ArrowDownRight className="w-3.5 h-3.5" /> وارد (+)
                          </span>
                        )}
                        {tx.type === "stock-out" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold text-[11px]">
                            <ArrowUpRight className="w-3.5 h-3.5" /> صادر (-)
                          </span>
                        )}
                        {tx.type === "adjustment" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold text-[11px]">
                            <RefreshCw className="w-3.5 h-3.5" /> تسوية (=)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-black text-slate-100 text-sm">{tx.quantity}</td>
                      <td className="px-5 py-4 text-slate-400">
                        {tx.notes || tx.reference_id || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Record Transaction */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-right space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  تسجيل حركة مخزنية جديدة
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-4">
                {/* Select Product */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اختيار المنتج *</label>
                  <select
                    required
                    value={txItemId}
                    onChange={(e) => setTxItemId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- اختر المنتج من القائمة --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} (الكمية الحالية: {it.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Movement Type */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">نوع الحركة</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxType("stock-in")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        txType === "stock-in"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      وارد (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType("stock-out")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        txType === "stock-out"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      صادر (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType("adjustment")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        txType === "adjustment"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      تسوية (=)
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">
                    {txType === "adjustment" ? "الكمية الجديدة المطلوبة" : "الكمية"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={txQty}
                    onChange={(e) => setTxQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">ملاحظات / مرجع التوريد</label>
                  <input
                    type="text"
                    placeholder="مثال: توريد شحنة جديدة رقم 882"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-md transition-all"
                  >
                    تسجيل الحركة المخزنية
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
