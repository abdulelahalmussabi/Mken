"use client";

import React from "react";
import NeonSocialButton, { type SocialPlatform } from "./NeonSocialIcons";
import type { SocialLinks } from "@/types/database";
import { Sparkles } from "lucide-react";

interface NeonSocialRowProps {
  socialLinks?: SocialLinks;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "center" | "right" | "left" | "between";
  showContainer?: boolean;
  excludeWhatsapp?: boolean;
  className?: string;
}

const PLATFORM_TITLES: { key: keyof SocialLinks; platform: SocialPlatform; title: string }[] = [
  { key: "instagram", platform: "instagram", title: "حساب إنستغرام" },
  { key: "tiktok", platform: "tiktok", title: "حساب تيك توك" },
  { key: "snapchat", platform: "snapchat", title: "حساب سناب شات" },
  { key: "twitter", platform: "twitter", title: "حساب إكس (تويتر)" },
  { key: "x", platform: "twitter", title: "حساب إكس (تويتر)" },
  { key: "whatsapp", platform: "whatsapp", title: "محادثة واتساب مباشرة" },
  { key: "youtube", platform: "youtube", title: "قناة يوتيوب الرسمية" },
  { key: "facebook", platform: "facebook", title: "صفحة فيسبوك" },
  { key: "linkedin", platform: "linkedin", title: "صفحة لينكد إن" },
  { key: "telegram", platform: "telegram", title: "قناة تيليجرام" },
  { key: "pinterest", platform: "pinterest", title: "حساب بينتريست" },
  { key: "website", platform: "website", title: "الموقع الإلكتروني" },
  { key: "phone", platform: "phone", title: "اتصال هاتفي" },
  { key: "map", platform: "maps", title: "خرائط جوجل" },
];

export default function NeonSocialRow({
  socialLinks,
  title,
  subtitle,
  size = "md",
  align = "center",
  showContainer = false,
  excludeWhatsapp = true,
  className = "",
}: NeonSocialRowProps) {
  if (!socialLinks) return null;

  const seen = new Set<SocialPlatform>();
  const activeItems: { platform: SocialPlatform; url: string; title: string }[] = [];

  for (const item of PLATFORM_TITLES) {
    if (excludeWhatsapp && item.platform === "whatsapp") continue;
    const url = socialLinks[item.key];
    if (!url || seen.has(item.platform)) continue;
    seen.add(item.platform);
    activeItems.push({ platform: item.platform, url, title: item.title });
  }

  if (activeItems.length === 0) return null;

  const alignmentClasses = {
    center: "justify-center text-center",
    right: "justify-start text-right",
    left: "justify-end text-left",
    between: "justify-between text-right",
  }[align];

  const content = (
    <div className={`space-y-3 ${className}`}>
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && (
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-100 flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{title}</span>
            </h4>
          )}
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-3 sm:gap-4 ${alignmentClasses}`}>
        {activeItems.map((item) => (
          <NeonSocialButton
            key={item.platform}
            platform={item.platform}
            url={item.url}
            size={size}
            title={item.title}
          />
        ))}
      </div>
    </div>
  );

  if (showContainer) {
    return (
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-950/80 border border-slate-800/80 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        {content}
      </div>
    );
  }

  return content;
}
