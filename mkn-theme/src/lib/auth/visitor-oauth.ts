import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import { boundTenantFromHostname } from "@/lib/mken/tenant-host";
import { supabase } from "@/lib/supabase/client";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

export type VisitorOAuthProvider = "google" | "apple";

const LEGACY_MOCK_ID = "usr-sa-101";

export function isLegacyMockVisitor(user: { id?: string } | null | undefined): boolean {
  return user?.id === LEGACY_MOCK_ID;
}

export function profileFromAuthUser(user: User): Profile {
  const meta = user.user_metadata || {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.given_name === "string" && meta.given_name.trim()) ||
    (user.email ? user.email.split("@")[0] : "زائر");
  const phone =
    (typeof meta.phone === "string" && meta.phone.trim()) ||
    (typeof meta.phone_number === "string" && meta.phone_number.trim()) ||
    user.phone ||
    "";
  const provider =
    (typeof user.app_metadata?.provider === "string" && user.app_metadata.provider) || "oauth";
  return {
    id: user.id,
    full_name: fullName,
    phone: phone || undefined,
    email: user.email || undefined,
    provider,
    created_at: user.created_at,
  };
}

export function visitorSafeNext(raw: string | null | undefined): string {
  const next = (raw || "").trim() || "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  if (next.startsWith("/admin") || next.startsWith("/staff") || next.startsWith("/api")) return "/";
  return next;
}

export function defaultVisitorNext(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = visitorSafeNext(params.get("next"));
  if (params.get("next")) return fromQuery;
  const bound = boundTenantFromHostname(window.location.hostname);
  if (bound) return "/";
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/register")) {
    return "/dashboard";
  }
  return `${path}${window.location.search}` || "/";
}

function arabicOAuthError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "مزود الدخول غير مفعّل. فعّل Google و Apple من Supabase → Authentication → Providers.";
  }
  if (m.includes("redirect")) {
    return "رابط العودة غير مسموح. أضف https://{نطاق}/auth/callback إلى Redirect URLs في Supabase.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "تعذّر الاتصال بخادم المصادقة. تحقق من NEXT_PUBLIC_SUPABASE_URL.";
  }
  return message || "تعذّر بدء تسجيل الدخول";
}

export async function startVisitorOAuth(
  provider: VisitorOAuthProvider,
  nextPath?: string
): Promise<{ url?: string; error?: string }> {
  const env = publicSupabaseEnv();
  if (!env || env.url.includes("mock-project-id")) {
    return { error: "تسجيل الدخول عبر جوجل وآبل غير مُعدّ على هذا الخادم." };
  }

  const next = visitorSafeNext(nextPath || defaultVisitorNext());
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
    },
  });
  if (error) return { error: arabicOAuthError(error.message) };
  return { url: data.url };
}
