import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حجز موعد",
  description: "احجز موعدك أونلاين عبر منصة مكّن للمنشآت المحلية في السعودية.",
  alternates: { canonical: "/book" },
  openGraph: {
    title: "حجز موعد",
    description: "احجز موعدك أونلاين عبر منصة مكّن للمنشآت المحلية في السعودية.",
    url: "/book",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
