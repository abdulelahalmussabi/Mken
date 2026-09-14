import { getTenantDb, fetchTenantRow } from "@/lib/mken/tenant";
import { saasFeaturesFromConfig } from "@/lib/mken/saas";

export const DOMAINS_TABLE = "mken_tenant_domains";

export type DomainStatus = "pending_dns" | "verified" | "active" | "suspended";

export interface TenantDomain {
  id: string;
  tenant_slug: string;
  hostname: string;
  status: DomainStatus;
  vercel_verified: boolean;
  ssl_ready: boolean;
  verification: unknown;
  dns_records: DnsRecord[];
  expires_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  hint: string;
}

const BLOCKED_SUFFIXES = [".mken.live", ".vercel.app", ".localhost"];
const BLOCKED_EXACT = new Set(["mken.live", "www.mken.live", "localhost", "127.0.0.1"]);

export function normalizeHostname(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  host = host.split(":")[0];
  if (!host || BLOCKED_EXACT.has(host)) return null;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null;
  if (host.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  return host;
}

export function dnsInstructions(hostname: string): DnsRecord[] {
  const parts = hostname.split(".");
  const isApex = parts.length === 2;
  if (isApex) {
    return [
      {
        type: "A",
        name: "@",
        value: "76.76.21.21",
        hint: "سجّل A للنطاق الجذر (بدون www)",
      },
      {
        type: "CNAME",
        name: "www",
        value: "cname.vercel-dns.com",
        hint: "وجّه www إلى Vercel",
      },
    ];
  }
  return [
    {
      type: "CNAME",
      name: parts[0],
      value: "cname.vercel-dns.com",
      hint: "سجّل CNAME للساب دومين لدى مزوّد DNS",
    },
  ];
}

export function tenantHasCustomDomainAddon(
  config: { subscription?: { customFeatures?: { hasCustomDomain?: boolean } } } | null | undefined,
  opts: { superAdmin?: boolean } = {}
): boolean {
  if (opts.superAdmin) return true;
  return !!config?.subscription?.customFeatures?.hasCustomDomain;
}

export async function assertCustomDomainEntitled(
  slug: string,
  superAdmin: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (superAdmin) return { ok: true };
  const row = await fetchTenantRow(slug);
  if (!row) return { ok: false, message: "المنشأة غير موجودة" };
  const features = saasFeaturesFromConfig(row.config_data, { slug });
  if (!features.hasCustomDomain && !tenantHasCustomDomainAddon(row.config_data)) {
    return { ok: false, message: "الدومين الخاص غير مفعّل في خيارات الاشتراك" };
  }
  const end = row.subscription_end ? new Date(row.subscription_end) : null;
  if (end && end.getTime() < Date.now()) {
    return { ok: false, message: "الاشتراك منتهٍ — جدّد الاشتراك قبل ربط النطاق" };
  }
  return { ok: true };
}

export async function listTenantDomains(slug: string): Promise<TenantDomain[]> {
  const db = getTenantDb();
  if (!db) return [];
  const { data, error } = await db
    .from(DOMAINS_TABLE)
    .select("*")
    .eq("tenant_slug", slug)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as TenantDomain[];
}

export async function activeHostnameForSlug(slug: string): Promise<string | null> {
  const db = getTenantDb();
  if (!db) return null;
  const { data } = await db
    .from(DOMAINS_TABLE)
    .select("hostname")
    .eq("tenant_slug", slug)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.hostname || null;
}

export async function tenantWebsiteUrl(slug: string): Promise<string> {
  const custom = await activeHostnameForSlug(slug);
  if (custom) return `https://${custom}/`;
  return `https://${slug}.mken.live/`;
}

const hostCache = new Map<string, { slug: string; exp: number }>();
const HOST_CACHE_MS = 30_000;

export async function resolveActiveCustomHost(hostname: string): Promise<string | null> {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  const cached = hostCache.get(host);
  if (cached && cached.exp > Date.now()) return cached.slug;

  const db = getTenantDb();
  if (!db) return null;
  const { data } = await db
    .from(DOMAINS_TABLE)
    .select("tenant_slug")
    .eq("hostname", host)
    .eq("status", "active")
    .maybeSingle();
  const slug = data?.tenant_slug || null;
  if (slug) hostCache.set(host, { slug, exp: Date.now() + HOST_CACHE_MS });
  return slug;
}

export function invalidateHostCache(hostname?: string): void {
  if (hostname) hostCache.delete(hostname);
  else hostCache.clear();
}

function vercelAuth(): { token: string; projectId: string; teamId: string } | null {
  const token = (process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || "").trim();
  const projectId = (process.env.VERCEL_PROJECT_ID || "").trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: (process.env.VERCEL_TEAM_ID || "").trim() };
}

