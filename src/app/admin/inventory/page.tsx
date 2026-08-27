"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Layers,
  History,
  Barcode,
  Image as ImageIcon,
} from "lucide-react";
import type { InventoryItem, InventoryTransaction } from "@/lib/mken/inventory";

export default function AdminInventoryPage() {
  const { session, currentTenantSlug, hostTenantSlug } = useAdmin();
  const tenantSlug = currentTenantSlug || session?.clientSlug || hostTenantSlug || "rewa";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"items" | "transactions">("items");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txTargetItem, setTxTargetItem] = useState<InventoryItem | null>(null);
  const [txType, setTxType] = useState<"stock-in" | "stock-out" | "adjustment">("stock-in");
  const [txQuantity, setTxQuantity] = useState<number>(1);
  const [txNotes, setTxNotes] = useState<string>("");

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: "",
    sku: "",
    barcode: "",
    cost_price: 0,
    sell_price: 0,
    quantity: 0,
    min_stock_alert: 5,
    image_url: "",
  });

  // Fetch Inventory Data
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/inventory?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.items || []);
        setTransactions(data.transactions || []);
        setTableMissing(!!data.tableMissing);
        if (data.error) setErrorMsg(data.error);
      } else {
        setErrorMsg(data.error || "فشل تحميل بيانات المخزون");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalCost = 0;
    let totalSell = 0;
    let lowStockCount = 0;

    items.forEach((item) => {
      const qty = Math.max(0, item.quantity);
      totalCost += (item.cost_price || 0) * qty;
      totalSell += (item.sell_price || 0) * qty;
      if (qty <= (item.min_stock_alert || 0)) {
        lowStockCount++;
      }
    });

    return {
      totalCost,
      totalSell,
      lowStockCount,
      totalCount: items.length,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q));

      const matchesLowStock = !filterLowStockOnly || item.quantity <= item.min_stock_alert;

      return matchesSearch && matchesLowStock;
    });
  }, [items, searchQuery, filterLowStockOnly]);

  // Handlers for Add/Edit Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      cost_price: 0,
      sell_price: 0,
      quantity: 0,
      min_stock_alert: 5,
      image_url: "",
    });
    setItemModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || "",
      barcode: item.barcode || "",
      cost_price: item.cost_price,
      sell_price: item.sell_price,
      quantity: item.quantity,
      min_stock_alert: item.min_stock_alert,
      image_url: item.image_url || "",
    });
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast("يرجى إدخال اسم المنتج", "error");
      return;
    }

    try {
      const url = "/api/inventory";
      const method = editingItem ? "PUT" : "POST";
      const payload = editingItem
        ? { id: editingItem.id, ...formData, tenant_slug: tenantSlug }
        : { ...formData, tenant_slug: tenantSlug };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingItem ? "تم تحديث بيانات المنتج بنجاح" : "تمت إضافة المنتج بنجاح");
        setItemModalOpen(false);
        loadInventory();
      } else {
        showToast(data.error || "فشل حفظ البيانات", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`هل أنت متأكد من حذف المنتج "${item.name}" نهائياً؟`)) return;

    try {
      const res = await fetch(`/api/inventory?id=${item.id}&tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showToast("تم حذف المنتج بنجاح");
        loadInventory();
      } else {
        showToast(data.error || "فشل حذف المنتج", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء طلب الحذف", "error");
    }
  };

  // Handlers for Movement / Transaction Modal
  const handleOpenTxModal = (item: InventoryItem) => {
    setTxTargetItem(item);
    setTxType("stock-in");
    setTxQuantity(1);
    setTxNotes("");
    setTxModalOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTargetItem || txQuantity <= 0) {
      showToast("يرجى تحديد كمية صالحة", "error");
      return;
    }

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transaction",
          tenant_slug: tenantSlug,
          item_id: txTargetItem.id,
          type: txType,
          quantity: txQuantity,
          notes: txNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("تم تسجيل الحركة المخزنية وتحديث الكمية بنجاح");
        setTxModalOpen(false);
        loadInventory();
      } else {
        showToast(data.error || "فشل تسجيل الحركة المخزنية", "error");
      }
    } catch {
      showToast("حدث خطأ في الشبكة أثناء تسجل الحركة", "error");
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Package className="w-3.5 h-3.5" />
                <span>المستودع والمخزون — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إدارة المخزون والمستودع</h1>
              <p className="text-slate-400 text-xs">
                متابعة أصناف المنتجات، أسعار التكلفة والبيع، كميات المخزون وحركات الوارد والصادر.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadInventory}
                disabled={loading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-all flex items-center gap-1.5"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                إضافة منتج جديد
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول المخزون غير محدد في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى التأكد من تنفيذ ملف السكربت <code>scripts/setup-db.sql</code> لتفعيل جداول المخزون والحركات.
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
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>إجمالي التكلفة</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalCost.toFixed(2)} ر.س</p>
              <p className="text-[10px] text-slate-500">قيمة شراء المخزون الحالي</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>إجمالي سعر البيع</span>
              </div>
              <p className="text-xl font-black text-amber-400">{stats.totalSell.toFixed(2)} ر.س</p>
              <p className="text-[10px] text-slate-500">القيمة السوقية المتوقعة</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>منخفض المخزون</span>
              </div>
              <p className="text-xl font-black text-rose-400">{stats.lowStockCount} صنف</p>
              <p className="text-[10px] text-slate-500">تجاوزت حد الإنذار</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>عدد المنتجات</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalCount} منتج</p>
              <p className="text-[10px] text-slate-500">المسجلة في المستودع</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "items"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>قائمة المنتجات ({filteredItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "transactions"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل حركات المخزون ({transactions.length})</span>
            </button>
          </div>

          {/* Search & Filter */}
          {activeTab === "items" && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={filterLowStockOnly}
                  onChange={(e) => setFilterLowStockOnly(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>الأصناف المنخفضة فقط</span>
              </label>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="بحث باسم المنتج، SKU، أو الباركود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Items List */}
        {activeTab === "items" && (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                <p>جاري تحميل قائمة المنتجات...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                <Package className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-bold text-slate-300">لا توجد منتجات مطابقة لعملية البحث</p>
                <p className="text-[11px] text-slate-500">قم بإضافة أصناف جديدة لمستودعك أو تغيير عبارة البحث.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                      <th className="px-5 py-4">المنتج</th>
                      <th className="px-5 py-4">SKU / الباركود</th>
                      <th className="px-5 py-4">سعر التكلفة</th>
                      <th className="px-5 py-4">سعر البيع</th>
                      <th className="px-5 py-4">الكمية الحالية</th>
                      <th className="px-5 py-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map((item) => {
                      const isLowStock = item.quantity <= item.min_stock_alert;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                          {/* Image + Name */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-100 text-sm">{item.name}</p>
                                <span className="text-[10px] text-slate-500">معرف: {item.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* SKU & Barcode */}
                          <td className="px-5 py-4">
                            <div className="font-mono text-slate-300 space-y-0.5">
                              <div>{item.sku || "—"}</div>
                              {item.barcode && (
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Barcode className="w-3 h-3" />
                                  <span>{item.barcode}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Cost Price */}
                          <td className="px-5 py-4 text-slate-300 font-bold">
                            {item.cost_price.toFixed(2)} ر.س
                          </td>

                          {/* Sell Price */}
                          <td className="px-5 py-4 text-amber-400 font-bold">
                            {item.sell_price.toFixed(2)} ر.س
                          </td>

                          {/* Quantity Badge */}
                          <td className="px-5 py-4">
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={`px-2.5 py-1 rounded-full font-black text-xs border ${
                                  isLowStock
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {item.quantity}
                              </span>
                              {isLowStock && (
                                <span className="text-[10px] text-rose-400 font-bold">
                                  (الحد الأدنى: {item.min_stock_alert})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenTxModal(item)}
                                className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1"
                                title="حركة مخزنية (وارد / صادر)"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>تعديل كمية</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all"
                                title="تعديل تفاصيل المنتج"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                                title="حذف المنتج"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Transactions Log */}
        {activeTab === "transactions" && (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <History className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-bold text-slate-300">لا توجد حركات مخزنية مسجلة حتى الآن</p>
                <p className="text-[11px] text-slate-500">
                  عند إجراء أي حركة توريد، صرف أو تسوية ستظهر السجلات تفصيلياً هنا.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                      <th className="px-5 py-4">التاريخ والوقت</th>
                      <th className="px-5 py-4">نوع الحركة</th>
                      <th className="px-5 py-4">معرّف المنتج</th>
                      <th className="px-5 py-4">الكمية</th>
                      <th className="px-5 py-4">المرجع / ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString("ar-SA") : "—"}
                        </td>
                        <td className="px-5 py-4">
                          {tx.type === "stock-in" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                              <ArrowDownRight className="w-3 h-3" /> وارد (+)
                            </span>
                          )}
                          {tx.type === "stock-out" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold">
                              <ArrowUpRight className="w-3 h-3" /> صادر (-)
                            </span>
                          )}
                          {tx.type === "adjustment" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                              <RefreshCw className="w-3 h-3" /> تسوية (=)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-300">{tx.item_id}</td>
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
        )}

        {/* Modal: Add / Edit Product */}
        {itemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-right space-y-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  {editingItem ? "تعديل بيانات المنتج" : "إضافة منتج جديد للمستودع"}
                </h3>
                <button
                  onClick={() => setItemModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: شامبو العناية الفائقة 500 مل"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* SKU & Barcode */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">رمز SKU</label>
                    <input
                      type="text"
                      placeholder="SHAMP-500"
                      value={formData.sku || ""}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">الباركود (Barcode)</label>
                    <input
                      type="text"
                      placeholder="6291100223344"
                      value={formData.barcode || ""}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Cost & Sell Prices */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">سعر التكلفة (ر.س)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">سعر البيع (ر.س)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sell_price ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, sell_price: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Quantity & Min Stock Alert */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">الكمية المتاحة</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.quantity ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">حد إشعار النقصان</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_stock_alert ?? 5}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_stock_alert: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Image URL */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">رابط صورة المنتج (اختياري)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.image_url || ""}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono dir-ltr text-left"
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:from-amber-400 hover:to-orange-500 transition-all"
                  >
                    {editingItem ? "حفظ التعديلات" : "إضافة المنتج الآن"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Stock Movement / Transaction */}
        {txModalOpen && txTargetItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-right space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-white text-base">تسجيل حركة مخزنية</h3>
                  <p className="text-xs text-amber-400 font-bold mt-0.5">{txTargetItem.name}</p>
                </div>
                <button
                  onClick={() => setTxModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTx} className="space-y-4">
                {/* Current Stock */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>الكمية الحالية بالمستودع:</span>
                  <span className="font-black text-amber-400 text-sm">{txTargetItem.quantity}</span>
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
                    {txType === "adjustment" ? "الكمية الجديدة بعد التسوية" : "الكمية"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">ملاحظات / مركب الفاتورة</label>
                  <input
                    type="text"
                    placeholder="مثال: فاتورة توريد رقم 1024 أو جرد شهري"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all"
                  >
                    تأكيد الحركة المخزنية
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxModalOpen(false)}
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
