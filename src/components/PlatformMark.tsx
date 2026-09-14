"use client";

import { useAdmin } from "@/context/AdminContext";
import type { ReactNode } from "react";
import { isUsableLogoSrc } from "@/lib/mken/logo-crop";

export function BrandCutout({
  src,
  alt,
  className = "h-11 sm:h-12",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span className={`${className} inline-flex items-center justify-center shrink-0 bg-transparent`}>
      {/* data URLs and tenant CDNs are not in next/image remotePatterns */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="brand-cutout max-h-full w-auto max-w-full" />
    </span>
  );
}

export function PlatformMark({
  className = "w-10 h-10",
  fallback,
}: {
  className?: string;
  fallback: ReactNode;
}) {
  const { platformLogo } = useAdmin();
  if (!isUsableLogoSrc(platformLogo)) return <>{fallback}</>;
  return <BrandCutout src={platformLogo} alt="مكّن" className={className} />;
}
