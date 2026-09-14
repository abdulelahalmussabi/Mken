import React from "react";

export function SkeletonCard() {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-6 bg-slate-800 rounded-full w-20"></div>
      </div>
      <div className="h-3 bg-slate-800/80 rounded w-2/3"></div>
      <div className="h-3 bg-slate-800/60 rounded w-1/2"></div>
      <div className="pt-4 border-t border-slate-800/60 flex justify-between">
        <div className="h-3 bg-slate-800 rounded w-1/4"></div>
        <div className="h-3 bg-slate-800 rounded w-1/6"></div>
      </div>
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
