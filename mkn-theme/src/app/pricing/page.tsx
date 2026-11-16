"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useOccasion } from "@/context/OccasionContext";
import {
  PLATFORM_PLANS,
  planPrice,
  yearlySavings,
  type BillingCycle,
} from "@/lib/mken/platform-pricing";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

export default function PricingPage() {
  const { occasionDetails } = useOccasion();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="flex-1 relative z-10">
        <section className="pt-14 pb-10 border-b border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              تسعير واضح — بدون مفاجآت
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              ثلاث باقات لتشغيل منشأتك
            </h1>
            <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              قارن الامتثال والنمو والاحترافي — شهرياً أو سنوياً (شهران مجاناً على السنوي). إعداد أول مرة منفصل حسب تعقيد منشأتك.
            </p>

            <div className="inline-flex rounded-2xl border border-line bg-surface p-1 mt-2">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition ${
                  cycle === "monthly" ? "bg-amber-500 text-slate-950 shadow" : "text-muted hover:text-foreground"
                }`}
              >
                شهري
              </button>
              <button
                type="button"
                onClick={() => setCycle("yearly")}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition ${
                  cycle === "yearly" ? "bg-amber-500 text-slate-950 shadow" : "text-muted hover:text-foreground"
                }`}
              >
                سنوي · وفّر شهرين
              </button>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {PLATFORM_PLANS.map((plan) => {
                const price = planPrice(plan, cycle);
                const save = yearlySavings(plan);
                const external = plan.cta.href.startsWith("http");
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 bg-surface/90 shadow-xl ${
                      plan.popular ? "border-amber-500 ring-1 ring-amber-500/40" : "border-line"
                    }`}
                  >
                    {plan.popular ? (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-extrabold">
                        الأكثر طلباً
                      </span>
                    ) : null}
                    <h2 className="text-xl font-extrabold text-foreground">{plan.name}</h2>
                    <p className="text-xs text-muted mt-1.5 min-h-[2.5rem]">{plan.blurb}</p>
                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="text-4xl font-black" style={{ color: occasionDetails.accentColor }}>
                        {price.toLocaleString("ar-SA")}
                      </span>
                      <span className="text-sm text-muted">
                        ر.س / {cycle === "yearly" ? "سنة" : "شهر"}
                      </span>
                    </div>
                    {cycle === "yearly" ? (
                      <p className="text-[11px] text-emerald-600 font-bold mt-1">
                        توفير {save.toLocaleString("ar-SA")} ر.س مقارنة بالدفع الشهري
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted mt-1">
                        أو {plan.yearly.toLocaleString("ar-SA")} ر.س سنوياً
                      </p>
                    )}

                    <ul className="mt-6 space-y-2.5 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                      {(plan.missing || []).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-muted line-through opacity-70">
                          <span className="w-4 shrink-0 text-center">—</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {external ? (
                      <a
                        href={plan.cta.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-8 w-full py-3.5 rounded-2xl font-extrabold text-sm text-center border border-line hover:border-amber-500 transition"
                      >
                        {plan.cta.label}
                      </a>
                    ) : (
                      <Link
                        href={plan.cta.href as Route}
                        className="mt-8 w-full py-3.5 rounded-2xl font-extrabold text-sm text-center text-slate-950 shadow-lg transition hover:scale-[1.01] flex items-center justify-center gap-2"
                        style={{ backgroundColor: occasionDetails.accentColor }}
                      >
                        <span>{plan.cta.label}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted mt-10 max-w-2xl mx-auto leading-relaxed">
              الأسعار بالريال السعودي وقد تشمل ضريبة القيمة المضافة وفق الأنظمة. إعداد أول مرة: من 999 إلى 2,500 ر.س حسب تعقيد المنشأة.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
