"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function OrderRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const slug = (params.get("tenant") || params.get("store") || params.get("client") || "").trim().toLowerCase();
    if (slug) {
      router.replace(`/subscriber/${slug}` as Route);
      return;
    }
    router.replace("/" as Route);
  }, [params, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 flex items-center justify-center text-sm text-muted">جاري فتح المتجر…</main>
      <Footer />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderRedirectInner />
    </Suspense>
  );
}
