import { NextResponse } from "next/server";

/** Exact Search Console HTML-file bodies. Do not wrap in markup or add a trailing newline. */
const FILES: Record<string, string> = {
  googleae07a7b850e5250d: "google-site-verification: googleae07a7b850e5250d.html",
};

export function googleHtmlVerificationBody(pathname: string): string | null {
  const match = pathname.trim().match(/^\/?(google[a-z0-9]+)(?:\.html)?$/i);
  if (!match) return null;
  return FILES[match[1].toLowerCase()] || null;
}

export function googleHtmlVerificationResponse(pathname: string): NextResponse | null {
  const body = googleHtmlVerificationBody(pathname);
  if (body == null) return null;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
