import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import Toast from "@/components/Toast";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "مكّن | تصدر نتائج محركات البحث المحلية لمجالك في السعودية",
  description: "المنصة الأولى المخصصة لأصحاب المحلات والأنشطة التجارية في المملكة العربية السعودية لتحسين الظهور في خرائط Google وجلب المزيد من الزبائن المحليين.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#090d16] text-slate-100 selection:bg-orange-500 selection:text-white">
        <AppProvider>
          {children}
          <Toast />
        </AppProvider>
      </body>
    </html>
  );
}
