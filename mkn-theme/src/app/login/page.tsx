"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";
import { useOccasion } from "@/context/OccasionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, Mail, Lock, AlertCircle, Loader2, Sparkles } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تتكون من 6 خانات على الأقل" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const { loginMockUser } = useApp();
  const { activeOccasion, occasionDetails } = useOccasion();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setAuthError(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      loginMockUser(data.email, "عبدالرحمن الشمري");
      router.push("/dashboard");
    } catch {
      setAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className={`w-full max-w-md ${activeOccasion !== "none" ? occasionDetails.badgeBg : "bg-surface/90 border-line"} border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6`}>
          {/* Header */}
          <div className="text-center space-y-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-2xl text-slate-950 mx-auto shadow-lg"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              م
            </div>
            {activeOccasion !== "none" && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 rounded-full text-xs font-bold text-amber-300 border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>أهلاً بك في {occasionDetails.shortName}</span>
              </div>
            )}
            <h1 className="text-2xl font-extrabold text-foreground">تسجيل الدخول إلى منصة مكّن</h1>
            <p className="text-muted text-xs">
              أدخل بيانات حسابك للمتابعة وإدارة طلبات المحل التجاري
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-muted mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                placeholder="example@domain.com"
                {...register("email")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-bold text-muted flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  كلمة المرور
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-amber-400 hover:underline font-medium"
                >
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
              />
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 font-bold text-slate-950 text-sm rounded-xl shadow-lg disabled:opacity-50 cursor-pointer transition-all mt-2 active:scale-95"
              style={{ backgroundColor: occasionDetails.accentColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-line text-center text-xs text-muted">
            ليس لديك حساب بعد؟{" "}
            <Link href="/register" className="text-amber-400 font-bold hover:underline">
              إنشاء حساب جديد
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
