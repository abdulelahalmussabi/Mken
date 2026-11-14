import { getTenantDb, fetchTenantRow, writeTenantConfig } from "@/lib/mken/tenant";
import { loadNapSiteSnapshot } from "@/lib/mken/gbp";
import {
  geoGridAllowedSizes,
  geoGridCreditCost,
  geoGridMonthlyCredits,
  saasFeaturesFromConfig,
  SAAS_FEATURE_MESSAGES,
  type SaasTierId,
} from "@/lib/mken/saas";

export type GridSize = "3x3" | "5x5" | "7x7";
export type GeoScanSource = "dataforseo" | "places_estimate";

export interface GridCell {
  lat: number;
  lng: number;
  rank: number | null;
  inPack: boolean;
  title?: string;
}

export interface RankScan {
  id: string;
  keyword: string;
  gridSize: GridSize;
  radiusKm: number;
  centerLat: number;
  centerLng: number;
  averageRank: number | null;
  top3Percentage: number | null;
  cells: GridCell[];
  scannedAt: string;
  cached: boolean;
  source: GeoScanSource;
}

export interface GeoCredits {
  tier: SaasTierId;
  used: number;
  limit: number;
  remaining: number;
  month: string;
  allowedSizes: GridSize[];
}

function riyadhDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function riyadhMonth(): string {
  return riyadhDay().slice(0, 7);
}

function missingTable(message: string): boolean {
  return /does not exist|42P01/i.test(message);
}

export function dataforseoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

export function placesGeoConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export function geoGridScanReady(): boolean {
  return dataforseoConfigured() || placesGeoConfigured();
}

export function preferredGeoSource(): GeoScanSource | null {
  if (dataforseoConfigured()) return "dataforseo";
  if (placesGeoConfigured()) return "places_estimate";
  return null;
}

export function suggestedGeoKeyword(input: { slug: string; city?: string; activity?: string; name?: string }): string {
  const city = (input.city || "").trim();
  const loc = city || (input.slug === "almahrusa" ? "المدينة المنورة" : "");
  if (input.slug === "almahrusa" || input.activity === "hotels") {
    return loc ? `شقق مفروشة ${loc}` : "شقق مفروشة المدينة المنورة";
  }
  if (input.activity === "barber-salon" || input.activity === "salon") {
    return loc ? `صالون حلاقة ${loc}` : "صالون حلاقة";
  }
  const name = (input.name || "").split("|")[0]?.trim() || "";
  if (name && loc) return `${name} ${loc}`;
  return name || loc || "";
}

function gridDimension(size: GridSize): number {
  if (size === "7x7") return 7;
  if (size === "5x5") return 5;
  return 3;
}

function pinsAround(lat: number, lng: number, radiusKm: number, n: number): Array<{ lat: number; lng: number }> {
  const stepKm = n === 1 ? 0 : (2 * radiusKm) / (n - 1);
  const latDeg = 1 / 111.32;
  const lngDeg = 1 / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);
  const originLat = lat - radiusKm * latDeg;
  const originLng = lng - radiusKm * lngDeg;
  const out: Array<{ lat: number; lng: number }> = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      out.push({
        lat: originLat + row * stepKm * latDeg,
        lng: originLng + col * stepKm * lngDeg,
      });
    }
  }
  return out;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ال/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function geoCreditsForSlug(slug: string): Promise<GeoCredits> {
  const row = await fetchTenantRow(slug);
  const features = saasFeaturesFromConfig(row?.config_data, { slug });
  const month = riyadhMonth();
  const stored = row?.config_data?.localGrowth || {};
  const used = stored.geoMonth === month ? Number(stored.geoUsed) || 0 : 0;
  const limit = geoGridMonthlyCredits(features.tier);
  return {
    tier: features.tier,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    month,
    allowedSizes: geoGridAllowedSizes(features.tier),
  };
}

async function debitCredits(slug: string, cost: number): Promise<{ error?: string; credits?: GeoCredits }> {
  const credits = await geoCreditsForSlug(slug);
  if (credits.remaining < cost) return { error: SAAS_FEATURE_MESSAGES.geoGrid, credits };
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة", credits };
  const next = {
    ...(row.config_data || {}),
    localGrowth: {
      ...(row.config_data?.localGrowth || {}),
      geoMonth: credits.month,
      geoUsed: credits.used + cost,
    },
  };
  const written = await writeTenantConfig(slug, next);
  if (written.error) return { error: written.error, credits };
  return {
    credits: {
      ...credits,
      used: credits.used + cost,
      remaining: Math.max(0, credits.limit - credits.used - cost),
    },
  };
}

