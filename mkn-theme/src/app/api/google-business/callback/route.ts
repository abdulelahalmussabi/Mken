import { NextResponse } from "next/server";
import { completeGbpOAuth } from "@/lib/mken/gbp";

function settingsRedirect(request: Request, slug: string, status: "success" | "error", message = ""): NextResponse {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const origin = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || "https://www.mken.live").replace(/\/$/, "");
  const url = new URL("/admin/settings", origin.replace("://mken.live", "://www.mken.live"));
  if (slug) url.searchParams.set("client", slug);
  url.searchParams.set("google_connect", status);
  if (message) url.searchParams.set("error_desc", message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = (params.get("state") || "").trim().toLowerCase();
  const error = params.get("error");
  const code = params.get("code") || "";
  if (error) {
    return settingsRedirect(request, slug, "error", error);
  }
  if (!slug) {
    return settingsRedirect(request, "", "error", "حالة الربط ناقصة");
  }
  if (!code) {
    return settingsRedirect(request, slug, "error", "رمز الربط ناقص");
  }
  const result = await completeGbpOAuth(slug, code);
  if (result.error) {
    return settingsRedirect(request, slug, "error", result.error);
  }
  return settingsRedirect(request, slug, "success");
}
