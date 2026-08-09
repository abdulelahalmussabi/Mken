import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") || "";

  // Handle subdomain mapping (e.g. demo.mken.live, almahrusa.mken.live)
  if (hostname.includes("mken.live")) {
    const subdomain = hostname.split(".")[0]?.toLowerCase();
    
    if (subdomain && subdomain !== "mken" && subdomain !== "www") {
      // If user accesses root of subdomain (e.g. demo.mken.live or almahrusa.mken.live)
      if (url.pathname === "/") {
        url.pathname = `/subscriber/${subdomain}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // Handle /book.html or /almahrusa directly
  if (url.pathname === "/book.html") {
    url.pathname = "/book";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/almahrusa") {
    url.pathname = "/subscriber/almahrusa";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/demo") {
    url.pathname = "/subscriber/demo";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
