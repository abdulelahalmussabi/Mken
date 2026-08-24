import { readAdminSession, type AdminSession } from "@/lib/auth/session";

/**
 * Resolves which tenant an admin request operates on: a client admin is locked
 * to its own tenant, a super admin must name one via `?client=`.
 */
export async function resolveTenantScope(
  request: Request
): Promise<{ slug?: string; session?: AdminSession; status?: number; message?: string }> {
  const session = await readAdminSession();
  if (!session) return { status: 401, message: "الجلسة منتهية، يرجى تسجيل الدخول" };

  if (session.role === "client") {
    if (!session.clientSlug) return { status: 403, message: "الحساب غير مرتبط بمنشأة" };
    return { slug: session.clientSlug, session };
  }

  const requested = new URL(request.url).searchParams.get("client");
  if (!requested) return { status: 400, message: "اختر المنشأة أولاً" };
  return { slug: requested.toLowerCase(), session };
}
