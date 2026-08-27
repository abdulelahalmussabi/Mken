"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  Truck,
  FileCheck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  FileText,
  DollarSign,
  ShoppingCart,
  Receipt,
  Layers,
} from "lucide-react";
import type { Vendor, PurchaseInvoice, PurchaseInvoiceItem } from "@/lib/mken/purchases";

export default function AdminPurchasesPage() {
  const { session, currentTenantSlug, hostTenantSlug } = useAdmin();
  const tenantSlug = currentTenantSlug || session?.clientSlug || hostTenantSlug || "rewa";

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active tab: 'vendors' | 'invoices'
  const [activeTab, setActiveTab] = useState<"vendors" | "invoices">("vendors");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Vendor Form State
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  // Purchase Invoice Form State
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid");
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([
    { name: "", quantity: 1, unit_price: 0, total: 0 },
  ]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Purchases Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/purchases?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();

      if (data.success) {
        setVendors(data.vendors || []);
        setInvoices(data.invoices || []);
        setTableMissing(!!data.tableMissing);
        if (data.error) setErrorMsg(data.error);
      } else {
        setErrorMsg(data.error || "فشل تحميل بيانات الموردين والمشتريات");
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

  // Stats
  const stats = useMemo(() => {
    const totalVendors = vendors.length;
    const totalInvoices = invoices.length;
    let unpaidTotal = 0;
    let totalPurchasesAmount = 0;

    invoices.forEach((inv) => {
      totalPurchasesAmount += inv.total_amount || 0;
      if (inv.payment_status === "unpaid") {
        unpaidTotal += inv.total_amount || 0;
      }
    });

    return {
      totalVendors,
      totalInvoices,
      totalPurchasesAmount,
      unpaidTotal,
    };
  }, [vendors, invoices]);

  // Filtered lists
  const filteredVendors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
        (v.phone && v.phone.includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q))
    );
  }, [vendors, searchQuery]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return invoices;
    return invoices.filter((inv) => inv.id.toLowerCase().includes(q));
  }, [invoices, searchQuery]);

  // Handlers for Vendor
  const handleOpenAddVendor = () => {
    setEditingVendor(null);
    setVendorForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
    setVendorModalOpen(true);
  };

  const handleOpenEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setVendorForm({
      name: v.name,
      contact_person: v.contact_person || "",
      phone: v.phone || "",
      email: v.email || "",
      address: v.address || "",
    });
    setVendorModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name?.trim()) {
      showToast("اسم المورد مطلوب", "error");
      return;
    }

    try {
      const url = "/api/purchases";
      const method = editingVendor ? "PUT" : "POST";
      const payload = editingVendor
        ? { id: editingVendor.id, ...vendorForm, tenant_slug: tenantSlug }
        : { ...vendorForm, tenant_slug: tenantSlug };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingVendor ? "تم تحديث بيانات المورد بنجاح" : "تمت إضافة المورد بنجاح");
        setVendorModalOpen(false);
        loadData();
      } else {
        showToast(data.error || "فشل حفظ المورد", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
    }
  };

  const handleDeleteVendor = async (v: Vendor) => {
    if (!confirm(`هل أنت متأكد من حذف المورد "${v.name}"؟`)) return;

    try {
      const res = await fetch(`/api/purchases?id=${v.id}&type=vendor&tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showToast("تم حذف المورد بنجاح");
        loadData();
      } else {
        showToast(data.error || "فشل حذف المورد", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء الحذف", "error");
    }
  };

  // Dynamic Item builder for Purchase Invoice
  const handleItemChange = (index: number, field: keyof PurchaseInvoiceItem, value: any) => {
    const nextItems = [...invoiceItems];
    const current = { ...nextItems[index], [field]: value };

    if (field === "quantity" || field === "unit_price") {
      const q = Number(current.quantity || 0);
      const p = Number(current.unit_price || 0);
      current.total = q * p;
    }

    nextItems[index] = current;
    setInvoiceItems(nextItems);
  };

  const handleAddItemRow = () => {
    setInvoiceItems([...invoiceItems, { name: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (invoiceItems.length === 1) return;
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculatedInvoiceTotal = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [invoiceItems]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = invoiceItems.filter((it) => it.name.trim() !== "");
    if (validItems.length === 0) {
      showToast("يرجى إدخال بند واحد على الأقل", "error");
      return;
    }

    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          tenant_slug: tenantSlug,
          vendor_id: selectedVendorId || null,
          items: validItems,
          total_amount: calculatedInvoiceTotal,
          payment_status: paymentStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("تم تسجيل فاتورة المشتريات بنجاح");
        setInvoiceModalOpen(false);
        setInvoiceItems([{ name: "", quantity: 1, unit_price: 0, total: 0 }]);
        loadData();
      } else {
        showToast(data.error || "فشل تسجيل الفاتورة", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
    }
  };

  const handleDeleteInvoice = async (inv: PurchaseInvoice) => {
    if (!confirm(`هل أنت متأكد من حذف فاتورة المشتريات ${inv.id}؟`)) return;

    try {
      const res = await fetch(`/api/purchases?id=${inv.id}&type=invoice&tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showToast("تم حذف الفاتورة بنجاح");
        loadData();
      } else {
        showToast(data.error || "فشل حذف الفاتورة", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء الحذف", "error");
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <Truck className="w-3.5 h-3.5" />
                <span>إدارة المشتريات والتوريد — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">الموردين وفواتير المشتريات</h1>
              <p className="text-slate-400 text-xs">
                متابعة الموردين، إصدار فواتير المشتريات، وتسجيل التكاليف وحالة السداد.
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
                onClick={handleOpenAddVendor}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                إضافة مورد
              </button>

              <button
                onClick={() => setInvoiceModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <Receipt className="w-4 h-4" />
                فاتورة مشتريات جديدة
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول الموردين أو المشتريات غير محدد في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى تنفيذ السكربت <code>scripts/setup-db.sql</code> لتشغيل جداول <code>mken_vendors</code> و <code>mken_purchase_invoices</code>.
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
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>إجمالي الموردين</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalVendors} مورد</p>
              <p className="text-[10px] text-slate-500">مسجلين بالمنشأة</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Receipt className="w-4 h-4 text-teal-400" />
                <span>فواتير المشتريات</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalInvoices} فاتورة</p>
              <p className="text-[10px] text-slate-500">إجمالي السجلات</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>قيمة المشتريات</span>
              </div>
              <p className="text-xl font-black text-amber-400">{stats.totalPurchasesAmount.toFixed(2)} ر.س</p>
              <p className="text-[10px] text-slate-500">إجمالي المشتريات</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>غير مدفوعة</span>
              </div>
              <p className="text-xl font-black text-rose-400">{stats.unpaidTotal.toFixed(2)} ر.س</p>
              <p className="text-[10px] text-slate-500">مستحقة للموردين</p>
            </div>
          </div>
        </div>

        {/* Tab Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab("vendors")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "vendors"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>قائمة الموردين ({filteredVendors.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("invoices")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "invoices"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>فواتير المشتريات ({filteredInvoices.length})</span>
            </button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="البحث باسم المورد أو رقم الفاتورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tab 1: Vendors List */}
        {activeTab === "vendors" && (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                <p>جاري تحميل الموردين...</p>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                <Truck className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-bold text-slate-300">لا يوجد موردين مسجلين مطبقين للبحث</p>
                <p className="text-[11px] text-slate-500">قم بإضافة موردين جدد لإدارة التوريد والمشتروات.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                      <th className="px-5 py-4">اسم المورد</th>
                      <th className="px-5 py-4">المسؤول / الجهة</th>
                      <th className="px-5 py-4">رقم الهاتف</th>
                      <th className="px-5 py-4">البريد الإلكتروني</th>
                      <th className="px-5 py-4">العنوان</th>
                      <th className="px-5 py-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredVendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-100 text-sm">{v.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">ID: {v.id}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-300">{v.contact_person || "—"}</td>
                        <td className="px-5 py-4 font-mono text-slate-300">{v.phone || "—"}</td>
                        <td className="px-5 py-4 font-mono text-slate-300">{v.email || "—"}</td>
                        <td className="px-5 py-4 text-slate-300">{v.address || "—"}</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditVendor(v)}
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all"
                              title="تعديل المورد"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVendor(v)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                              title="حذف المورد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Purchase Invoices List */}
        {activeTab === "invoices" && (
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                <Receipt className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-bold text-slate-300">لا توجد فواتير مشتريات مسجلة</p>
                <p className="text-[11px] text-slate-500">
                  اضغط على زر "فاتورة مشتريات جديدة" لإضافة فاتورة توريد.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                      <th className="px-5 py-4">رقم الفاتورة</th>
                      <th className="px-5 py-4">المورد</th>
                      <th className="px-5 py-4">عدد البنود</th>
                      <th className="px-5 py-4">المبلغ الإجمالي</th>
                      <th className="px-5 py-4">حالة السداد</th>
                      <th className="px-5 py-4">التاريخ</th>
                      <th className="px-5 py-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredInvoices.map((inv) => {
                      const vendorObj = vendors.find((v) => v.id === inv.vendor_id);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-5 py-4 font-mono font-bold text-slate-100">{inv.id}</td>
                          <td className="px-5 py-4 text-slate-300">
                            {vendorObj ? vendorObj.name : "مورد عام"}
                          </td>
                          <td className="px-5 py-4 text-slate-400">{inv.items.length} بنود</td>
                          <td className="px-5 py-4 font-black text-amber-400 text-sm">
                            {inv.total_amount.toFixed(2)} ر.س
                          </td>
                          <td className="px-5 py-4">
                            {inv.payment_status === "paid" ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                                مدفوعة
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold text-[11px]">
                                غير مدفوعة
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString("ar-SA") : "—"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => handleDeleteInvoice(inv)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                              title="حذف الفاتورة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* Modal: Add / Edit Vendor */}
        {vendorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-right space-y-5 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  {editingVendor ? "تعديل بيانات مورد" : "إضافة مورد جديد"}
                </h3>
                <button
                  onClick={() => setVendorModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVendor} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اسم المورد / الشركة *</label>
                  <input
                    type="text"
                    required
                    placeholder="شركة التوريدات العالمية"
                    value={vendorForm.name || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اسم الشخص المسؤول</label>
                  <input
                    type="text"
                    placeholder="م. أحمد الشمري"
                    value={vendorForm.contact_person || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">رقم الهاتف</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="05XXXXXXXX"
                    value={vendorForm.phone || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="vendor@company.com"
                    value={vendorForm.email || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">العنوان</label>
                  <input
                    type="text"
                    placeholder="الرياض - المنطقة الصناعية"
                    value={vendorForm.address || ""}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-xs rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-400 transition-all"
                  >
                    {editingVendor ? "حفظ التعديلات" : "إضافة المورد الآن"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: New Purchase Invoice */}
        {invoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-right space-y-5 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-teal-400" />
                  تسجيل فاتورة مشتريات جديدة
                </h3>
                <button
                  onClick={() => setInvoiceModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInvoice} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {/* Select Vendor */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">اختيار المورد</label>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">مورد عام (بدون تحديد)</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">حالة الفاتورة</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as "paid" | "unpaid")}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="unpaid">غير مدفوعة (آجلة)</option>
                      <option value="paid">مدفوعة كاش / تحويل</option>
                    </select>
                  </div>
                </div>

                {/* Items Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300">بنود الفاتورة *</label>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة بند
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
                    {invoiceItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                        <div className="col-span-5">
                          <input
                            type="text"
                            placeholder="اسم البند / المنتج"
                            required
                            value={item.name}
                            onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="الكمية"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 text-center focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="السعر"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 text-center focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="col-span-2 text-left font-bold text-amber-400 text-xs dir-ltr">
                          {(item.total || 0).toFixed(2)}
                        </div>
                        <div className="col-span-1 text-center">
                          {invoiceItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Summary */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">الإجمالي الكلي للفاتورة:</span>
                  <span className="text-xl font-black text-amber-400">{calculatedInvoiceTotal.toFixed(2)} ر.س</span>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-xs rounded-xl shadow-lg hover:from-emerald-500 hover:to-teal-400 transition-all"
                  >
                    تأكيد وحفظ فاتورة المشتريات
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
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
