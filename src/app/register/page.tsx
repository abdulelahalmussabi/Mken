"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, User, Mail, Lock, Phone, AlertCircle, Loader2 } from "lucide-react";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

const ACTIVITY_OPTIONS = [
  { id: "barber-salon", label: "صالون حلاقة" },
  { id: "car-care", label: "مغاسل سيارات" },
  { id: "cleaning", label: "نظافة" },
  { id: "maintenance", label: "صيانة" },
  { id: "commerce", label: "متجر" },
  { id: "tech-digital", label: "تقنية رقمية" },
  { id: "restaurant", label: "مطعم" },
  { id: "healthcare", label: "خدمات طبية" },
] as const;

const registerSchema = z.object({
  full_name: z.string().min(3, { message: "الاسم الكامل يجب أن يتكون من 3 حروف على الأقل" }),
  tenantSlug: z
    .string()
    .min(3, { message: "رابط الموقع 3 أحرف إنجليزية على الأقل" })
    .regex(/^[a-z0-9-]+$/, { message: "أحرف إنجليزية صغيرة وأرقام وشرطات فقط" }),
  activityId: z.string().min(1),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل" }),
  phone: z
    .string()
    .min(9, { message: "يرجى إدخال رقم جوال صحيح (مثال: 0551234567)" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const { showToast } = useApp();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { activityId: "barber-salon" },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setAuthError(null);
    try {
      const res = await fetch("/api/v1/auth/register-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantSlug: data.tenantSlug.trim().toLowerCase(),
          businessName: data.full_name,
          email: data.email,
          password: data.password,
          phone: data.phone,
          activityId: data.activityId,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setAuthError(result.error || "حدث خطأ أثناء إنشاء الحساب.");
        return;
      }
      showToast("تم إنشاء حسابك — تجربتك 14 يوماً.", "success");
      router.push(result.adminUrl || "/admin?welcome=trial");
    } catch {
      setAuthError("حدث خطأ أثناء إنشاء الحساب. قد يكون البريد مستخدماً سابقاً.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-md bg-surface/90 border border-line rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-extrabold text-2xl text-slate-950 mx-auto shadow-lg shadow-orange-500/20">
              م
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">تجربة مجانية 14 يوماً</h1>
            <p className="text-muted text-xs">
              أنشئ موقع منشأتك ولوحة الإدارة — بدون بطاقة
            </p>
          </div>

          <SocialAuthButtons onError={setAuthError} />

          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex-1 h-px bg-line" />
            أو بالبريد
            <span className="flex-1 h-px bg-line" />
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-xs font-bold text-muted mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-400" />
                الاسم الكامل
              </label>
              <input
                id="full_name"
                type="text"
                placeholder="أدخل اسمك الكريم"
                {...register("full_name")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
              />
              {errors.full_name && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="tenantSlug" className="block text-xs font-bold text-muted mb-1">
                رابط الموقع (subdomain)
              </label>
              <input
                id="tenantSlug"
                type="text"
                dir="ltr"
                placeholder="myshop"
                {...register("tenantSlug")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
              />
              <p className="text-[11px] text-muted mt-1">سيصبح myshop.mken.live</p>
              {errors.tenantSlug && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.tenantSlug.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="activityId" className="block text-xs font-bold text-muted mb-1">
                النشاط
              </label>
              <select
                id="activityId"
                {...register("activityId")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-muted mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-orange-400" />
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                placeholder="example@domain.com"
                {...register("email")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-bold text-muted mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-orange-400" />
                رقم الجوال
              </label>
              <input
                id="phone"
                type="text"
                dir="ltr"
                placeholder="0551234567"
                {...register("phone")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
              />
              {errors.phone && (
                <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-muted mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-orange-400" />
                كلمة المرور
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-background border border-line rounded-xl text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
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
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري إنشاء الحساب...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  إنشاء الحساب الآن
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-line text-center text-xs text-muted">
            لديك حساب بالفعل؟{" "}
            <Link href="/admin/login" className="text-orange-400 font-bold hover:underline">
              تسجيل الدخول للإدارة
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
