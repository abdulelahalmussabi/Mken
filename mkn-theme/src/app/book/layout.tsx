import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حجز موعد أو استشارة",
  description: "احجز موعداً لدى منشأتك أو استشارة تشغيل عبر منصة مكّن في السعودية.",
  alternates: { canonical: "/book" },
  openGraph: {
    title: "حجز موعد أو استشارة",
    description: "احجز موعداً لدى منشأتك أو استشارة تشغيل عبر منصة مكّن في السعودية.",
    url: "/book",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
