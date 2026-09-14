import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { privacyHtml } from "@/content/legal-html";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description:
    "سياسة خصوصية منصة مكّن: بيانات Google OAuth، كيفية استخدامها وحفظها، وحقوق الحذف وفق نظام حماية البيانات الشخصية السعودي.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalPageShell html={privacyHtml} />;
}
