"use client";

import React, { useState, useEffect } from "react";
import { generateQRCodeSVG, getTenantQueueScanUrl } from "@/lib/mken/qr-svg";
import { Printer, Smartphone, HeartHandshake, Sparkles, CheckCircle2 } from "lucide-react";

export default function QueueKioskPosterPage() {
  const [scanUrl, setScanUrl] = useState<string>("/queue/scan");
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("صالة الخدمات المركزية");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const params = new URLSearchParams(window.location.search);
      const tenant = params.get("tenant") || "default";

      // Build ultra-clean, short QR code URL for rapid mobile scanning
      const fullUrl = `${origin}/queue/scan${tenant !== "default" ? `?tenant=${tenant}` : ""}`;
      setScanUrl(fullUrl);

      // Generate high-contrast SVG QR Code with generous quiet zone
      const svg = generateQRCodeSVG(fullUrl, { sizePx: 320, margin: 4 });
      setSvgMarkup(svg);

      if (tenant && tenant !== "default") {
        setTenantName(`صالة ${tenant}`);
      }
    }
  }, []);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans print:bg-white print:p-0 print:text-black">
      {/* Non-printable action top bar */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between print:hidden">
        <span className="text-xs text-slate-400">لوحة ستاند الاستقبال والكشك الذكي</span>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs transition shadow-lg cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          طباعة اللوحة (A4 Stand)
        </button>
      </div>

      {/* Main High-Contrast Printable Poster Card */}
      <div className="w-full max-w-lg bg-white text-slate-950 rounded-3xl p-8 sm:p-10 shadow-2xl border-4 border-slate-200 flex flex-col items-center text-center space-y-6 print:border-none print:shadow-none print:w-full print:max-w-none print:p-8">
        {/* Brand Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-950 text-xs font-black mb-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            نظام الطابور الذكي المباشر
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
            مَكَن <span className="text-orange-500">|</span> {tenantName}
          </h1>
          <p className="text-sm sm:text-base font-bold text-slate-700">
            امسح الباركود بهاتفك لتأكيد وصولك وسحب تذكرتك مباشرة
          </p>
        </div>

        {/* The Ultra-High-Contrast QR Code Container */}
        <div className="p-4 bg-white rounded-3xl border-2 border-slate-900 shadow-md flex items-center justify-center">
          {svgMarkup ? (
            <div
              className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          ) : (
            <div className="w-64 h-64 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs">
              جاري تجهيز الباركود...
            </div>
          )}
        </div>

        {/* Rapid Camera Scan Guidance */}
        <div className="space-y-2 max-w-sm">
          <div className="flex items-center justify-center gap-2 text-xs font-black text-emerald-800 bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            لا حاجة لتثبيت أي تطبيق • يعمل مباشرة عبر كاميرا هاتفك
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] font-bold text-slate-600 pt-1">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-orange-600 block text-xs">1. وجّه الكاميرا</span>
              نحو الباركود
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-orange-600 block text-xs">2. استلم رقمك</span>
              على جوالك
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-orange-600 block text-xs">3. تابع الشاشة</span>
              لحظة النداء
            </div>
          </div>
        </div>

        {/* Human Priority Banner */}
        <div className="w-full p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-right space-y-1">
          <div className="flex items-center gap-2 font-black text-xs text-amber-900">
            <HeartHandshake className="w-4 h-4 text-amber-600" />
            مسار الرعاية الخاصة (كبار السن وذوو الإعاقة)
          </div>
          <p className="text-[11px] text-amber-900/90 leading-relaxed">
            يحظى كبار السن 👴 وذوو الاحتياجات الخاصة ♿ بأولوية وتقدير فوري لدى موظف الاستقبال لتفعيل مسار الرعاية دون انتظار.
          </p>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-slate-500 font-mono tracking-wider pt-2 border-t border-slate-200 w-full">
          {scanUrl}
        </div>
      </div>
    </div>
  );
}
