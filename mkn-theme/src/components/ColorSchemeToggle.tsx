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
      className={`inline-flex items-center justify-center p-2 rounded-xl border border-line bg-surface text-foreground hover:bg-surface-2 transition-colors ${className}`}
      aria-label={dark ? "تفعيل الثيم الفاتح" : "تفعيل الثيم الداكن"}
      title={dark ? "الثيم الفاتح" : "الثيم الداكن"}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
