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
      className={`inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors ${className}`}
      aria-label={dark ? "تفعيل الثيم الفاتح" : "تفعيل الثيم الداكن"}
      title={dark ? "الثيم الفاتح" : "الثيم الداكن"}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