async function fetchCachedScan(
  slug: string,
  keyword: string,
  gridSize: GridSize,
  radiusKm: number
): Promise<RankScan | null> {
  const db = getTenantDb();
  if (!db) return null;
  const { data, error } = await db
    .from("mken_local_rank_scans")
    .select("*")
    .eq("tenant_slug", slug)
    .eq("keyword", keyword)
    .eq("grid_size", gridSize)
    .eq("radius_km", radiusKm)
    .eq("scan_day", riyadhDay())
    .maybeSingle();
  if (error || !data) return null;
  return toScan(data as Record<string, unknown>, true);
}

function parseStoredResults(raw: unknown): { cells: GridCell[]; source: GeoScanSource } {
  if (Array.isArray(raw)) {
    return { cells: raw as GridCell[], source: "dataforseo" };
  }
  if (raw && typeof raw === "object") {
    const stored = raw as { cells?: GridCell[]; source?: string };
    return {
      cells: Array.isArray(stored.cells) ? stored.cells : [],
      source: stored.source === "places_estimate" ? "places_estimate" : "dataforseo",
    };
  }
  return { cells: [], source: "dataforseo" };
}

function toScan(row: Record<string, unknown>, cached: boolean): RankScan {
  const parsed = parseStoredResults(row.raw_results);
  return {
    id: String(row.id || ""),
    keyword: String(row.keyword || ""),
    gridSize: (row.grid_size === "5x5" || row.grid_size === "7x7" ? row.grid_size : "3x3") as GridSize,
    radiusKm: Number(row.radius_km) || 5,
    centerLat: Number(row.center_lat) || 0,
    centerLng: Number(row.center_lng) || 0,
    averageRank: row.average_rank != null ? Number(row.average_rank) : null,
    top3Percentage: row.top3_percentage != null ? Number(row.top3_percentage) : null,
    cells: parsed.cells,
    scannedAt: String(row.scanned_at || ""),
    cached,
    source: parsed.source,
  };
}

interface MapsItem {
  title?: string;
  rank_absolute?: number;
  rank_group?: number;
  place_id?: string;
}

async function dataforseoMaps(tasks: Array<{ keyword: string; lat: number; lng: number }>): Promise<MapsItem[][]> {
  const login = process.env.DATAFORSEO_LOGIN?.trim() || "";
  const password = process.env.DATAFORSEO_PASSWORD?.trim() || "";
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      tasks.map((task) => ({
        keyword: task.keyword,
        location_coordinate: `${task.lat.toFixed(6)},${task.lng.toFixed(6)},1`,
        language_code: "ar",
        depth: 20,
      }))
    ),
  });
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  const json = (await res.json()) as {
    tasks?: Array<{ result?: Array<{ items?: MapsItem[] }>; status_code?: number; status_message?: string }>;
  };
  return (json.tasks || []).map((task) => task.result?.[0]?.items || []);
}

