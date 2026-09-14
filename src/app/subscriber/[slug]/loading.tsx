import React from "react";

export default function SubscriberLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 space-y-8 animate-pulse dir-rtl">
      {/* Header Skeleton */}
      <div className="max-w-4xl mx-auto space-y-4 text-center">
        <div className="h-10 w-2/3 bg-slate-800 rounded-2xl mx-auto" />
        <div className="h-5 w-1/2 bg-slate-800/60 rounded-xl mx-auto" />
      </div>

      {/* Banner Skeleton */}
      <div className="max-w-4xl mx-auto h-48 bg-slate-900 border border-slate-800 rounded-3xl" />

      {/* Grid Skeleton */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
      </div>
    </div>
  );
}
