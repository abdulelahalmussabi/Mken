import type { Metadata } from "next";
import AdminLayout from "@/components/AdminLayout";
import { noIndexRobots } from "@/lib/mken/seo";

export const metadata: Metadata = {
  title: "لوحة الإدارة",
  robots: noIndexRobots,
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
