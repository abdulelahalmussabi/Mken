"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SandboxReconciler } from "@/components/preview/SandboxReconciler";
import { StorefrontFrame } from "@/components/storefront/StorefrontFrame";
import SubscriberStorefrontPage from "@/app/subscriber/[slug]/page";
import { SAUDI_SYNTHETIC_BUSINESS } from "@/lib/preview/saudi-synthetic-data";
import { ShieldCheck, Lock, KeyRound, Loader2, AlertCircle } from "lucide-react";

function SandboxContent() {
  const searchParams = useSearchParams();
  const rawTenant = searchParams.get("tenant") || "demo";
  const tenantSlug = rawTenant.trim().toLowerCase();
  const token = searchParams.get("token");

  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(Boolean(token));
  const [snapshotData, setSnapshotData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;

    const fetchSnapshot = async (userPin?: string) => {
      setLoadingSnapshot(true);
      setPinError(null);
      try {
        const query = new URLSearchParams({ token, pin: userPin || "" });
        const res = await fetch(`/api/preview/share?${query.toString()}`);
        const data = await res.json();

        if (res.status === 401 && data.requirePin) {
          setPinRequired(true);
        } else if (!res.ok || !data.success) {
          setPinError(data.message || "تعذر قراءة المسودة المؤقتة.");
        } else {
          setPinRequired(false);
          setSnapshotData(data.snapshot);
          // Apply tokens & text from snapshot
          if (data.snapshot) {
            window.dispatchEvent(
              new CustomEvent("mken-preview-patch", {
                detail: [
                  { op: "replace", path: "/client/name", value: data.snapshot.name },
                  { op: "replace", path: "/client/tagline", value: data.snapshot.tagline },
                  { op: "replace", path: "/client/subtitle", value: data.snapshot.subtitle },
                ],
              })
            );
          }
        }
      } catch {
        setPinError("خطأ في الاتصال بالخادم.");
      } finally {
        setLoadingSnapshot(false);
      }
    };

    fetchSnapshot();
  }, [token]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoadingSnapshot(true);
    fetch(`/api/preview/share?token=${encodeURIComponent(token)}&pin=${encodeURIComponent(pin)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setPinError(data.message || "الرمز السري غير صحيح");
        } else {
          setPinRequired(false);
          setSnapshotData(data.snapshot);
          if (data.snapshot) {
            window.dispatchEvent(
              new CustomEvent("mken-preview-patch", {
                detail: [
                  { op: "replace", path: "/client/name", value: data.snapshot.name },
                  { op: "replace", path: "/client/tagline", value: data.snapshot.tagline },
                  { op: "replace", path: "/client/subtitle", value: data.snapshot.subtitle },
                ],
              })
            );
          }
        }
      })
      .catch(() => setPinError("حدث خطأ في التحقق."))
      .finally(() => setLoadingSnapshot(false));
  };

  if (loadingSnapshot) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-bold">جاري تحميل المسودة المشفرة الآمنة...</p>
      </div>
    );
  }

  if (pinRequired) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <form
          onSubmit={handleVerifyPin}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-right space-y-4 shadow-2xl"
        >
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-extrabold text-white">مسودة معاينة مؤمنة</h2>
            <p className="text-xs text-slate-400">
              أدخل رمز المرور السري (PIN) المكوّن من 4 أرقام لمشاهدة المتجر
            </p>
          </div>

          <div className="space-y-1.5">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
            />
          </div>

          {pinError ? (
            <p className="text-xs text-rose-400 flex items-center justify-center gap-1 font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              {pinError}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>عرض المعاينة</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 relative">
      {/* Zero-latency DOM & Style Reconciler with Saudi Compliance Banner */}
      <SandboxReconciler />

      {/* Render the Storefront Component */}
      <StorefrontFrame slug={tenantSlug}>
        <SubscriberStorefrontPage />
      </StorefrontFrame>
    </div>
  );
}

export default function PreviewSandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          جاري إعداد بيئة المعاينة المعزولة...
        </div>
      }
    >
      <SandboxContent />
    </Suspense>
  );
}
