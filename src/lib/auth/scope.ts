import { readAdminSession, type AdminSession } from "@/lib/auth/session";
import { CROSS_TENANT_HOST, resolveBoundTenant } from "@/lib/mken/bound-host";
import { canonicalTenantSlug } from "@/lib/mken/tenant-slug";

/**
 * Resolves which tenant an admin request operates on.
 * A bound custom domain / tenant subdomain always wins over `?client=` and
 * over a platform super-admin cookie.
 */
export async function resolveTenantScope(
  request: Request
): Promise<{ slug?: string; session?: AdminSession; status?: number; message?: string }> {
  const session = await readAdminSession();
  if (!session) return { status: 401, message: "الجلسة منتهية، يرجى تسجيل الدخول" };

  const bound = await resolveBoundTenant(request);
  if (bound) {
    const slug = canonicalTenantSlug(bound);
    if (session.role === "client" && session.clientSlug && canonicalTenantSlug(session.clientSlug) !== slug) {
      return { status: 403, message: CROSS_TENANT_HOST };
    }
    return { slug, session };
  }

  if (session.role === "client") {
    if (!session.clientSlug) return { status: 403, message: "الحساب غير مرتبط بمنشأة" };
    return { slug: canonicalTenantSlug(session.clientSlug), session };
  }

  const requested = new URL(request.url).searchParams.get("client");
  if (!requested) return { status: 400, message: "اختر المنشأة أولاً" };
  return { slug: canonicalTenantSlug(requested), session };
}