function vercelUrl(path: string, teamId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return teamId
    ? `https://api.vercel.com${path}${sep}teamId=${encodeURIComponent(teamId)}`
    : `https://api.vercel.com${path}`;
}

export async function vercelAddDomain(hostname: string): Promise<{
  verified: boolean;
  verification: unknown;
  error?: string;
  skipped?: boolean;
}> {
  const auth = vercelAuth();
  if (!auth) return { verified: false, verification: null, skipped: true };

  const res = await fetch(vercelUrl(`/v10/projects/${auth.projectId}/domains`, auth.teamId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: hostname }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    verification?: unknown;
    error?: { message?: string; code?: string };
  };
  if (!res.ok && res.status !== 409) {
    return { verified: false, verification: null, error: body.error?.message || "فشل إضافة النطاق في Vercel" };
  }
  return { verified: !!body.verified, verification: body.verification || null };
}

export async function vercelVerifyDomain(hostname: string): Promise<{
  verified: boolean;
  sslReady: boolean;
  error?: string;
  skipped?: boolean;
}> {
  const auth = vercelAuth();
  if (!auth) return { verified: false, sslReady: false, skipped: true };

  await fetch(
    vercelUrl(`/v9/projects/${auth.projectId}/domains/${encodeURIComponent(hostname)}/verify`, auth.teamId),
    { method: "POST", headers: { Authorization: `Bearer ${auth.token}` } }
  );

  const configRes = await fetch(vercelUrl(`/v6/domains/${encodeURIComponent(hostname)}/config`, auth.teamId), {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const config = (await configRes.json().catch(() => ({}))) as { misconfigured?: boolean };
  const sslReady = configRes.ok && config.misconfigured === false;
  return { verified: sslReady, sslReady };
}

export async function vercelRemoveDomain(hostname: string): Promise<void> {
  const auth = vercelAuth();
  if (!auth) return;
  await fetch(
    vercelUrl(`/v9/projects/${auth.projectId}/domains/${encodeURIComponent(hostname)}`, auth.teamId),
    { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } }
  );
}

export async function expiryForSlug(slug: string): Promise<string | null> {
  const row = await fetchTenantRow(slug);
  if (row?.subscription_end) return row.subscription_end;
  const inYear = new Date();
  inYear.setFullYear(inYear.getFullYear() + 1);
  return inYear.toISOString();
}

async function insertDomainRow(input: {
  slug: string;
  hostname: string;
  createdBy: string;
  expires_at: string;
}): Promise<{ domain?: TenantDomain; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة — نفّذ db/tenant-custom-domains-schema.sql" };

  const dns_records = dnsInstructions(input.hostname);
  const vercel = await vercelAddDomain(input.hostname);
  if (vercel.error) return { error: vercel.error };

  const status: DomainStatus = vercel.verified ? "verified" : "pending_dns";

  const { data, error } = await db
    .from(DOMAINS_TABLE)
    .insert({
      tenant_slug: input.slug,
      hostname: input.hostname,
      status,
      vercel_verified: !!vercel.verified,
      ssl_ready: false,
      verification: vercel.verification,
      dns_records,
      expires_at: input.expires_at,
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "هذا النطاق مربوط بمنشأة أخرى" };
    if (error.message?.includes("mken_tenant_domains") || error.code === "42P01") {
      return { error: "جدول النطاقات غير موجود — نفّذ db/tenant-custom-domains-schema.sql في Supabase" };
    }
    return { error: error.message };
  }
  return { domain: data as TenantDomain };
}

export async function insertDomain(input: {
  slug: string;
  hostname: string;
  createdBy: string;
}): Promise<{ domain?: TenantDomain; error?: string; paired?: TenantDomain | null }> {
  const existing = await listTenantDomains(input.slug);
  const live = existing.filter((d) => d.status !== "suspended");
  const parts = input.hostname.split(".");
  const isApex = parts.length === 2;
  const wwwHost = isApex ? `www.${input.hostname}` : null;
  const slotsNeeded = isApex && wwwHost && !live.some((d) => d.hostname === wwwHost) ? 2 : 1;

  if (live.length + slotsNeeded > 2) {
    return { error: "حد أقصى نطاقان لكل منشأة (الجذر و www)" };
  }

  const expires_at = (await expiryForSlug(input.slug)) || new Date().toISOString();
  const primary = await insertDomainRow({
    slug: input.slug,
    hostname: input.hostname,
    createdBy: input.createdBy,
    expires_at,
  });
  if (primary.error || !primary.domain) return primary;

  if (!wwwHost || live.some((d) => d.hostname === wwwHost)) {
    return primary;
  }

  const paired = await insertDomainRow({
    slug: input.slug,
    hostname: wwwHost,
    createdBy: input.createdBy,
    expires_at,
  });
  if (paired.error) {
    return { ...primary, paired: null };
  }
  return { ...primary, paired: paired.domain || null };
}

export async function refreshDomain(id: string, slug: string): Promise<{ domain?: TenantDomain; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة" };

  const { data: row } = await db
    .from(DOMAINS_TABLE)
    .select("*")
    .eq("id", id)
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (!row) return { error: "النطاق غير موجود" };

  const check = await vercelVerifyDomain(row.hostname);
  let status: DomainStatus = row.status;
  if (check.sslReady) status = "active";
  else if (check.verified) status = "verified";
  else if (row.status !== "suspended") status = "pending_dns";

  const { data, error } = await db
    .from(DOMAINS_TABLE)
    .update({
      status,
      vercel_verified: check.verified || check.sslReady,
      ssl_ready: check.sslReady,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  if (status === "active") invalidateHostCache(row.hostname);
  return { domain: data as TenantDomain };
}

export async function removeDomain(id: string, slug: string): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة" };
  const { data: row } = await db
    .from(DOMAINS_TABLE)
    .select("hostname")
    .eq("id", id)
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (!row) return { error: "النطاق غير موجود" };
  await vercelRemoveDomain(row.hostname);
  const { error } = await db.from(DOMAINS_TABLE).delete().eq("id", id).eq("tenant_slug", slug);
  invalidateHostCache(row.hostname);
  return error ? { error: error.message } : {};
}

export async function suspendExpiredDomains(): Promise<{ suspended: number; errors: string[] }> {
  const db = getTenantDb();
  if (!db) return { suspended: 0, errors: ["no_db"] };

  const now = new Date().toISOString();
  const { data: due } = await db
    .from(DOMAINS_TABLE)
    .select("id, hostname, tenant_slug, expires_at")
    .in("status", ["pending_dns", "verified", "active"]);

  const errors: string[] = [];
  let suspended = 0;
  for (const row of due || []) {
    const expired = row.expires_at && row.expires_at < now;
    const tenant = await fetchTenantRow(row.tenant_slug);
    const entitled = tenantHasCustomDomainAddon(tenant?.config_data);
    const subEnded = tenant?.subscription_end && tenant.subscription_end < now;
    if (!expired && entitled && !subEnded) continue;

    await vercelRemoveDomain(row.hostname);
    const { error } = await db
      .from(DOMAINS_TABLE)
      .update({ status: "suspended", ssl_ready: false, updated_at: now })
      .eq("id", row.id);
    if (error) errors.push(error.message);
    else {
      suspended += 1;
      invalidateHostCache(row.hostname);
    }
  }
  return { suspended, errors };
}
