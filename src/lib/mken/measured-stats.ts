import { fetchTenants, getTenantDb } from "@/lib/mken/tenant";
import { isIndexableStorefront } from "@/lib/mken/seo";

export const MEASURED_WINDOW_DAYS = 30;
export const MEASURED_MIN_TENANTS = 3;

export type TenantMeasuredWindow = {
  qualified: boolean;
  spanDays: number;
  latestRank: number | null;
  top3Percentage: number | null;
  bookings: number;
  whatsappConversations: number;
  adConversations: number;
  adSpentHalalas: number;
  reasons: string[];
};

export type PlatformMeasuredStats = {
  ready: boolean;
  windowDays: number;
  requiredTenants: number;
  qualifiedTenants: number;
  indexableTenants: number;
  asOf: string;
  stats: {
    medianRank: number | null;
    medianTop3: number | null;
    avgBookings: number | null;
    avgWhatsapp: number | null;
    cplSar: number | null;
  } | null;
};

type ScanRow = {
  tenant_slug?: string | null;
  average_rank?: number | null;
  top3_percentage?: number | null;
  scanned_at?: string | null;
  raw_results?: unknown;
};

type CountRow = { tenant_slug?: string | null; phone?: string | null; created_at?: string | null };
type CampaignRow = {
  tenant_slug?: string | null;
  spent_halalas?: number | null;
  metrics?: { conversations?: number | null } | null;
  start_date?: string | null;
  created_at?: string | null;
};

let cache: { at: number; value: PlatformMeasuredStats } | null = null;
const CACHE_MS = 30 * 60 * 1000;

function missingTable(message: string): boolean {
  return /does not exist|42P01/i.test(message);
}

function sinceIso(days = MEASURED_WINDOW_DAYS): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function spanDaysFrom(createdAt: string | undefined): number {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

function isDataforseoRow(raw: unknown): boolean {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return (raw as { source?: string }).source !== "places_estimate";
  }
  return true;
}

function median(values: number[]): number | null {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 10) / 10;
}

function bump(map: Map<string, number>, slug: string, by = 1) {
  map.set(slug, (map.get(slug) || 0) + by);
}

async function loadWindowRows(slugs: string[]): Promise<{
  latestScan: Map<string, { rank: number | null; top3: number | null; at: string }>;
  bookings: Map<string, number>;
  whatsapp: Map<string, Set<string>>;
  ads: Map<string, { conversations: number; spentHalalas: number }>;
}> {
  const latestScan = new Map<string, { rank: number | null; top3: number | null; at: string }>();
  const bookings = new Map<string, number>();
  const whatsapp = new Map<string, Set<string>>();
  const ads = new Map<string, { conversations: number; spentHalalas: number }>();
  const db = getTenantDb();
  if (!db || !slugs.length) return { latestScan, bookings, whatsapp, ads };
  const since = sinceIso();

  const [scansRes, booksRes, waRes, adsRes] = await Promise.all([
    db
      .from("mken_local_rank_scans")
      .select("tenant_slug, average_rank, top3_percentage, scanned_at, raw_results")
      .in("tenant_slug", slugs)
      .gte("scanned_at", since)
      .order("scanned_at", { ascending: false })
      .limit(400),
    db
      .from("mken_appointments")
      .select("tenant_slug, created_at")
      .in("tenant_slug", slugs)
      .gte("created_at", since)
      .limit(2000),
    db
      .from("mken_whatsapp_logs")
      .select("tenant_slug, phone, event_type, created_at")
      .in("tenant_slug", slugs)
      .gte("created_at", since)
      .limit(3000),
    db
      .from("mken_ad_campaigns")
      .select("tenant_slug, spent_halalas, metrics, start_date, created_at")
      .in("tenant_slug", slugs)
      .limit(400),
  ]);

  if (!scansRes.error || missingTable(scansRes.error.message)) {
    for (const row of (scansRes.data || []) as ScanRow[]) {
      const slug = (row.tenant_slug || "").trim();
      const at = row.scanned_at || "";
      if (!slug || !at || !isDataforseoRow(row.raw_results) || latestScan.has(slug)) continue;
      latestScan.set(slug, {
        rank: Number.isFinite(Number(row.average_rank)) ? Number(row.average_rank) : null,
        top3: Number.isFinite(Number(row.top3_percentage)) ? Number(row.top3_percentage) : null,
        at,
      });
    }
  }

  if (!booksRes.error || missingTable(booksRes.error.message)) {
    for (const row of (booksRes.data || []) as CountRow[]) {
      const slug = (row.tenant_slug || "").trim();
      if (slug) bump(bookings, slug);
    }
  }

  if (!waRes.error || missingTable(waRes.error.message)) {
    for (const row of ((waRes.data || []) as Array<CountRow & { event_type?: string | null }>)) {
      const slug = (row.tenant_slug || "").trim();
      const event = (row.event_type || "").trim();
      if (!slug || event === "ctwa_clid") continue;
      if (event && event !== "inbound") continue;
      const phone = (row.phone || "").replace(/\D/g, "");
      if (!phone) continue;
      const set = whatsapp.get(slug) || new Set<string>();
      set.add(phone);
      whatsapp.set(slug, set);
    }
  }

  if (!adsRes.error || missingTable(adsRes.error.message)) {
    for (const row of (adsRes.data || []) as CampaignRow[]) {
      const slug = (row.tenant_slug || "").trim();
      if (!slug) continue;
      const prev = ads.get(slug) || { conversations: 0, spentHalalas: 0 };
      prev.conversations += Number(row.metrics?.conversations) || 0;
      prev.spentHalalas += Number(row.spent_halalas) || 0;
      ads.set(slug, prev);
    }
  }

  return { latestScan, bookings, whatsapp, ads };
}

