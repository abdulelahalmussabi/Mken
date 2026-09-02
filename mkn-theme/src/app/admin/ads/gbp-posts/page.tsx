"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Sparkles, Send } from "lucide-react";
import { ADMIN_INPUT, useAdminTenant } from "@/components/AdminPageTabs";
import { useApp } from "@/context/AppContext";

type ScheduledGbpPost = {
  id: string;
  topic: string;
  content: string;
  status: string;
  publishAt: string;
  errorLog: string;
};

const STATUS: Record<string, string> = {
  PENDING: "مجدول",
  PUBLISHED: "منشور",
  FAILED: "فشل",
};

export default function GbpPostsPage() {
  const { tenant, query, authLoading } = useAdminTenant();
  const { showToast } = useApp();
  const [posts, setPosts] = useState<ScheduledGbpPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("عرض الأسبوع");
  const [text, setText] = useState("");
  const [publishAt, setPublishAt] = useState("");

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!tenant) {
      setLoading(false);
      setError("اختر المنشأة أولاً");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/google-business?action=scheduled-posts${query ? `&${query.slice(1)}` : ""}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "تعذّر تحميل المنشورات");
        setPosts([]);
      } else {
        setError("");
        setPosts(data.posts || []);
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

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-post", prompt: topic, serviceName: topic }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر التوليد", "error");
        return;
      }
      setText(data.text || "");
    } finally {
      setGenerating(false);
    }
  };

  const save = async (immediate: boolean) => {
    setSaving(true);
    try {
      const when = immediate ? new Date().toISOString() : new Date(publishAt).toISOString();
      const res = await fetch(`/api/google-business${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule-post", topic, text, publishAt: when }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "تعذّر الجدولة", "error");
        return;
      }
      showToast(data.publishedNow ? "نُشر المنشور على الخرائط" : "تمت الجدولة", "success");
      setText("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h1 className="text-lg font-extrabold text-white">جدولة منشورات خرائط جوجل</h1>
            <p className="text-xs text-slate-400 mt-1 leading-6">
              يُنشر تلقائياً في الموعد عبر الربط الحالي لجوجل بيزنس. اربط الفرع من الإعدادات إن لم يكن مربوطاً.
            </p>
          </div>
        </div>
        <input className={ADMIN_INPUT} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="موضوع المنشور" />
        <textarea className={ADMIN_INPUT} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="نص المنشور" />
        <input
          className={ADMIN_INPUT}
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={generating} onClick={generate} className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            توليد بالذكاء
          </button>
          <button type="button" disabled={saving || !text.trim() || !publishAt} onClick={() => save(false)} className="inline-flex items-center gap-2 px-4 py-3 bg-amber-500 text-slate-950 font-extrabold text-sm rounded-xl disabled:opacity-50">
            <CalendarClock className="w-4 h-4" />
            جدولة
          </button>
          <button type="button" disabled={saving || !text.trim()} onClick={() => save(true)} className="inline-flex items-center gap-2 px-4 py-3 bg-slate-800 text-white font-extrabold text-sm rounded-xl disabled:opacity-50">
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
            <p className="text-sm font-extrabold text-white">
              {post.topic} · {STATUS[post.status] || post.status}
            </p>
            <p className="text-xs text-slate-400 mt-1">{post.publishAt ? new Date(post.publishAt).toLocaleString("ar-SA") : ""}</p>
            <p className="text-xs text-slate-300 mt-2 leading-6">{post.content}</p>
            {post.errorLog ? <p className="text-[11px] text-rose-300 mt-2">{post.errorLog}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
