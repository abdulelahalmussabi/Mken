"use client";

import React, { useEffect } from "react";

export default function SubscriberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Subscriber page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4 text-right">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl font-bold">
        ⚠️
      </div>
      <h2 className="text-2xl font-bold text-rose-400">حدث خطأ أثناء تحميل الصفحة</h2>
      <p className="text-slate-400 text-sm max-w-md">
        {error?.message || "عذراً، لم نتمكن من جلب بيانات المنشأة المطلوب عرضها حالياً."}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition-all"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
