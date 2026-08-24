/** Authentica.sa OTP client — https://api.authentica.sa/api/v2 */

import { authenticaApiKey } from "./env.ts";

const BASE = "https://api.authentica.sa/api/v2";

export type AuthenticaMethod = "whatsapp" | "sms" | "email";

export interface SendOtpInput {
  method: AuthenticaMethod;
  phone?: string;
  email?: string;
  templateId?: number;
  fallbackEmail?: string;
}

export interface AuthenticaSendResult {
  ok: boolean;
  status: number;
  message: string;
  raw: unknown;
}

export interface AuthenticaVerifyResult {
  ok: boolean;
  status: number;
  message: string;
  raw: unknown;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Authorization": authenticaApiKey(),
  };
}

export async function authenticaSendOtp(input: SendOtpInput): Promise<AuthenticaSendResult> {
  const body: Record<string, unknown> = {
    method: input.method,
    template_id: input.templateId ?? Number(Deno.env.get("AUTHENTICA_TEMPLATE_ID") ?? "1"),
  };
  if (input.method === "email") {
    if (!input.email) throw new Error("email_required");
    body.email = input.email;
  } else {
    if (!input.phone) throw new Error("phone_required");
    body.phone = input.phone;
  }
  if (input.fallbackEmail) body.fallback_email = input.fallbackEmail;

  const res = await fetch(`${BASE}/send-otp`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  let raw: unknown = null;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }

  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const success = res.ok && obj.success !== false;
  const message = typeof obj.message === "string"
    ? obj.message
    : success
    ? "OTP sent"
    : "OTP send failed";

  return { ok: success, status: res.status, message, raw };
}

export async function authenticaVerifyOtp(input: {
  phone?: string;
  email?: string;
  otp: string;
}): Promise<AuthenticaVerifyResult> {
  const body: Record<string, unknown> = { otp: input.otp };
  if (input.phone) body.phone = input.phone;
  if (input.email) body.email = input.email;

  const res = await fetch(`${BASE}/verify-otp`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  let raw: unknown = null;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }

  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  // Docs: { status: true, message: "OTP verified successfully" }
  const ok = res.ok && (obj.status === true || obj.success === true);
  const message = typeof obj.message === "string"
    ? obj.message
    : ok
    ? "OTP verified"
    : "OTP verification failed";

  return { ok, status: res.status, message, raw };
}
