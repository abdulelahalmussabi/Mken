"use client";

import React from "react";

export type SocialPlatform =
  | "twitter"
  | "tiktok"
  | "instagram"
  | "snapchat"
  | "whatsapp"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "pinterest"
  | "telegram"
  | "maps"
  | "phone"
  | "website";

interface NeonIconProps {
  platform: SocialPlatform;
  size?: number; // size in px
  className?: string;
}

// ظ¤ظ¤ظ¤ SVG Vector Paths & Colors for Neon Styling ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤
const PLATFORM_CONFIG: Record<
  SocialPlatform,
  {
    nameAr: string;
    neonColor: string;
    glowColor: string;
    secondaryNeon?: string;
    bgTint: string;
    borderGlow: string;
  }
> = {
  twitter: {
    nameAr: "إكس (تويتر)",
    neonColor: "#38bdf8",
    glowColor: "rgba(56, 189, 248, 0.75)",
    bgTint: "rgba(14, 165, 233, 0.08)",
    borderGlow: "rgba(56, 189, 248, 0.4)",
  },
  tiktok: {
    nameAr: "تيك توك",
    neonColor: "#00f2fe",
    secondaryNeon: "#fe0979",
    glowColor: "rgba(0, 242, 254, 0.7)",
    bgTint: "rgba(0, 242, 254, 0.08)",
    borderGlow: "rgba(254, 9, 121, 0.45)",
  },
  instagram: {
    nameAr: "إنستغرام",
    neonColor: "#f43f5e",
    secondaryNeon: "#fbbf24",
    glowColor: "rgba(244, 63, 94, 0.75)",
    bgTint: "rgba(244, 63, 94, 0.08)",
    borderGlow: "rgba(236, 72, 153, 0.4)",
  },
  snapchat: {
    nameAr: "سناب شات",
    neonColor: "#facc15",
    glowColor: "rgba(250, 204, 21, 0.8)",
    bgTint: "rgba(250, 204, 21, 0.08)",
    borderGlow: "rgba(250, 204, 21, 0.45)",
  },
  whatsapp: {
    nameAr: "واتساب",
    neonColor: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.8)",
    bgTint: "rgba(34, 197, 94, 0.08)",
    borderGlow: "rgba(34, 197, 94, 0.45)",
  },
  youtube: {
    nameAr: "يوتيوب",
    neonColor: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.8)",
    bgTint: "rgba(239, 68, 68, 0.08)",
    borderGlow: "rgba(239, 68, 68, 0.45)",
  },
  facebook: {
    nameAr: "فيسبوك",
    neonColor: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.8)",
    bgTint: "rgba(59, 130, 246, 0.08)",
    borderGlow: "rgba(59, 130, 246, 0.45)",
  },
  linkedin: {
    nameAr: "لينكد إن",
    neonColor: "#0284c7",
    glowColor: "rgba(2, 132, 199, 0.8)",
    bgTint: "rgba(2, 132, 199, 0.08)",
    borderGlow: "rgba(2, 132, 199, 0.45)",
  },
  pinterest: {
    nameAr: "بينتريست",
    neonColor: "#e11d48",
    glowColor: "rgba(225, 29, 72, 0.8)",
    bgTint: "rgba(225, 29, 72, 0.08)",
    borderGlow: "rgba(225, 29, 72, 0.45)",
  },
  telegram: {
    nameAr: "تيليجرام",
    neonColor: "#0ea5e9",
    glowColor: "rgba(14, 165, 233, 0.8)",
    bgTint: "rgba(14, 165, 233, 0.08)",
    borderGlow: "rgba(14, 165, 233, 0.45)",
  },
  maps: {
    nameAr: "خرائط جوجل",
    neonColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.8)",
    bgTint: "rgba(16, 185, 129, 0.08)",
    borderGlow: "rgba(16, 185, 129, 0.45)",
  },
  phone: {
    nameAr: "اتصال هاتفي",
    neonColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.8)",
    bgTint: "rgba(245, 158, 11, 0.08)",
    borderGlow: "rgba(245, 158, 11, 0.45)",
  },
  website: {
    nameAr: "الموقع الإلكتروني",
    neonColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.8)",
    bgTint: "rgba(6, 182, 212, 0.08)",
    borderGlow: "rgba(6, 182, 212, 0.45)",
  },
};

