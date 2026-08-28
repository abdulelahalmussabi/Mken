"use client";

import { Suspense } from "react";
import { AdminSectionLayout } from "@/components/AdminPageTabs";
import type { Route } from "next";

const TABS = [
  { href: "/admin/interface" as Route, label: "العناوين" },
  { href: "/admin/interface/pages" as Route, label: "صفحات الموقع" },
  { href: "/admin/interface/services" as Route, label: "الخدمات" },
  { href: "/admin/interface/phrases" as Route, label: "العبارات أسفل الخدمات" },
];

export default function InterfaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm">جاري التحميل...</div>}>
      <AdminSectionLayout tabs={TABS}>{children}</AdminSectionLayout>
    </Suspense>
  );
}
