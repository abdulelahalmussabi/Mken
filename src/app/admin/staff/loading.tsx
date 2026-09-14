import React from "react";

export default function AdminStaffLoading() {
  return (
    <>
      <div className="p-8 space-y-6 animate-pulse text-right">
        <div className="h-8 w-48 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-36 bg-slate-900 border border-slate-800 rounded-3xl" />
          <div className="h-36 bg-slate-900 border border-slate-800 rounded-3xl" />
          <div className="h-36 bg-slate-900 border border-slate-800 rounded-3xl" />
        </div>
      </div>
    </>
  );
}