export function NeonSocialGlyph({
  platform,
  size = 28,
}: {
  platform: SocialPlatform;
  size?: number;
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.twitter;
  const filterId = `neon-glow-${platform}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible transition-all duration-300"
      style={{
        filter: `drop-shadow(0 0 5px ${cfg.glowColor}) drop-shadow(0 0 12px ${cfg.glowColor})`,
      }}
    >
      <defs>
        {/* Instagram Gradient */}
        <linearGradient id="ig-neon-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffb703" />
          <stop offset="35%" stopColor="#ff007f" />
          <stop offset="70%" stopColor="#d0006f" />
          <stop offset="100%" stopColor="#7209b7" />
        </linearGradient>

        {/* TikTok Dual Cyan/Pink Filter */}
        <linearGradient id="tiktok-neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f2fe" />
          <stop offset="100%" stopColor="#fe0979" />
        </linearGradient>
      </defs>

      {/* ظ¤ظ¤ظ¤ PLATFORMS SVG NEON OUTLINES ظ¤ظ¤ظ¤ */}

      {/* 1. X (formerly Twitter) - Neon Modern ≡إـ + Bird Style */}
      {platform === "twitter" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Neon Rounded Boundary Glow */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          {/* Modern Official ≡إـ Neon Glyph */}
          <path
            d="M14 13L24.8 27.5L14 35H16.8L26.1 29.2L32.2 35H35L24.2 20.5L34.5 13H31.7L22.9 18.8L16.8 13H14Z"
            stroke="#e0f2fe"
            strokeWidth="2.4"
            fill="none"
          />
          <path
            d="M14.5 13.5L33.5 34.5"
            stroke="#38bdf8"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* 2. TikTok - Vibrant Cyan & Pink Neon Note */}
      {platform === "tiktok" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Rounded Box */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            stroke="url(#tiktok-neon-grad)"
            strokeWidth="2.5"
            strokeOpacity="0.5"
          />
          {/* Cyan Glow Layer */}
          <path
            d="M26 13V29.5C26 33.09 23.09 36 19.5 36C15.91 36 13 33.09 13 29.5C13 25.91 15.91 23 19.5 23C20.64 23 21.71 23.3 22.62 23.83"
            stroke="#00f2fe"
            strokeWidth="2.8"
            fill="none"
          />
          {/* Magenta / Pink Glow Layer Top Hook */}
          <path
            d="M26 13C27.5 17.5 31.5 20.5 36 21V25C32 25 28.5 23.5 26 21"
            stroke="#fe0979"
            strokeWidth="2.8"
            fill="none"
          />
          <circle cx="19.5" cy="29.5" r="3.5" stroke="#00f2fe" strokeWidth="2.2" fill="none" />
        </g>
      )}

      {/* 3. Instagram - Neon Multi-tone Glow */}
      {platform === "instagram" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Outer Rounded Square */}
          <rect
            x="7"
            y="7"
            width="34"
            height="34"
            rx="10"
            stroke="url(#ig-neon-grad)"
            strokeWidth="2.8"
            fill="none"
          />
          {/* Inner Camera Lens */}
          <circle
            cx="24"
            cy="24"
            r="8.5"
            stroke="url(#ig-neon-grad)"
            strokeWidth="2.8"
            fill="none"
          />
          {/* Camera Flash Dot */}
          <circle cx="33" cy="15" r="1.8" fill="#fbbf24" />
        </g>
      )}

      {/* 4. WhatsApp - Glowing Neon Green Speech Bubble & Phone */}
      {platform === "whatsapp" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Glowing Speech Bubble */}
          <path
            d="M24 6C14.06 6 6 14.06 6 24C6 27.5 7 30.76 8.73 33.52L6.5 41.5L14.77 39.34C17.43 40.97 20.6 42 24 42C33.94 42 42 33.94 42 24C42 14.06 33.94 6 24 6Z"
            stroke="#22c55e"
            strokeWidth="2.6"
            fill="none"
          />
          {/* Phone Receiver Inside */}
          <path
            d="M17.5 16.5C16.8 17.2 16.5 18.2 16.7 19.3C17.4 23.2 20.8 28.6 25.5 30.8C26.5 31.3 27.6 31.1 28.5 30.5L30.2 29.2C30.8 28.7 30.9 27.9 30.4 27.3L28.1 24.6C27.6 24.1 26.8 24 26.2 24.4L25 25.3C22.8 24.2 21.3 22.7 20.2 20.5L21.1 19.3C21.5 18.7 21.4 17.9 20.9 17.4L18.7 15.1C18.2 14.6 17.4 14.7 16.9 15.3L17.5 16.5Z"
            stroke="#86efac"
            strokeWidth="2.2"
            fill="none"
          />
        </g>
      )}

      {/* 5. Snapchat - Neon Yellow Ghost */}
      {platform === "snapchat" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            stroke="#facc15"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          <path
            d="M24 10C18.5 10 16 14.5 16 18C16 19.5 16.5 21 15 22C14 22.7 12 23 12 24.5C12 25.7 13.5 26.2 15.5 26.2C15.5 27.5 14.8 29.5 13 30.5C11.8 31.2 11.5 32.5 12.5 33.5C13.5 34.5 16.5 35 19 34C20.5 34.8 22.2 35.2 24 35.2C25.8 35.2 27.5 34.8 29 34C31.5 35 34.5 34.5 35.5 33.5C36.5 32.5 36.2 31.2 35 30.5C33.2 29.5 32.5 27.5 32.5 26.2C34.5 26.2 36 25.7 36 24.5C36 23 34 22.7 33 22C31.5 21 32 19.5 32 18C32 14.5 29.5 10 24 10Z"
            stroke="#fef08a"
            strokeWidth="2.6"
            fill="none"
          />
        </g>
      )}

      {/* 6. YouTube - Neon Red Play Screen */}
      {platform === "youtube" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          {/* Rounded TV / Screen Outline */}
          <rect
            x="6"
            y="11"
            width="36"
            height="26"
            rx="8"
            stroke="#ef4444"
            strokeWidth="2.8"
            fill="none"
          />
          {/* Glowing Play Triangle */}
          <path
            d="M21 19L30 24L21 29V19Z"
            stroke="#fca5a5"
            strokeWidth="2.4"
            fill="#ef4444"
            fillOpacity="0.2"
          />
        </g>
      )}

      {/* 7. Facebook - Electric Blue 'f' */}
      {platform === "facebook" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          <path
            d="M27 12H23C20.24 12 18 14.24 18 17V21H14V26H18V36H24V26H28L29 21H24V17C24 16.45 24.45 16 25 16H27V12Z"
            stroke="#93c5fd"
            strokeWidth="2.6"
            fill="none"
          />
        </g>
      )}

      {/* 8. LinkedIn - Neon Cobalt 'in' */}
      {platform === "linkedin" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect
            x="6"
            y="6"
            width="36"
            height="36"
            rx="9"
            stroke="#0284c7"
            strokeWidth="2.6"
            fill="none"
          />
          {/* 'i' */}
          <circle cx="15" cy="15" r="2" stroke="#7dd3fc" strokeWidth="2" fill="none" />
          <path d="M15 21V32" stroke="#7dd3fc" strokeWidth="2.6" />
          {/* 'n' */}
          <path
            d="M22 32V21H27V23C28 21.5 30 20.8 32 21C35 21.3 36 23.5 36 27V32"
            stroke="#38bdf8"
            strokeWidth="2.6"
            fill="none"
          />
        </g>
      )}

      {/* 9. Pinterest - Neon Ruby Red Circle & P */}
      {platform === "pinterest" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="24" r="18" stroke="#e11d48" strokeWidth="2.6" fill="none" />
          <path
            d="M20 34L23 21C21.8 19 23 15 25.5 16.5C28 18 25 24 27 26C29 27.5 32 24.5 31.5 21C31 16 25.5 13 20.5 15.5C16 17.8 15.5 24.5 18 27C18.5 27.5 18.5 28 18 29.5"
            stroke="#fda4af"
            strokeWidth="2.4"
            fill="none"
          />
        </g>
      )}

      {/* 10. Telegram - Neon Sky Blue Plane */}
      {platform === "telegram" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="24" r="18" stroke="#0ea5e9" strokeWidth="2.6" fill="none" />
          <path
            d="M34 14L11 23L19 26L30 18L21 28L20.5 34L25 30L30 33.5L34 14Z"
            stroke="#7dd3fc"
            strokeWidth="2.2"
            fill="none"
          />
        </g>
      )}

      {/* 11. Google Maps / Location */}
      {platform === "maps" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M24 7C16.8 7 11 12.8 11 20C11 29 24 41 24 41C24 41 37 29 37 20C37 12.8 31.2 7 24 7Z"
            stroke="#10b981"
            strokeWidth="2.6"
            fill="none"
          />
          <circle cx="24" cy="20" r="4.5" stroke="#a7f3d0" strokeWidth="2.4" fill="none" />
        </g>
      )}

      {/* 12. Phone Call */}
      {platform === "phone" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />
          <path
            d="M16 14C15.5 15 15.2 16.2 15.5 17.5C16.5 22.5 21.5 28.5 27.5 30.5C28.8 30.8 30 30.5 31 29.5L33 27.5C33.8 26.7 33.8 25.3 33 24.5L29.5 21C28.7 20.2 27.3 20.2 26.5 21L25 22.5C22 21 21 20 19.5 17L21 15.5C21.8 14.7 21.8 13.3 21 12.5L17.5 9C16.7 8.2 15.3 8.2 14.5 9L16 14Z"
            stroke="#fde68a"
            strokeWidth="2.4"
            fill="none"
          />
        </g>
      )}

      {/* 13. Website / Domain */}
      {platform === "website" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="24" r="18" stroke="#06b6d4" strokeWidth="2.6" fill="none" />
          <path
            d="M6 24H42M24 6C28.5 11.5 30.5 17.5 30.5 24C30.5 30.5 28.5 36.5 24 42C19.5 36.5 17.5 30.5 17.5 24C17.5 17.5 19.5 11.5 24 6Z"
            stroke="#67e8f9"
            strokeWidth="2.2"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}

export function NeonSocialButton({
  platform,
  url,
  size = "md",
  title,
}: {
  platform: SocialPlatform;
  url?: string;
  size?: "sm" | "md" | "lg" | "xl";
  title?: string;
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.twitter;
  const isUrlValid = Boolean(url && url.trim().length > 0);

  // Parse phone / whatsapp URLs if raw digits are provided
  let href = url || "#";
  if (platform === "whatsapp" && url && !url.startsWith("http")) {
    href = `https://wa.me/${url.replace(/[^\d]/g, "")}`;
  } else if (platform === "phone" && url && !url.startsWith("tel:")) {
    href = `tel:${url.replace(/[^\d+]/g, "")}`;
  }

  const dimensionStyles = {
    sm: "w-10 h-10 p-2",
    md: "w-12 h-12 p-2.5",
    lg: "w-14 h-14 p-3",
    xl: "w-16 h-16 p-3.5",
  }[size];

  const iconSizes = {
    sm: 24,
    md: 28,
    lg: 34,
    xl: 40,
  }[size];

  if (!isUrlValid) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || cfg.nameAr}
      className={`relative group inline-flex items-center justify-center rounded-2xl bg-[#070b14]/90 border transition-all duration-300 transform hover:-translate-y-1 hover:scale-110 shadow-lg ${dimensionStyles}`}
      style={{
        borderColor: cfg.borderGlow,
        backgroundColor: cfg.bgTint,
      }}
    >
      {/* Background Soft Glow Aura */}
      <span
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md pointer-events-none -z-10"
        style={{
          backgroundColor: cfg.glowColor,
        }}
      />

      {/* SVG Neon Icon */}
      <NeonSocialGlyph platform={platform} size={iconSizes} />

      {/* Tooltip */}
      <span className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none text-[10px] font-bold text-white bg-slate-950/95 px-2.5 py-1 rounded-md border border-slate-700 whitespace-nowrap z-30 shadow-xl">
        {title || cfg.nameAr}
      </span>
    </a>
  );
}

