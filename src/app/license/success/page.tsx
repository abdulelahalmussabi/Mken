"use client";

import React, { useCallback, useEffect, useState } from "react";

type Phase = "loading" | "success" | "error" | "delay";

export default function LicenseSuccessPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("نحن نتحقق من دفعتك عبر Moyasar ونصدر مفتاح الترخيص.");
  const [licenseKey, setLicenseKey] = useState("");
  const [plan, setPlan] = useState("");
  const [copied, setCopied] = useState(false);

  const check = useCallback((attempt = 0) => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("id") || params.get("payment_id") || "";
    const status = params.get("status") || "";
    if (!paymentId) {
      setPhase("error");
      setMessage("رقم عملية الدفع غير موجود في الرابط. ارجع لصفحة التسعير أو تواصل مع الدعم.");
      return;
    }
    if (status && status !== "paid" && status !== "captured") {
      setPhase("error");
      setMessage(`عملية الدفع لم تكتمل بنجاح. حالة الدفعة: ${status}`);
      return;
    }

    fetch(`/api/license-checkout/status?paymentId=${encodeURIComponent(paymentId)}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "خطأ في الاتصال بالخادم");
        if (d.paid && d.issued) {
          setLicenseKey(d.licenseKey);
          setPlan(d.plan || "");
          setPhase("success");
          setMessage(`شكراً لثقتك بمكن لايت. تم إصدار ترخيص التشغيل لباقة ${d.plan}.`);
          return;
        }
        if (d.paid && !d.issued) {
          if (attempt < 6) {
            setTimeout(() => check(attempt + 1), 2500);
            return;
          }
          setPhase("delay");
          setMessage(`تم تأكيد الدفعة ${paymentId}. يبدو أن إصدار المفتاح تأخر قليلاً — حدّث الصفحة بعد لحظات أو راسل الدعم برقم الدفعة.`);
          return;
        }
        setPhase("error");
        setMessage(`الدفع غير مؤكد بعد. حالة الدفع: ${d.status || "معلق"}`);
      })
      .catch((err) => {
        if (attempt < 6) {
          setTimeout(() => check(attempt + 1), 3000);
          return;
        }
        setPhase("error");
        setMessage(`حدث خطأ أثناء التحقق من الدفع: ${err instanceof Error ? err.message : "خطأ"}`);
      });
  }, []);

  useEffect(() => {
    check(0);
  }, [check]);

  const copy = async () => {
    if (!licenseKey) return;
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-5" dir="rtl">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div
          className={`mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-2 ${
            phase === "success" || phase === "delay"
              ? "border-emerald-400 text-emerald-400 bg-emerald-500/10"
              : phase === "error"
                ? "border-rose-400 text-rose-400 bg-rose-500/10"
                : "border-sky-400 text-sky-400 bg-sky-500/10"
          }`}
        >
          {phase === "success" || phase === "delay" ? "✓" : phase === "error" ? "✕" : "…"}
        </div>
        <h1 className="text-2xl font-black mb-3">
          {phase === "success" ? "تم الدفع وتفعيل الترخيص" : phase === "error" ? "عذراً، فشلت العملية" : phase === "delay" ? "تم الدفع وجاري إصدار المفتاح" : "جارٍ التحقق من الدفع"}
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">{message}</p>

        {phase === "success" ? (
          <>
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4">
              <p className="text-[11px] text-slate-500 mb-1">مفتاح الترخيص {plan ? `— ${plan}` : ""}</p>
              <p className="font-mono font-bold text-amber-300 tracking-wide" dir="ltr">
                {licenseKey}
              </p>
            </div>
            <ol className="text-right text-xs text-slate-400 mt-5 space-y-1 list-decimal ps-5">
              <li>انسخ المفتاح أعلاه.</li>
              <li>افتح تطبيق Mken Lite على جهازك.</li>
              <li>الإعدادات ← الترخيص والحماية.</li>
              <li>ألصق المفتاح واضغط تفعيل لربط هذا الجهاز.</li>
            </ol>
            <button type="button" onClick={copy} className="mt-6 w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-extrabold text-sm">
              {copied ? "تم النسخ" : "نسخ مفتاح الترخيص"}
            </button>
          </>
        ) : null}

        <a href="/license" className="mt-4 inline-block text-sm text-sky-400">
          العودة للتسعير
        </a>
      </div>
    </div>
  );
}
