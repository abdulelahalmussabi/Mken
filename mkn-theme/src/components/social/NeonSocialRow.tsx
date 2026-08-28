"use client";

import React from "react";
import NeonSocialButton, {
  SocialPlatform,
  NeonSocialGlyph,
} from "./NeonSocialIcons";
import type { SocialLinks } from "@/types/database";
import { Sparkles, Share2 } from "lucide-react";

interface NeonSocialRowProps {
  socialLinks?: SocialLinks;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "center" | "right" | "left" | "between";
  showContainer?: boolean;
  className?: string;
}

export default function NeonSocialRow({
  socialLinks,
  title,
  subtitle,
  size = "md",
  align = "center",
  showContainer = false,
  className = "",
}: NeonSocialRowProps) {
  // If no links provided or empty object
  if (!socialLinks) {
    return null;
  }

  // Active items list
  const activeItems: { platform: SocialPlatform; url?: string; title: string }[] = [];

  if (socialLinks.twitter) {
    activeItems.push({
      platform: "twitter",
      url: socialLinks.twitter,
      title: "╪ص╪│╪د╪ذ ┘à┘╪╡╪ر ≡إـ ╪د┘╪▒╪│┘à┘è╪ر",
    });
  }

  if (socialLinks.tiktok) {
    activeItems.push({
      platform: "tiktok",
      url: socialLinks.tiktok,
      title: "╪ص╪│╪د╪ذ ╪ز┘è┘â ╪ز┘ê┘â TikTok",
    });
  }

  if (socialLinks.instagram) {
    activeItems.push({
      platform: "instagram",
      url: socialLinks.instagram,
      title: "╪ص╪│╪د╪ذ ╪ح┘╪│╪ز╪║╪▒╪د┘à Instagram",
    });
  }

  if (socialLinks.snapchat) {
    activeItems.push({
      platform: "snapchat",
      url: socialLinks.snapchat,
      title: "╪ص╪│╪د╪ذ ╪│┘╪د╪ذ ╪┤╪د╪ز Snapchat",
    });
  }

  if (socialLinks.whatsapp) {
    activeItems.push({
      platform: "whatsapp",
      url: socialLinks.whatsapp,
      title: "┘à╪ص╪د╪»╪س╪ر ┘ê╪د╪ز╪│╪د╪ذ ┘à╪ذ╪د╪┤╪▒╪ر",
    });
  }

  if (socialLinks.youtube) {
    activeItems.push({
      platform: "youtube",
      url: socialLinks.youtube,
      title: "┘é┘╪د╪ر ┘è┘ê╪ز┘è┘ê╪ذ ╪د┘╪▒╪│┘à┘è╪ر",
    });
  }

  if (socialLinks.facebook) {
    activeItems.push({
      platform: "facebook",
      url: socialLinks.facebook,
      title: "╪╡┘╪ص╪ر ┘┘è╪│╪ذ┘ê┘â Facebook",
    });
  }

  if (socialLinks.linkedin) {
    activeItems.push({
      platform: "linkedin",
      url: socialLinks.linkedin,
      title: "╪╡┘╪ص╪ر ┘┘è┘┘â╪» ╪ح┘ LinkedIn",
    });
  }

  // If no social links enabled/configured, do not render empty container
  if (activeItems.length === 0) {
    return null;
  }

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
          {subtitle && (
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          )}
        </div>
      )}

      {/* Neon Icons Row */}
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
        {/* Subtle Decorative Ambient Neon Glow on Top */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        {content}
      </div>
    );
  }

  return content;
}
