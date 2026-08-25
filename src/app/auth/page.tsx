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
import {
  User,
  Mail,
  Lock,
  Phone,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogIn,
  UserPlus,
} from "lucide-react";

// Login Schema
const loginSchema = z.object({
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تتكون من 6 خانات على الأقل" }),
});

// Register Schema
const registerSchema = z.object({
  full_name: z.string().min(3, { message: "الاسم الكامل يجب أن يتكون من 3 حروف على الأقل" }),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صحيح" }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل" }),
  phone: z
    .string()
    .min(9, { message: "يرجى إدخال رقم جوال صحيح (مثال: 0551234567)" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { loginMockUser, showToast } = useApp();
  const router = useRouter();

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: loginErrors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Register Form
  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    formState: { errors: registerErrors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      loginMockUser(data.email, "عبدالرحمن الشمري");
      router.push("/dashboard");
    } catch {
      setAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      loginMockUser(data.email, data.full_name, data.phone);
      showToast("تم إنشاء حسابك بنجاح! أهلاً بك في منصة مكّن.", "success");
      router.push("/dashboard");
    } catch {
      setAuthError("حدث خطأ أثناء إنشاء الحساب. قد يكون البريد مستخدماً سابقاً.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-extrabold text-2xl text-white mx-auto shadow-lg shadow-orange-500/20">
              م
            </div>
            <h1 className="text-2xl font-extrabold text-white">حساب العميل في منصة مكّن</h1>
            <p className="text-slate-400 text-xs">
              سجّل دخولك لمتابعة طلبات تحسين خرائط Google والتواصل مع فريق العمل
            </p>
          </div>

          {/* Auth Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                setActiveTab("login");
                setAuthError(null);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "login"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول
            </button>

            <button
              onClick={() => {
                setActiveTab("register");
                setAuthError(null);
              }}
              className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "register"
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              حساب جديد
            </button>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {activeTab === "login" && (
            <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder="example@domain.com"
                    {...registerLogin("email")}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                  />
                </div>
                {loginErrors.email && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {loginErrors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-300 mb-1">
                  كلمة المرور
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...registerLogin("password")}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                />
                {loginErrors.password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {loginErrors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    تسجيل الدخول الآن
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {activeTab === "register" && (
            <form onSubmit={handleSubmitSignup(onRegisterSubmit)} className="space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-xs font-bold text-slate-300 mb-1">
                  الاسم الكامل
                </label>
                <input
                  id="full_name"
                  type="text"
                  placeholder="مثال: عبدالرحمن الشمري"
                  {...registerSignup("full_name")}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
                />
                {registerErrors.full_name && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {registerErrors.full_name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg_email" className="block text-xs font-bold text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  id="reg_email"
                  type="email"
                  placeholder="example@domain.com"
                  {...registerSignup("email")}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                />
                {registerErrors.email && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {registerErrors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-slate-300 mb-1">
                  رقم الجوال
                </label>
                <input
                  id="phone"
                  type="text"
                  dir="ltr"
                  placeholder="0551234567"
                  {...registerSignup("phone")}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                />
                {registerErrors.phone && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {registerErrors.phone.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg_password" className="block text-xs font-bold text-slate-300 mb-1">
                  كلمة المرور
                </label>
                <input
                  id="reg_password"
                  type="password"
                  placeholder="••••••••"
                  {...registerSignup("password")}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm dir-ltr text-right"
                />
                {registerErrors.password && (
                  <p className="flex items-center gap-1 text-xs text-rose-400 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {registerErrors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all mt-2"
              >
                {submitting ? (
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
          )}

          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
            بتسجيلك فإنك توافق على شروط خدمة وتدابير حماية البيانات في منصة مكّن.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
