"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Appointment } from "@/lib/mken/appointments";
import { ACTIVITIES } from "@/lib/mken/catalog";
import { ROLE_LABELS, type StaffRole } from "@/lib/mken/staff";
import { LogOut, CalendarDays, Phone, MapPin, Shield, Fingerprint } from "lucide-react";

interface StaffView {
  id: string;
  name: string;
  role: string;
  phone: string;
  tenantSlug: string;
  activities: string[];
}

interface PasskeyDevice {
  id: string;
  device_name: string;
  created_at: string | null;
}

function activityTitle(id: string): string {
  return ACTIVITIES.find((item) => item.id === id)?.title || id;
}

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

export default function StaffHomePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffView | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);
  const [passkeyDevices, setPasskeyDevices] = useState<PasskeyDevice[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState("");

  useEffect(() => {
    setPasskeyReady(typeof window !== "undefined" && "credentials" in navigator && "PublicKeyCredential" in window);

    fetch("/api/staff/me/appointments")
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          router.replace("/staff/login");
          return;
        }
        if (!res.ok || !data.success) {
          setError(data.message || "تعذّر تحميل المهام");
          return;
        }
        setStaff(data.staff);
        setAppointments(data.appointments || []);
      })
      .catch(() => setError("تعذّر الاتصال بالخادم"))
      .finally(() => setLoading(false));

    fetch("/api/staff/me/passkey")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPasskeyEnrolled(Boolean(data.enrolled));
          setPasskeyDevices(data.devices || []);
        }
      })
      .catch(() => {});
  }, [router]);

  const logout = async () => {
    await fetch("/api/staff/session", { method: "DELETE" }).catch(() => {});
    router.replace("/staff/login");
  };

  const enrollPasskey = async () => {
    if (!passkeyReady) {
      setPasskeyMessage("الدخول البيومتري غير مدعوم في هذا المتصفح.");
      return;
    }
    setPasskeyBusy(true);
    setPasskeyMessage("");
    try {
      const challengeRes = await fetch("/api/staff/me/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "enroll-challenge" }),
      });
      const options = await challengeRes.json();
      if (!challengeRes.ok || !options.success) {
        setPasskeyMessage(options.message || "تعذّر تحضير التسجيل");
        return;
      }

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          rp: options.rp,
          user: {
            id: base64urlToBuffer(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          timeout: 60_000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          excludeCredentials: (options.excludeCredentials || []).map((item: { id: string }) => ({
            type: "public-key" as const,
            id: base64urlToBuffer(item.id),
          })),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        setPasskeyMessage("أُلغي تسجيل البصمة");
        return;
      }

      const attestation = credential.response as AuthenticatorAttestationResponse;
      if (typeof attestation.getPublicKey !== "function" || !attestation.getPublicKey()) {
        setPasskeyMessage("المتصفح لا يدعم استخراج المفتاح العام");
        return;
      }

      const verifyRes = await fetch("/api/staff/me/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "enroll-verify",
          credentialId: bufferToBase64url(credential.rawId),
          publicKeyDer: bufferToBase64(attestation.getPublicKey() as ArrayBuffer),
          challenge: options.challenge,
          expiresAt: options.expiresAt,
          challengeSignature: options.challengeSignature,
        }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok || !data.success) {
        setPasskeyMessage(data.message || "فشل حفظ البصمة");
        return;
      }

      setPasskeyEnrolled(true);
      setPasskeyMessage("تم تفعيل الدخول بالبصمة/الوجه على هذا الجهاز.");
      const refresh = await fetch("/api/staff/me/passkey").then((res) => res.json());
      if (refresh.success) setPasskeyDevices(refresh.devices || []);
    } catch (err) {
      setPasskeyMessage(err instanceof Error ? err.message : "فشل تفعيل البصمة");
    } finally {
      setPasskeyBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        جاري تحميل بوابة الموظف…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-sky-400">بوابة الموظفين</p>
            <h1 className="font-extrabold text-white">{staff?.name || "موظف"}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 border border-rose-900/40 hover:bg-rose-950/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            خروج
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
            {ROLE_LABELS[(staff?.role as StaffRole) || "technician"] || staff?.role}
            <Shield className="w-3.5 h-3.5 text-sky-400" />
          </p>
          <p className="text-xs text-slate-500 font-mono text-left" dir="ltr">{staff?.phone}</p>
          {staff?.activities?.length ? (
            <div className="flex flex-wrap gap-1.5 justify-end pt-2">
              {staff.activities.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-bold text-sky-300"
                >
                  {activityTitle(id)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">لم تُربط أنشطة بعد — تظهر المواعيد المسندة لاسمك فقط.</p>
          )}
        </section>

        {passkeyReady && (
          <section className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={enrollPasskey}
                disabled={passkeyBusy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-sky-300 border border-sky-900/50 hover:bg-sky-950/40 disabled:opacity-60"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                {passkeyEnrolled ? "إضافة جهاز آخر" : "تفعيل البصمة على هذا الجهاز"}
              </button>
              <div className="text-right">
                <h2 className="text-sm font-extrabold text-white">الدخول البيومتري</h2>
                <p className="text-[11px] text-slate-500">
                  {passkeyEnrolled
                    ? `${passkeyDevices.length} جهاز مسجّل — بعد التفعيل استخدم «دخول بالبصمة» من صفحة الدخول.`
                    : "ادخل بالرمز مرة، ثم سجّل البصمة هنا. لا حاجة لـ staff.html."}
                </p>
              </div>
            </div>
            {passkeyMessage && (
              <p className="text-xs text-sky-300 bg-sky-950/30 border border-sky-900/40 rounded-xl px-3 py-2">
                {passkeyMessage}
              </p>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 justify-end">
            المهام المسندة
            <CalendarDays className="w-4 h-4 text-sky-400" />
          </h2>
          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {!error && appointments.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">لا توجد مهام مسندة إليك حالياً.</p>
          )}
          {appointments.map((item) => (
            <article key={item.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                  {item.status}
                </span>
                <h3 className="font-extrabold text-white text-sm">
                  {item.activityId ? activityTitle(item.activityId) : item.serviceId || "موعد"}
                </h3>
              </div>
              <p className="text-xs text-slate-300">{item.customerName}</p>
              <p className="text-xs text-slate-500">
                {item.date} — {item.time}
              </p>
              {item.locationAddress && (
                <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                  {item.locationAddress}
                  <MapPin className="w-3 h-3" />
                </p>
              )}
              {item.phone && (
                <a
                  href={`https://wa.me/${item.phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400"
                >
                  واتساب العميل
                  <Phone className="w-3 h-3" />
                </a>
              )}
            </article>
          ))}
        </section>

        <Link href="/" className="block text-center text-xs text-slate-500 hover:text-slate-300">
          العودة للموقع
        </Link>
      </main>
    </div>
  );
}
