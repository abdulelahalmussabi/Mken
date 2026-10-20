"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Plus, Save, Trash2, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import type { ResolvedActivity, ResolvedService } from "@/lib/mken/catalog";

interface CardDraft {
  title: string;
  shortTitle: string;
  description: string;
  heroImage: string;
  features: string;
}

export default function InterfaceServicesPage() {
  const { tenant, query } = useAdminTenant();
  const { showToast } = useApp();
  const [services, setServices] = useState<ResolvedService[]>([]);
  const [activities, setActivities] = useState<ResolvedActivity[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CardDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newShortTitle, setNewShortTitle] = useState("");
  const [newActivityId, setNewActivityId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newHeroImage, setNewHeroImage] = useState("");
  const [newFeatures, setNewFeatures] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/services${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الخدمات");
        setServices([]);
        return;
      }
      const list = (data.services as ResolvedService[]).filter((s) => s.enabled && s.available);
      setActivities(data.activities || []);
      setServices(list);
      setDrafts(
        Object.fromEntries(
          list.map((service) => [
            service.id,
            {
              title: service.overrides.title || service.title || "",
              shortTitle: typeof service.overrides.shortTitle === "string" ? service.overrides.shortTitle : (service.shortTitle || ""),
              description: service.overrides.description || service.description || "",
              heroImage: service.overrides.heroImage || "",
              features: (service.overrides.features || service.features || []).join("\n"),
            },
          ])
        )
      );
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id: string, field: keyof CardDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const createCustomService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newActivityId) {
      showToast("يرجى إدخال اسم الخدمة واختيار القسم", "error");
      return;
    }
    setCreating(true);
    try {
      const id = "custom-" + Date.now();
      const features = newFeatures.split("\n").map(f => f.trim()).filter(Boolean);
      const res = await fetch(`/api/services${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newCustomService: {
            id,
            activityId: newActivityId,
            title: newTitle.trim(),
            shortTitle: newShortTitle.trim(),
            price: newPrice.trim() || "السعر عند الطلب",
            description: newDescription.trim(),
            heroImage: newHeroImage.trim(),
            features,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر إضافة الخدمة", "error");
        return;
      }
      showToast("تمت إضافة الخدمة بنجاح", "success");
      setShowAddModal(false);
      setNewTitle("");
      setNewShortTitle("");
      setNewPrice("");
      setNewDescription("");
      setNewHeroImage("");
      setNewFeatures("");
      load();
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setCreating(false);
    }
  };

  const saveCard = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/services${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceOverrides: {
            [id]: {
              title: draft.title,
              shortTitle: draft.shortTitle,
              description: draft.description,
              heroImage: draft.heroImage,
              features: draft.features
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) showToast(data.message || "تعذّر الحفظ", "error");
      else showToast("تم حفظ بطاقة الخدمة", "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-lg font-extrabold text-white">بطاقات الخدمات الظاهرة</h1>
            <p className="text-xs text-slate-400 mt-0.5">تعديل الاسم والشارة والصورة والمزايا، وحذف أو إضافة أي خدمة للزائر مباشرة.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!newActivityId && activities.length > 0) setNewActivityId(activities[0].id);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          إضافة خدمة جديدة
        </button>
      </div>

      {showAddModal && (
        <form onSubmit={createCustomService} className="p-5 rounded-3xl bg-slate-900 border-2 border-amber-500/50 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              إضافة خدمة جديدة لموقعك
            </h3>
            <button type="button" onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">القسم / النشاط</label>
              <select className={ADMIN_INPUT} value={newActivityId} onChange={(e) => setNewActivityId(e.target.value)}>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.overrides.title || a.title || a.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">اسم الخدمة *</label>
              <input className={ADMIN_INPUT} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="مثلاً: جلسة عناية متقدمة" required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">الشارة (اختياري)</label>
              <input className={ADMIN_INPUT} value={newShortTitle} onChange={(e) => setNewShortTitle(e.target.value)} placeholder="مثلاً: الأكثر طلباً" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">السعر</label>
              <input className={ADMIN_INPUT} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="مثلاً: 250 ر.س أو عند الطلب" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-300">رابط صورة الخدمة (اختياري)</label>
              <input className={ADMIN_INPUT} dir="ltr" value={newHeroImage} onChange={(e) => setNewHeroImage(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-300">الوصف</label>
              <input className={ADMIN_INPUT} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="وصف موجز يظهر للزائر" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-300">المزايا (سطر لكل ميزة)</label>
              <textarea className={ADMIN_INPUT} rows={2} value={newFeatures} onChange={(e) => setNewFeatures(e.target.value)} placeholder="ميزة 1\nميزة 2" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={creating} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl disabled:opacity-50 transition">
              {creating ? "جاري الإنشاء..." : "حفظ وإضافة الخدمة"}
            </button>
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-40 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-bold text-center">
          {error}
        </div>
      ) : services.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد خدمات مفعّلة للعرض.</p>
      ) : (
        <div className="space-y-4">
          {services.map((service) => {
            const draft = drafts[service.id];
            const activity = activities.find((a) => a.id === service.activityId);
            if (!draft) return null;
            return (
              <section key={service.id} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
                <p className="text-[11px] font-bold text-amber-300">
                  {activity?.overrides.title || activity?.title || service.activityId}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">اسم الخدمة</label>
                    <input className={ADMIN_INPUT} value={draft.title} onChange={(e) => patch(service.id, "title", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-300">الشارة</label>
                      {draft.shortTitle ? (
                        <button
                          type="button"
                          onClick={() => patch(service.id, "shortTitle", "")}
                          className="text-[10px] text-rose-400 hover:underline font-bold"
                        >
                          مسح الشارة
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">بدون شارة</span>
                      )}
                    </div>
                    <input
                      className={ADMIN_INPUT}
                      value={draft.shortTitle}
                      onChange={(e) => patch(service.id, "shortTitle", e.target.value)}
                      placeholder="الشارة (اتركها فارغة لإخفاء الشارة تماماً)"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300">رابط الصورة</label>
                    <input
                      className={ADMIN_INPUT}
                      dir="ltr"
                      value={draft.heroImage}
                      onChange={(e) => patch(service.id, "heroImage", e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-300">المزايا (سطر لكل ميزة)</label>
                    <textarea className={ADMIN_INPUT} rows={3} value={draft.features} onChange={(e) => patch(service.id, "features", e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={saving === service.id}
                    onClick={() => saveCard(service.id)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl disabled:opacity-50 transition shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving === service.id ? "جاري الحفظ..." : "حفظ تعديلات البطاقة"}
                  </button>
                  <button
                    type="button"
                    disabled={saving === service.id}
                    onClick={async () => {
                      const serviceName = draft.title || service.title || "هذه الخدمة";
                      if (!window.confirm(`هل أنت متأكد من حذف خدمة «${serviceName}» نهائياً من الموقع وقائمة الخدمات؟`)) return;
                      try {
                        const res = await fetch(`/api/services${query}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ deleteServiceId: service.id }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setServices((prev) => prev.filter((s) => s.id !== service.id));
                          showToast(`تم حذف خدمة «${serviceName}» بنجاح`, "success");
                        } else {
                          showToast(data.message || "تعذّر الحذف", "error");
                        }
                      } catch {
                        showToast("تعذّر الاتصال بالخادم", "error");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold text-xs rounded-xl transition shadow-sm"
                    title="حذف الخدمة نهائياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف الخدمة نهائياً
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
