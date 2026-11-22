"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, animate, useInView } from "framer-motion";

const ONEPLUS_EASE = [0.16, 1, 0.3, 1] as const;

export interface ParsedMetric {
  isNumeric: boolean;
  prefix: string;
  targetNumber: number;
  decimals: number;
  suffix: string;
  textValue: string;
}

/**
 * Dynamically parse any customer metric string or number.
 * Handles:
 * - "10" -> 10
 * - "4.9" -> 4.9 (1 decimal)
 * - "+350%" -> prefix "+", 350, suffix "%"
 * - "24/7" -> 24, suffix "/7"
 * - "4.9 / 5" -> 4.9, suffix " / 5"
 * - "المدينة المنورة" -> text-only
 */
export function parseMetricValue(raw: string | number): ParsedMetric {
  const str = String(raw ?? "").trim();
  const cleaned = str.replace(/,/g, "");

  // Match: (non-digits)(digits with optional decimal)(trailing characters)
  const match = cleaned.match(/^([^\d.]*?)([\d]+(?:\.[\d]+)?)(.*)$/);

  if (!match) {
    return {
      isNumeric: false,
      prefix: "",
      targetNumber: 0,
      decimals: 0,
      suffix: "",
      textValue: str,
    };
  }

  const [, prefix, numStr, suffix] = match;
  const targetNumber = parseFloat(numStr);

  if (isNaN(targetNumber)) {
    return {
      isNumeric: false,
      prefix: "",
      targetNumber: 0,
      decimals: 0,
      suffix: "",
      textValue: str,
    };
  }

  const dotIndex = numStr.indexOf(".");
  const decimals = dotIndex !== -1 ? numStr.length - dotIndex - 1 : 0;

  return {
    isNumeric: true,
    prefix: prefix.trim(),
    targetNumber,
    decimals,
    suffix,
    textValue: str,
  };
}

export interface AnimatedStatValueProps {
  value: string | number;
  duration?: number;
  className?: string;
  onComplete?: () => void;
}

/**
 * Smart Count-Up & Reveal component for all tenant metrics.
 * Numbers count up from 0 over 1.6s with cubic-bezier(0.16, 1, 0.3, 1).
 * Text metrics animate with a crisp upward fade-in.
 */
export function AnimatedStatValue({
  value,
  duration = 1.6,
  className = "",
  onComplete,
}: AnimatedStatValueProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [isMounted, setIsMounted] = useState(false);
  const [displayVal, setDisplayVal] = useState<number>(0);
  const parsed = parseMetricValue(value);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!inView || !parsed.isNumeric) return;

    const controls = animate(0, parsed.targetNumber, {
      duration,
      ease: ONEPLUS_EASE,
      onUpdate: (latest) => {
        setDisplayVal(latest);
      },
      onComplete: () => {
        setDisplayVal(parsed.targetNumber);
        onComplete?.();
      },
    });

    return () => controls.stop();
  }, [inView, parsed.isNumeric, parsed.targetNumber, duration, onComplete]);

  // If text-only (e.g. "المدينة المنورة")
  if (!parsed.isNumeric) {
    return (
      <motion.span
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.6, ease: ONEPLUS_EASE }}
        className={`inline-block ${className}`}
      >
        {parsed.textValue}
      </motion.span>
    );
  }

  // Pure Number or Number with Prefix/Suffix
  const formattedNumber =
    isMounted && inView
      ? parsed.decimals > 0
        ? displayVal.toFixed(parsed.decimals)
        : Math.round(displayVal)
      : parsed.decimals > 0
        ? parsed.targetNumber.toFixed(parsed.decimals)
        : parsed.targetNumber;

  return (
    <span
      ref={ref}
      className={`tabular-nums inline-flex items-center justify-center font-display ${className}`}
      suppressHydrationWarning
    >
      {parsed.prefix ? <span className="mr-0.5">{parsed.prefix}</span> : null}
      <span>{formattedNumber}</span>
      {parsed.suffix ? <span className="ml-0.5">{parsed.suffix}</span> : null}
    </span>
  );
}

export interface TenantStatItem {
  value: string;
  label: string;
}

export interface TenantStatCardProps {
  item: TenantStatItem;
  accentColor: string;
}

export function TenantStatCard({ item, accentColor }: TenantStatCardProps) {
  const [glowPulse, setGlowPulse] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 28 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.7,
            ease: ONEPLUS_EASE,
          },
        },
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }}
      className={`relative p-6 sm:p-7 rounded-3xl bg-white/90 dark:bg-[#141417]/85 backdrop-blur-2xl border-t border-emerald-400/35 border-x border-b border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] text-center spotlight-card overflow-hidden transition-all duration-700 ${
        glowPulse
          ? "shadow-[inset_0_2px_0_0_rgba(255,255,255,1),0_0_25px_rgba(16,185,129,0.22)] dark:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.4),0_0_30px_rgba(16,185,129,0.3)]"
          : ""
      }`}
      style={{
        borderTopColor: `${accentColor}55`,
        "--spotlight-color": `${accentColor}18`,
      } as React.CSSProperties}
    >
      {/* Specular Top Glow Pulse sweep when counter finishes */}
      {glowPulse && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 1, 0], scaleX: [0.2, 1, 0.8] }}
          transition={{ duration: 0.9, ease: ONEPLUS_EASE }}
          className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white dark:via-emerald-300 to-transparent pointer-events-none z-10"
        />
      )}

      <div className="relative z-10 space-y-1">
        <div className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          <AnimatedStatValue
            value={item.value}
            onComplete={() => setGlowPulse(true)}
          />
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-medium">
          {item.label}
        </p>
      </div>
    </motion.div>
  );
}

export interface TenantStatsStripProps {
  stats: TenantStatItem[];
  accentColor?: string;
  className?: string;
}

export function TenantStatsStrip({
  stats,
  accentColor = "#10B981",
  className = "",
}: TenantStatsStripProps) {
  if (!stats || stats.length === 0) return null;

  // Adapt grid layout dynamically: 3 cards look flagship in 3-column split
  const gridClass =
    stats.length === 3
      ? "grid grid-cols-1 sm:grid-cols-3 gap-6"
      : stats.length === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
        : "grid grid-cols-2 md:grid-cols-4 gap-4";

  return (
    <section className={`py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.15,
              delayChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className={gridClass}
      >
        {stats.map((item, idx) => (
          <TenantStatCard
            key={`${item.label}-${idx}`}
            item={item}
            accentColor={accentColor}
          />
        ))}
      </motion.div>
    </section>
  );
}
