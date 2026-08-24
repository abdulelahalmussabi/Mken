import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "mkn_admin_session";

const SKIP_SUBDOMAINS = new Set([
  "www",
  "admin",
  "mken",
  "license",
  "licenses",
  "api",
]);

function tenantSubdomain(hostname: string): string | null {
  if (!hostname.includes("mken.live")) return null;
  const host = hostname.split(":")[0].toLowerCase();
  const parts = host.split(".");
  if (parts.length <= 2) return null;
  let head = parts[0];
  // www.almasabi.mken.live is a nested host; *.mken.live does not cover it.
  if (head === "www" && parts.length >= 4) head = parts[1];
  if (SKIP_SUBDOMAINS.has(head)) return null;
  return head;
}

/** www.{tenant}.mken.live is not on the wildcard cert — send browsers to {tenant}.mken.live. */
function nestedWwwTenant(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  const match = host.match(/^www\.([a-z0-9-]+)\.mken\.live$/);
  if (!match) return null;
  const slug = match[1];
  if (SKIP_SUBDOMAINS.has(slug)) return null;
  return slug;
}

function hasAdminCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
}

/**
 * Next 16 request gate. HMAC cookies protect `/admin` and `/staff` only.
 * `/dashboard` and `/login` are a different identity (P-07) — do not require
 * `mkn_admin_session` there.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") || "";
  const nestedWww = nestedWwwTenant(hostname);
  if (nestedWww) {
    const dest = new URL(request.url);
    dest.hostname = `${nestedWww}.mken.live`;
    dest.protocol = "https:";
    dest.port = "";
    return NextResponse.redirect(dest, 308);
  }
  const { pathname } = url;
  const subdomain = tenantSubdomain(hostname);

  if (pathname === "/admin.html") {
    url.pathname = url.searchParams.has("google_connect") ? "/admin/settings" : "/admin";
    if (subdomain) url.searchParams.set("client", subdomain);
    return NextResponse.redirect(url);
  }

  const STAFF_COOKIE = "mkn_staff_session";

  const isStaffLogin = pathname === "/staff/login" || pathname.startsWith("/staff/login/");
  const isStaffPage = pathname === "/staff" || pathname.startsWith("/staff/");
  const isStaffMeApi = pathname.startsWith("/api/staff/me/");

  if ((isStaffPage && !isStaffLogin) || isStaffMeApi) {
    if (!request.cookies.get(STAFF_COOKIE)?.value) {
      if (isStaffMeApi) {
        return NextResponse.json(
          { success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/staff/login", request.url);
      if (subdomain) loginUrl.searchParams.set("tenant", subdomain);
      return NextResponse.redirect(loginUrl);
    }
  }
  const isAdminLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const isAdminApiLogin = pathname === "/api/admin/login";
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  if ((isAdminPage && !isAdminLogin) || (isAdminApi && !isAdminApiLogin)) {
    if (!hasAdminCookie(request)) {
      if (isAdminApi) {
        return NextResponse.json(
          { success: false, message: "الجلسة منتهية، يرجى تسجيل الدخول" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      request.nextUrl.searchParams.forEach((value, key) => {
        if (!loginUrl.searchParams.has(key)) loginUrl.searchParams.set(key, value);
      });
      if (subdomain) loginUrl.searchParams.set("client", subdomain);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (subdomain && pathname === "/") {
    url.pathname = `/subscriber/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/book.html") {
    url.pathname = "/book";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/almahrusa") {
    url.pathname = "/subscriber/almahrusa";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/demo") {
    url.pathname = "/subscriber/demo";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
