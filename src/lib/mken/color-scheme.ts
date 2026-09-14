export const COLOR_SCHEME_KEY = "mken-color-scheme";

export type ColorScheme = "light" | "dark";

export function isColorScheme(value: unknown): value is ColorScheme {
  return value === "light" || value === "dark";
}

export function readStoredColorScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(COLOR_SCHEME_KEY);
    return isColorScheme(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function applyColorScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-scheme", scheme);
  root.style.colorScheme = scheme;
}

export function persistColorScheme(scheme: ColorScheme) {
  applyColorScheme(scheme);
  try {
    window.localStorage.setItem(COLOR_SCHEME_KEY, scheme);
  } catch {
    /* private mode */
  }
}
