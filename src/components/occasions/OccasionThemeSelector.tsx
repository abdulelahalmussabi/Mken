"use client";

import React, { useState, useRef, useEffect } from "react";
import { useOccasion, SAUDI_OCCASIONS, OccasionId } from "@/context/OccasionContext";
import { Sparkles, Palette, ChevronDown, Check, Info } from "lucide-react";

export const OccasionThemeSelector: React.FC = () => {
  const { activeOccasion, setOccasion, openModal, isMounted } = useOccasion();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isMounted) return null;

  const occasionsList = Object.values(SAUDI_OCCASIONS);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-all shadow-md active:scale-95"
        title="اختيار ثيم المناسبة السعودية"
      >
        <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: SAUDI_OCCASIONS[activeOccasion]?.accentColor || "#f97316" }} />
        <Palette className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline font-bold">ثيم المناسبات</span>
        <span className="text-slate-400 text-xs hidden md:inline">({SAUDI_OCCASIONS[activeOccasion]?.shortName})</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 mb-1">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>حزمة المناسبات السعودية 🇸🇦</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                openModal();
              }}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              <Info className="w-3.5 h-3.5" />
              <span>تفاصيل الدراسة</span>
            </button>
          </div>

          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {occasionsList.map((occ) => {
              const isSelected = activeOccasion === occ.id;
              return (
                <button
                  key={occ.id}
                  onClick={() => {
                    setOccasion(occ.id as OccasionId);
                    setIsOpen(false);
                  }}
                  className={`w-full text-right flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                    isSelected
                      ? "bg-slate-800/90 border border-amber-500/40 text-white font-bold shadow-sm"
                      : "hover:bg-slate-800/50 text-slate-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: occ.accentColor }}
                    />
                    <div>
                      <div className="font-bold text-slate-100">{occ.name}</div>
                      <div className="text-[11px] text-slate-400 font-normal line-clamp-1">{occ.slogan}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
