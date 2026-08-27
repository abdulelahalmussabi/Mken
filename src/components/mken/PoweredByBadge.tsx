"use client";

import React, { useState } from "react";
import { Zap, Sparkles, ExternalLink, X } from "lucide-react";
import { getReferralUrl } from "@/lib/mken/affiliate";

interface PoweredByBadgeProps {
  tenantSlug: string;
  planTier?: "starter" | "pro" | "enterprise" | string;
  variant?: "floating" | "inline" | "footer";
  isWhiteLabelAllowed?: boolean;
}

export default function PoweredByBadge({
  tenantSlug,
  planTier = "starter",
  variant = "floating",
  isWhiteLabelAllowed = false,
}: PoweredByBadgeProps) {
  const [minimized, setMinimized] = useState(false);

  // If plan is Pro/Enterprise and white label is enabled, hide badge completely
  if (isWhiteLabelAllowed && (planTier === "pro" || planTier === "enterprise")) {
    return null;
  }

  const referralUrl = getReferralUrl(tenantSlug);

  const handleClick = () => {
    // Optionally fire lightweight telemetry
    try {
      fetch("/api/affiliates/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: tenantSlug, type: "click" }),
      }).catch(() => {});
    } catch {}
  };

  if (variant === "footer" || variant === "inline") {
    return (
      <div className="w-full py-4 text-center border-t border-slate-800/40 bg-slate-950/60 backdrop-blur-sm">
        <a
          href={referralUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-xs group shadow-sm"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold">مشغل بواسطة منصة</span>
          <span className="font-black text-amber-400 group-hover:underline">مكّن | mken.live</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">أطلق بوابتك الذكية</span>
          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
        </a>
      </div>
    );
  }

  // Floating Pill Variant
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 left-4 z-40 p-2.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-amber-400 shadow-xl hover:scale-110 transition-all backdrop-blur-md"
        title="مشغل بواسطة مكّن"
      >
        <Zap className="w-4 h-4 fill-amber-400 animate-pulse" />
      </button>
    );
  }

  return (
    <aside aria-label="شعار منصة مكن" className="fixed bottom-4 left-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl shadow-2xl backdrop-blur-md transition-all group">
        <a
          href={referralUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200"
        >
          <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-inner shrink-0">
            <Zap className="w-3 h-3 text-slate-950 fill-slate-950" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-medium leading-none">مدعوم بواسطة</span>
            <span className="font-extrabold text-white group-hover:text-amber-400 transition-colors leading-tight">
              مكّن <span className="text-amber-400 font-mono">mken.live</span>
            </span>
          </div>
          <span className="text-[9px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded mr-1 hidden sm:inline-block">
            بوابة ذكية ⚡
          </span>
        </a>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(true);
          }}
          className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition"
          title="تصغير الشارة"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
}
