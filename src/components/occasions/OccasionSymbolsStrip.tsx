"use client";

import { useOccasion } from "@/context/OccasionContext";

export function OccasionSymbolsStrip({ className = "" }: { className?: string }) {
  const { activeOccasion, occasionDetails } = useOccasion();

  if (activeOccasion === "none" || occasionDetails.officialSymbols.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {occasionDetails.officialSymbols.map((sym) => (
        <span
          key={sym}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
          style={{
            color: occasionDetails.accentColor,
            borderColor: `${occasionDetails.accentColor}55`,
            backgroundColor: `${occasionDetails.accentColor}14`,
          }}
        >
          {sym}
        </span>
      ))}
    </div>
  );
}
