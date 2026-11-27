"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  RECOVERY_TARGET_STORAGE_KEY,
  completeRecoverySessionFromUrl,
  resolveRecoveryLoginTarget,
  updateRecoveredPassword,
  type RecoveryLoginTarget,
} from "@/lib/auth/password-recovery";

const resetSchema = z
  .object({
    password: z.string().min(8, { message: "كلمة المرور يجب أن تتكون من 8 خانات على الأقل" }),
    confirmPassword: z.string().min(8, { message: "يرجى تأكيد كلمة المرور الجديدة" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمة المرور وتأكيدها غير متطابقين",
    path: ["confirmPassword"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;
type PageStatus = "verifying" | "ready" | "invalid" | "success";

const subscribeEmpty = () => () => {};

function clearStoredRecoveryTarget() {
  try {
    window.sessionStorage.removeItem(RECOVERY_TARGET_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<PageStatus>("verifying");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const loginTarget = useSyncExternalStore<RecoveryLoginTarget>(
    subscribeEmpty,
    () => {
      try {
        return resolveRecoveryLoginTarget(window.sessionStorage.getItem(RECOVERY_TARGET_STORAGE_KEY));
      } catch {
        return "/login";
      }
    },
    () => "/login"
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    let cancelled = false;
    let hashTimer: ReturnType<typeof setTimeout> | null = null;

    const markReady = () => {
      if (cancelled) return;
      if (hashTimer) clearTimeout(hashTimer);
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      setVerifyError(null);
      setStatus("ready");
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        markReady();
      }
    });

    void completeRecoverySessionFromUrl(window.location.search, window.location.hash)
      .then((res) => {
        if (cancelled) return;
        if (res.ready) {
          markReady();
          return;
        }
        if (res.pendingHash) {
          hashTimer = setTimeout(() => {
            void supabase.auth.getSession().then(({ data }) => {
              if (cancelled) return;
              if (data.session) {
                markReady();
              } else {
                setVerifyError("رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.");
                setStatus("invalid");
              }
            });
          }, 2500);
          return;
        }
        setVerifyError(res.error || "رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.");
        setStatus("invalid");
      })
      .catch(() => {
        if (!cancelled) {
          setVerifyError("تعذّر التحقق من رابط إعادة تعيين كلمة المرور.");
          setStatus("invalid");
        }
      });

    return () => {
      cancelled = true;
      if (hashTimer) clearTimeout(hashTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: ResetFormValues) => {
    setSubmitError(null);
    const result = await updateRecoveredPassword(data.password);
    if (!result.ok) {
      setSubmitError(result.error || "تعذّر تحديث كلمة المرور.");
      return;
    }

    setStatus("success");
  };

  const secondaryTarget: RecoveryLoginTarget = loginTarget === "/admin/login" ? "/login" : "/admin/login";

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
            العودة لتسجيل الدخول
          </Link>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-extrabold text-2xl mx-auto shadow-lg">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">تعيين كلمة مرور جديدة</h1>
            <p className="text-slate-400 text-xs">
              أدخل كلمة مرور جديدة قوية لحماية حسابك في منصة مكّن.
            </p>
          </div>

          {status === "verifying" && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-orange-400" />
              <p>جاري التحقق من رابط إعادة التعيين...</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl text-rose-200 text-xs space-y-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  {verifyError || "رابط إعادة تعيين كلمة المرور منتهي الصلاحية أو غير صالح."}
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="block text-center w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all"
              >
                طلب رابط جديد
              </Link>
            </div>
          )}

          {status === "success" && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-emerald-200 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
                </p>
              </div>
              <Link
                href={loginTarget}
                onClick={clearStoredRecoveryTarget}
                className="block text-center w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all"
              >
                {loginTarget === "/admin/login" ? "تسجيل الدخول إلى لوحة الإدارة" : "تسجيل الدخول الآن"}
              </Link>
              <Link
                href={secondaryTarget}
                onClick={clearStoredRecoveryTarget}
                className="block text-center text-[11px] font-bold text-slate-300 hover:text-amber-300 transition-colors pt-1"
              >
                {secondaryTarget === "/admin/login" ? "أو الدخول إلى لوحة الإدارة" : "أو الدخول كزائر"}
              </Link>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {submitError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="8 خانات على الأقل"
                    {...register("password")}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="أعد إدخال كلمة المرور"
                    {...register("confirmPassword")}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.confirmPassword.message}
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
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    حفظ كلمة المرور الجديدة
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
