"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  cropWorthApplying,
  findContentBounds,
  isUsableLogoSrc,
  knockoutBackground,
  MAX_LOGO_EDGE,
  MAX_SOURCE_BYTES,
  padCropRect,
} from "@/lib/mken/logo-crop";

type PersistResult = { success: boolean; message?: string } | boolean | void;

export async function processLogoFile(file: File): Promise<{ dataUrl: string; trimmed: boolean }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("الملف ليس صورة. ارفع PNG أو WebP أو JPEG.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("حجم الملف أكبر من 12 ميغابايت.");
  }

  const bitmap = await createImageBitmap(file);
  const source = document.createElement("canvas");
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    bitmap.close();
    throw new Error("تعذّر قراءة الصورة في هذا المتصفح.");
  }
  sourceCtx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const pixels = sourceCtx.getImageData(0, 0, source.width, source.height);
  knockoutBackground(pixels);
  sourceCtx.putImageData(pixels, 0, 0);
  const bounds = findContentBounds(pixels);
  let sx = 0;
  let sy = 0;
  let sw = source.width;
  let sh = source.height;
  let trimmed = false;

  if (bounds) {
    const padded = padCropRect(bounds, pixels);
    if (cropWorthApplying(pixels, padded)) {
      sx = padded.left;
      sy = padded.top;
      sw = padded.width;
      sh = padded.height;
      trimmed = true;
    }
  }

  const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const out = document.createElement("canvas");
  out.width = dw;
  out.height = dh;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("تعذّر تجهيز الشعار.");
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.clearRect(0, 0, dw, dh);
  outCtx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);

  const dataUrl = out.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png")) {
    throw new Error("تعذّر حفظ الشعار بعد القص.");
  }
  return { dataUrl, trimmed };
}

export function BrandLogoUploader({
  value,
  onPersist,
  disabled,
}: {
  value: string;
  onPersist: (logo: string) => Promise<PersistResult> | PersistResult;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const preview = isUsableLogoSrc(value) ? value : "";

  const persist = async (logo: string, okMessage: string) => {
    const result = await onPersist(logo);
    if (result && typeof result === "object" && "success" in result && !result.success) {
      throw new Error(result.message || "تعذّر حفظ الشعار");
    }
    if (result === false) throw new Error("تعذّر حفظ الشعار");
    setHint(okMessage);
  };

  const onFile = async (file: File | undefined) => {
    if (!file || busy || disabled) return;
    setBusy(true);
    setHint("جاري قص الهوامش وحفظ الشعار…");
    try {
      const processed = await processLogoFile(file);
      await persist(
        processed.dataUrl,
        processed.trimmed ? "تم قص الهوامش الفارغة وحفظ الشعار فوراً" : "تم حفظ الشعار فوراً"
      );
    } catch (err) {
      setHint(err instanceof Error ? err.message : "تعذّر معالجة الشعار");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await persist("", "تم إزالة الشعار");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "تعذّر إزالة الشعار");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-slate-300">شعار المنشأة</label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="w-20 h-20 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center shrink-0"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#1e293b 25%,transparent 25%),linear-gradient(-45deg,#1e293b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e293b 75%),linear-gradient(-45deg,transparent 75%,#1e293b 75%)",
            backgroundSize: "14px 14px",
            backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
            backgroundColor: "#0f172a",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="معاينة الشعار" className="w-full h-full object-contain" />
          ) : (
            <ImagePlus className="w-7 h-7 text-slate-500" />
          )}
        </div>
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                busy || disabled
                  ? "bg-slate-800 text-slate-500 pointer-events-none"
                  : "bg-amber-500 text-slate-950 hover:bg-amber-400"
              }`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              رفع شعار
            </label>
            {preview ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy || disabled}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-rose-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                إزالة
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            PNG مفرّغ (خلفية شفافة) أفضل. نفرّغ اللوح الأبيض أو الأسود تلقائياً حتى يتكيّف الشعار مع أي ثيم.
          </p>
          {hint ? <p className="text-[11px] font-bold text-amber-300">{hint}</p> : null}
        </div>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        hidden
        disabled={busy || disabled}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
