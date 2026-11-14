import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mken Lite — باقات واشتراكات",
  description: "اشترِ رخصة تشغيل Mken Lite للفواتير والمخزون دون إنترنت، مع تفعيل الجهاز عبر مفتاح موقّع.",
  alternates: { canonical: "/license" },
};

export default function LicenseLayout({ children }: { children: ReactNode }) {
  return children;
}
