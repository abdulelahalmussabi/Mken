import { NextResponse } from "next/server";
import { completeGbpOAuth } from "@/lib/mken/gbp";
import { gbpReturnHost, parseGbpOAuthState } from "@/lib/mken/google-oauth";

function settingsRedirect(
  request: Request,
  slug: string,
  status: "success" | "error",
  message = "",
  returnHost = ""
): NextResponse {
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || (hostHeader.includes("localhost") ? "http" : "https");
  const host = gbpReturnHost(returnHost || hostHeader, slug);
  const origin = `${proto}://${host}`;
  const url = new URL("/admin/settings", origin);
  if (slug) url.searchParams.set("client", slug);
  url.searchParams.set("google_connect", status);
  if (message) url.searchParams.set("error_desc", message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = parseGbpOAuthState(params.get("state") || "");
  const slug = parsed.slug || "";
  const error = params.get("error");
  const code = params.get("code") || "";
  if (error) {
    return settingsRedirect(request, slug, "error", error, parsed.returnHost);
  }
  if (parsed.error || !slug) {
    return settingsRedirect(request, slug, "error", parsed.error || "حالة الربط ناقصة", parsed.returnHost);
  }
  if (!code) {
    return settingsRedirect(request, slug, "error", "رمز الربط ناقص", parsed.returnHost);
  }
  const result = await completeGbpOAuth(slug, code);
  if (result.error) {
    return settingsRedirect(request, slug, "error", result.error, parsed.returnHost);
  }
  return settingsRedirect(request, slug, "success", "", parsed.returnHost);
}
