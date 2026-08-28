import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveBoundTenantFromHostname } from "@/lib/mken/bound-host";
import { attachUnclaimedRobotsHeader } from "@/lib/mken/preview";

const ADMIN_COOKIE = "mkn_admin_session";

const SHORT_TENANT_ALIASES = new Set(["almahrusa", "demo", "almasabi", "rewa"]);
const SKIP_NESTED_WWW = new Set(["www", "admin", "mken", "license", "licenses", "api"]);
const PLATFORM_ADMIN_PATHS = new Set(["/admin", "/admin/", "/admin/licenses"]);

/** www.{tenant}.mken.live is not on the wildcard cert — send browsers to {tenant}.mken.live. */
function nestedWwwTenant(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  const match = host.match(/^www\.([a-z0-9-]+)\.mken\.live$/);
  if (!match) return null;
  const slug = match[1];
  if (SKIP_NESTED_WWW.has(slug)) return null;
  return slug;
}

function hasAdminCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(ADMIN_COOKIE)?.value);
}

/** A bound host (custom domain or tenant subdomain) must never render another tenant. */
function lockBoundTenant(url: URL, pathname: string, tenant: string): NextResponse | null {
  const subscriber = pathname.match(/^\/subscriber\/([^/]+)/i);
  if (subscriber && subscriber[1].toLowerCase() !== tenant) {
    url.pathname = `/subscriber/${tenant}${pathname.slice(subscriber[0].length)}`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  const store = pathname.match(/^\/store\/([^/]+)/i);
  if (store && store[1].toLowerCase() !== tenant) {
    url.pathname = `/store/${tenant}`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/book" || pathname === "/book.html") {
    const requested = (
      url.searchParams.get("tenant") ||
      url.searchParams.get("store") ||
      url.searchParams.get("client") ||
      ""
    ).toLowerCase();
    if (requested && requested !== tenant) {
      url.searchParams.set("tenant", tenant);
      url.searchParams.delete("store");
      url.searchParams.delete("client");
      return NextResponse.redirect(url);
    }
  }
  const alias = pathname.replace(/^\//, "").toLowerCase();
  if (SHORT_TENANT_ALIASES.has(alias) && alias !== tenant) {
    url.pathname = `/subscriber/${tenant}`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  for (const key of ["tenant", "store", "client"] as const) {
    const value = url.searchParams.get(key);
    if (value && value.toLowerCase() !== tenant) {
      url.searchParams.set(key, tenant);
      return NextResponse.redirect(url);
    }
  }
  return null;
}

/**
 * Next 16 request gate. HMAC cookies protect `/admin` and `/staff` only.
 * `/dashboard` and `/login` are a different identity (P-07) — do not require
 * `mkn_admin_session` there.
 */
export async function proxy(request: NextRequest) {
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
  const tenant = await resolveBoundTenantFromHostname(hostname);

  if (tenant) {
    const locked = lockBoundTenant(url, pathname, tenant);
    if (locked) return locked;
    if (PLATFORM_ADMIN_PATHS.has(pathname) || pathname.startsWith("/admin/licenses/")) {
      url.pathname = "/admin/client";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/admin.html") {
    url.pathname = url.searchParams.has("google_connect")
      ? "/admin/settings"
      : tenant
        ? "/admin/client"
        : "/admin";
    if (tenant) url.searchParams.set("client", tenant);
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
      if (tenant) loginUrl.searchParams.set("tenant", tenant);
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
      if (tenant) loginUrl.searchParams.set("client", tenant);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (tenant && pathname === "/") {
    url.pathname = `/subscriber/${tenant}`;
    return attachUnclaimedRobotsHeader(NextResponse.rewrite(url), tenant);
  }

  const tenantSitePage = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (tenant && /^(about|services|work|contact)$/.test(tenantSitePage)) {
    url.pathname = `/subscriber/${tenant}/${tenantSitePage}`;
    return attachUnclaimedRobotsHeader(NextResponse.rewrite(url), tenant);
  }

  if (tenant && (pathname === "/book" || pathname === "/book.html") && !url.searchParams.has("tenant")) {
    url.searchParams.set("tenant", tenant);
    return attachUnclaimedRobotsHeader(NextResponse.rewrite(url), tenant);
  }

  if (tenant && (pathname === "/store" || pathname === "/store.html")) {
    url.pathname = `/store/${tenant}`;
    return attachUnclaimedRobotsHeader(NextResponse.rewrite(url), tenant);
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

  if (pathname === "/almasabi") {
    url.pathname = "/subscriber/almasabi";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/rewa") {
    url.pathname = "/subscriber/rewa";
    return NextResponse.rewrite(url);
  }

  const next = NextResponse.next();
  return tenant ? attachUnclaimedRobotsHeader(next, tenant) : next;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
