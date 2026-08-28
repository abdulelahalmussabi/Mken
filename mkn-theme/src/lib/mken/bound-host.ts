import { resolveActiveCustomHost } from "@/lib/mken/custom-domain";
import {
  boundTenantFromHostname,
  hostnameFromHeaders,
  isPlatformHostname,
} from "@/lib/mken/tenant-host";

type AdminSessionLike = {
  email: string;
  role: "super" | "client";
  clientSlug?: string;
};

type StaffSessionLike = {
  tenantSlug: string;
};

export const CROSS_TENANT_HOST =
  "هذا النطاق مخصص لمنشأة أخرى. سجّل الدخول من نطاق منشأتك.";

export { hostnameFromHeaders };

export async function resolveBoundTenantFromHostname(hostname: string): Promise<string | null> {
  const sync = boundTenantFromHostname(hostname);
  if (sync) return sync;
  if (isPlatformHostname(hostname)) return null;
  return resolveActiveCustomHost(hostname);
}

export async function resolveBoundTenant(request: Request): Promise<string | null> {
  return resolveBoundTenantFromHostname(hostnameFromHeaders(request.headers));
}

/**
 * A custom domain / tenant subdomain never carries platform super-admin.
 * Foreign tenant cookies are dropped instead of rewritten.
 */
export function pinAdminSessionToBoundHost<T extends AdminSessionLike>(
  session: T | null,
  boundSlug: string | null
): T | null {
  if (!session) return null;
  if (!boundSlug) return session;
  if (session.role === "super") {
    return { ...session, role: "client", clientSlug: boundSlug };
  }
  const slug = (session.clientSlug || "").toLowerCase();
  if (slug && slug !== boundSlug) return null;
  return { ...session, role: "client", clientSlug: boundSlug };
}

export function pinStaffSessionToBoundHost<T extends StaffSessionLike>(
  session: T | null,
  boundSlug: string | null
): T | null {
  if (!session) return null;
  if (!boundSlug) return session;
  if (session.tenantSlug.toLowerCase() !== boundSlug) return null;
  return session;
}
