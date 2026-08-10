import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AdminProvider } from "@/context/AdminContext";
import { OccasionProvider } from "@/context/OccasionContext";
import { OccasionBanner } from "@/components/occasions/OccasionBanner";
import { OccasionParticleCanvas } from "@/components/occasions/OccasionParticleCanvas";
import { OccasionShowcaseModal } from "@/components/occasions/OccasionShowcaseModal";
import { OccasionFloatingButton } from "@/components/occasions/OccasionFloatingButton";
import Toast from "@/components/Toast";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "منصة مكّن | حزمة واجهات المناسبات السعودية وخدمات Local SEO",
  description:
    "المنصة الأولى المخصصة لأصحاب المحلات والأنشطة التجارية في المملكة العربية السعودية لتحسين الظهور في خرائط Google بحزمة واجهات تفاعلية للمناسبات الوطنية والدينية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-theme-main text-slate-100 selection:bg-amber-500 selection:text-slate-950 transition-colors duration-500">
        <AdminProvider>
          <AppProvider>
            <OccasionProvider>
              <OccasionBanner />
              <OccasionParticleCanvas />
              {children}
              <OccasionFloatingButton />
              <OccasionShowcaseModal />
              <Toast />
            </OccasionProvider>
          </AppProvider>
        </AdminProvider>
      </body>
    </html>
  );
}
