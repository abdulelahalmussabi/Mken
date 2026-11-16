import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الباقات والأسعار",
  description:
    "ثلاث باقات لمكّن: امتثال ونمو واحترافي — أسعار شهرية وسنوية واضحة مع شهرين مجاناً على السنوي.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "باقات مكّن والأسعار",
    description: "قارن الامتثال والنمو والاحترافي شهرياً أو سنوياً.",
    url: "/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
