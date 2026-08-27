import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Known custom domain map for instant zero-latency edge lookup
 */
export const KNOWN_CUSTOM_DOMAINS: Record<string, string> = {
  "rewa.care": "rewa",
  "www.rewa.care": "rewa",
  "rewa.cre": "rewa",
  "www.rewa.cre": "rewa",
  "almahrusa.mken.live": "almahrusa",
  "almasabi.mken.live": "almasabi",
  "demo.mken.live": "demo",
};

/**
 * Extract tenant slug from hostname or query parameters
 */
export function extractTenantSlug(hostname: string): string | null {
  const host = (hostname || "").toLowerCase().split(":")[0];

  // 1. Direct custom domains lookup
  if (KNOWN_CUSTOM_DOMAINS[host]) {
    return KNOWN_CUSTOM_DOMAINS[host];
  }

  if (host.endsWith(".rewa.care") || host.endsWith(".rewa.cre")) {
    return "rewa";
  }

  // 2. Subdomains on mken.live or localhost or vercel.app
  if (host.includes("mken.live") || host.includes("localhost") || host.includes("vercel.app")) {
    const parts = host.split(".");
    if (parts.length > 2) {
      const sub = parts[0].toLowerCase();
      const reserved = ["www", "admin", "mken", "api", "app", "dashboard", "cname"];
      if (!reserved.includes(sub)) {
        return sub;
      }
    }
  }

  return null;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host") || "";

  // Extract tenant slug
  const tenantSlug = extractTenantSlug(hostname);

  // Prepare custom request headers to pass tenant info downstream
  const requestHeaders = new Headers(request.headers);
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
    requestHeaders.set("x-is-tenant-domain", "true");
  }

  // 1. Handle /admin.html or /auth redirects
  if (url.pathname === "/admin.html" || url.pathname === "/auth") {
    url.pathname = "/admin/login";
    if (tenantSlug) {
      url.searchParams.set("client", tenantSlug);
    }
    return NextResponse.redirect(url);
  }

  // 2. STRICT TENANT DOMAIN ISOLATION (e.g. rewa.care, rewa.cre, rewa.mken.live)
  if (tenantSlug) {
    // A. Forbid cross-tenant shortcut access (e.g. rewa.care/almahrusa or rewa.care/almasabi)
    const crossTenantSlugs = ["almahrusa", "almasabi", "demo", "rewa"].filter((s) => s !== tenantSlug);
    for (const crossSlug of crossTenantSlugs) {
      if (url.pathname === `/${crossSlug}` || url.pathname === `/subscriber/${crossSlug}`) {
        // Strict boundary: redirect to this tenant's home page
        url.pathname = `/subscriber/${tenantSlug}`;
        return NextResponse.redirect(url);
      }
    }

    // B. Root page -> rewrite to this subscriber's page
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = `/subscriber/${tenantSlug}`;
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    // C. /admin or /admin/ on a tenant domain MUST rewrite to /admin/client
    // so tenant admins and staff NEVER see platform-wide Super Admin multi-tenant panels
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      url.pathname = "/admin/client";
      url.searchParams.set("client", tenantSlug);
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    // D. /admin/login on tenant domain -> lock client query param
    if (url.pathname === "/admin/login") {
      if (!url.searchParams.get("client")) {
        url.searchParams.set("client", tenantSlug);
        return NextResponse.rewrite(url, {
          request: { headers: requestHeaders },
        });
      }
    }

    // E. /book or /book.html -> ensure tenant query param is locked to this tenant
    if (url.pathname === "/book" || url.pathname === "/book.html") {
      url.pathname = "/book";
      url.searchParams.set("tenant", tenantSlug);
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    // F. /subscriber/{tenantSlug} -> direct access is allowed
    if (url.pathname === `/subscriber/${tenantSlug}`) {
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    // G. /subscriber/{other} on this tenant domain -> block and redirect to own subscriber page
    if (url.pathname.startsWith("/subscriber/")) {
      url.pathname = `/subscriber/${tenantSlug}`;
      return NextResponse.redirect(url);
    }
  }

  // 3. MAIN PLATFORM ROUTING (Without tenant domain: e.g. mken.live, localhost)
  // Handle /book.html without subdomain
  if (url.pathname === "/book.html") {
    url.pathname = "/book";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  // Handle direct slug shortcuts on main platform domain
  if (url.pathname === "/almahrusa") {
    url.pathname = "/subscriber/almahrusa";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  if (url.pathname === "/demo") {
    url.pathname = "/subscriber/demo";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  if (url.pathname === "/almasabi") {
    url.pathname = "/subscriber/almasabi";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  if (url.pathname === "/rewa") {
    url.pathname = "/subscriber/rewa";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
