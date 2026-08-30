"use client";

import { Moon, Sun } from "lucide-react";
import { useColorScheme } from "@/context/ColorSchemeContext";

export function ColorSchemeToggle({ className = "" }: { className?: string }) {
  const { scheme, darkEnabled, toggleScheme } = useColorScheme();

  if (!darkEnabled) return null;

  const dark = scheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleScheme}
      className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 font-bold text-xs transition-colors ${className}`}
      aria-label={dark ? "تفعيل الثيم الفاتح" : "تفعيل الثيم الداكن"}
      title={dark ? "الثيم الفاتح" : "الثيم الداكن"}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span>{dark ? "فاتح" : "داكن"}</span>
    </button>
  );
}