export function toTenantMeasuredWindow(
  input: {
    createdAt?: string;
    scan?: { rank: number | null; top3: number | null };
    bookings: number;
    whatsapp: number;
    ads: { conversations: number; spentHalalas: number };
  }
): TenantMeasuredWindow {
  const spanDays = spanDaysFrom(input.createdAt);
  const reasons: string[] = [];
  if (spanDays < MEASURED_WINDOW_DAYS) {
    reasons.push(`يلزم مرور ${MEASURED_WINDOW_DAYS} يوماً على المنشأة (مضى ${spanDays}).`);
  }
  if (input.scan == null) reasons.push("لا يوجد فحص رانك DataForSEO خلال النافذة.");
  const ops = input.bookings + input.whatsapp + input.ads.conversations;
  if (ops < 1) reasons.push("لا حجوزات أو محادثات واتساب أو تحويلات إعلان خلال النافذة.");
  return {
    qualified: reasons.length === 0,
    spanDays,
    latestRank: input.scan?.rank ?? null,
    top3Percentage: input.scan?.top3 ?? null,
    bookings: input.bookings,
    whatsappConversations: input.whatsapp,
    adConversations: input.ads.conversations,
    adSpentHalalas: input.ads.spentHalalas,
    reasons,
  };
}

export async function loadTenantMeasuredWindow(slug: string): Promise<TenantMeasuredWindow> {
  const tenants = (await fetchTenants()) || [];
  const tenant = tenants.find((item) => item.slug === slug);
  const rows = await loadWindowRows([slug]);
  return toTenantMeasuredWindow({
    createdAt: tenant?.createdAt,
    scan: rows.latestScan.get(slug),
    bookings: rows.bookings.get(slug) || 0,
    whatsapp: rows.whatsapp.get(slug)?.size || 0,
    ads: rows.ads.get(slug) || { conversations: 0, spentHalalas: 0 },
  });
}

export async function loadPlatformMeasuredStats(opts?: { fresh?: boolean }): Promise<PlatformMeasuredStats> {
  if (!opts?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const tenants = ((await fetchTenants()) || []).filter((item) => isIndexableStorefront(item));
  const slugs = tenants.map((item) => item.slug);
  const rows = await loadWindowRows(slugs);
  const windows = tenants.map((item) =>
    toTenantMeasuredWindow({
      createdAt: item.createdAt,
      scan: rows.latestScan.get(item.slug),
      bookings: rows.bookings.get(item.slug) || 0,
      whatsapp: rows.whatsapp.get(item.slug)?.size || 0,
      ads: rows.ads.get(item.slug) || { conversations: 0, spentHalalas: 0 },
    })
  );
  const qualified = windows.filter((item) => item.qualified);
  const ready = qualified.length >= MEASURED_MIN_TENANTS;
  let stats: PlatformMeasuredStats["stats"] = null;
  if (ready) {
    const spend = qualified.reduce((sum, item) => sum + item.adSpentHalalas, 0);
    const conv = qualified.reduce((sum, item) => sum + item.adConversations, 0);
    stats = {
      medianRank: median(qualified.map((item) => item.latestRank).filter((n): n is number => n != null && n > 0)),
      medianTop3: median(
        qualified.map((item) => item.top3Percentage).filter((n): n is number => n != null)
      ),
      avgBookings: average(qualified.map((item) => item.bookings)),
      avgWhatsapp: average(qualified.map((item) => item.whatsappConversations)),
      cplSar: conv > 0 ? Math.round(spend / 100 / conv * 10) / 10 : null,
    };
  }
  const value: PlatformMeasuredStats = {
    ready,
    windowDays: MEASURED_WINDOW_DAYS,
    requiredTenants: MEASURED_MIN_TENANTS,
    qualifiedTenants: qualified.length,
    indexableTenants: tenants.length,
    asOf: new Date().toISOString(),
    stats,
  };
  cache = { at: Date.now(), value };
  return value;
}
