"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";

export default function PrivacyDeletePage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/privacy/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantSlug: tenantSlug.trim().toLowerCase(),
          email: email.trim(),
          confirm: confirm.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setError(result.error || "تعذّر تنفيذ الطلب");
        return;
      }
      setDone(true);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-10 sm:py-14">
        <p className="text-sm text-muted mb-2">نظام حماية البيانات الشخصية · PDPL</p>
        <h1 className="text-3xl font-extrabold mb-3">طلب حذف بيانات المنشأة</h1>
        <p className="text-muted leading-relaxed mb-6">
          يحذف هذا النموذج بيانات التشغيل المرتبطة بمنشأتك (المواعيد، المحادثات، الموظفون، الرموز).
          تُجهَّل بيانات العملاء على الفواتير المحتفظ بها للالتزامات النظامية مثل زاتكا. لا يُحذف صف
          المنصة <span dir="ltr">_mken_platform</span>.
        </p>

        {done ? (
          <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-5 text-sm leading-relaxed">
            تم تسجيل الطلب وتنفيذ الحذف. لن تتمكن من الدخول إلى لوحة هذه المنشأة بعد الآن.
            <div className="mt-4">
              <Link href={"/" as Route} className="text-amber-400 underline">
                العودة للرئيسية
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line p-5 bg-surface">
            {error ? (
              <p className="flex items-start gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-bold">معرّف المنشأة (الرابط)</span>
              <input
                dir="ltr"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="your-business"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-line text-left"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-bold">البريد المسجّل للمنشأة</span>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-line text-left"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-bold">
                اكتب <span dir="ltr">DELETE</span> للتأكيد
              </span>
              <input
                dir="ltr"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-line text-left"
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-60 font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف بيانات المنشأة
            </button>
            <p className="text-xs text-muted">
              إن كنت مسجّلاً في لوحة الإدارة يمكنك الحذف من{" "}
              <Link href={"/admin/settings" as Route} className="underline text-amber-600">
                الإعدادات
              </Link>
              . راجع{" "}
              <Link href={"/privacy" as Route} className="underline text-amber-600">
                سياسة الخصوصية
              </Link>
              .
            </p>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
