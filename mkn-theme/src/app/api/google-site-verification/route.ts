import { NextResponse } from "next/server";
import { googleHtmlVerificationResponse } from "@/lib/mken/google-html-verification";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return (
    googleHtmlVerificationResponse("/googleae07a7b850e5250d.html") ||
    new NextResponse("Not found", { status: 404 })
  );
}
