"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, CheckCircle2, Phone, MapPin, MessageCircle, Star } from "lucide-react";
import type { PageBlock } from "@/types/blocks";

interface PageBlockRendererProps {
  blocks: PageBlock[];
  tenantSlug: string;
  accentColor?: string;
}

export default function PageBlockRenderer({
  blocks,
  tenantSlug,
  accentColor = "#D97706",
}: PageBlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-16 py-8">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "hero": {
            const b = block as any;
            return (
              <section
                key={index}
                className="relative rounded-3xl p-8 sm:p-14 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl"
              >
                {b.badge && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    {b.badge}
                  </span>
                )}
                <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                  {b.title}
                </h1>
                {b.subtitle && (
                  <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                    {b.subtitle}
                  </p>
                )}
                {b.ctaText && (
                  <div className="pt-4">
                    <Link
                      href={b.ctaLink || `/book?tenant=${tenantSlug}`}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-slate-950 shadow-xl hover:scale-105 transition-all text-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      <span>{b.ctaText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </section>
            );
          }

          case "content": {
            const b = block as any;
            return (
              <section key={index} className="max-w-4xl mx-auto p-8 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
                <h2 className="text-2xl font-black text-white">{b.title}</h2>
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                  {b.body}
                </div>
              </section>
            );
          }

          case "pricing": {
            const b = block as any;
            return (
              <section key={index} className="space-y-8 text-center max-w-5xl mx-auto">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">{b.title}</h2>
                  {b.subtitle && <p className="text-sm text-slate-400">{b.subtitle}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                  {(b.plans || [
                    { name: "الباقة الأساسية", price: "99 ر.س", features: ["خدمة أولى مميزة", "حجز فوري", "دعم واتساب"] },
                    { name: "الباقة الذهبية (الأكثر طلباً)", price: "249 ر.س", features: ["كافة الخدمات الأساسية", "أولوية الحجز", "خصم 20% على المنتجات", "ضيافة VIP"], isPopular: true },
                    { name: "الباقة الملكية VIP", price: "499 ر.س", features: ["خدمات شاملة غير محدودة", "حجز منزلي مجاني", "عناية خاصة متكاملة"] },
                  ]).map((plan: any, pIdx: number) => (
                    <div
                      key={pIdx}
                      className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                        plan.isPopular
                          ? "bg-slate-900 border-amber-500/50 shadow-2xl scale-105"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-white text-base">{plan.name}</h3>
                          {plan.isPopular && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                              شائعة
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-black text-amber-400 font-mono">{plan.price}</p>
                        <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                          {plan.features.map((feat: string, fIdx: number) => (
                            <li key={fIdx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-6">
                        <Link
                          href={`/book?tenant=${tenantSlug}`}
                          className="w-full py-3 rounded-xl font-bold text-xs text-slate-950 text-center block transition shadow"
                          style={{ backgroundColor: accentColor }}
                        >
                          اختيار هذه الباقة
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          case "contact": {
            const b = block as any;
            return (
              <section key={index} className="max-w-2xl mx-auto p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6 text-center">
                <h2 className="text-2xl font-black text-white">{b.title || "تواصل معنا"}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right text-xs">
                  {b.phone && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                      <Phone className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">الهاتف / الاتصال:</span>
                        <span className="font-bold font-mono text-white">{b.phone}</span>
                      </div>
                    </div>
                  )}
                  {b.location && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">الموقع:</span>
                        <span className="font-bold text-white">{b.location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
