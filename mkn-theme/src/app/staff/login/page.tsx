"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Fingerprint, LogIn, ArrowRight } from "lucide-react";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  return bufferToBase64(buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export default function StaffLoginPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyReady, setPasskeyReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenant = params.get("tenant") || params.get("client") || "";
    if (tenant) setTenantSlug(tenant.toLowerCase());
    setPasskeyReady(typeof window !== "undefined" && "credentials" in navigator);
    fetch("/api/staff/session", { signal: AbortSignal.timeout(8000) })
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.id) window.location.assign("/staff");
      })
      .catch(() => {});
  }, []);

  const afterLogin = (ok: boolean, message?: string) => {
    if (ok) {
      window.location.assign("/staff");
      return;
    }
    setError(message || "تعذّر تسجيل الدخول");
    setLoading(false);
  };

  const handlePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "pin", tenantSlug, phone, pin }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      afterLogin(res.ok && data.success, data.message);
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      afterLogin(false, timedOut ? "انتهت مهلة الاتصال بالخادم، حاول مرة أخرى" : "تعذّر الاتصال بالخادم");
    }
  };

  const handlePasskey = async () => {
    if (!tenantSlug.trim() || !phone.trim()) {
      setError("أدخل معرف المنشأة والجوال أولاً");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const challengeRes = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "passkey-challenge", tenantSlug, phone }),
      });
      const options = await challengeRes.json();
      if (!challengeRes.ok || !options.success) {
        afterLogin(false, options.message);
        return;
      }

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          allowCredentials: (options.allowCredentials || []).map(
            (item: { id: string }) => ({
              type: "public-key" as const,
              id: base64urlToBuffer(item.id),
            })
          ),
          timeout: 60_000,
          userVerification: "required",
        },
      })) as PublicKeyCredential | null;

      if (!assertion) {
        afterLogin(false, "أُلغي التحقق البيومتري");
        return;
      }

      const response = assertion.response as AuthenticatorAssertionResponse;
      const verifyRes = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "passkey-verify",
          tenantSlug,
          phone,
          credentialId: bufferToBase64url(assertion.rawId),
          clientDataJSON: bufferToBase64(response.clientDataJSON),
          authenticatorData: bufferToBase64(response.authenticatorData),
          signature: bufferToBase64(response.signature),
          challenge: options.challenge,
          expiresAt: options.expiresAt,
          challengeSignature: options.challengeSignature,
        }),
      });
      const data = await verifyRes.json();
      afterLogin(verifyRes.ok && data.success, data.message);
    } catch (err) {
      afterLogin(false, err instanceof Error ? err.message : "فشل التحقق البيومتري");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-600 mx-auto shadow-xl">
            <KeyRound className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-3xl font-black text-white">بوابة الموظفين</h1>
          <p className="text-slate-400 text-sm">دخول بالرمز أو بالبصمة للمهام المسندة إليك</p>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
          <form onSubmit={handlePin} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-300">معرف المنشأة</span>
              <input
                required
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="almahrusa"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-300">رقم الجوال</span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-300">رمز الدخول (PIN)</span>
              <input
                required
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={8}
                dir="ltr"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </label>
            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              دخول بالرمز
            </button>
          </form>

          {passkeyReady && (
            <button
              type="button"
              disabled={loading}
              onClick={handlePasskey}
              className="w-full py-3 rounded-xl border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-60"
            >
              <Fingerprint className="w-4 h-4 text-sky-400" />
              دخول بالبصمة / الوجه
            </button>
          )}

          <Link
            href="/admin/login"
            className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            دخول الإدارة
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
