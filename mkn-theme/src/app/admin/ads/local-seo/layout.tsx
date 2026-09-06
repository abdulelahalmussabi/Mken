"use client";

import { Suspense, type ReactNode } from "react";
import { AdminPageTabs, useAdminTenant, type AdminTab } from "@/components/AdminPageTabs";
import type { Route } from "next";

const TABS: AdminTab[] = [
  { href: "/admin/ads/local-seo" as Route, label: "الربط وNAP" },
  { href: "/admin/ads/local-seo/competitors" as Route, label: "قائمة المنافسين" },
  { href: "/admin/ads/local-seo/reviews" as Route, label: "طلبات التقييم" },
];

function LocalSeoTabs() {
  const { query } = useAdminTenant();
  return <AdminPageTabs tabs={TABS} query={query} />;
}

export default function LocalSeoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <LocalSeoTabs />
      </Suspense>
      {children}
    </div>
  );
}
