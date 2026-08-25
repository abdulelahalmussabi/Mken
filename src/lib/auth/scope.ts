import { NextRequest } from "next/server";

export interface TenantScope {
  tenantSlug: string;
  isSuperAdmin: boolean;
  isAnon: boolean;
}

export function resolveTenantScope(req: Request | NextRequest): TenantScope {
  const url = new URL(req.url);
  
  // 1. Check query parameter
  const queryTenant = url.searchParams.get("tenant_slug") || url.searchParams.get("slug");

  // 2. Check request headers
  const headerTenant = req.headers.get("x-tenant-slug");
  const adminRoleHeader = req.headers.get("x-admin-role");

  // Determine slug
  const tenantSlug = (queryTenant || headerTenant || "almahrusa").trim().toLowerCase();
  const isSuperAdmin = adminRoleHeader === "super";
  const isAnon = !req.headers.get("authorization") && !req.headers.get("cookie");

  return {
    tenantSlug,
    isSuperAdmin,
    isAnon,
  };
}
