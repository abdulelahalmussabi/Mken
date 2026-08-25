"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, Megaphone, Sparkles, Gift, Check, Copy, Tag, Calendar, ArrowLeft } from "lucide-react";
import { useOccasion } from "@/context/OccasionContext";
import type { AdBannerRecord } from "@/types/database";

interface AdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ads: AdBannerRecord[];
}

export const AdsModal: React.FC<AdsModalProps> = ({ isOpen, onClose, ads }) => {
  const { occasionDetails, copyCoupon } = useOccasion();
  const [copied, setCopied] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);

  if (!isOpen || ads.length === 0) return null;

  const currentAd = ads[activeAdIndex] || ads[0];

  const handleCopyCoupon = () => {
    copyCoupon(occasionDetails.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 text-right font-sans">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Megaphone className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>العروض والإعلانات الترويجية</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {ads.length} {ads.length === 1 ? "إعلان نشط" : "إعلانات نشطة"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                أحدث العروض الحصرية والخصومات المعتمدة لزوار المنصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ads Selector Tabs (if multiple ads) */}
        {ads.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto p-3 bg-slate-950/60 border-b border-slate-800 no-scrollbar">
            {ads.map((ad, idx) => {
              const isActive = activeAdIndex === idx;
              return (
                <button
                  key={ad.id}
                  onClick={() => setActiveAdIndex(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    isActive
                      ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">{ad.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Ad Content Card */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
            {/* Background Glow */}
            <div
              className="absolute -top-12 -left-12 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: occasionDetails.accentColor }}
            />

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
                <span>عرض ترويجي حصري ✨</span>
              </span>

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>ساري لفترة محدودة</span>
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white leading-snug">
                {currentAd.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentAd.subtitle}
              </p>
            </div>

            {/* Coupon Code Section */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs">
                  <span className="text-slate-400 block">كوبون خصم مناسبة {occasionDetails.shortName}:</span>
                  <span className="font-bold text-amber-300">{occasionDetails.discountText}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <code className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm font-black text-amber-300 tracking-wider">
                  {occasionDetails.couponCode}
                </code>
                <button
                  onClick={handleCopyCoupon}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  title="نسخ الكود"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Link Button */}
            {currentAd.linkUrl && (
              <div className="pt-2">
                <Link
                  href={currentAd.linkUrl}
                  onClick={onClose}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                >
                  <span>الاستفادة من العرض والتسجيل الآن</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>منصة مكّن 🇸🇦 • العروض المعتمدة</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};