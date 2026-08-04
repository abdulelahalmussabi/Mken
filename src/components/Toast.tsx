"use client";

import { useApp } from "@/context/AppContext";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export default function Toast() {
  const { toast } = useApp();

  if (!toast) return null;

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
          isSuccess
            ? "bg-slate-900/90 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40"
            : isError
            ? "bg-slate-900/90 border-rose-500/40 text-rose-300 shadow-rose-950/40"
            : "bg-slate-900/90 border-orange-500/40 text-orange-300 shadow-orange-950/40"
        }`}
      >
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />}

        <div className="flex-1 text-sm font-medium leading-relaxed">
          {toast.message}
        </div>
      </div>
    </div>
  );
}
