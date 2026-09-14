"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import type { ResolvedActivity, ResolvedService } from "@/lib/mken/catalog";
import { LayoutGrid, RefreshCw, Save, Star, Tag, Check, X } from "lucide-react";

export default function AdminServicesPage() {
  const { session, isSuperAdmin, clients } = useAdmin();
  const { showToast } = useApp();

  const [selectedTenant, setSelectedTenant] = useState("");
  const [activities, setActivities] = useState<ResolvedActivity[]>([]);
  const [services, setServices] = useState<ResolvedService[]>([]);
  const [featuredActivity, setFeaturedActivity] = useState("");
  const [featured, setFeatured] = useState("");
  const [openActivity, setOpenActivity] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tenant = isSuperAdmin ? selectedTenant : session?.clientSlug || "";
  const query = isSuperAdmin && tenant ? `?client=${encodeURIComponent(tenant)}` : "";

  useEffect(() => {
    if (isSuperAdmin && !selectedTenant && clients.length) setSelectedTenant(clients[0].slug);
  }, [isSuperAdmin, selectedTenant, clients]);

  const applyCatalog = useCallback(
    (data: {
      activities: ResolvedActivity[];
      services: ResolvedService[];
      featuredActivity: string;
      featuredService: string;
    }) => {
      setActivities(data.activities);
      setServices(data.services);
      setFeaturedActivity(data.featuredActivity);
      setFeatured(data.featuredService);
      setPrices(
        Object.fromEntries(
          data.services.map((s) => [s.id, s.overrides.price ?? s.price ?? ""])
        )
      );
      setOpenActivity((current) => {
        if (current) return current;
        const first = data.activities.find((a) => a.enabled);
        return first?.id || "";
      });
    },
    []
  );

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/services${query}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الكتالوج");
        setActivities([]);
        setServices([]);
      } else {
        applyCatalog(data);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, applyCatalog]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Record<string, unknown>, message: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/services${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الحفظ", "error");
        return;
      }

      applyCatalog(data);
      showToast(message, "success");
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setSaving(false);
    }
  };

  const enabledActivityIds = useMemo(
    () => activities.filter((a) => a.enabled).map((a) => a.id),
    [activities]
  );
  const enabledServiceIds = useMemo(
    () => services.filter((s) => s.enabled).map((s) => s.id),
    [services]
  );

  const toggleActivity = (id: string, locked?: boolean) => {
    if (locked) return;
    const next = enabledActivityIds.includes(id)
      ? enabledActivityIds.filter((a) => a !== id)
      : [...enabledActivityIds, id];
    save({ enabledActivities: next, enabled: enabledServiceIds }, "تم تحديث الأنشطة");
  };

  const toggleService = (id: string) => {
    const next = enabledServiceIds.includes(id)
      ? enabledServiceIds.filter((s) => s !== id)
      : [...enabledServiceIds, id];
    save({ enabled: next }, "تم تحديث الخدمات");
  };

  const savePrice = (id: string) => {
    save({ serviceOverrides: { [id]: { price: prices[id]?.trim() ?? "" } } }, "تم حفظ السعر");
  };

  const activeActivity = activities.find((a) => a.id === openActivity);
  const activityServices = services.filter((s) => s.activityId === openActivity);

  return (
    <>
      <div className="space-y-8 text-right">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>الخدمات والكتالوج</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-white">أنشطة المنشأة وخدماتها</h1>
            <p className="text-xs text-slate-400 mt-1">
              التغييرات تُحفظ في تهيئة المستأجر وتظهر فورًا على الموقع العام.
            </p>
          </div>

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
        </div>

        {loading ? (
          <div className="space-y-3">
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
        ) : (
          <>
            {/* Activities */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-300">
                الأنشطة ({enabledActivityIds.length} من {activities.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activities.map((activity) => {
                  const title = activity.overrides.title || activity.title;
                  const isOpen = openActivity === activity.id;

                  return (
                    <div
                      key={activity.id}
                      className={`p-4 rounded-3xl border transition-all ${
                        activity.enabled
                          ? "bg-slate-900/80 border-amber-500/40"
                          : "bg-slate-900/40 border-slate-800"
                      } ${isOpen ? "ring-1 ring-amber-500/40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleActivity(activity.id, activity.locked)}
                          disabled={saving || activity.locked}
                          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-50 ${
                            activity.enabled
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}
                          title={
                            activity.locked
                              ? "يتطلب الباقة المتقدمة 🌟"
                              : activity.enabled
                                ? "تعطيل النشاط"
                                : "تمكين النشاط"
                          }
                        >
                          {activity.enabled ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpenActivity(activity.id)}
                          className="flex-1 text-right"
                        >
                          <p className="font-bold text-white text-sm flex items-center gap-1.5 justify-end">
                            {activity.locked && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                🔒 يتطلب الباقة المتقدمة
                              </span>
                            )}
                            {title}
                            <span>{activity.overrides.icon || activity.icon}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {activity.enabledServiceCount} / {activity.serviceCount} خدمة مُمكّنة
                          </p>
                        </button>
                      </div>

                      {activity.enabled && (
                        <button
                          type="button"
                          onClick={() =>
                            save({ featuredActivity: activity.id }, "تم تعيين النشاط الرئيسي")
                          }
                          disabled={saving || activity.featured || activity.locked}
                          className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-60 ${
                            featuredActivity === activity.id
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                              : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-amber-300"
                          }`}
                        >
                          <Star className="w-3 h-3" />
                          {featuredActivity === activity.id ? "النشاط الرئيسي" : "تعيين كنشاط رئيسي"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Services of selected activity */}
            {activeActivity && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2 justify-end">
                  خدمات: {activeActivity.overrides.title || activeActivity.title}
                  <Tag className="w-4 h-4 text-amber-400" />
                </h2>

                {!activeActivity.enabled && (
                  <p className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs font-bold">
                    النشاط معطّل حاليًا — الخدمات المُمكّنة تحته لن تظهر على الموقع حتى تُمكّن النشاط.
                  </p>
                )}

                <div className="space-y-2">
                  {activityServices.map((service) => (
                    <div
                      key={service.id}
                      className={`p-4 rounded-3xl border flex items-start gap-4 flex-wrap ${
                        service.enabled
                          ? "bg-slate-900/80 border-slate-700"
                          : "bg-slate-900/40 border-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(service.id)}
                        disabled={saving || Boolean(activeActivity.locked)}
                        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-50 ${
                          service.enabled
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}
                        title={service.enabled ? "تعطيل الخدمة" : "تمكين الخدمة"}
                      >
                        {service.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-[200px] text-right">
                        <p className="font-bold text-white text-sm flex items-center gap-1.5 justify-end">
                          {service.overrides.title || service.title}
                          <span>{service.overrides.icon || service.icon}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {service.overrides.description || service.description}
                        </p>
                        {featured === service.id && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                            <Star className="w-2.5 h-2.5" />
                            الخدمة المميزة
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          value={prices[service.id] ?? ""}
                          onChange={(e) =>
                            setPrices((prev) => ({ ...prev, [service.id]: e.target.value }))
                          }
                          placeholder="السعر"
                          className="w-28 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 text-right focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => savePrice(service.id)}
                          disabled={saving}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all disabled:opacity-50"
                          title="حفظ السعر"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        {service.enabled && featured !== service.id && (
                          <button
                            type="button"
                            onClick={() => save({ featured: service.id }, "تم تعيين الخدمة المميزة")}
                            disabled={saving}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded-xl transition-all disabled:opacity-50"
                            title="تعيين كخدمة مميزة"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
