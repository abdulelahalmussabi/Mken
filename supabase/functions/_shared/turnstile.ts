import { turnstileSecret } from "./env.ts";

export async function verifyTurnstile(
  token: string,
  remoteIp: string,
): Promise<{ ok: boolean; errorCodes: string[] }> {
  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, errorCodes: ["missing-input-response"] };
  }

  // Fail-closed in production: missing secret = reject
  let secret: string;
  try {
    secret = turnstileSecret();
  } catch {
    return { ok: false, errorCodes: ["missing-turnstile-secret"] };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp && remoteIp !== "0.0.0.0") form.set("remoteip", remoteIp);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );

  const data = await res.json() as {
    success?: boolean;
    "error-codes"?: string[];
  };

  return {
    ok: data.success === true,
    errorCodes: data["error-codes"] ?? [],
  };
}
