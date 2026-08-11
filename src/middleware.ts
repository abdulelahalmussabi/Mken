import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") || "";

  // Extract subdomain if present (e.g. demo.mken.live, almahrusa.mken.live)
  let subdomain: string | null = null;
  if (hostname.includes("mken.live")) {
    const parts = hostname.split(".");
    if (parts.length > 2 && parts[0] !== "www" && parts[0] !== "admin" && parts[0] !== "mken") {
      subdomain = parts[0].toLowerCase();
    }
  }

  // Redirect /admin.html, /admin, or /auth to /admin/login
  if (url.pathname === "/admin.html" || url.pathname === "/admin" || url.pathname === "/auth") {
    url.pathname = "/admin/login";
    if (subdomain) {
      url.searchParams.set("client", subdomain);
    }
    return NextResponse.redirect(url);
  }

  if (subdomain && url.pathname === "/") {
    url.pathname = `/subscriber/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // Handle /book.html
  if (url.pathname === "/book.html") {
    url.pathname = "/book";
    return NextResponse.rewrite(url);
  }

  // Handle direct slug shortcuts
  if (url.pathname === "/almahrusa") {
    url.pathname = "/subscriber/almahrusa";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/demo") {
    url.pathname = "/subscriber/demo";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/almasabi") {
    url.pathname = "/subscriber/almasabi";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
