"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Save } from "lucide-react";
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
              shortTitle: service.overrides.shortTitle || service.shortTitle || "",
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
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-5 h-5 text-amber-400" />
        <div>
          <h1 className="text-lg font-extrabold text-white">بطاقات الخدمات الظاهرة</h1>
          <p className="text-xs text-slate-400 mt-0.5">تعديل الاسم والصورة والمزايا كما يراها الزائر. التسعير والتفعيل من بند الخدمات والكتالوج.</p>
        </div>
      </div>

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
                    <label className="block text-xs font-bold text-slate-300">الشارة</label>
                    <input className={ADMIN_INPUT} value={draft.shortTitle} onChange={(e) => patch(service.id, "shortTitle", e.target.value)} />
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
                <button
                  type="button"
                  disabled={saving === service.id}
                  onClick={() => saveCard(service.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving === service.id ? "جاري الحفظ..." : "حفظ البطاقة"}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
