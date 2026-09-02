"use client";

import { useEffect, useState } from "react";
import { useOccasion } from "@/context/OccasionContext";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

type LivePlace = {
  name: string;
  address?: string;
  rating?: number;
  ratingsTotal?: number;
  mapsUrl?: string;
  weekdayText?: string[];
  reviews: Array<{ authorName: string; rating?: number; text?: string; relativeTime?: string; authorUrl?: string }>;
  photos: Array<{ reference: string }>;
  attribution: string;
};

const PREVIEW_CLIENT_TIMEOUT_MS = 15000;
const PREVIEW_CONNECT_ERROR = "تعذّر الاتصال بخادم المعاينة حالياً، يرجى تحديث الصفحة والمحاولة مجدداً.";

/** Apex mken.live 308s every /api/* to www with a non-JSON body. Always hit www from apex. */
function previewApiUrl(path = ""): string {
  if (typeof window === "undefined") return `/api/preview${path}`;
  const host = window.location.hostname.toLowerCase();
  const origin = host === "mken.live" ? "https://www.mken.live" : window.location.origin;
  return `${origin}/api/preview${path}`;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && (err.name === "AbortError" || /aborted|timeout/i.test(err.message)))
  );
}

async function readPreviewJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) {
    if (res.status === 429) throw new Error("تجاوزت حد الطلبات. أعد المحاولة بعد 10 دقائق.");
    if (res.status === 403) throw new Error("فشل التحقق. حدّث الصفحة وحاول مجدداً.");
    if (res.status === 504 || res.status === 408 || res.status === 502) {
      throw new Error("انتهت مهلة قراءة خرائط جوجل. استخدم رابط maps.app.goo.gl أو معرّف المكان الذي يبدأ بـ ChIJ.");
    }
    throw new Error(PREVIEW_CONNECT_ERROR);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(PREVIEW_CONNECT_ERROR);
  }
}

async function previewFetch(path = "", init?: RequestInit): Promise<Response> {
  try {
    return await fetch(previewApiUrl(path), {
      ...init,
      credentials: "omit",
      mode: "cors",
      signal: init?.signal ?? AbortSignal.timeout(PREVIEW_CLIENT_TIMEOUT_MS),
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error("انتهت مهلة الاتصال بالخادم. جرّب رابط خرائط أقصر أو معرّف المكان ChIJ.");
    }
    throw new Error(PREVIEW_CONNECT_ERROR);
  }
}

async function loadChallenge(): Promise<string> {
  try {
    const res = await previewFetch("?action=challenge");
    const data = await readPreviewJson(res);
    return typeof data.challenge === "string" ? data.challenge : "";
  } catch {
    return "";
  }
}

export function UnclaimedClaimBanner({ slug, accentColor }: { slug: string; accentColor: string }) {
  const [placeName, setPlaceName] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [challenge, setChallenge] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"idle" | "otp">("idle");
  const [claimStatus, setClaimStatus] = useState<"unclaimed" | "pending" | "claimed">("unclaimed");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChallenge().then((token) => {
      if (token) setChallenge(token);
    });
    previewFetch(`?action=live&slug=${encodeURIComponent(slug)}`)
      .then((res) => readPreviewJson(res))
      .then((data) => {
        const place = data.place as LivePlace | undefined;
        if (place?.name) setPlaceName(place.name);
        if (place?.mapsUrl) setMapsUrl(place.mapsUrl);
        if (data.claimStatus === "pending" || data.claimStatus === "claimed") {
          setClaimStatus(data.claimStatus);
        }
      })
      .catch(() => undefined);
  }, [slug]);

  const startClaim = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const turnstile = (document.querySelector("[name='cf-turnstile-response']") as HTMLInputElement | null)
        ?.value;
      let token = challenge;
      if (!token) {
        token = await loadChallenge();
        if (token) setChallenge(token);
      }
      const res = await previewFetch("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim-start",
          slug,
          phone,
          challenge: token,
          turnstileToken: turnstile,
        }),
      });
      const data = await readPreviewJson(res);
      if (!res.ok || !data?.success) throw new Error(String(data?.message || "تعذّر إرسال الرمز"));
      setStep("otp");
      setMessage(
        typeof data.devOtp === "string"
          ? `رمز التطوير: ${data.devOtp}`
          : String(data.message || "")
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "تعذّر إرسال الرمز");
    } finally {
      setLoading(false);
    }
  };

  const verifyClaim = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await previewFetch("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim-verify", slug, phone, otp }),
      });
      const data = await readPreviewJson(res);
      if (!res.ok || !data?.success) throw new Error(String(data?.message || "فشل التحقق"));
      if (typeof data.googleAuthUrl === "string" && data.googleAuthUrl) {
        window.location.href = data.googleAuthUrl;
        return;
      }
      window.location.href = typeof data.settingsUrl === "string" ? data.settingsUrl : "/admin/settings";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل التحقق");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full py-3 px-4 bg-amber-500 text-slate-950 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex-1">
          <p className="font-extrabold">هذه معاينة غير مفهرسة{placeName ? ` لـ ${placeName}` : ""}</p>
          <p className="text-xs opacity-80">
            المصدر: Google Maps — العرض حي. بعد OTP يفتح ربط Google Business ثم كتالوج واتساب الرسمي.
            {mapsUrl ? (
              <>
                {" "}
                <a href={mapsUrl} className="underline" target="_blank" rel="noopener noreferrer">
                  عرض المصدر على Google Maps
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="جوال المطالبة"
            className="px-3 py-2 rounded-lg text-xs bg-white/80 outline-none"
            dir="ltr"
          />
          {claimStatus === "pending" ? (
            <a
              href="/admin/settings"
              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-950 text-white"
            >
              أكمل ربط Google Business
            </a>
          ) : step === "otp" ? (
            <>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="رمز OTP"
                className="px-3 py-2 rounded-lg text-xs bg-white/80 outline-none w-28"
                dir="ltr"
              />
              <button
                type="button"
                onClick={verifyClaim}
                disabled={loading}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                تأكيد وربط Google
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startClaim}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-950 text-white"
            >
              طالب بالموقع
            </button>
          )}
        </div>
      </div>
      {message ? <p className="max-w-7xl mx-auto text-xs mt-2 font-bold">{message}</p> : null}
    </div>
  );
}

