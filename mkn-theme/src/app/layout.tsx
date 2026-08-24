import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
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
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_NAME,
  siteMetadataBase,
} from "@/lib/mken/seo";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title: {
    default: SITE_DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "مكّن",
    "Local SEO",
    "خرائط Google",
    "محلات السعودية",
    "ظهور محلي",
    "مناسبات سعودية",
  ],
  authors: [{ name: SITE_NAME, url: "https://mken.live" }],
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: SITE_NAME,
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-theme-main text-slate-100 selection:bg-amber-500 selection:text-slate-950 transition-colors duration-500">
        <Script id="mken-kill-legacy-sw" strategy="beforeInteractive">
          {`(function(){if(!("serviceWorker"in navigator))return;navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()});});if(window.caches){caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})})}})();`}
        </Script>
        <AdminProvider>
          <AppProvider>
            <Suspense fallback={null}>
              <OccasionProvider>
                <OccasionBanner />
                <OccasionParticleCanvas />
                {children}
                <OccasionFloatingButton />
                <OccasionShowcaseModal />
                <Toast />
              </OccasionProvider>
            </Suspense>
          </AppProvider>
        </AdminProvider>
      </body>
    </html>
  );
}
