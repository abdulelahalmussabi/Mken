"use client";

import { useAdmin } from "@/context/AdminContext";
import type { ReactNode } from "react";
import { isUsableLogoSrc } from "@/lib/mken/logo-crop";

export function PlatformMark({
  className = "w-10 h-10",
  fallback,
}: {
  className?: string;
  fallback: ReactNode;
}) {
  const { platformLogo } = useAdmin();
  if (!isUsableLogoSrc(platformLogo)) return <>{fallback}</>;
  return (
    <span className={`${className} overflow-hidden rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={platformLogo} alt="مكّن" className="w-full h-full object-contain p-0.5" />
    </span>
  );
}
