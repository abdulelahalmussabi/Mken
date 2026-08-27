"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { Shield, Eye, EyeOff, LogIn, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const { loginAdmin, isAdmin, session, hostTenantSlug, isTenantDomain } = useAdmin();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill client email if on tenant domain or passed in URL query
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const clientSlug = params.get("client") || hostTenantSlug;
      if (clientSlug) {
        if (clientSlug === "rewa") setEmail("rewa@mken.live");
        else if (clientSlug === "almahrusa") setEmail("almahrusa@mken.live");
        else if (clientSlug === "almasabi") setEmail("almasabi@mken.live");
        else if (clientSlug === "demo") setEmail("demo@mken.live");
        else setEmail(`${clientSlug}@mken.live`);
      }
    }
  }, [hostTenantSlug]);

  // Already logged in
  React.useEffect(() => {
    if (isAdmin) {
      if (session?.role === "client" || isTenantDomain) {
        router.push("/admin/client");
      } else {
        router.push("/admin");
      }
    }
  }, [isAdmin, session, isTenantDomain, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      try {
        const result = loginAdmin(email.trim(), password);
        if (result.success) {
          const isSuper = !isTenantDomain && email.trim().toLowerCase() === "admin@mken.live";
          const targetPath = isSuper ? "/admin" : "/admin/client";
          window.location.href = targetPath;
        } else {
          setError(result.message);
          setLoading(false);
        }
      } catch (err) {
        setError("حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى");
        setLoading(false);
      }
    }, 300);
  };

  const handleQuickFill = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-2xl shadow-amber-500/30 mx-auto">
            <Shield className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">
              {isTenantDomain ? `تسجيل دخول إدارة ${hostTenantSlug === "rewa" ? "رواء" : hostTenantSlug}` : "لوحة تحكم مكّن"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              دخول آمن للمديرين وأدمن المنشآت والموظفين
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@mken.live"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition font-mono"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition font-mono pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-bold text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span>جاري التحقق...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول إلى لوحة التحكم</span>
                </>
              )}
            </button>
          </form>

          {/* Accounts Info with Quick Fill */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-2.5 text-xs">
            <p className="text-slate-400 font-bold flex items-center justify-between">
              <span>حسابات الدخول السريعة:</span>
              <span className="text-[10px] text-slate-500 font-normal">اضغط للتعبئة التلقائية</span>
            </p>
            <div className="space-y-1.5 text-slate-500">
              {/* Rewa quick fill */}
              {(!isTenantDomain || hostTenantSlug === "rewa") && (
                <button
                  type="button"
                  onClick={() => handleQuickFill("rewa@mken.live", "Rewa#123")}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition text-right"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-bold">أدمن منشأة رواء (rewa.care)</span>
                  </div>
                  <code className="text-emerald-400 font-mono text-[11px]">rewa@mken.live</code>
                </button>
              )}

              {/* Super Admin - only on platform domain */}
              {!isTenantDomain && (
                <button
                  type="button"
                  onClick={() => handleQuickFill("admin@mken.live", "Aa#321321")}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition text-right"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-slate-300 font-bold">سوبر أدمن المنصة</span>
                  </div>
                  <code className="text-amber-400 font-mono text-[11px]">admin@mken.live</code>
                </button>
              )}

              {/* Almahrusa */}
              {(!isTenantDomain || hostTenantSlug === "almahrusa") && (
                <button
                  type="button"
                  onClick={() => handleQuickFill("almahrusa@mken.live", "Almahrusa#123")}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition text-right"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-300 font-bold">أدمن المحروسة للشقق</span>
                  </div>
                  <code className="text-emerald-400 font-mono text-[11px]">almahrusa@mken.live</code>
                </button>
              )}

              {/* Almasabi */}
              {(!isTenantDomain || hostTenantSlug === "almasabi") && (
                <button
                  type="button"
                  onClick={() => handleQuickFill("almasabi@mken.live", "Almasabi#123")}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 transition text-right"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-slate-300 font-bold">أدمن مؤسسة المصعبي</span>
                  </div>
                  <code className="text-purple-400 font-mono text-[11px]">almasabi@mken.live</code>
                </button>
              )}

              {/* Demo */}
              {(!isTenantDomain || hostTenantSlug === "demo") && (
                <button
                  type="button"
                  onClick={() => handleQuickFill("demo@mken.live", "Demo#123")}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/30 transition text-right"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-300 font-bold">أدمن صالون النخبة</span>
                  </div>
                  <code className="text-blue-400 font-mono text-[11px]">demo@mken.live</code>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Back to Site */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة للموقع
          </Link>
        </div>
      </div>
    </div>
  );
}
