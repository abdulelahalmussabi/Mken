"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/AdminContext";

/** Theme editing belongs on /admin — this route only redirects. */
export default function DashboardThemesRedirect() {
  const router = useRouter();
  const { session, authLoading, isAdmin } = useAdmin();

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/admin/login?from=/admin");
      return;
    }
    router.replace(session?.role === "client" ? "/admin/client#theme" : "/admin#clients");
  }, [authLoading, isAdmin, session, router]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
      جاري التحويل إلى لوحة الإدارة…
    </div>
  );
}
