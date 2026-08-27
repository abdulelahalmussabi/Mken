"use client";

import React, { useState, useEffect } from "react";
import { Zap, Users, DollarSign, MousePointerClick, Copy, Check, ExternalLink, Gift } from "lucide-react";
import type { AffiliateAccount } from "@/lib/mken/affiliate";

export default function AffiliateCard({ tenantSlug }: { tenantSlug: string }) {
  const [affiliate, setAffiliate] = useState<AffiliateAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadAffiliate() {
      try {
        const res = await fetch(`/api/affiliates?tenant_slug=${encodeURIComponent(tenantSlug)}`);
        const data = await res.json();
        if (data.success && data.affiliate) {
          setAffiliate(data.affiliate);
        }
      } catch {}
      setLoading(false);
    }
    loadAffiliate();
  }, [tenantSlug]);

  const copyLink = () => {
    if (affiliate?.referralUrl) {
      navigator.clipboard.writeText(affiliate.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse text-xs text-slate-500 text-center">
        جاري تحميل برنامج الشركاء والإحالات...
      </div>
    );
  }

  const referralUrl = affiliate?.referralUrl || `https://mken.live?ref=${tenantSlug}`;

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-amber-500/20 shadow-2xl space-y-6 text-right relative overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Gift className="w-5 h-5" />
            </span>
            <h3 className="text-base font-black text-white">برنامج شركاء مكّن (Viral Affiliate Loop)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            شارك رابط بوابتك أو منصة مكّن واربح <strong>عمولة 20%</strong> على كل اشتراك جديد يأتي من خلالك مدى الحياة!
          </p>
        </div>

        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
          عمولة الشريك: 20%
        </span>
      </div>

      {/* Referral Link Box */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 block">رابط الإحالة الخاص بك (Referral Link):</label>
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2 pl-3">
          <input
            type="text"
            readOnly
            dir="ltr"
            value={referralUrl}
            className="flex-1 bg-transparent text-xs font-mono text-amber-300 outline-none select-all"
          />
          <button
            type="button"
            onClick={copyLink}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950" />
                <span>تم النسخ!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرابط</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>النقرات</span>
            <MousePointerClick className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-lg font-black text-white font-mono">{affiliate?.totalClicks || 0}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>المشتركين الجدد</span>
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-lg font-black text-white font-mono">{affiliate?.totalSignups || 0}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>إجمالي الأرباح</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-400 font-mono">{affiliate?.totalEarnings || 0} ر.س</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>الرصيد المتاح</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-black text-amber-400 font-mono">{affiliate?.pendingPayout || 0} ر.س</p>
        </div>
      </div>
    </div>
  );
}
