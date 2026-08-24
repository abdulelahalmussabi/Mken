import React from "react";

export default function AdminSettingsLoading() {
  return (
    <>
      <div className="p-8 space-y-6 animate-pulse text-right">
        <div className="h-8 w-48 bg-slate-800 rounded-xl" />
        <div className="h-4 w-full bg-slate-800/60 rounded-lg" />
        <div className="h-4 w-3/4 bg-slate-800/60 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="h-48 bg-slate-900 border border-slate-800 rounded-3xl" />
          <div className="h-48 bg-slate-900 border border-slate-800 rounded-3xl" />
        </div>
      </div>
    </>
  );
}
