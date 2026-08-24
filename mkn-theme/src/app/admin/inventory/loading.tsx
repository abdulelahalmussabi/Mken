import React from "react";

export default function AdminInventoryLoading() {
  return (
    <>
      <div className="p-8 space-y-6 animate-pulse text-right">
        <div className="h-8 w-48 bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-3xl" />
      </div>
    </>
  );
}