async function placesTextSearchPin(keyword: string, lat: number, lng: number): Promise<MapsItem[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
  const params = new URLSearchParams({
    query: keyword,
    language: "ar",
    region: "sa",
    location: `${lat.toFixed(6)},${lng.toFixed(6)}`,
    radius: "1000",
    key,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`);
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{ name?: string; place_id?: string }>;
  };
  if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) {
    throw new Error(data.error_message ? `Places API ${data.status}: ${data.error_message}` : `Places API ${data.status}`);
  }
  return (data.results || []).slice(0, 20).map((item, index) => ({
    title: item.name,
    place_id: item.place_id,
    rank_absolute: index + 1,
    rank_group: index + 1,
  }));
}

async function placesMaps(tasks: Array<{ keyword: string; lat: number; lng: number }>): Promise<MapsItem[][]> {
  const out: MapsItem[][] = [];
  const chunk = 5;
  for (let i = 0; i < tasks.length; i += chunk) {
    const slice = tasks.slice(i, i + chunk);
    out.push(...(await Promise.all(slice.map((task) => placesTextSearchPin(task.keyword, task.lat, task.lng)))));
  }
  return out;
}

function matchRank(items: MapsItem[], businessName: string, placeId: string): { rank: number | null; title?: string } {
  const wantPlace = placeId.trim();
  const wantName = normalizeName(businessName);
  for (const item of items) {
    if (wantPlace && item.place_id === wantPlace) {
      return { rank: Number(item.rank_absolute || item.rank_group) || null, title: item.title };
    }
  }
  for (const item of items) {
    const title = normalizeName(item.title || "");
    if (wantName && title && (title.includes(wantName) || wantName.includes(title))) {
      return { rank: Number(item.rank_absolute || item.rank_group) || null, title: item.title };
    }
  }
  return { rank: null };
}

export async function listRecentRankScans(slug: string): Promise<{ scans?: RankScan[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db
    .from("mken_local_rank_scans")
    .select("*")
    .eq("tenant_slug", slug)
    .order("scanned_at", { ascending: false })
    .limit(10);
  if (error) {
    if (missingTable(error.message)) return { scans: [] };
    return { error: error.message };
  }
  return { scans: ((data || []) as Record<string, unknown>[]).map((row) => toScan(row, true)) };
}

export async function runGeoGridScan(input: {
  slug: string;
  keyword: string;
  gridSize: string;
  radiusKm: number;
}): Promise<{ scan?: RankScan; credits?: GeoCredits; error?: string }> {
  const keyword = input.keyword.trim().slice(0, 80);
  if (!keyword) return { error: "أدخل كلمة البحث المحلية" };

  const gridSize: GridSize =
    input.gridSize === "5x5" || input.gridSize === "7x7" ? input.gridSize : "3x3";
  const radius = [5, 8, 10, 15].includes(Number(input.radiusKm)) ? Number(input.radiusKm) : 5;

  const credits = await geoCreditsForSlug(input.slug);
  if (!credits.allowedSizes.includes(gridSize)) {
    return { error: "حجم الشبكة غير متاح في باقتك الحالية", credits };
  }

  const source = preferredGeoSource();
  if (!source) {
    return {
      error:
        "لا يوجد مزود فحص على الخادم. عيّن GOOGLE_MAPS_API_KEY لتقدير أماكن، أو DATAFORSEO_LOGIN و DATAFORSEO_PASSWORD لرانك الخرائط.",
      credits,
    };
  }

  const cached = await fetchCachedScan(input.slug, keyword, gridSize, radius);
  const replaceEstimate = Boolean(cached && source === "dataforseo" && cached.source === "places_estimate");
  if (cached && !replaceEstimate) return { scan: cached, credits };

  const cost = geoGridCreditCost(gridSize);
  if (credits.remaining < cost) {
    return { error: SAAS_FEATURE_MESSAGES.geoGrid, credits };
  }

  const row = await fetchTenantRow(input.slug);
  const lat = Number(row?.config_data?.serviceArea?.center?.lat);
  const lng = Number(row?.config_data?.serviceArea?.center?.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return {
      error: "حدّد موقع الفرع في إعدادات المنشأة (خط العرض والطول المحفوظان) قبل مسح الشبكة. لا يُستخدم موقع افتراضي.",
      credits,
    };
  }
  const snap = await loadNapSiteSnapshot(input.slug);
  const name = snap.site?.name || input.slug;
  const placeId = row?.config_data?.preview?.placeId || "";

  const n = gridDimension(gridSize);
  const pins = pinsAround(lat, lng, radius, n);
  const tasks = pins.map((pin) => ({ keyword, lat: pin.lat, lng: pin.lng }));

  try {
    const results = source === "dataforseo" ? await dataforseoMaps(tasks) : await placesMaps(tasks);
    const cells: GridCell[] = pins.map((pin, index) => {
      const matched = matchRank(results[index] || [], name, placeId);
      return {
        lat: pin.lat,
        lng: pin.lng,
        rank: matched.rank,
        inPack: matched.rank != null && matched.rank <= 3,
        title: matched.title,
      };
    });
    const ranked = cells.map((cell) => cell.rank).filter((rank): rank is number => rank != null);
    const averageRank =
      ranked.length > 0 ? Math.round((ranked.reduce((sum, rank) => sum + rank, 0) / ranked.length) * 100) / 100 : null;
    const top3Percentage = Math.round((cells.filter((cell) => cell.inPack).length / cells.length) * 10000) / 100;

    const debit = await debitCredits(input.slug, cost);
    if (debit.error) return { error: debit.error, credits: debit.credits };

    const db = getTenantDb();
    if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم", credits: debit.credits };

    const payload = {
      tenant_slug: input.slug,
      keyword,
      grid_size: gridSize,
      radius_km: radius,
      center_lat: lat,
      center_lng: lng,
      average_rank: averageRank,
      top3_percentage: top3Percentage,
      raw_results: { source, cells },
      scan_day: riyadhDay(),
      scanned_at: new Date().toISOString(),
    };

    const written =
      replaceEstimate && cached?.id
        ? await db.from("mken_local_rank_scans").update(payload).eq("id", cached.id).select("*").maybeSingle()
        : await db.from("mken_local_rank_scans").insert(payload).select("*").maybeSingle();

    if (written.error || !written.data) {
      if (written.error && /duplicate|unique/i.test(written.error.message)) {
        const again = await fetchCachedScan(input.slug, keyword, gridSize, radius);
        if (again) return { scan: again, credits: debit.credits };
      }
      return { error: written.error?.message || "تعذّر حفظ الفحص", credits: debit.credits };
    }
    return { scan: toScan(written.data as Record<string, unknown>, false), credits: debit.credits };
  } catch (err) {
    const fallback = source === "places_estimate" ? "فشل تقدير Places" : "فشل فحص DataForSEO";
    return { error: err instanceof Error ? err.message : fallback, credits };
  }
}
