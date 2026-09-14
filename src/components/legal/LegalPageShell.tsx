import Link from "next/link";
import type { Route } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const legalHtmlClass =
  "legal-html max-w-3xl mx-auto px-4 py-10 sm:py-14 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:mb-4 [&_h1]:leading-snug [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-amber-700 dark:[&_h3]:text-amber-400 [&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-muted [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:mb-3 [&_li]:mb-1.5 [&_li]:text-muted [&_a]:text-amber-700 dark:[&_a]:text-amber-400 [&_a]:underline [&_hr]:my-12 [&_hr]:border-line [&_code]:font-mono [&_code]:text-sm [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_.lp-legal__kicker]:text-sm [&_.lp-legal__kicker]:text-muted [&_.lp-legal__kicker]:mb-2";

export default function LegalPageShell({ html }: { html: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <nav className="border-b border-line text-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 text-muted">
          <a href="#ar" className="hover:text-amber-600">
            العربية
          </a>
          <a href="#en" className="hover:text-amber-600">
            English
          </a>
          <Link href={"/privacy" as Route} className="hover:text-amber-600">
            سياسة الخصوصية
          </Link>
          <Link href={"/terms" as Route} className="hover:text-amber-600">
            شروط الخدمة
          </Link>
        </div>
      </nav>
      <main className="flex-1 w-full">
        <div className={legalHtmlClass} dangerouslySetInnerHTML={{ __html: html }} />
      </main>
      <Footer />
    </div>
  );
}
