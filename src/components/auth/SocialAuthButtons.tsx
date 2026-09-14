"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  startVisitorOAuth,
  type VisitorOAuthProvider,
} from "@/lib/auth/visitor-oauth";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
      <path d="M16.4 12.3c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.7c-1.5.1-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.8 1.1 1.7 2.3 2.9 2.2 1.2-.1 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.2c1.1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-2.9-4.1zM14.6 5.6c.6-.8 1.1-1.8.9-2.9-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.8-.9 2.8 1.1.1 2.1-.5 2.7-1.4z" />
    </svg>
  );
}

export default function SocialAuthButtons({
  nextPath,
  compact = false,
  onError,
}: {
  nextPath?: string;
  compact?: boolean;
  onError?: (message: string) => void;
}) {
  const [pending, setPending] = useState<VisitorOAuthProvider | null>(null);
  const [error, setError] = useState("");

  const start = async (provider: VisitorOAuthProvider) => {
    setError("");
    setPending(provider);
    const result = await startVisitorOAuth(provider, nextPath);
    if (result.error) {
      setError(result.error);
      onError?.(result.error);
      setPending(null);
    }
  };

  const btn =
    "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition disabled:opacity-60";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={() => void start("google")}
        className={`${btn} bg-white text-slate-900 border-slate-200 hover:bg-slate-50`}
      >
        {pending === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />}
        {compact ? "جوجل" : "الدخول بحساب جوجل"}
      </button>
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={() => void start("apple")}
        className={`${btn} bg-black text-white border-black hover:bg-slate-900`}
      >
        {pending === "apple" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AppleMark />}
        {compact ? "آبل" : "الدخول بحساب آبل"}
      </button>
      {error ? <p className="text-[11px] text-rose-400 font-medium text-center">{error}</p> : null}
      <p className="text-[11px] text-muted text-center leading-relaxed pt-1">
        بتسجيل الدخول عبر جوجل فإنك توافق على{" "}
        <a href="https://mken.live/privacy" className="text-amber-400 hover:underline">
          سياسة الخصوصية
        </a>{" "}
        و{" "}
        <a href="https://mken.live/terms" className="text-amber-400 hover:underline">
          شروط الخدمة
        </a>
        . نستخدم الاسم والبريد فقط للمصادقة وإنشاء الحساب.
      </p>
    </div>
  );
}
