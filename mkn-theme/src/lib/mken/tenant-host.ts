/** Hostnames that map to a tenant without a DB row. Safe for client + server. */
export const KNOWN_CUSTOM_HOSTS: Record<string, string> = {
  "rewa.care": "rewa",
  "www.rewa.care": "rewa",
};

export function slugFromCustomHostname(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  return KNOWN_CUSTOM_HOSTS[host] || null;
}

const SUBSCRIBER_PATH = /^\/subscriber\/([^/]+)/i;
const STORE_PATH = /^\/store\/([^/]+)/i;
const TENANT_QUERY_KEYS = ["tenant", "store", "client"] as const;

/**
 * Keep ad/CTA URLs inside the current tenant. Cross-tenant `/subscriber/*`
 * and `?tenant=` values are rewritten to `tenantSlug`.
 */
export function isolateTenantHref(href: string, tenantSlug: string): string {
  const slug = tenantSlug.trim().toLowerCase();
  const raw = (href || "").trim();
  if (!slug) return raw || "/";
  if (!raw) return `/subscriber/${slug}`;

  const absolute = /^https?:\/\//i.test(raw);
  let url: URL;
  try {
    url = absolute ? new URL(raw) : new URL(raw, "https://mken.invalid");
  } catch {
    return `/subscriber/${slug}`;
  }

  const subscriber = url.pathname.match(SUBSCRIBER_PATH);
  if (subscriber && subscriber[1].toLowerCase() !== slug) {
    url.pathname = `/subscriber/${slug}`;
  }
  const store = url.pathname.match(STORE_PATH);
  if (store && store[1].toLowerCase() !== slug) {
    url.pathname = `/store/${slug}`;
  }

  for (const key of TENANT_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value && value.toLowerCase() !== slug) {
      url.searchParams.set(key, slug);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