const WA = PLATFORM_CONFIG.whatsapp;

export function WhatsappMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden>
      <NeonSocialGlyph platform="whatsapp" size={size} />
    </span>
  );
}

export function WhatsappCta({
  href,
  label = "واتساب",
  size = "md",
  floating = false,
  compactOnMobile = false,
  className = "",
}: {
  href: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  floating?: boolean;
  compactOnMobile?: boolean;
  className?: string;
}) {
  const glyph = floating ? 32 : { sm: 18, md: 22, lg: 24 }[size];
  const pad = {
    sm: "px-3 py-2 text-xs rounded-xl gap-1.5",
    md: "px-5 py-3 text-sm rounded-2xl gap-2",
    lg: "px-5 py-4 text-sm rounded-2xl gap-2",
  }[size];

  if (floating) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="تواصل معنا عبر واتساب"
        className={`fixed bottom-5 left-5 z-50 w-14 h-14 rounded-2xl inline-flex items-center justify-center border shadow-2xl transition hover:-translate-y-0.5 hover:scale-105 ${className}`}
        style={{ borderColor: WA.borderGlow, backgroundColor: "rgba(6, 32, 20, 0.94)" }}
      >
        <WhatsappMark size={glyph} />
        <span className="sr-only">تواصل معنا عبر واتساب</span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center font-bold border shadow-md transition hover:-translate-y-0.5 ${pad} ${className}`}
      style={{
        borderColor: WA.borderGlow,
        backgroundColor: "rgba(6, 32, 20, 0.92)",
        color: "#86efac",
      }}
    >
      <WhatsappMark size={glyph} />
      {label ? <span className={compactOnMobile ? "hidden sm:inline" : undefined}>{label}</span> : null}
    </a>
  );
}

export default NeonSocialButton;
