"use client";

import { Suspense } from "react";
import { AdminSectionLayout } from "@/components/AdminPageTabs";
import type { Route } from "next";

const TABS = [
  { href: "/admin/theme" as Route, label: "المكتبة" },
  { href: "/admin/theme/custom" as Route, label: "تخصيص ثيم" },
];

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">جاري التحميل...</div>}>
      <AdminSectionLayout tabs={TABS}>{children}</AdminSectionLayout>
    </Suspense>
  );
}
