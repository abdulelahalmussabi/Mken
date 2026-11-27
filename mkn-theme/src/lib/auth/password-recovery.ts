import { supabase } from "@/lib/supabase/client";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

export type RecoveryLoginTarget = "/login" | "/admin/login";

export const RECOVERY_TARGET_STORAGE_KEY = "mkn_pw_reset_target";

export type RecoveryUrlState = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  hasHashToken: boolean;
  error: string | null;
};

const inFlightCodeExchanges = new Map<string, Promise<{ ready: boolean; error?: string }>>();

/** Keep post-reset navigation constrained to known login routes. */
export function resolveRecoveryLoginTarget(raw: string | null | undefined): RecoveryLoginTarget {
  const value = (raw || "").trim().toLowerCase();
  if (value === "admin" || value === "/admin/login") return "/admin/login";
  return "/login";
}

/**
 * Build a clean base `/reset-password` redirect URL without query parameters so
 * exact-match Supabase Redirect URL entries validate consistently across hosts.
 */
export function buildPasswordResetRedirectUrl(origin: string): string {
  const cleanOrigin = (origin || "").trim().replace(/\/+$/, "");
  return `${cleanOrigin}/reset-password`;
}

/** Map raw Supabase recovery errors into clear Arabic messages. */
export function mapRecoveryErrorMessage(
  rawMessage: string | null | undefined,
  phase: "request" | "verify" | "update"
): string {
  const msg = (rawMessage || "").toLowerCase();

  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "تعذّر الاتصال بخادم المصادقة. تحقق من الاتصال ثم حاول مرة أخرى.";
  }
  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes") ||
    msg.includes("over_email_send_rate_limit")
  ) {
    return "تم إرسال عدة طلبات مؤخراً، يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.";
  }
  if (msg.includes("redirect") && msg.includes("not allowed")) {
    return "رابط الاستعادة غير مسموح به حالياً في إعدادات Redirect URLs في Supabase.";
  }
  if (msg.includes("same_password") || msg.includes("different from the old password")) {
    return "يجب أن تكون كلمة المرور الجديدة مختلفة عن كلمة المرور الحالية.";
  }
  if (msg.includes("weak_password") || msg.includes("password should be") || msg.includes("at least")) {
    return "كلمة المرور ضعيفة جداً؛ استخدم 8 خانات على الأقل تحتوي حروفاً وأرقاماً.";
  }
  if (
    phase === "verify" ||
    msg.includes("expired") ||
    msg.includes("otp_expired") ||
    msg.includes("invalid") ||
    msg.includes("session missing")
  ) {
    return "رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.";
  }
  if (phase === "request") {
    return "تعذّر إرسال رابط استعادة كلمة المرور. يرجى المحاولة لاحقاً.";
  }
  return "تعذّر تحديث كلمة المرور. يرجى طلب رابط جديد والمحاولة مرة أخرى.";
}

/** Extract PKCE code, OTP token_hash, implicit hash state, or errors from the landing URL. */
export function extractRecoveryUrlState(search: string, hash: string): RecoveryUrlState {
  const queryParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const error =
    queryParams.get("error_description") ||
    queryParams.get("error") ||
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    null;

  const code = queryParams.get("code")?.trim() || null;
  const tokenHash = queryParams.get("token_hash")?.trim() || null;
  const type = (queryParams.get("type") || hashParams.get("type") || "").trim().toLowerCase() || null;
  const hasHashToken = Boolean(hashParams.get("access_token"));

  return { code, tokenHash, type, hasHashToken, error };
}

/** Send a real Supabase password recovery email without enumerating accounts. */
export async function requestPasswordReset(
  email: string,
  origin: string
): Promise<{ ok: boolean; error?: string }> {
  const env = publicSupabaseEnv();
  if (!env || env.url.includes("mock-project-id")) {
    return { ok: false, error: "خدمة استعادة كلمة المرور غير مُعدّة على هذا الخادم." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "يرجى إدخال بريد إلكتروني صحيح." };
  }

  const redirectTo = buildPasswordResetRedirectUrl(origin);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (error) {
    const lower = error.message.toLowerCase();
    // Avoid disclosing whether an email exists unless a transport/rate-limit error occurred.
    if (!lower.includes("user not found")) {
      return { ok: false, error: mapRecoveryErrorMessage(error.message, "request") };
    }
  }

  return { ok: true };
}

/**
 * Exchange recovery credentials (`?code=`, `?token_hash=`, or implicit URL hash) into an active
 * Supabase session so `updateUser({ password })` can succeed. Deduplicates concurrent strict-mode calls.
 */
export async function completeRecoverySessionFromUrl(
  search: string,
  hash: string
): Promise<{ ready: boolean; pendingHash?: boolean; error?: string }> {
  const env = publicSupabaseEnv();
  if (!env || env.url.includes("mock-project-id")) {
    return { ready: false, error: "خدمة المصادقة غير مُعدّة على هذا الخادم." };
  }

  const state = extractRecoveryUrlState(search, hash);
  if (state.error) {
    return { ready: false, error: mapRecoveryErrorMessage(state.error, "verify") };
  }

  const { data: initialSession } = await supabase.auth.getSession();
  if (initialSession.session) {
    return { ready: true };
  }

  if (state.code) {
    const existing = inFlightCodeExchanges.get(state.code);
    if (existing) return existing;

    const exchangeTask = (async (): Promise<{ ready: boolean; error?: string }> => {
      const { error } = await supabase.auth.exchangeCodeForSession(state.code as string);
      if (error) {
        const { data: retrySession } = await supabase.auth.getSession();
        if (retrySession.session) return { ready: true };
        return { ready: false, error: mapRecoveryErrorMessage(error.message, "verify") };
      }
      return { ready: true };
    })();

    inFlightCodeExchanges.set(state.code, exchangeTask);
    try {
      return await exchangeTask;
    } finally {
      inFlightCodeExchanges.delete(state.code);
    }
  }

  if (state.tokenHash && state.type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: state.tokenHash,
      type: "recovery",
    });
    if (error) {
      return { ready: false, error: mapRecoveryErrorMessage(error.message, "verify") };
    }
    return { ready: true };
  }

  if (state.hasHashToken) {
    return { ready: false, pendingHash: true };
  }

  return {
    ready: false,
    error: "رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.",
  };
}

/** Update password for the active recovery session and clear transient local browser state. */
export async function updateRecoveredPassword(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: mapRecoveryErrorMessage(error.message, "update") };
  }
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { ok: true };
}
