/** Hostnames that map to a tenant without a DB row. Safe for client + server. */
export const KNOWN_CUSTOM_HOSTS: Record<string, string> = {
  "rewa.care": "rewa",
  "www.rewa.care": "rewa",
};

const SKIP_SUBDOMAINS = new Set(["www", "admin", "mken", "license", "licenses", "api"]);

export function hostnameFromHostHeader(value: string): string {
  return value.split(",")[0]?.trim().split(":")[0].toLowerCase() || "";
}

export function hostnameFromHeaders(headers: { get(name: string): string | null }): string {
  return hostnameFromHostHeader(headers.get("x-forwarded-host") || headers.get("host") || "");
}

/** Apex / preview hosts where platform super-admin is allowed. */
export function isPlatformHostname(hostname: string): boolean {
  const host = hostnameFromHostHeader(hostname);
  return (
    host === "mken.live" ||
    host === "www.mken.live" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".vercel.app")
  );
}

export function slugFromCustomHostname(hostname: string): string | null {
  const host = hostnameFromHostHeader(hostname);
  return KNOWN_CUSTOM_HOSTS[host] || null;
}

/** `{slug}.mken.live` (and `www.{slug}.mken.live`) → slug. Never the platform apex. */
export function tenantSlugFromSubdomain(hostname: string): string | null {
  const host = hostnameFromHostHeader(hostname);
  if (host === "mken.live" || host === "www.mken.live") return null;
  if (!host.endsWith(".mken.live")) return null;
  const parts = host.slice(0, -".mken.live".length).split(".");
  let head = parts[0] || "";
  if (head === "www" && parts.length >= 2) head = parts[1];
  if (!head || SKIP_SUBDOMAINS.has(head)) return null;
  return head;
}

/**
 * Sync bound tenant for a host: custom domain map or tenant subdomain.
 * Unknown custom domains need the DB lookup in `resolveBoundTenantFromHostname`.
 */
export function boundTenantFromHostname(hostname: string): string | null {
  const host = hostnameFromHostHeader(hostname);
  if (!host || isPlatformHostname(host)) return null;
  return slugFromCustomHostname(host) || tenantSlugFromSubdomain(host);
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
    url.pathname = `/subscriber/${slug}${url.pathname.slice(subscriber[0].length)}`;
  }
  const store = url.pathname.match(STORE_PATH);
  if (store && store[1].toLowerCase() !== slug) {
    url.pathname = `/store/${slug}${url.pathname.slice(store[0].length)}`;
  }

  for (const key of TENANT_QUERY_KEYS) {
    const value = url.searchParams.get(key);
    if (value && value.toLowerCase() !== slug) {
      url.searchParams.set(key, slug);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
