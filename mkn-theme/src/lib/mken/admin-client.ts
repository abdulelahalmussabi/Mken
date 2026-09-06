const STORAGE_KEY = "mkn_admin_client";

export function readStoredAdminClient(): string {
  if (typeof window === "undefined") return "";
  try {
    return (sessionStorage.getItem(STORAGE_KEY) || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

export function writeStoredAdminClient(slug: string): void {
  if (typeof window === "undefined") return;
  const key = slug.trim().toLowerCase();
  if (!key) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveAdminClient(urlClient: string, known: string[]): string {
  const fromUrl = urlClient.trim().toLowerCase();
  if (fromUrl) return fromUrl;
  const stored = readStoredAdminClient();
  if (!stored) return "";
  if (!known.length) return stored;
  return known.some((slug) => slug.toLowerCase() === stored) ? stored : "";
}

const PLATFORM_ADMIN_PATHS = new Set(["/admin", "/admin/licenses"]);

export function withAdminClientHref(href: string, client: string): string {
  const slug = client.trim().toLowerCase();
  if (!slug) return href;
  const [pathAndQuery, hash] = href.split("#");
  const [path] = (pathAndQuery || "/").split("?");
  if (PLATFORM_ADMIN_PATHS.has(path) || path.startsWith("/admin/licenses/")) return href;
  if (!path.startsWith("/admin")) return href;
  const params = new URLSearchParams((pathAndQuery || "").split("?")[1] || "");
  params.set("client", slug);
  const next = `${path}?${params.toString()}`;
  return hash ? `${next}#${hash}` : next;
}
