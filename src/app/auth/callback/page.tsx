"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { visitorSafeNext } from "@/lib/auth/visitor-oauth";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const next = visitorSafeNext(searchParams.get("next"));
    const oauthError = searchParams.get("error_description") || searchParams.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      router.replace(next as Route);
      return;
    }

    let cancelled = false;
    void import("@/lib/supabase/client")
      .then(({ supabase }) => supabase.auth.exchangeCodeForSession(code))
      .then(({ error: exchangeError }) => {
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        router.replace(next as Route);
      })
      .catch(() => {
        if (!cancelled) setError("تعذّر إكمال تسجيل الدخول");
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground px-4">
      {error ? (
        <>
          <p className="text-sm font-bold text-rose-400 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="text-xs font-bold text-amber-400 hover:underline"
          >
            العودة لتسجيل الدخول
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-sm">جاري إكمال الدخول بحسابك…</p>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
