"use client";

import React, { useEffect, useMemo, useState } from "react";

type Plan = {
  key: string;
  label: string;
  annual: number;
  perpetual: number;
  maxDevices: number;
};

type Config = {
  publishableKey: string;
  plans: Plan[];
};

const FEATURES: Record<string, string[]> = {
  Lite: ["فوترة + فاتورة ضريبية ZATCA", "مخزون وتقارير تشغيل", "يعمل بدون إنترنت", "نسخ احتياطي محلي", "جهاز واحد", "دعم أساسي"],
  Pro: ["فوترة + فاتورة ضريبية ZATCA", "مخزون وتقارير تشغيل", "يعمل بدون إنترنت", "نسخ احتياطي محلي", "حتى 3 أجهزة", "فروع وورديات", "دعم أولوية"],
  Business: ["فوترة + فاتورة ضريبية ZATCA", "مخزون وتقارير تشغيل", "يعمل بدون إنترنت", "نسخ احتياطي محلي", "حتى 25 جهازاً", "كل مزايا Pro", "مزامنة سحابية اختيارية", "دعم مخصص"],
};

function cleanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

declare global {
  interface Window {
    Moyasar?: { init: (opts: Record<string, unknown>) => void };
  }
}

export default function LicensePricingPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState<"annual" | "perpetual">("annual");
  const [selected, setSelected] = useState<Plan | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", crNumber: "", taxNumber: "" });

  useEffect(() => {
    fetch("/api/license-checkout/config")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "تعذّر تحميل الباقات");
        setConfig({ publishableKey: d.publishableKey || "", plans: d.plans || [] });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "تعذّر التحميل"));

    if (!document.getElementById("moyasar-css")) {
      const css = document.createElement("link");
      css.id = "moyasar-css";
      css.rel = "stylesheet";
      css.href = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.css";
      document.head.appendChild(css);
    }
    if (!document.getElementById("moyasar-js")) {
      const script = document.createElement("script");
      script.id = "moyasar-js";
      script.src = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.js";
      document.body.appendChild(script);
    }
  }, []);

  const plans = config?.plans || [];
  const subtitle = useMemo(() => {
    if (!selected) return "";
    const price = cycle === "perpetual" ? selected.perpetual : selected.annual;
    return `${price} ر.س — ${cycle === "perpetual" ? "رخصة دائمة" : "اشتراك سنوي"} · حتى ${selected.maxDevices} جهاز`;
  }, [selected, cycle]);

  const choose = (plan: Plan) => {
    setSelected(plan);
    setFormErr("");
    setShowPay(false);
    setOverlay(true);
  };

  const proceed = () => {
    if (!config?.publishableKey) {
      setFormErr("بوابة الدفع غير مهيّأة. تواصل مع الدعم.");
      return;
    }
    if (!selected) return;
    const name = form.name.trim();
    const phone = cleanPhone(form.phone);
    const crNumber = form.crNumber.trim();
    const taxNumber = form.taxNumber.trim();
    if (!name) {
      setFormErr("أدخل اسم المنشأة");
      return;
    }
    if (phone.length < 12) {
      setFormErr("أدخل رقم جوال صحيح");
      return;
    }
    if (!crNumber) {
      setFormErr("أدخل رقم السجل التجاري أو وثيقة العمل الحر");
      return;
    }
    if (taxNumber && !/^[0-9]{15}$/.test(taxNumber)) {
      setFormErr("الرقم الضريبي غير صالح (يجب أن يتكون من 15 رقماً)");
      return;
    }
    if (!window.Moyasar) {
      setFormErr("بوابة الدفع لم تُحمَّل بعد، حاول بعد لحظات.");
      return;
    }

    const price = cycle === "perpetual" ? selected.perpetual : selected.annual;
    setFormErr("");
    setShowPay(true);
    window.Moyasar.init({
      element: "#moyasar-form",
      amount: Math.round(price * 100),
      currency: "SAR",
      description: `Mken Lite — ${selected.label} (${cycle === "perpetual" ? "دائم" : "سنوي"})`,
      publishable_api_key: config.publishableKey,
      callback_url: `${window.location.origin}/license/success`,
      methods: ["creditcard", "mada", "applepay", "stcpay"],
      metadata: {
        type: "mken_lite_license",
        plan: selected.key,
        billing_cycle: cycle,
        max_devices: selected.maxDevices,
        customer_name: name,
        phone,
        email: form.email.trim(),
        commercial_registry_number: crNumber,
        tax_number: taxNumber || null,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col" dir="rtl">
      <main className="max-w-5xl mx-auto w-full px-5 py-12 flex-1">
        <header className="text-center mb-12">
          <p className="text-sky-400 text-xs font-bold mb-2">Mken Lite</p>
          <h1 className="text-3xl sm:text-4xl font-black mb-3">مكن لايت — رخص التشغيل والاشتراكات</h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            اختر باقتك لتفعيل تطبيق Mken Lite وتشغيل الفواتير والمخزون بدون إنترنت. بعد الدفع يصلك المفتاح فوراً، ثم تربطه بجهازك عبر واجهة التفعيل.
          </p>
        </header>

        <div className="flex justify-center gap-2 mb-10">
          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={`px-4 py-2 rounded-full text-sm font-bold ${cycle === "annual" ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}
          >
            اشتراك سنوي
          </button>
          <button
            type="button"
            onClick={() => setCycle("perpetual")}
            className={`px-4 py-2 rounded-full text-sm font-bold ${cycle === "perpetual" ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}
          >
            رخصة مدى الحياة
          </button>
        </div>

        {error ? (
          <p className="text-center text-rose-400 text-sm">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const price = cycle === "perpetual" ? plan.perpetual : plan.annual;
              const unit = cycle === "perpetual" ? "لمرة واحدة" : "/ سنوياً";
              const popular = plan.key === "Pro";
              return (
                <div
                  key={plan.key}
                  className={`rounded-3xl border p-6 bg-slate-900/70 ${popular ? "border-sky-400" : "border-slate-800"}`}
                >
                  {popular ? <p className="text-[11px] font-bold text-sky-400 mb-2">الأكثر اختياراً</p> : null}
                  <h2 className="text-xl font-extrabold">{plan.label}</h2>
                  <p className="text-3xl font-black mt-3">
                    {price} <span className="text-sm font-bold text-slate-400">ر.س {unit}</span>
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-slate-300">
                    {(FEATURES[plan.key] || FEATURES.Lite).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => choose(plan)}
                    className="mt-6 w-full py-2.5 rounded-xl font-bold text-sm border border-sky-400 text-sky-300 hover:bg-sky-500 hover:text-slate-950"
                  >
                    اشترك الآن
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-500 py-8 border-t border-slate-800">
        <p>بشراء ترخيص التشغيل، أنت توافق على شروط الخدمة وسياسة الخصوصية.</p>
        <p className="mt-2">
          <a className="text-sky-400" href="https://www.mken.live/privacy">
            سياسة الخصوصية
          </a>
          {" · "}
          <a className="text-sky-400" href="https://www.mken.live/terms">
            شروط الخدمة
          </a>
          {" · "}
          <a className="text-sky-400" href="/admin/licenses">
            لوحة الإدارة
          </a>
        </p>
      </footer>

      {overlay && selected ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setOverlay(false)} className="absolute top-4 left-4 text-slate-400 text-xl">
              ×
            </button>
            <h2 className="text-lg font-extrabold">اشتراك {selected.label}</h2>
            <p className="text-sky-400 text-sm mt-1 mb-5">{subtitle}</p>
            {formErr ? <p className="mb-4 text-sm text-rose-300 bg-rose-950/40 border border-rose-800 rounded-xl px-3 py-2">{formErr}</p> : null}
            <div className="space-y-3">
              <input className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="اسم المنشأة / العميل *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="رقم الجوال لتلقي المفتاح *" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="البريد الإلكتروني (اختياري)" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="السجل التجاري أو وثيقة العمل الحر *" dir="ltr" value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} />
              <input className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="الرقم الضريبي إن وجد (15 رقماً)" dir="ltr" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
            </div>
            {!showPay ? (
              <button type="button" onClick={proceed} className="mt-5 w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm">
                الانتقال للدفع الآمن
              </button>
            ) : null}
            <div id="moyasar-form" className="mt-4" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
