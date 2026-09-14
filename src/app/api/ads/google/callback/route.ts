import { NextResponse } from "next/server";
import { completeGoogleAdsOAuth, parseGoogleAdsOAuthState } from "@/lib/mken/google-ads";

function campaignsRedirect(request: Request, slug: string, google: string, message = ""): NextResponse {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const origin = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || "https://mken.live").replace(/\/$/, "");
  const url = new URL("/admin/ads/campaigns", origin);
  if (slug) url.searchParams.set("client", slug);
  url.searchParams.set("google", google);
  if (message) url.searchParams.set("googleMsg", message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const error = params.get("error");
  const code = params.get("code") || "";
  const parsed = parseGoogleAdsOAuthState(params.get("state") || "");
  if (error) {
    return campaignsRedirect(request, parsed.slug || "", "error", error);
  }
  if (parsed.error || !parsed.slug) {
    return campaignsRedirect(request, "", "error", parsed.error || "حالة الربط ناقصة");
  }
  if (!code) {
    return campaignsRedirect(request, parsed.slug, "error", "رمز الربط ناقص");
  }
  const result = await completeGoogleAdsOAuth(parsed.slug, code);
  if (result.error) {
    return campaignsRedirect(request, parsed.slug, "error", result.error);
  }
  const needsPick = (result.ads?.pendingAccounts.length || 0) > 0 || (result.ads?.customerId.length || 0) < 8;
  return campaignsRedirect(request, parsed.slug, needsPick ? "pick" : "ok");
}
