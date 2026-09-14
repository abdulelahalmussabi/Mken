import React from "react";
import { Lock } from "lucide-react";

export default function SaasUpgradeNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="p-8 rounded-3xl bg-slate-900/80 border border-amber-500/30 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
        <Lock className="w-5 h-5 text-amber-400" />
      </div>
      <h2 className="text-xl font-extrabold text-white">{title}</h2>
      <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
    </div>
  );
}
