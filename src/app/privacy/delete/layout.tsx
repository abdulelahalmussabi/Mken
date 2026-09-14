import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "طلب حذف البيانات",
  description:
    "قدّم طلب حذف بيانات منشأتك على مكّن وفق نظام حماية البيانات الشخصية السعودي (PDPL).",
  alternates: { canonical: "/privacy/delete" },
  robots: { index: true, follow: true },
};

export default function PrivacyDeleteLayout({ children }: { children: ReactNode }) {
  return children;
}
