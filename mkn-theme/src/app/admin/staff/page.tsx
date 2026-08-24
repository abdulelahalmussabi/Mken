"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import {
  AVAILABILITY_LABELS,
  ROLE_LABELS,
  STAFF_ROLES,
  STAFF_STATUSES,
  type Availability,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@/lib/mken/staff";
import { ACTIVITIES } from "@/lib/mken/catalog";
import {
  UsersRound,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  Phone,
  Mail,
  KeyRound,
  Circle,
} from "lucide-react";

const AVAILABILITY_CLASSES: Record<Availability, string> = {
  online: "text-emerald-400",
  busy: "text-amber-400",
  offline: "text-slate-500",
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  role: "technician" as StaffRole,
  status: "active" as StaffStatus,
  pinCode: "",
  activities: [] as string[],
};

export default function AdminStaffPage() {
  const { session, isSuperAdmin, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";
  const query = isSuperAdmin && tenant ? `?client=${encodeURIComponent(tenant)}` : "";

  useEffect(() => {
    if (isSuperAdmin && !selectedTenant && clients.length) setSelectedTenant(clients[0].slug);
  }, [isSuperAdmin, selectedTenant, clients]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/staff${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStaff([]);
        setError(data.message || "تعذّر تحميل الموظفين");
      } else {
        setStaff(data.staff || []);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query]);

  useEffect(() => {
    load();
  }, [load]);

  const activityTitle = useMemo(() => {
    const map = new Map(ACTIVITIES.map((a) => [a.id, a.title]));
    return (id: string) => map.get(id) || id;
  }, []);

  const visible = useMemo(() => {
    const term = search.trim();
    if (!term) return staff;
    return staff.filter(
      (m) =>
        m.name.includes(term) ||
        m.phone.includes(term) ||
        m.email.includes(term) ||
        ROLE_LABELS[m.role].includes(term)
    );
  }, [staff, search]);

  const create = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/staff${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إضافة الموظف", "error");
        return;
      }

      setStaff((prev) => [...prev, data.member].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setForm(emptyForm);
      setShowForm(false);
      showToast("تم إضافة الموظف", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (id: string, status: StaffStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/staff/${id}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر تحديث الحالة", "error");
        return;
      }

      setStaff((prev) => prev.map((m) => (m.id === id ? data.member : m)));
      showToast(status === "active" ? "تم تفعيل الموظف" : "تم تعطيل الموظف", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الموظف؟")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/staff/${id}${query}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر حذف الموظف", "error");
        return;
      }

      setStaff((prev) => prev.filter((m) => m.id !== id));
      showToast("تم حذف الموظف", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActivity = (id: string) => {
    setForm((prev) => ({
      ...prev,
      activities: prev.activities.includes(id)
        ? prev.activities.filter((a) => a !== id)
        : [...prev.activities, id],
    }));
  };

  const totals = {
    count: staff.length,
    active: staff.filter((m) => m.status === "active").length,
    online: staff.filter((m) => m.availability === "online").length,
  };

  return (
    <>
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
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة موظف
              </button>
              {tenant && (
                <Link
                  href={`/staff/login?tenant=${encodeURIComponent(tenant)}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs rounded-xl"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  بوابة الموظف
                </Link>
              )}
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold">
              <UsersRound className="w-3.5 h-3.5" />
              <span>الموظفون والمناوبات</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white">فريق العمل</h1>

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

          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الجوال أو الدور"
              className="w-full px-4 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي الفريق", value: totals.count },
            { label: "نشطون", value: totals.active },
            { label: "متصلون الآن", value: totals.online },
          ].map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-right"
            >
              <p className="text-2xl font-black text-white">{card.value}</p>
              <p className="text-[11px] font-bold text-slate-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-amber-500/30 space-y-4">
            <h2 className="text-sm font-bold text-amber-300">موظف جديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="الاسم *"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="الجوال"
                dir="ltr"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-left focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="البريد"
                dir="ltr"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-left focus:outline-none focus:border-amber-500"
              />
              <input
                value={form.pinCode}
                onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                placeholder="رمز الدخول (4-8 أرقام)"
                type="password"
                inputMode="numeric"
                dir="ltr"
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-left focus:outline-none focus:border-amber-500"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}
                className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {STAFF_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "active" ? "نشط" : "معطّل"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400">الأنشطة المرتبطة</p>
              <div className="flex flex-wrap gap-2 justify-end">
                {ACTIVITIES.map((activity) => {
                  const on = form.activities.includes(activity.id);
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => toggleActivity(activity.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        on
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : "bg-slate-800/60 border-slate-700 text-slate-400"
                      }`}
                    >
                      {activity.title}
                    </button>
                  );
                })}
              </div>
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
            <UsersRound className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-bold">
              {staff.length === 0 ? "لا يوجد موظفون بعد" : "لا توجد نتائج مطابقة"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((member) => (
              <div
                key={member.id}
                className={`p-5 rounded-3xl border space-y-3 ${
                  member.status === "active"
                    ? "bg-slate-900/80 border-slate-800"
                    : "bg-slate-900/40 border-slate-800/60 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => remove(member.id)}
                      disabled={busyId === member.id}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <select
                      value={member.status}
                      disabled={busyId === member.id}
                      onChange={(e) => patchStatus(member.id, e.target.value as StaffStatus)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="active">نشط</option>
                      <option value="inactive">معطّل</option>
                    </select>
                  </div>

                  <div className="space-y-1 text-right">
                    <p className="font-extrabold text-white flex items-center gap-2 justify-end">
                      {member.name}
                      <Circle
                        className={`w-2.5 h-2.5 fill-current ${AVAILABILITY_CLASSES[member.availability]}`}
                      />
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 justify-end flex-wrap">
                      <span>{ROLE_LABELS[member.role]}</span>
                      <span className={AVAILABILITY_CLASSES[member.availability]}>
                        {AVAILABILITY_LABELS[member.availability]}
                      </span>
                      {member.hasPin && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <KeyRound className="w-3 h-3" />
                          رمز دخول
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 justify-end flex-wrap">
                      {member.phone && (
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          {member.phone}
                          <Phone className="w-3 h-3" />
                        </span>
                      )}
                      {member.email && (
                        <span className="flex items-center gap-1" dir="ltr">
                          {member.email}
                          <Mail className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {member.activities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {member.activities.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400"
                      >
                        {activityTitle(id)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
