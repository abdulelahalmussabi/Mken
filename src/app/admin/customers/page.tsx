"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import {
  Users,
  UserPlus,
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
  FileText,
  DollarSign,
  TrendingDown,
  UserCheck,
} from "lucide-react";
import type { Customer } from "@/lib/mken/customers";

export default function AdminCustomersPage() {
  const { session } = useAdmin();
  const tenantSlug = session?.clientSlug || "almahrusa";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Fetch Customers Data
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/customers?tenant_slug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();

      if (data.success) {
        setCustomers(data.customers || []);
        setTableMissing(!!data.tableMissing);
        if (data.error) setErrorMsg(data.error);
      } else {
        setErrorMsg(data.error || "فشل تحميل قائمة العملاء");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = customers.length;
    const withPhoneCount = customers.filter((c) => !!c.phone).length;
    return {
      totalCount,
      withPhoneCount,
    };
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Handlers for Add/Edit
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "", address: "" });
    setModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
    });
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast("اسم العميل مطلوب", "error");
      return;
    }

    try {
      const url = "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";
      const payload = editingCustomer
        ? { id: editingCustomer.id, ...formData, tenant_slug: tenantSlug }
        : { ...formData, tenant_slug: tenantSlug };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingCustomer ? "تم تحديث بيانات العميل بنجاح" : "تم إضافة العميل بنجاح");
        setModalOpen(false);
        loadCustomers();
      } else {
        showToast(data.error || "فشل حفظ البيانات", "error");
      }
    } catch {
      showToast("حدث خطأ في الاتصال بالشبكة", "error");
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customer.name}"؟`)) return;

    try {
      const res = await fetch(`/api/customers?id=${customer.id}&tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        showToast("تم حذف العميل بنجاح");
        loadCustomers();
      } else {
        showToast(data.error || "فشل حذف العميل", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء طلب الحذف", "error");
    }
  };

  // Ledger handler
  const handleOpenLedger = (customer: Customer) => {
    setLedgerCustomer(customer);
    setLedgerModalOpen(true);
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

        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>إدارة العملاء والديون — منصة مكّن</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">قائمة العملاء والحسابات</h1>
              <p className="text-slate-400 text-xs">
                إدارة سجلات العملاء، بيانات الاتصال، كشوف الحساب ومتابعة المبالغ والديون الآجلة.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadCustomers}
                disabled={loading}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition-all flex items-center gap-1.5"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs rounded-xl shadow-lg transition-all"
              >
                <UserPlus className="w-4 h-4" />
                إضافة عميل جديد
              </button>
            </div>
          </div>

          {/* Database Table Warning Banner */}
          {tableMissing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold">تنبيه: جدول العملاء غير موجود في قاعدة البيانات (PGRST205)</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  يرجى تنفيذ السكربت <code>scripts/setup-db.sql</code> في Supabase لتحديث جدول <code>mken_customers</code>.
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
                <Users className="w-4 h-4 text-blue-400" />
                <span>إجمالي العملاء</span>
              </div>
              <p className="text-xl font-black text-white">{stats.totalCount} عميل</p>
              <p className="text-[10px] text-slate-500">مسجلين في المنشأة</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>عملاء بأرقام هواتف</span>
              </div>
              <p className="text-xl font-black text-emerald-400">{stats.withPhoneCount} عميل</p>
              <p className="text-[10px] text-slate-500">مكتملي بيانات الاتصال</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>حالة الحسابات</span>
              </div>
              <p className="text-xl font-black text-amber-400">نشطة (مزامنة)</p>
              <p className="text-[10px] text-slate-500">جاهزة للفواتير والمواعيد</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="البحث باسم العميل، الهاتف، البريد أو العنوان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400">
            عدد النتائج: <strong className="text-slate-100">{filteredCustomers.length}</strong>
          </span>
        </div>

        {/* Table of Customers */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              <p>جاري تحميل قائمة العملاء...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <p className="font-bold text-slate-300">لا يوجد عملاء مطبقون لشروط البحث</p>
              <p className="text-[11px] text-slate-500">اضغط على زر "إضافة عميل جديد" للبدء.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold">
                    <th className="px-5 py-4">اسم العميل</th>
                    <th className="px-5 py-4">رقم الهاتف</th>
                    <th className="px-5 py-4">البريد الإلكتروني</th>
                    <th className="px-5 py-4">العنوان / المدينة</th>
                    <th className="px-5 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-800/20 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 shrink-0">
                            {customer.name.slice(0, 1)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-100 text-sm">{customer.name}</p>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {customer.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4">
                        {customer.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span dir="ltr">{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4">
                        {customer.email ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>{customer.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-5 py-4">
                        {customer.address ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[200px]">{customer.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenLedger(customer)}
                            className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1"
                            title="كشف حساب العميل والديون"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>كشف الحساب</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(customer)}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all"
                            title="تعديل البيانات"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                            title="حذف العميل"
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

        {/* Modal: Add / Edit Customer */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-right space-y-5 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">اسم العميل الثلاثي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عبد الله بن محمد العتيبي"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">رقم الهاتف / الواتساب</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-left"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="customer@domain.com"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-left"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">العنوان / المدينة والملاحظات</label>
                  <input
                    type="text"
                    placeholder="الرياض - حي النرجس"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-xs rounded-xl shadow-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
                  >
                    {editingCustomer ? "حفظ التعديلات" : "إضافة العميل الآن"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Customer Ledger / Account Statement */}
        {ledgerModalOpen && ledgerCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-right space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-white text-base">كشف حساب العميل</h3>
                  <p className="text-xs text-blue-400 font-bold mt-0.5">{ledgerCustomer.name}</p>
                </div>
                <button
                  onClick={() => setLedgerModalOpen(false)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>رقم الهاتف:</span>
                    <span className="font-mono text-slate-200" dir="ltr">{ledgerCustomer.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>البريد الإلكتروني:</span>
                    <span className="font-mono text-slate-200">{ledgerCustomer.email || "—"}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>العنوان:</span>
                    <span className="text-slate-200">{ledgerCustomer.address || "—"}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                  <span className="text-emerald-300 font-bold">الرصيد والديون الآجلة:</span>
                  <span className="text-emerald-400 font-black text-sm">0.00 ر.س (لا يوجد ديون قائمة)</span>
                </div>

                <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  لا توجد فواتير غير مدفوعة مرتبطة بهذا العميل حالياً.
                </div>

                <button
                  onClick={() => setLedgerModalOpen(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  إغلاق كشف الحساب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
