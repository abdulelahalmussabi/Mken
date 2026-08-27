"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { useAdmin } from "@/context/AdminContext";
import { SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import type { ClientRecord } from "@/types/database";
import {
  Palette,
  Globe,
  Users,
  Check,
  CheckCircle2,
  Eye,
  Plus,
  X,
  Edit3,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Gift,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  clinic: "🏥 مجمع طبي / عيادات",
  gym: "🏋️ نادي صحي / رياضي",
  hotel: "🏢 فندق / شقق",
  salon: "💈 صالون / حلاقة",
  restaurant: "🍽️ مطعم",
  cafe: "☕ مقهى",
  other: "🏪 أخرى",
};

const occasionsList = Object.values(SAUDI_OCCASIONS);

export default function AdminDashboardPage() {
  const {
    session,
    isSuperAdmin,
    isTenantDomain,
    globalTheme,
    setGlobalTheme,
    clients,
    getClientTheme,
    setClientTheme,
    addClient,
    removeClient,
    updateClient,
  } = useAdmin();
  const router = useRouter();

  // Strict Tenant Guard: If accessed by a client admin or on a tenant custom domain/subdomain, redirect to /admin/client
  useEffect(() => {
    if (session?.role === "client" || isTenantDomain || !isSuperAdmin) {
      router.replace("/admin/client");
    }
  }, [session, isTenantDomain, isSuperAdmin, router]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (!isSuperAdmin || isTenantDomain) {
    return null;
  }

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // New Client Form State
  const [newClient, setNewClient] = useState<Partial<ClientRecord>>({
    type: "clinic",
    theme: "national_day",
    active: true,
  });

  const handleAddClient = () => {
    if (!newClient.slug?.trim()) {
      showToast("يرجى إدخال المعرف الإنجليزي (Slug) للمنشأة", "error");
      return;
    }
    if (!newClient.name?.trim()) {
      showToast("يرجى إدخال اسم المنشأة", "error");
      return;
    }
    if (!newClient.adminEmail?.trim()) {
      showToast("يرجى إدخال البريد الإلكتروني الخاص بمدير المنشأة", "error");
      return;
    }
    if (!newClient.adminPassword?.trim()) {
      showToast("يرجى إدخال كلمة مرور الحساب", "error");
      return;
    }

    const cleanSlug = newClient.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");

    addClient({
      slug: cleanSlug,
      name: newClient.name.trim(),
      tagline: newClient.tagline?.trim() || "احجز واستمتع بأفضل الخدمات",
      subtitle: newClient.subtitle?.trim() || "",
      type: (newClient.type as ClientRecord["type"]) || "clinic",
      phone: newClient.phone?.trim() || "0500000000",
      whatsapp: newClient.whatsapp?.trim() || "966500000000",
      email: newClient.email?.trim() || newClient.adminEmail?.trim(),
      location: newClient.location?.trim() || "المملكة العربية السعودية",
      rating: "4.9",
      reviewsCount: "0 تقييم",
      heroImage:
        newClient.heroImage ||
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      demoNotice: newClient.demoNotice || `✨ موقع ${newClient.name} على منصة مكّن`,
      adminEmail: newClient.adminEmail.trim(),
      adminPassword: newClient.adminPassword.trim(),
      theme: (newClient.theme as OccasionId) || "national_day",
      active: true,
      createdAt: new Date().toISOString(),
    });

    showToast(`تمت إضافة منشأة "${newClient.name}" بنجاح!`, "success");
    setNewClient({ type: "clinic", theme: "national_day", active: true });
    setShowAddForm(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-10 text-right">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 ${
              toastMessage.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/80 border-rose-500/40 text-rose-300"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <X className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-extrabold">{toastMessage.text}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-amber-500/20 shadow-xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>لوحة التحكم المركزية — منصة مكّن</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {isSuperAdmin ? "إدارة الثيمات والعملاء" : "إعدادات حساب العميل"}
          </h1>
          <p className="text-slate-400 text-xs">
            {isSuperAdmin
              ? "تحكم بالثيم الافتراضي للمنصة وثيمات كل عميل على حدة — يُطبَّق فوراً على جميع صفحات الموقع."
              : "قم بتخصيص ثيم صفحة عميلك وإعداداتها من هنا."}
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {[
              { label: "العملاء المسجلين", value: clients.length, icon: Users, color: "text-blue-400" },
              { label: "الثيم العالمي", value: SAUDI_OCCASIONS[globalTheme]?.shortName || "—", icon: Globe, color: "text-amber-400" },
              { label: "العملاء النشطين", value: clients.filter((c) => c.active).length, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "المناسبات المتاحة", value: occasionsList.length, icon: Sparkles, color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <p className="text-lg font-black text-white">{stat.value}</p>
                <p className="text-[10px] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 1: Global Platform Theme ───────────────────────────── */}
        {isSuperAdmin && (
          <section id="global-theme" className="space-y-5">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-extrabold text-white">الثيم الافتراضي للمنصة</h2>
              <span className="text-xs text-slate-500">← يُطبَّق على جميع صفحات مكّن ما لم يكن للعميل ثيم مخصص</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {occasionsList.map((occ) => {
                const isActive = globalTheme === occ.id;
                return (
                  <button
                    key={occ.id}
                    onClick={() => setGlobalTheme(occ.id as OccasionId)}
                    className={`p-4 rounded-2xl border text-right transition-all relative group ${
                      isActive
                        ? "bg-slate-900 border-amber-500 shadow-xl ring-2 ring-amber-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: occ.accentColor }}
                      />
                      <span className="text-xs font-extrabold text-slate-100 truncate">{occ.shortName}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{occ.slogan}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                      <Gift className="w-3 h-3 text-amber-500" />
                      <code className="font-mono text-amber-400">{occ.couponCode}</code>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Section 2: Client Themes ──────────────────────────────────── */}
        <section id="clients" className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-extrabold text-white">ثيمات العملاء</h2>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة عميل
              </button>
            )}
          </div>

          {/* Add Client Form */}
          {showAddForm && isSuperAdmin && (
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-emerald-400 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> إضافة عميل جديد
                </h3>
                <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "slug", label: "المعرّف (slug) *", placeholder: "my-client", dir: "ltr" },
                  { key: "name", label: "اسم المنشأة *", placeholder: "صالون النخبة" },
                  { key: "tagline", label: "الشعار القصير", placeholder: "احجز وادخل بدون انتظار" },
                  { key: "phone", label: "رقم الهاتف", placeholder: "05XXXXXXXX", dir: "ltr" },
                  { key: "whatsapp", label: "رقم واتساب", placeholder: "9665XXXXXXXX", dir: "ltr" },
                  { key: "location", label: "الموقع", placeholder: "الرياض، المملكة العربية السعودية" },
                  { key: "adminEmail", label: "إيميل الأدمن *", placeholder: "client@mken.live", dir: "ltr" },
                  { key: "adminPassword", label: "رمز الأدمن *", placeholder: "Client#123", dir: "ltr" },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">{field.label}</label>
                    <input
                      type="text"
                      dir={field.dir || "rtl"}
                      placeholder={field.placeholder}
                      value={(newClient as Record<string, string>)[field.key] || ""}
                      onChange={(e) =>
                        setNewClient((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                ))}

                {/* Type Select */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">نوع المنشأة *</label>
                  <select
                    value={newClient.type || "hotel"}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, type: e.target.value as ClientRecord["type"] }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Theme Select */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">الثيم الافتراضي</label>
                  <select
                    value={newClient.theme || "national_day"}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, theme: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {occasionsList.map((occ) => (
                      <option key={occ.id} value={occ.id}>{occ.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddClient}
                disabled={!newClient.slug || !newClient.name || !newClient.adminEmail || !newClient.adminPassword}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة العميل الآن
              </button>
            </div>
          )}

          {/* Clients Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    <th className="px-5 py-4 text-xs font-bold text-slate-400">العميل</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-400">النوع</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-400">إيميل الأدمن</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-400">الثيم المخصص</th>
                    <th className="px-5 py-4 text-xs font-bold text-slate-400">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clients.map((client) => {
                    const clientTheme = getClientTheme(client.slug) || "national_day";
                    const occ = SAUDI_OCCASIONS[clientTheme];
                    const isEditing = editingSlug === client.slug;

                    return (
                      <tr key={client.slug} className="hover:bg-slate-800/20 transition-colors">
                        {/* Client Info */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-sm text-slate-100">{client.name}</p>
                            <code className="text-[11px] text-slate-500 font-mono">/{client.slug}</code>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-4">
                          <span className="text-xs text-slate-300">{TYPE_LABELS[client.type] || client.type}</span>
                        </td>

                        {/* Admin Email */}
                        <td className="px-5 py-4">
                          <code className="text-[11px] font-mono text-slate-400">{client.adminEmail}</code>
                        </td>

                        {/* Theme Selector */}
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <select
                              value={clientTheme}
                              onChange={(e) => {
                                setClientTheme(client.slug, e.target.value as OccasionId);
                                setEditingSlug(null);
                              }}
                              className="px-3 py-1.5 bg-slate-950 border border-amber-500/50 rounded-xl text-xs text-slate-100 focus:outline-none"
                            >
                              {occasionsList.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full border border-white/20"
                                style={{ backgroundColor: occ?.accentColor }}
                              />
                              <span className="text-xs text-slate-300 font-bold">{occ?.shortName}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingSlug(isEditing ? null : client.slug)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                              title="تغيير الثيم"
                            >
                              <Palette className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              href={`/subscriber/${client.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
                              title="معاينة الصفحة"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            {isSuperAdmin && (
                              <button
                                onClick={() => setConfirmDelete(client.slug)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                                title="حذف العميل"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm Delete Modal */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
              <div className="bg-slate-900 border border-rose-800/50 rounded-3xl p-6 max-w-sm w-full text-right space-y-4 shadow-2xl">
                <h3 className="font-extrabold text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                  تأكيد الحذف
                </h3>
                <p className="text-sm text-slate-400">
                  هل أنت متأكد من حذف العميل <strong className="text-white">{confirmDelete}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      removeClient(confirmDelete);
                      setConfirmDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    نعم، احذف
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
