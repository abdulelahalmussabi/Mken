import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { termsHtml } from "@/content/legal-html";

export const metadata: Metadata = {
  title: "شروط الخدمة",
  description:
    "شروط استخدام منصة مكّن: الحسابات، ربط Google، المدفوعات، والمسؤوليات وفق أنظمة المملكة العربية السعودية.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalPageShell html={termsHtml} />;
}
