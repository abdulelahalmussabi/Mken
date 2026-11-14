"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, Images, Loader2, Send, Upload, X } from "lucide-react";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";

type IgPost = {
  id: string;
  caption: string;
  imageUrls: string[];
  alsoFacebook: boolean;
  status: string;
  publishAt: string;
  igMediaId: string;
  fbPostId: string;
  errorLog: string;
};

type Connection = {
  tokenReady: boolean;
  pageId: string;
  pageName: string;
  igUserId: string;
  igUsername: string;
  connected: boolean;
  blockers: string[];
};

const STATUS: Record<string, string> = {
  PENDING: "مجدول",
  PUBLISHING: "جارٍ النشر",
  PUBLISHED: "منشور",
  FAILED: "فشل",
  CANCELLED: "ملغى",
};

function defaultSlot(): string {
  const d = new Date();
  d.setHours(20, 15, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1440;
      let width = img.width;
      let height = img.height;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("image"));
    };
    img.src = blobUrl;
  });
}

export default function InstagramPostsPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const { showToast } = useApp();
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [gallery, setGallery] = useState<{ url: string; label: string }[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState(defaultSlot);
  const [alsoFacebook, setAlsoFacebook] = useState(true);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/instagram-posts${query}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل الناشر");
        setPosts([]);
      } else {
        setError("");
        setPosts(data.posts || []);
        setGallery(Array.isArray(data.gallery) ? data.gallery : []);
        setConnection(data.connection || null);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, [tenant, query, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const addUrl = (url: string) => {
    if (imageUrls.includes(url) || imageUrls.length >= 10) return;
    setImageUrls([...imageUrls, url]);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const next = [...imageUrls];
      for (const file of Array.from(files).slice(0, 10 - next.length)) {
        const imageDataUrl = await compressImage(file);
        const res = await fetch(`/api/instagram-posts${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload", imageDataUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || typeof data.url !== "string") {
          showToast(data.message || "تعذّر رفع الصورة", "error");
          break;
        }
        next.push(data.url);
      }
      setImageUrls(next);
    } catch {
      showToast("تعذّر ضغط أو رفع الصورة", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async (immediate: boolean) => {
    setSaving(true);
    try {
      const when = immediate ? new Date().toISOString() : new Date(publishAt).toISOString();
      const res = await fetch(`/api/instagram-posts${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          caption,
          imageUrls,
          publishAt: when,
          alsoFacebook,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الجدولة", "error");
        return;
      }
      showToast(data.publishedNow ? "نُشر على إنستقرام" : "تمت الجدولة — الكرون كل 15 دقيقة", "success");
      if (data.message) showToast(data.message, "error");
      setCaption("");
      setImageUrls([]);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    const res = await fetch(`/api/instagram-posts${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "تعذّر الإلغاء", "error");
      return;
    }
    showToast("أُلغي المنشور المجدول", "success");
    await load();
  };

  const connected = Boolean(connection?.connected);
  const canSubmit = Boolean(caption.trim() && imageUrls.length && connected);

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-start gap-3">
          <Images className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">ناشر إنستقرام</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              جدولة منشورات الحساب المهني المرتبط بصفحة المنشأة. الكرون يمر كل 15 دقيقة. القصص تُنشر يدوياً من التطبيق.
            </p>
          </div>
        </div>

        {connection ? (
          <div className="text-xs leading-6 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
            {connected ? (
              <p className="text-emerald-300">
                مربوط: @{connection.igUsername || connection.igUserId}
                {connection.pageName ? ` · ${connection.pageName}` : ""}
              </p>
            ) : (
              (connection.blockers.length ? connection.blockers : ["أكمل ربط إنستقرام المهني بصفحة المنشأة."]).map(
                (item) => (
                  <p key={item} className="text-amber-200">
                    {item}
                  </p>
                )
              )
            )}
            <p className="text-slate-500">
              معرّف الصفحة من{" "}
              <Link href={`/admin/ads/campaigns${query}` as Route} className="underline">
                لوحة الحملات
              </Link>
              . لا تستخدم صفحة mken.live.
            </p>
          </div>
        ) : null}

        <textarea
          className={ADMIN_INPUT}
          rows={6}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="نص المنشور مع الهاشتاقات ورابط الحجز"
        />

        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={alsoFacebook}
            onChange={(e) => setAlsoFacebook(e.target.checked)}
            className="rounded border-slate-700"
          />
          انشر الصورة الأولى أيضاً على صفحة فيسبوك
        </label>

        <div className="flex flex-wrap gap-2">
          {imageUrls.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-800" />
              <button
                type="button"
                onClick={() => setImageUrls(imageUrls.filter((item) => item !== url))}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-800 text-white grid place-items-center"
                aria-label="إزالة الصورة"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-3 bg-slate-800 text-white font-extrabold text-sm rounded-xl cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "جاري الرفع..." : "رفع صور (حتى 10)"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading || imageUrls.length >= 10}
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {gallery.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">صور الموقع الجاهزة (روابط عامة ينسخها إنستقرام)</p>
            <div className="flex flex-wrap gap-2">
              {gallery.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => addUrl(item.url)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border ${
                    imageUrls.includes(item.url) ? "border-amber-400" : "border-slate-800"
                  }`}
                  title={item.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <input
          className={ADMIN_INPUT}
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving || uploading || !canSubmit || !publishAt}
            onClick={() => save(false)}
            className="inline-flex items-center gap-2 px-4 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <CalendarClock className="w-4 h-4" />
            جدولة
          </button>
          <button
            type="button"
            disabled={saving || uploading || !canSubmit}
            onClick={() => save(true)}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-800 text-white font-extrabold text-sm rounded-xl disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            نشر الآن
          </button>
        </div>
      </section>

      {loading ? (
        <div className="h-20 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-rose-300 font-bold">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-400">لا منشورات مجدولة بعد.</p>
      ) : (
        posts.map((post) => (
          <article key={post.id} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-extrabold text-white">
                {STATUS[post.status] || post.status}
                {post.alsoFacebook ? " · فيسبوك" : ""}
              </p>
              {post.status === "PENDING" ? (
                <button type="button" onClick={() => cancel(post.id)} className="text-[11px] text-rose-300">
                  إلغاء
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {post.publishAt ? new Date(post.publishAt).toLocaleString("ar-SA") : ""}
            </p>
            <p className="text-xs text-slate-300 mt-2 leading-6 whitespace-pre-wrap">{post.caption}</p>
            {post.imageUrls.length ? (
              <div className="flex gap-2 mt-3">
                {post.imageUrls.slice(0, 4).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-800" />
                ))}
              </div>
            ) : null}
            {post.errorLog ? <p className="text-[11px] text-rose-300 mt-2">{post.errorLog}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