export default function MagicPreviewForm({ compact = false }: { compact?: boolean }) {
  const { occasionDetails } = useOccasion();
  const [mapsUrl, setMapsUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ previewUrl: string; place: LivePlace; slug: string } | null>(null);

  useEffect(() => {
    loadChallenge().then((token) => {
      if (token) setChallenge(token);
    });
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;
    if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const turnstile = (document.querySelector("[name='cf-turnstile-response']") as HTMLInputElement | null)
        ?.value;
      let token = challenge;
      if (!token) {
        token = await loadChallenge();
        if (token) setChallenge(token);
      }
      const res = await previewFetch("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          mapsUrl,
          phone,
          consent,
          challenge: token,
          turnstileToken: turnstile,
          website: honeypot,
        }),
      });
      const data = await readPreviewJson(res);
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.message || "تعذّر إنشاء المعاينة"));
      }
      setResult({
        previewUrl: String(data.previewUrl || ""),
        place: data.place as LivePlace,
        slug: String(data.slug || ""),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إنشاء المعاينة");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4 text-right">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>المعاينة جاهزة — غير مفهرسة لمدة 7 أيام</span>
        </div>
        <p className="text-white font-extrabold text-lg">{result.place.name}</p>
        {result.place.address ? <p className="text-xs text-slate-400">{result.place.address}</p> : null}
        <p className="text-[11px] text-slate-500">المصدر: Google Maps — العرض حي ولم يُحفظ في قاعدة مكّن.</p>
        <a
          href={result.previewUrl}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-slate-950"
          style={{ backgroundColor: occasionDetails.accentColor }}
        >
          <span>افتح المعاينة</span>
          <ArrowLeft className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-right">
      {!compact ? (
        <div className="space-y-1">
          <h3 className="font-bold text-white text-sm">جهّز معاينة موقعك بنفسك</h3>
          <p className="text-xs text-slate-400">
            الصق رابط خرائط جوجل ورقم جوالك. لا نرسل رسائل باردة ولا ننسخ كتالوج واتساب.
          </p>
        </div>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          رابط خرائط جوجل أو place_id
        </span>
        <input
          value={mapsUrl}
          onChange={(event) => setMapsUrl(event.target.value)}
          required
          dir="ltr"
          placeholder="https://maps.app.goo.gl/… أو ChIJ…"
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-amber-500"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-amber-400" />
          رقم الجوال (سعودي)
        </span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          dir="ltr"
          placeholder="05xxxxxxxx"
          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-amber-500"
        />
      </label>

      <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5"
          required
        />
        <span>
          أؤكد أنني صاحب النشاط وأوافق على معالجة رقم جوالي وplace_id لإنشاء معاينة غير مفهرسة وفق نظام حماية البيانات الشخصية. لن تُحفظ صور أو مراجعات خرائط جوجل.
        </span>
      </label>

      <div className="hidden" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
      </div>

      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
        <div
          className="cf-turnstile"
          data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          data-theme="dark"
        />
      ) : null}

      {error ? (
        <p className="text-xs text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !consent}
        className="w-full py-3 rounded-xl font-bold text-slate-950 flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ backgroundColor: occasionDetails.accentColor }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        <span>إنشاء المعاينة الآمنة</span>
      </button>
    </form>
  );
}
