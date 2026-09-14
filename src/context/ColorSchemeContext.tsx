"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyColorScheme,
  persistColorScheme,
  readStoredColorScheme,
  type ColorScheme,
} from "@/lib/mken/color-scheme";

interface ColorSchemeContextValue {
  scheme: ColorScheme;
  darkEnabled: boolean;
  setDarkEnabled: (allowed: boolean) => void;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");
  const [darkEnabled, setDarkEnabledState] = useState(true);

  useEffect(() => {
    const stored = readStoredColorScheme();
    setSchemeState(stored);
    applyColorScheme(stored);
  }, []);

  const setScheme = useCallback(
    (next: ColorScheme) => {
      const resolved = !darkEnabled && next === "dark" ? "light" : next;
      setSchemeState(resolved);
      persistColorScheme(resolved);
    },
    [darkEnabled]
  );

  const setDarkEnabled = useCallback((allowed: boolean) => {
    setDarkEnabledState(allowed);
    if (!allowed) {
      setSchemeState("light");
      applyColorScheme("light");
      return;
    }
    const stored = readStoredColorScheme();
    setSchemeState(stored);
    applyColorScheme(stored);
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme(scheme === "dark" ? "light" : "dark");
  }, [scheme, setScheme]);

  const value = useMemo(
    () => ({ scheme, darkEnabled, setDarkEnabled, setScheme, toggleScheme }),
    [scheme, darkEnabled, setDarkEnabled, setScheme, toggleScheme]
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error("useColorScheme must be used within ColorSchemeProvider");
  return ctx;
}
