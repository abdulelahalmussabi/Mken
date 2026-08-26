"use client";

import React, { useEffect, useState } from "react";
import { useOccasion } from "@/context/OccasionContext";
import { isolateTenantHref } from "@/lib/mken/tenant-host";
import type { AppearancePublic } from "@/lib/mken/appearance";
import { Megaphone, X, Star, Gift, Copy, Check, ArrowLeft } from "lucide-react";

export interface TenantPublicAd {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  ctaLabel: string;
  couponCode: string;
  image: string;
}

export function adsFromAppearance(
  appearance: AppearancePublic | null,
  slug: string
): TenantPublicAd[] {
  if (!appearance || !slug) return [];
  const items: TenantPublicAd[] = [];
  const primary = appearance.ads.primary;
  if (primary.enabled && (primary.title || primary.text)) {
    items.push({
      id: "primary",
      title: primary.title || "عرض المنشأة",
      subtitle: primary.text,
      href: isolateTenantHref(primary.ctaHref, slug),
      ctaLabel: primary.ctaLabel || "الاستفادة من العرض الآن",
      couponCode: primary.couponCode,
      image: primary.image,
    });
  }
  for (const ad of appearance.ads.secondary || []) {
    if (!ad.enabled || !ad.title.trim()) continue;
    items.push({
      id: ad.id,
      title: ad.title,
      subtitle: ad.text,
      href: isolateTenantHref(ad.href, slug),
      ctaLabel: "الاستفادة من العرض الآن",
      couponCode: "",
      image: ad.image,
    });
  }
  return items;
}

export function useTenantPublicAds(slug: string | null): TenantPublicAd[] {
  const { occasionDetails, activeOccasion } = useOccasion();
  const [tenantAds, setTenantAds] = useState<TenantPublicAd[]>([]);

  useEffect(() => {
    if (!slug) {
      setTenantAds([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        setTenantAds(adsFromAppearance(data.appearance || null, slug));
      })
      .catch(() => {
        if (!cancelled) setTenantAds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return [];

  const occasionAd: TenantPublicAd | null =
    activeOccasion !== "none"
      ? {
          id: `occasion-${activeOccasion}`,
          title: occasionDetails.slogan,
          subtitle: occasionDetails.discountText,
          href: isolateTenantHref(`/book?tenant=${slug}`, slug),
          ctaLabel: "الاستفادة من العرض والتسجيل الآن",
          couponCode: occasionDetails.couponCode,
          image: "",
        }
      : null;

  const merged = occasionAd ? [occasionAd, ...tenantAds] : tenantAds;
  const seen = new Set<string>();
  return merged.filter((ad) => {
    const key = `${ad.title}|${ad.couponCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const AdsShowcaseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  ads: TenantPublicAd[];
}> = ({ open, onClose, ads }) => {
  const { copyCoupon, occasionDetails } = useOccasion();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open || ads.length === 0) return null;

  const current = ads[Math.min(index, ads.length - 1)] || ads[0];
  const coupon = current.couponCode || occasionDetails.couponCode;

  const handleCopy = () => {
    if (!coupon) return;
    copyCoupon(coupon);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 text-right font-sans">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
              <p className="text-xs text-slate-400">عروض هذه المنشأة فقط — دون خلط عملاء آخرين</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {ads.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto p-3 bg-slate-950/60 border-b border-slate-800 no-scrollbar">
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 max-w-[14rem] truncate ${
                  index === i
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {ad.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {current.image ? (
            <img src={current.image} alt={current.title} className="w-full h-40 object-cover rounded-2xl" />
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300">
              <Star className="w-3.5 h-3.5" />
              <span>عرض ترويجي حصري ✨</span>
            </div>
            <h3 className="text-xl font-black text-white">{current.title}</h3>
            {current.subtitle ? <p className="text-sm text-slate-300 leading-relaxed">{current.subtitle}</p> : null}
          </div>

          {coupon ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-slate-400 truncate">كوبون خصم: {current.subtitle || occasionDetails.discountText}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 text-amber-300 text-xs font-black"
              >
                <code className="font-mono">{coupon}</code>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : null}

          <a
            href={current.href}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
          >
            <span>{current.ctaLabel}</span>
            <ArrowLeft className="w-4 h-4" />
          </a>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">عروض هذه المنشأة على منصة مكّن</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
