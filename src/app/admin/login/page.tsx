"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { Shield, Eye, EyeOff, LogIn, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const { loginAdmin, isAdmin } = useAdmin();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in
  React.useEffect(() => {
    if (isAdmin) {
      router.push("/admin");
    }
  }, [isAdmin, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const result = loginAdmin(email.trim(), password);
      if (result.success) {
        router.push("/admin");
      } else {
        setError(result.message);
        setLoading(false);
      }
    }, 600);
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
            <h1 className="text-3xl font-black text-white">لوحة تحكم مكّن</h1>
            <p className="text-slate-400 text-sm mt-1">
              دخول آمن للمديرين وأدمن العملاء
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
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mken.live"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors font-mono pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-400 text-xs font-medium text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="animate-pulse">جاري التحقق...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول لوحة التحكم</span>
                </>
              )}
            </button>
          </form>

          {/* Accounts Info */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-2 text-xs">
            <p className="text-slate-400 font-bold">حسابات الدخول:</p>
            <div className="space-y-1.5 text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>سوبر أدمن: <code className="text-amber-400 font-mono">admin@mken.live</code></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>أدمن المحروسة: <code className="text-emerald-400 font-mono">almahrusa@mken.live</code></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>أدمن ديمو: <code className="text-blue-400 font-mono">demo@mken.live</code></span>
              </div>
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
