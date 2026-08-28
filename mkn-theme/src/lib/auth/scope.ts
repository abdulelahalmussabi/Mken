import { readAdminSession, type AdminSession } from "@/lib/auth/session";
import { CROSS_TENANT_HOST, resolveBoundTenant } from "@/lib/mken/bound-host";

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
    if (session.role === "client" && session.clientSlug && session.clientSlug !== bound) {
      return { status: 403, message: CROSS_TENANT_HOST };
    }
    return { slug: bound, session };
  }

  if (session.role === "client") {
    if (!session.clientSlug) return { status: 403, message: "الحساب غير مرتبط بمنشأة" };
    return { slug: session.clientSlug, session };
  }

  const requested = new URL(request.url).searchParams.get("client");
  if (!requested) return { status: 400, message: "اختر المنشأة أولاً" };
  return { slug: requested.toLowerCase(), session };
}
