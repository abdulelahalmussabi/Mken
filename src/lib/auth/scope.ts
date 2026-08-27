import { NextRequest } from "next/server";

export interface TenantScope {
  tenantSlug: string;
  isSuperAdmin: boolean;
  isAnon: boolean;
  isTenantDomain: boolean;
}

/**
 * Extract tenant slug from host header
 */
function extractTenantFromHost(host: string): string | null {
  const cleanHost = (host || "").toLowerCase().split(":")[0];
  if (
    cleanHost === "rewa.care" ||
    cleanHost.endsWith(".rewa.care") ||
    cleanHost === "rewa.cre" ||
    cleanHost.endsWith(".rewa.cre")
  ) {
    return "rewa";
  }
  if (cleanHost.includes("mken.live") || cleanHost.includes("localhost") || cleanHost.includes("vercel.app")) {
    const parts = cleanHost.split(".");
    if (parts.length > 2) {
      const sub = parts[0].toLowerCase();
      const reserved = ["www", "admin", "mken", "api", "app", "dashboard"];
      if (!reserved.includes(sub)) {
        return sub;
      }
    }
  }
  return null;
}

export function resolveTenantScope(req: Request | NextRequest): TenantScope {
  const url = new URL(req.url);
  
  // 1. Check request headers (injected by proxy/middleware)
  const headerTenant = req.headers.get("x-tenant-slug");
  const hostHeader = req.headers.get("host") || req.headers.get("x-forwarded-host") || "";
  const hostTenant = extractTenantFromHost(hostHeader);

  // 2. Check query parameter
  const queryTenant = url.searchParams.get("tenant_slug") || url.searchParams.get("slug") || url.searchParams.get("tenant") || url.searchParams.get("client");

  // Determine slug
  const tenantSlug = (headerTenant || hostTenant || queryTenant || "rewa").trim().toLowerCase();

  const isTenantDomain = !!(headerTenant || hostTenant || req.headers.get("x-is-tenant-domain") === "true");

  // On a tenant custom domain or subdomain, super admin is strictly disallowed to prevent cross-tenant leakage
  const adminRoleHeader = req.headers.get("x-admin-role");
  const isSuperAdmin = !isTenantDomain && adminRoleHeader === "super";

  const isAnon = !req.headers.get("authorization") && !req.headers.get("cookie");

  return {
    tenantSlug,
    isSuperAdmin,
    isAnon,
    isTenantDomain,
  };
}

