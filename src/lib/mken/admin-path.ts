export function isAdminPathname(pathname: string | null | undefined): boolean {
  const path = (pathname || "").split("?")[0];
  return path === "/admin" || path.startsWith("/admin/");
}
