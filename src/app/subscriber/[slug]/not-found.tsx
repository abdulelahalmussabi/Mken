import Link from "next/link";
import type { Route } from "next";

export default function SubscriberNotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-200 px-6 text-center">
      <p className="text-lg font-extrabold">هذه الصفحة غير متاحة</p>
      <p className="text-sm text-slate-400">ربما تكون مغلقة من إعدادات محتوى المنشأة.</p>
      <Link href={"/" as Route} className="text-amber-400 text-sm font-bold">
        العودة للرئيسية
      </Link>
    </div>
  );
}
