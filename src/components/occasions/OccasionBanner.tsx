"use client";

import React, { useState } from "react";
import { useOccasion } from "@/context/OccasionContext";
import { useAdmin } from "@/context/AdminContext";
import { Sparkles, Copy, Check, Gift, Megaphone } from "lucide-react";
import { AdsModal } from "./AdsModal";

export const OccasionBanner: React.FC = () => {
  const { activeOccasion, occasionDetails, copyCoupon, isMounted, currentSlug } = useOccasion();
  const { getAdsForTenant } = useAdmin();
  const [copied, setCopied] = useState(false);
  const [showAdsModal, setShowAdsModal] = useState(false);

  if (!isMounted || activeOccasion === "none") return null;

  const activeAds = getAdsForTenant ? getAdsForTenant(currentSlug || undefined) : [];

  const handleCopy = () => {
    copyCoupon(occasionDetails.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      <div className="relative bg-slate-900/90 border-b border-amber-500/30 text-white py-2 px-4 shadow-xl backdrop-blur-md z-40 overflow-hidden transition-all duration-500">
        {/* Background Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-purple-500/10 animate-shimmer pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Left/Right RTL Occasion Info */}
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${occasionDetails.badgeBg}`}>
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
              {occasionDetails.name}
            </span>
            <span className="font-medium text-slate-200 hidden md:inline">|</span>
            <span className="text-slate-300 font-semibold">{occasionDetails.slogan}</span>
          </div>

          {/* Promo Code & Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Coupon Code Pill */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300 text-xs">كود الخصم:</span>
              <code className="font-mono font-bold text-amber-300 text-xs tracking-wider">
                {occasionDetails.couponCode}
              </code>
              <button
                onClick={handleCopy}
                className="mr-1 p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                title="نسخ كود الخصم"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Dynamic Active Ads & Promotions Button (Shows if ads exist, hides if none) */}
            {activeAds.length > 0 && (
              <button
                onClick={() => setShowAdsModal(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black px-3 py-1 rounded-lg text-xs transition-all shadow-md hover:scale-105 active:scale-95"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>العروض والإعلانات</span>
                <span className="bg-slate-950 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black">
                  {activeAds.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ads Modal */}
      {activeAds.length > 0 && (
        <AdsModal
          isOpen={showAdsModal}
          onClose={() => setShowAdsModal(false)}
          ads={activeAds}
        />
      )}
    </>
  );
};

