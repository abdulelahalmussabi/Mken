import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MagicPreviewForm from "@/components/MagicPreviewForm";
import { noIndexRobots } from "@/lib/mken/seo";

export const metadata: Metadata = {
  title: "معاينة فورية بموافقة المالك | مكّن",
  description:
    "أنشئ معاينة غير مفهرسة لموقع نشاطك من رابط خرائط جوجل بموافقتك الصريحة. لا كشط لواتساب ولا حفظ لمراجعات جوجل.",
  robots: noIndexRobots,
};

export default function PreviewPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
          <MagicPreviewForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
