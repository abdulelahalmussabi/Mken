"use client";

import React from "react";
import { useOccasion } from "@/context/OccasionContext";
import { useAdmin } from "@/context/AdminContext";
import { Palette, Sparkles } from "lucide-react";

export const OccasionFloatingButton: React.FC = () => {
  const { occasionDetails, openModal, isMounted } = useOccasion();
  const { isAdmin } = useAdmin();

  if (!isMounted || !isAdmin) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-bounce" style={{ animationDuration: "3s" }}>
      <button
        onClick={openModal}
        className="flex items-center gap-2.5 px-4 py-3 bg-slate-900/95 hover:bg-slate-800 border-2 border-amber-500 text-white rounded-2xl shadow-2xl backdrop-blur-xl transition-all hover:scale-110 active:scale-95 group cursor-pointer"
        title="تغيير واستعراض ثيمات المناسبات السعودية"
      >
        <div className="relative">
          <span
            className="w-3.5 h-3.5 rounded-full block animate-ping absolute inset-0"
            style={{ backgroundColor: occasionDetails.accentColor }}
          />
          <span
            className="w-3.5 h-3.5 rounded-full block relative"
            style={{ backgroundColor: occasionDetails.accentColor }}
          />
        </div>
        <Palette className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
        <div className="text-right hidden sm:block">
          <div className="text-xs font-black text-white flex items-center gap-1">
            <span>تغيير الثيم</span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-[10px] text-amber-300 font-semibold">{occasionDetails.shortName}</div>
        </div>
      </button>
    </div>
  );
};
