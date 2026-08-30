"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useAdmin } from "@/context/AdminContext";
import { useApp } from "@/context/AppContext";
import type { AppearancePublic, AppearanceUpdate } from "@/lib/mken/appearance";

export const ADMIN_INPUT =
  "w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500";

export interface AdminTab {
  href: Route;
  label: string;
}

export function useAdminTenant() {
  const { isSuperAdmin, clients, session, authLoading } = useAdmin();
  const searchParams = useSearchParams();
  const param = searchParams.get("client") || "";
  const tenant = isSuperAdmin ? param || clients[0]?.slug || "" : session?.clientSlug || "";
  const query = isSuperAdmin && tenant ? `?client=${encodeURIComponent(tenant)}` : "";
  return { tenant, query, isSuperAdmin, clients, authLoading };
}

export function useAppearanceEditor() {
  const { tenant, query, authLoading } = useAdminTenant();
  const { showToast } = useApp();
  const [appearance, setAppearance] = useState<AppearancePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setAppearance(null);
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/appearance${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAppearance(null);
        setError(data.message || "تعذّر تحميل المظهر");
      } else {
        setAppearance(data.appearance);
      }
    } catch {
      setAppearance(null);
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: AppearanceUpdate, message: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/appearance${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الحفظ", "error");
        return false;
      }
      setAppearance(data.appearance);
      showToast(message, "success");
      return true;
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { tenant, appearance, loading, saving, error, save, load };
}

function withClient(href: string, query: string): Route {
  return `${href}${query}` as Route;
}

export function AdminPageTabs({ tabs, query }: { tabs: AdminTab[]; query: string }) {
  const pathname = usePathname();

  return (
    <div dir="rtl" className="flex gap-1 overflow-x-auto border-b border-slate-800">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={withClient(tab.href, query)}
            className={`shrink-0 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors ${
              active
                ? "text-amber-300 border-amber-400 bg-amber-500/10"
                : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminSectionLayout({
  tabs,
  children,
}: {
  tabs: AdminTab[];
  children: React.ReactNode;
}) {
  const { tenant, query, isSuperAdmin, clients } = useAdminTenant();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin || !clients.length) return;
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if (params.get("client")) return;
    router.replace(`${pathname}?client=${encodeURIComponent(clients[0].slug)}` as Route);
  }, [isSuperAdmin, clients, query, pathname, router]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {isSuperAdmin && (
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">المنشأة</label>
          <select
            value={tenant}
            onChange={(e) => router.replace(`${pathname}?client=${encodeURIComponent(e.target.value)}` as Route)}
            className={ADMIN_INPUT}
          >
            {clients.map((client) => (
              <option key={client.slug} value={client.slug}>
                {client.name} ({client.slug})
              </option>
            ))}
          </select>
        </div>
      )}
      <AdminPageTabs tabs={tabs} query={query} />
      {children}
    </div>
  );
}
