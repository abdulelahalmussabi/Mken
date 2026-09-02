"use client";

import { Suspense } from "react";
import { AdminSectionLayout } from "@/components/AdminPageTabs";
import type { Route } from "next";

const TABS = [
  { href: "/admin/ads" as Route, label: "الإعلان الرئيسي" },
  { href: "/admin/ads/secondary" as Route, label: "الإعلانات الثانوية" },
  { href: "/admin/ads/campaigns" as Route, label: "لوحة الحملات" },
  { href: "/admin/ads/gbp-posts" as Route, label: "منشورات الخرائط" },
  { href: "/admin/ads/geo-grid" as Route, label: "تتبع الرانك" },
];

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">جاري التحميل...</div>}>
      <AdminSectionLayout tabs={TABS}>{children}</AdminSectionLayout>
    </Suspense>
  );
}
