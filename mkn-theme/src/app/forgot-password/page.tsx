"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowRight, AlertCircle, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import {
  RECOVERY_TARGET_STORAGE_KEY,
  requestPasswordReset,
  resolveRecoveryLoginTarget,
  type RecoveryLoginTarget,
} from "@/lib/auth/password-recovery";

const forgotSchema = z.object({
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

const subscribeEmpty = () => () => {};

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loginTarget = useSyncExternalStore<RecoveryLoginTarget>(
    subscribeEmpty,
    () => resolveRecoveryLoginTarget(new URLSearchParams(window.location.search).get("from")),
    () => "/login"
  );

  useEffect(() => {
    try {
      if (loginTarget === "/admin/login") {
        window.sessionStorage.setItem(RECOVERY_TARGET_STORAGE_KEY, loginTarget);
      } else {
        window.sessionStorage.removeItem(RECOVERY_TARGET_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors in restricted browsers.
    }
  }, [loginTarget]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setSuccessMessage(null);
    setSubmitError(null);

    const result = await requestPasswordReset(data.email, window.location.origin);
    if (!result.ok) {
      setSubmitError(result.error || "تعذّر إرسال رابط استعادة كلمة المرور.");
      return;
    }

    setSuccessMessage(
      `إذا كان البريد ${data.email.trim().toLowerCase()} مسجّلاً لدينا، فقد أرسلنا رابط إعادة تعيين كلمة المرور. يرجى مراجعة صندوق الوارد والبريد غير الهام.`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <Link
            href={loginTarget}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-orange-400 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            {loginTarget === "/admin/login" ? "العودة لدخول لوحة الإدارة" : "العودة لصفحة تسجيل الدخول"}
          </Link>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-extrabold text-2xl mx-auto shadow-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">استعادة كلمة المرور</h1>
            <p className="text-slate-400 text-xs">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.
            </p>
          </div>

          {submitError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {successMessage ? (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-emerald-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{successMessage}</p>
              </div>
              <Link
                href={loginTarget}
                className="block text-center w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all"
              >
                {loginTarget === "/admin/login" ? "العودة لدخول لوحة الإدارة" : "العودة لتسجيل الدخول"}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-400" />
                  البريد الإلكتروني المسجل
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="example@domain.com"
                  {...register("email")}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                />
                {errors.email && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    إرسال رابط الإعادة
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
