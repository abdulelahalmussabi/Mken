"use client";

import React, { useState } from "react";
import { useOccasion, type OccasionId } from "@/context/OccasionContext";
import { AdsShowcaseModal, useTenantPublicAds } from "@/components/occasions/AdsShowcaseModal";
import { Copy, Check, Megaphone } from "lucide-react";

/** Compact badge label shown in the top occasion strip (matches original UI). */
const BANNER_BADGE: Partial<Record<OccasionId, string>> = {
  national_day: "96 SA",
  founding_day: "1727",
  flag_day: "11 MAR",
  ramadan: "رمضان",
  eid_fitr: "عيد الفطر",
  eid_adha: "عيد الأضحى",
  back_to_school: "نكتب قصة",
  white_friday: "WHITE",
};

const BANNER_SURFACE: Partial<
  Record<OccasionId, { bar: string; badge: string; line: string }>
> = {
  national_day: {
    bar: "bg-[#043d28] border-b border-emerald-700/60",
    badge: "bg-emerald-500 text-slate-950 border-emerald-400",
    line: "from-emerald-400/20 via-amber-300/10 to-transparent",
  },
  founding_day: {
    bar: "bg-[#3b1c09] border-b border-amber-800/60",
    badge: "bg-amber-500 text-slate-950 border-amber-400",
    line: "from-amber-400/20 via-orange-300/10 to-transparent",
  },
  flag_day: {
    bar: "bg-[#064e3b] border-b border-teal-700/60",
    badge: "bg-teal-400 text-slate-950 border-teal-300",
    line: "from-teal-300/20 via-emerald-300/10 to-transparent",
  },
  ramadan: {
    bar: "bg-[#0b1633] border-b border-amber-700/50",
    badge: "bg-amber-400 text-slate-950 border-amber-300",
    line: "from-amber-400/20 via-yellow-300/10 to-transparent",
  },
  eid_fitr: {
    bar: "bg-[#2a1040] border-b border-orange-700/50",
    badge: "bg-orange-400 text-slate-950 border-orange-300",
    line: "from-orange-400/20 via-purple-300/10 to-transparent",
  },
  eid_adha: {
    bar: "bg-[#052e1c] border-b border-yellow-700/50",
    badge: "bg-yellow-400 text-slate-950 border-yellow-300",
    line: "from-yellow-400/20 via-emerald-300/10 to-transparent",
  },
  back_to_school: {
    bar: "bg-[#0c4a6e] border-b border-sky-600/50",
    badge: "bg-sky-400 text-slate-950 border-sky-300",
    line: "from-sky-300/20 via-amber-300/10 to-transparent",
  },
  white_friday: {
    bar: "bg-black border-b border-white/20",
    badge: "bg-white text-slate-950 border-rose-400",
    line: "from-white/15 via-rose-500/15 to-transparent",
  },
};

const DEFAULT_SURFACE = {
  bar: "bg-slate-900 border-b border-slate-700",
  badge: "bg-slate-700 text-white border-slate-500",
  line: "from-white/10 via-transparent to-transparent",
};

export const OccasionBanner: React.FC = () => {
  const { activeOccasion, occasionDetails, copyCoupon, isMounted, currentSlug } = useOccasion();
  const [copied, setCopied] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);
  const ads = useTenantPublicAds(currentSlug);

  if (!isMounted || activeOccasion === "none") return null;

  const surface = BANNER_SURFACE[activeOccasion] || DEFAULT_SURFACE;
  const badgeLabel = BANNER_BADGE[activeOccasion] || occasionDetails.shortName;
  const stripTitle = `${occasionDetails.shortName} — ${occasionDetails.slogan}`;

  const handleCopy = () => {
    copyCoupon(occasionDetails.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className={`relative ${surface.bar} text-white py-2.5 px-4 z-40 overflow-hidden`}>
      <div
        className={`absolute inset-0 bg-gradient-to-l ${surface.line} pointer-events-none`}
      />

      <div className="relative max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Occasion title (RTL start) */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide border ${surface.badge}`}
          >
            {badgeLabel}
          </span>
          <span className="font-semibold text-white/95 text-center sm:text-right leading-snug">
            {stripTitle}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setAdsOpen(true)}
            className="relative flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-3 py-1 rounded-lg text-xs transition-all shadow-md hover:scale-105 active:scale-95"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>العروض والإعلانات</span>
            {ads.length > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rose-500 text-[10px] text-white font-black leading-[1.1rem] text-center">
                {ads.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-black/25 hover:bg-black/40 border border-white/15 px-3 py-1.5 rounded-lg text-xs transition-colors"
            title="نسخ كود الخصم"
          >
            <code className="font-mono font-bold text-amber-200 tracking-wider">
              {occasionDetails.couponCode}
            </code>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-white/70" />
            )}
          </button>
        </div>
      </div>
      <AdsShowcaseModal open={adsOpen} onClose={() => setAdsOpen(false)} ads={ads} />
    </div>
  );
};
