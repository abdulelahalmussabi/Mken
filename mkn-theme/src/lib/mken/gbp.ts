import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";
import {
  encodeGbpOAuthState,
  googleTokenError,
  normalizeGoogleOAuthValue,
} from "@/lib/mken/google-oauth";
import { fetchTenantRow, getTenantDb, TENANT_TABLE, writeTenantConfig } from "@/lib/mken/tenant";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { ACTIVITIES, fetchTenantCatalog } from "@/lib/mken/catalog";
import {
  buildNapAuditReport,
  cityFromGbpAddress,
  planNapSync,
  planReverseNapSync,
  type GbpLocationDetail,
  type NapReport,
  type NapSiteSnapshot,
  type ReverseNapField,
} from "@/lib/mken/nap";
import { generateGeminiText } from "@/lib/mken/gemini";
import { updateTenantSettings } from "@/lib/mken/settings";
import {
  extractLatLngFromMapsUrl,
  fetchLivePlaceDetails,
  resolvePlaceId,
  type LivePlaceDetails,
} from "@/lib/mken/preview";

export interface GbpStatus {
  connected: boolean;
  expiry: string | null;
  selectedLocationId: string | null;
  locations?: GbpLocation[];
  mapsUrl?: string;
  mapsPlaceId?: string;
}

export interface GbpLocation {
  id: string;
  title: string;
  websiteUri: string;
  newReviewUrl: string;
  mapsUri: string;
  city: string;
}

function explainGbpGoogleError(message: string): string {
  if (/quota exceeded|rate.?limit|resource.?exhausted/i.test(message)) {
    return "واجهة Google Business Profile غير مفعّلة على المشروع (الحصّة 0). لا تلغِ الربط. املأ نموذج Application for Basic API Access ثم انتظر حتى تصبح الحصّة 300.";
  }
  return message;
}

const locationListCache = new Map<
  string,
  { at: number; result: { connected: boolean; selectedLocationId: string | null; locations: GbpLocation[]; error?: string } }
>();

function readLocationCache(slug: string) {
  const hit = locationListCache.get(slug);
  if (!hit || hit.result.error || !hit.result.locations.length) return null;
  if (Date.now() - hit.at > 24 * 60 * 60 * 1000) return null;
  return hit.result;
}

function writeLocationCache(
  slug: string,
  result: { connected: boolean; selectedLocationId: string | null; locations: GbpLocation[]; error?: string }
) {
  locationListCache.set(slug, { at: Date.now(), result });
}

function locationFromGoogle(loc: {
  name?: string;
  title?: string;
  websiteUri?: string;
  metadata?: { newReviewUrl?: string; mapsUri?: string };
  storefrontAddress?: { locality?: string };
}): GbpLocation | null {
  if (!loc.name) return null;
  return {
    id: loc.name,
    title: loc.title || loc.name,
    websiteUri: loc.websiteUri || "",
    newReviewUrl: loc.metadata?.newReviewUrl || "",
    mapsUri: loc.metadata?.mapsUri || "",
    city: loc.storefrontAddress?.locality || "",
  };
}

async function fetchGbpLocationSummary(token: string, locationId: string): Promise<GbpLocation | null> {
  const qs = new URLSearchParams({
    readMask: "name,title,websiteUri,metadata,storefrontAddress",
  });
  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?${qs}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return locationFromGoogle((await res.json()) as Parameters<typeof locationFromGoogle>[0]);
}

function normalizeCachedLocations(raw: unknown): GbpLocation[] {
  if (!Array.isArray(raw)) return [];
  const locations: GbpLocation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || !("id" in item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) continue;
    const loc = item as Partial<GbpLocation>;
    locations.push({
      id,
      title: loc.title || id,
      websiteUri: loc.websiteUri || "",
      newReviewUrl: loc.newReviewUrl || "",
      mapsUri: loc.mapsUri || "",
      city: loc.city || "",
    });
  }
  return locations;
}

async function readGbpLocationDbCache(slug: string): Promise<GbpLocation[]> {
  const row = await fetchTenantRow(slug);
  return normalizeCachedLocations(row?.config_data?.gbp?.locations);
}

async function writeGbpLocationDbCache(slug: string, locations: GbpLocation[]) {
  const row = await fetchTenantRow(slug);
  const config = { ...(row?.config_data || {}) };
  config.gbp = { fetchedAt: new Date().toISOString(), locations };
  await writeTenantConfig(slug, config);
}

async function listOwnedGbpLocations(token: string): Promise<{ locations: GbpLocation[]; error?: string }> {
  const locations: GbpLocation[] = [];
  let pageToken = "";
  for (let page = 0; page < 3; page += 1) {
    const qs = new URLSearchParams({
      readMask: "name,title,websiteUri,metadata,storefrontAddress",
      pageSize: "100",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      return { locations, error: await googleApiError(res, "تعذّر جلب الفروع") };
    }
    const data = (await res.json()) as {
      locations?: Array<Parameters<typeof locationFromGoogle>[0]>;
      nextPageToken?: string;
    };
    for (const loc of data.locations || []) {
      const parsed = locationFromGoogle(loc);
      if (parsed) locations.push(parsed);
    }
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  return { locations };
}

export async function fetchGbpStatus(slug: string): Promise<{ status?: GbpStatus; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select(
      "google_refresh_token, google_access_token, google_token_expiry, google_business_location_id, config_data"
    )
    .eq("tenant_slug", slug)
    .maybeSingle();

  if (error) return { error: "تعذّر قراءة حالة الربط" };

  const row = data as {
    google_refresh_token?: string | null;
    google_access_token?: string | null;
    google_token_expiry?: string | null;
    google_business_location_id?: string | null;
    config_data?: {
      gbp?: { locations?: GbpLocation[] };
      mapsUrl?: string;
      preview?: { placeId?: string };
    } | null;
  } | null;

  const mapsUrl = typeof row?.config_data?.mapsUrl === "string" ? row.config_data.mapsUrl.trim() : "";
  const mapsPlaceId =
    typeof row?.config_data?.preview?.placeId === "string" ? row.config_data.preview.placeId.trim() : "";

  return {
    status: {
      connected: Boolean(row?.google_refresh_token || row?.google_access_token),
      expiry: row?.google_token_expiry || null,
      selectedLocationId: row?.google_business_location_id || null,
      locations: normalizeCachedLocations(row?.config_data?.gbp?.locations),
      mapsUrl: mapsUrl || undefined,
      mapsPlaceId: mapsPlaceId || undefined,
    },
  };
}

export async function disconnectGbp(slug: string): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_business_location_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  locationListCache.delete(slug);
  const row = await fetchTenantRow(slug);
  if (row?.config_data?.gbp) {
    const next = { ...row.config_data };
    delete next.gbp;
    await writeTenantConfig(slug, next);
  }
  return error ? { error: "تعذّر إلغاء الربط" } : {};
}

/** Canonical GBP OAuth callback. Must match Google Cloud → Credentials → Authorized redirect URIs exactly. */
export const GBP_OAUTH_CALLBACK_PATH = "/api/google-business/callback";

export function gbpRedirectUri(): string {
  let uri = normalizeGoogleOAuthValue(process.env.GOOGLE_REDIRECT_URI, "GOOGLE_REDIRECT_URI");
  if (!uri) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.mken.live").replace(/\/$/, "");
    uri = `${site}${GBP_OAUTH_CALLBACK_PATH}`;
  }
  uri = uri.replace("://mken.live/", "://www.mken.live/");
  uri = uri.replace("/api/google_business", "/api/google-business");
  if (/\/api\/google-business\/?(\?|$)/.test(uri) && !uri.includes("/callback")) {
    uri = uri.replace(/\/api\/google-business\/?/, GBP_OAUTH_CALLBACK_PATH).replace(/\?.*$/, "");
  }
  return uri.replace(/\/$/, "");
}

export function buildGoogleAuthUrl(
  tenantSlug: string,
  requestHost = ""
): { url?: string; error?: string } {
  const clientId = normalizeGoogleOAuthValue(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const redirectUri = gbpRedirectUri();
  if (!clientId) {
    return { error: "GOOGLE_CLIENT_ID غير معيّن على الخادم" };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
    state: encodeGbpOAuthState(tenantSlug, requestHost),
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

export async function completeGbpOAuth(
  slug: string,
  code: string
): Promise<{ error?: string }> {
  const key = slug.trim().toLowerCase();
  const clientId = normalizeGoogleOAuthValue(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const clientSecret = normalizeGoogleOAuthValue(process.env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
  const redirectUri = gbpRedirectUri();
  if (!clientId || !clientSecret) {
    return { error: "GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET غير معيّنين على الخادم" };
  }
  if (clientSecret.length < 16) {
    return {
      error:
        "GOOGLE_CLIENT_SECRET ناقص أو مقصوص. انسخ السر الكامل من Google Cloud عند إنشائه (آخر 4 أحرف في اللوحة لا تكفي).",
    };
  }
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    return { error: googleTokenError(tokenData) };
  }

  const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  const update: Record<string, string> = {
    google_access_token: tokenData.access_token,
    google_token_expiry: expiry,
    updated_at: new Date().toISOString(),
  };
  if (tokenData.refresh_token) update.google_refresh_token = tokenData.refresh_token;

  const { error } = await db.from(TENANT_TABLE).update(update).eq("tenant_slug", key);
  if (error) return { error: "تعذّر حفظ توكن جوجل لهذه المنشأة" };
  return {};
}

async function getValidAccessToken(slug: string): Promise<string> {
  const db = getTenantDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة على الخادم");

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("tenant_slug", slug)
    .maybeSingle();

  if (error || !data) throw new Error("Google Business account is not connected");

  const row = data as {
    google_access_token?: string | null;
    google_refresh_token?: string | null;
    google_token_expiry?: string | null;
  };

  if (!row.google_refresh_token) throw new Error("Google Business account is not connected");

  const stillValid =
    row.google_access_token &&
    row.google_token_expiry &&
    new Date(row.google_token_expiry).getTime() - Date.now() >= 60_000;

  if (stillValid && row.google_access_token) return row.google_access_token;

  const clientId = normalizeGoogleOAuthValue(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID");
  const clientSecret = normalizeGoogleOAuthValue(process.env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET غير معيّنين");
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) throw new Error("فشل تجديد توكن جوجل");

  const tokenData = (await refreshRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw new Error("فشل تجديد توكن جوجل");

  const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await db
    .from(TENANT_TABLE)
    .update({
      google_access_token: tokenData.access_token,
      google_token_expiry: expiry,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  return tokenData.access_token;
}

export async function listGbpLocations(
  slug: string,
  options?: { refresh?: boolean }
): Promise<{ connected: boolean; selectedLocationId: string | null; locations: GbpLocation[]; error?: string }> {
  const db = getTenantDb();
  const { data: client } = db
    ? await db
        .from(TENANT_TABLE)
        .select("google_business_location_id")
        .eq("tenant_slug", slug)
        .maybeSingle()
    : { data: null };
  const selectedLocationId =
    (client as { google_business_location_id?: string | null } | null)?.google_business_location_id || null;

  if (!options?.refresh) {
    const memory = readLocationCache(slug);
    if (memory) return { ...memory, selectedLocationId: selectedLocationId || memory.selectedLocationId };
    const stored = await readGbpLocationDbCache(slug);
    if (stored.length) {
      const result = { connected: true, selectedLocationId, locations: stored };
      writeLocationCache(slug, result);
      return result;
    }
  }

  try {
    const token = await getValidAccessToken(slug);
    const listed = await listOwnedGbpLocations(token);
    if (!listed.error && listed.locations.length) {
      const result = { connected: true as const, selectedLocationId, locations: listed.locations };
      writeLocationCache(slug, result);
      await writeGbpLocationDbCache(slug, listed.locations);
      return result;
    }

    const saved = selectedLocationId ? await fetchGbpLocationSummary(token, selectedLocationId) : null;
    const stored = listed.locations.length
      ? listed.locations
      : saved
        ? [saved]
        : await readGbpLocationDbCache(slug);
    if (stored.length) {
      if (!listed.error) {
        writeLocationCache(slug, { connected: true, selectedLocationId, locations: stored });
        await writeGbpLocationDbCache(slug, stored);
      }
      return {
        connected: true,
        selectedLocationId,
        locations: stored,
        error: listed.error ? explainGbpGoogleError(listed.error) : undefined,
      };
    }

    return {
      connected: true,
      selectedLocationId,
      locations: [],
      error: explainGbpGoogleError(
        listed.error ||
          "لا توجد فروع يمكن لمكّن قراءتها على هذا الحساب. تأكد أن الملف موثّق وأن الحساب مدير للصفحة."
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر جلب الفروع";
    if (message.includes("not connected")) {
      return { connected: false, selectedLocationId: null, locations: [] };
    }
    const stored = await readGbpLocationDbCache(slug);
    return {
      connected: true,
      selectedLocationId,
      locations: stored,
      error: stored.length ? undefined : explainGbpGoogleError(message),
    };
  }
}

export async function selectGbpLocation(
  slug: string,
  locationId: string,
  syncWebsite: boolean
): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  if (syncWebsite) {
    try {
      const token = await getValidAccessToken(slug);
      const websiteUrl = await tenantWebsiteUrl(slug);
      const updateRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=websiteUri`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ websiteUri: websiteUrl }),
        }
      );
      if (!updateRes.ok) return { error: "تعذّر تحديث رابط الموقع على جوجل" };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "تعذّر تحديث رابط الموقع على جوجل" };
    }
  }

  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_business_location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  locationListCache.delete(slug);
  return error ? { error: "تعذّر حفظ الفرع" } : {};
}

const GBP_POST_MAX_CHARS = 1500;
const GBP_LOCATION_READ_MASK =
  "title,phoneNumbers,websiteUri,storefrontAddress,regularHours,primaryCategory";

export interface GbpCompetitor {
  name: string;
  rating: number;
  userRatingsTotal: number;
  address: string;
  placeId?: string;
  mapsUrl?: string;
}

function trimGbpPostText(text: string): string {
  if (!text || text.length <= GBP_POST_MAX_CHARS) return text || "";
  return `${text.slice(0, GBP_POST_MAX_CHARS - 1).trim()}…`;
}

function readServiceAreaCenter(area: { center?: { lat?: unknown; lng?: unknown } }): {
  lat?: number;
  lng?: number;
} {
  const lat = Number(area.center?.lat);
  const lng = Number(area.center?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (lat === 0 && lng === 0) return {};
  return { lat, lng };
}

export async function loadNapSiteSnapshot(
  slug: string
): Promise<{
  site?: NapSiteSnapshot & {
    lat?: number;
    lng?: number;
    category: string;
    ownPlaceId: string;
    mapsUrl: string;
  };
  error?: string;
}> {
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const raw = row.config_data || {};
  const config =
    slug === "rewa"
      ? applyRewaDefaults(raw)
      : slug === "almahrusa"
        ? applyAlmahrusaDefaults(raw)
        : slug === "rewaq"
          ? applyRewaqDefaults(raw)
          : raw;
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as Record<string, unknown>)
      : {};
  const wh =
    booking.workingHours && typeof booking.workingHours === "object"
      ? (booking.workingHours as Record<string, unknown>)
      : {};
  const area = config.serviceArea || {};
  const preview =
    config.preview && typeof config.preview === "object"
      ? (config.preview as { placeId?: string })
      : {};
  return {
    site: {
      name: config.brand?.name || row.business_name || slug,
      phone: config.phone || row.phone || "",
      website: await tenantWebsiteUrl(slug),
      city: area.city || "",
      hoursStart: typeof wh.start === "string" ? wh.start : "",
      hoursEnd: typeof wh.end === "string" ? wh.end : "",
      ...readServiceAreaCenter(area),
      category: typeof config.featuredActivity === "string" ? config.featuredActivity : "",
      ownPlaceId: typeof preview.placeId === "string" ? preview.placeId.trim() : "",
      mapsUrl: typeof config.mapsUrl === "string" ? config.mapsUrl.trim() : "",
    },
  };
}

async function fetchGbpLocationDetail(slug: string, locationId: string): Promise<GbpLocationDetail> {
  const token = await getValidAccessToken(slug);
  const locationRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=${GBP_LOCATION_READ_MASK}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!locationRes.ok) throw new Error("تعذّر جلب بيانات الفرع من جوجل");
  return locationRes.json() as Promise<GbpLocationDetail>;
}

function gbpLocationFromPlace(place: LivePlaceDetails): GbpLocationDetail {
  const address = place.address || "";
  return {
    title: place.name,
    websiteUri: place.website,
    phoneNumbers: { primaryPhone: place.phone },
    storefrontAddress: {
      addressLines: address ? [address] : [],
      locality: cityFromGbpAddress({ addressLines: address ? [address] : [] }, address),
    },
    regularHours: place.openingPeriods?.length
      ? {
          periods: place.openingPeriods.map((period) => ({
            openDay: period.openDay,
            openTime: period.openTime,
            closeTime: period.closeTime,
          })),
        }
      : undefined,
  };
}

async function resolveGbpSnapshot(
  slug: string,
  locationId: string,
  site: NapSiteSnapshot & { ownPlaceId?: string; mapsUrl?: string }
): Promise<GbpLocationDetail | null> {
  if (locationId.trim()) {
    try {
      return await fetchGbpLocationDetail(slug, locationId);
    } catch {
      /* fall through to Maps listing */
    }
  }
  const placeId = site.ownPlaceId || (site.mapsUrl ? await resolvePlaceId(site.mapsUrl) : null);
  if (!placeId) return null;
  const place = await fetchLivePlaceDetails(placeId);
  return place ? gbpLocationFromPlace(place) : null;
}

export async function bindMapsListing(
  slug: string,
  mapsUrl: string
): Promise<{ mapsUrl?: string; mapsPlaceId?: string; city?: string; error?: string }> {
  const trimmed = mapsUrl.trim();
  if (!trimmed) return { error: "الصق رابط خرائط جوجل أو place_id" };
  const placeId = await resolvePlaceId(trimmed);
  if (!placeId) return { error: "تعذّر قراءة الرابط. انسخ الرابط من تطبيق خرائط جوجل أو من المشاركة." };

  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const config = { ...(row.config_data || {}) };
  const preview = { ...(config.preview && typeof config.preview === "object" ? config.preview : {}) };
  preview.placeId = placeId;
  config.mapsUrl = trimmed;
  config.preview = preview;

  const details = await fetchLivePlaceDetails(placeId);
  const area =
    config.serviceArea && typeof config.serviceArea === "object" ? { ...config.serviceArea } : {};
  const currentCity = typeof area.city === "string" ? area.city.trim() : "";
  const inferredCity = details ? cityFromGbpAddress({ addressLines: details.address ? [details.address] : [] }, details.address || "") : "";
  if (!currentCity && inferredCity) area.city = inferredCity;
  const coords = extractLatLngFromMapsUrl(trimmed);
  const center = area.center && typeof area.center === "object" ? { ...area.center } : {};
  const hasCenter = Number.isFinite(Number(center.lat)) && Number(center.lat) !== 0;
  if (!hasCenter && coords) area.center = coords;
  if (Object.keys(area).length) config.serviceArea = area;

  const written = await writeTenantConfig(slug, config);
  if (written.error) return { error: written.error };
  return {
    mapsUrl: trimmed,
    mapsPlaceId: placeId,
    city: typeof area.city === "string" ? area.city : inferredCity,
  };
}

export async function runNapAudit(
  slug: string,
  locationId: string
): Promise<{ report?: NapReport; error?: string }> {
  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };
  try {
    const gbp = await resolveGbpSnapshot(slug, locationId, snap.site);
    if (!gbp) return { error: "اختر فرعاً أو الصق رابط خرائط جوجل أولاً" };
    return { report: buildNapAuditReport(snap.site, gbp) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر فحص NAP" };
  }
}

export async function syncNapFromMken(
  slug: string,
  locationId: string,
  options?: { includeName?: boolean }
): Promise<{
  report?: NapReport;
  updated?: { field: string; label: string; value: string }[];
  skipped?: { field: string; label: string; reason: string }[];
  message?: string;
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };

  try {
    const token = await getValidAccessToken(slug);
    const gbp = await fetchGbpLocationDetail(slug, locationId);
    const plan = planNapSync(snap.site, gbp, { includeName: Boolean(options?.includeName) });

    if (!plan.updateMask) {
      return {
        report: plan.report,
        updated: [],
        skipped: plan.skipped,
        message: "لا توجد حقول قابلة للمزامنة التلقائية — البيانات متطابقة أو ناقصة في مكّن.",
      };
    }

    const updateRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=${plan.updateMask}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plan.patchBody),
      }
    );
    if (!updateRes.ok) return { error: "تعذّر مزامنة NAP مع جوجل" };

    await db
      .from(TENANT_TABLE)
      .update({
        google_business_location_id: locationId,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_slug", slug);

    const after = await fetchGbpLocationDetail(slug, locationId);
    return {
      report: buildNapAuditReport(snap.site, after),
      updated: plan.updated,
      skipped: plan.skipped,
      message: `تمت مزامنة ${plan.updated.length} حقل/حقول إلى جوجل بيزنس.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر مزامنة NAP" };
  }
}

export async function syncNapToMken(
  slug: string,
  locationId: string,
  selectedFields: ReverseNapField[]
): Promise<{
  report?: NapReport;
  updated?: { field: string; label: string; value: string }[];
  skipped?: { field: string; label: string; reason: string }[];
  message?: string;
  error?: string;
}> {
  if (!selectedFields.length) return { error: "اختر حقلاً واحداً على الأقل للاستيراد" };
  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };

  const gbp = await resolveGbpSnapshot(slug, locationId, snap.site);
  if (!gbp) return { error: "اختر فرعاً أو الصق رابط خرائط جوجل أولاً" };

  const plan = planReverseNapSync(snap.site, gbp, selectedFields);
  if (!plan.updates.length) {
    return {
      report: plan.report,
      updated: [],
      skipped: plan.skipped,
      message: "لا توجد حقول للاستيراد — البيانات متطابقة أو ناقصة في جوجل.",
    };
  }

  const { settings, error } = await updateTenantSettings(slug, {
    ...(plan.configPatch.phone ? { phone: plan.configPatch.phone } : {}),
    ...(plan.configPatch.brandName ? { brand: { name: plan.configPatch.brandName } } : {}),
    ...(plan.configPatch.city ? { serviceArea: { city: plan.configPatch.city } } : {}),
  });
  if (error || !settings) return { error: error || "تعذّر حفظ البيانات في مكّن" };

  const after = await loadNapSiteSnapshot(slug);
  return {
    report: after.site ? buildNapAuditReport(after.site, gbp) : plan.report,
    updated: plan.updates,
    skipped: plan.skipped,
    message: `تم استيراد ${plan.updates.length} حقل/حقول من جوجل إلى مكّن.`,
  };
}

export async function generateGbpPost(
  slug: string,
  prompt: string,
  serviceName: string
): Promise<{ text?: string; error?: string }> {
  const trimmed = prompt.trim();
  if (!trimmed) return { error: "اكتب فكرة المنشور أولاً" };
  if (trimmed.length > 2000) return { error: "النص أطول من 2000 حرف" };

  const snap = await loadNapSiteSnapshot(slug);
  const businessName = snap.site?.name || slug;
  const systemPrompt = `أنت خبير سيو محلي (Local SEO) متمرس. اكتب منشور تسويقي جذاب وملائم لخرائط جوجل (Google Business Profile) باللغة العربية.
اسم المنشأة: "${businessName}"
الخدمة أو العرض المستهدف: "${serviceName || ""}"
تفاصيل إضافية من التاجر: "${trimmed}"

شروط الكتابة:
1. اكتب بنبرة مهنية وترحيبية تلائم الجمهور السعودي والعربي، واستخدم الرموز التعبيرية (Emojis) بشكل معقول.
2. ركز على حث العميل على اتخاذ إجراء (Call to Action) مثل الحجز أو الاتصال.
3. استخدم كلمات مفتاحية طبيعية ومحسنة لمحركات البحث المحلية.
4. لا تذكر أي روابط أو أرقام هواتف إلا إذا حددها المستخدم.
5. اجعل المنشور قصيراً ومباشراً ومناسباً لمتصفحي خرائط جوجل.
6. لا تتجاوز ${GBP_POST_MAX_CHARS} حرفاً في النص النهائي.`;

  try {
    return { text: trimGbpPostText(await generateGeminiText(systemPrompt)) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر توليد المنشور" };
  }
}

export async function generateGbpReply(
  slug: string,
  reviewText: string,
  rating: string
): Promise<{ text?: string; error?: string }> {
  if (!reviewText.trim() && !rating) return { error: "أدخل نص التقييم أو النجوم" };
  if (reviewText.length > 2000) return { error: "نص التقييم أطول من 2000 حرف" };

  const snap = await loadNapSiteSnapshot(slug);
  const businessName = snap.site?.name || slug;
  const systemPrompt = `أنت ممثل خدمة عملاء محترف لشركة "${businessName}". اكتب رداً لبقاً واحترافياً باللغة العربية للرد على تقييم عميل على خرائط جوجل.
تقييم العميل: ${rating ? `${rating} نجوم` : "غير محدد"}
نص المراجعة: "${reviewText.trim() || "لا يوجد نص مراجعة، فقط تقييم بالنجوم"}"

شروط الرد:
1. إذا كان التقييم إيجابياً (4-5 نجوم)، اشكر العميل بعبارات لطيفة ودافئة وعبر عن سعادتك بخدمته.
2. إذا كان التقييم سلبياً (1-3 نجوم)، كن متعاطفاً للغاية، اعتذر عن التقصير بأدب ووقار، واقترح عليه التواصل لحل المشكلة (دون ذكر رقم محدد إلا بشكل عام مثل "يسعدنا تواصلكم معنا عبر أرقامنا الرسمية").
3. اكتب باللغة العربية الفصحى أو بلهجة بيضاء مهذبة ومناسبة.
4. حافظ على الإيجاز والاحترافية.`;

  try {
    return { text: await generateGeminiText(systemPrompt) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر توليد الرد" };
  }
}

const ACTIVITY_PLACES_QUERY: Record<string, string> = {
  hotels: "شقق مفروشة",
  healthcare: "عيادة",
  "barber-salon": "صالون حلاقة",
  salon: "صالون حلاقة",
  restaurant: "مطعم",
  restaurants: "مطعم",
  cafe: "مقهى",
  cafes: "مقهى",
  commerce: "متجر",
  "spa-wellness": "سبا",
  fitness: "نادي رياضي",
  veterinary: "عيادة بيطرية",
  cleaning: "شركة تنظيف",
  maintenance: "صيانة منزلية",
  "car-care": "مغسلة سيارات",
  legal: "مكتب محاماة",
  photography: "استوديو تصوير",
  tutoring: "مركز تعليمي",
  travel: "مكتب سياحة",
  events: "تنظيم مناسبات",
  tailoring: "خياطة",
  "military-tailoring": "خياطة عسكرية",
  "tech-digital": "شركة تقنية",
  "it-support": "صيانة حاسب",
  renovation: "تشطيبات",
  security: "أمن وحراسة",
  training: "معهد تدريب",
  consulting: "مكتب استشارات",
  bodybuilding: "نادي كمال أجسام",
  football: "ملعب كرة قدم",
  hockey: "هوكي",
};

function normalizeCompetitorName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function isSameBusiness(candidate: string, ownName: string): boolean {
  const a = normalizeCompetitorName(candidate);
  const b = normalizeCompetitorName(ownName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function competitorMapsUrl(name: string, address: string, placeId?: string): string {
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || "place")}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  const q = [name, address].filter(Boolean).join(" ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}

function placesSearchQuery(activityId: string, city: string, gbpCategory?: string): string {
  const cityPart = city.trim();
  const term =
    gbpCategory?.trim() ||
    ACTIVITY_PLACES_QUERY[activityId] ||
    ACTIVITIES.find((activity) => activity.id === activityId)?.title ||
    "";
  return [term, cityPart].filter(Boolean).join(" ").trim();
}

function toCompetitorCard(item: {
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  address?: string;
  placeId?: string;
}): GbpCompetitor | null {
  const name = (item.name || "").trim();
  if (!name) return null;
  const address = item.address || "";
  return {
    name,
    rating: item.rating || 0,
    userRatingsTotal: item.userRatingsTotal || 0,
    address,
    placeId: item.placeId,
    mapsUrl: competitorMapsUrl(name, address, item.placeId),
  };
}

async function readGbpCategoryLabel(slug: string): Promise<string> {
  const db = getTenantDb();
  if (!db) return "";
  const { data } = await db
    .from(TENANT_TABLE)
    .select("google_business_location_id")
    .eq("tenant_slug", slug)
    .maybeSingle();
  const locationId =
    (data as { google_business_location_id?: string | null } | null)?.google_business_location_id || "";
  if (!locationId) return "";
  try {
    const detail = await fetchGbpLocationDetail(slug, locationId);
    return detail.primaryCategory?.displayName || detail.primaryCategory?.name || "";
  } catch {
    return "";
  }
}

export async function listGbpCompetitors(
  slug: string
): Promise<{ competitors?: GbpCompetitor[]; source?: string; query?: string; error?: string }> {
  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };

  const { city, lat, lng, category, name: ownName, ownPlaceId } = snap.site;
  const gbpCategory = await readGbpCategoryLabel(slug);
  const query = placesSearchQuery(category, city, gbpCategory);
  const hasActivity = Boolean(
    gbpCategory?.trim() ||
      ACTIVITY_PLACES_QUERY[category] ||
      ACTIVITIES.find((activity) => activity.id === category)?.title
  );
  if (!city || !hasActivity) {
    return { error: "حدّد مدينة المنشأة ونشاطها الرئيسي من الإعدادات قبل جلب المنافسين." };
  }

  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const keepCompetitor = (item: GbpCompetitor) =>
    !isSameBusiness(item.name, ownName) && (!ownPlaceId || item.placeId !== ownPlaceId);

  if (mapsApiKey) {
    try {
      const params = new URLSearchParams({
        query,
        language: "ar",
        region: "sa",
        key: mapsApiKey,
      });
      if (lat != null && lng != null) {
        params.set("location", `${lat},${lng}`);
        params.set("radius", "12000");
      }
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`
      );
      if (!response.ok) throw new Error(`Places API ${response.status}`);
      const data = (await response.json()) as {
        status?: string;
        results?: Array<{
          name?: string;
          rating?: number;
          user_ratings_total?: number;
          formatted_address?: string;
          place_id?: string;
        }>;
      };
      if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) {
        throw new Error(data.status);
      }
      const competitors = (data.results || [])
        .map((item) =>
          toCompetitorCard({
            name: item.name,
            rating: item.rating,
            userRatingsTotal: item.user_ratings_total,
            address: item.formatted_address,
            placeId: item.place_id,
          })
        )
        .filter((item): item is GbpCompetitor => Boolean(item))
        .filter(keepCompetitor)
        .slice(0, 5);
      return { competitors, source: "google_places", query };
    } catch {
      // Places unavailable — labeled simulation only, never salon stubs.
    }
  }

  const activityLabel =
    gbpCategory ||
    ACTIVITY_PLACES_QUERY[category] ||
    ACTIVITIES.find((activity) => activity.id === category)?.title ||
    category;
  if (!city) {
    return { error: "تعذّر جلب المنافسين من خرائط جوجل. أدخل مدينة المنشأة في نطاق الخدمة." };
  }

  const prompt = `أرجع 4 منافسين محليين في نفس النشاط ونفس المدينة فقط.
النشاط: "${activityLabel}"
المدينة: "${city}"
ممنوع ذكر مدن أخرى أو أنشطة مختلفة (مثل صالونات إن لم يكن النشاط صالوناً).
أرجع مصفوفة JSON فقط تبدأ بـ [ وتنتهي بـ ] بالحقول: name, rating, userRatingsTotal, address.`;

  try {
    let cleanJson = (await generateGeminiText(prompt)).trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(cleanJson) as Array<Partial<GbpCompetitor>>;
    const competitors = parsed
      .map((item) =>
        toCompetitorCard({
          name: item.name,
          rating: item.rating,
          userRatingsTotal: item.userRatingsTotal,
          address: item.address,
          placeId: item.placeId,
        })
      )
      .filter((item): item is GbpCompetitor => Boolean(item))
      .filter(keepCompetitor)
      .slice(0, 4);
    if (!competitors.length) {
      return { error: "تعذّر العثور على منافسين لهذه المدينة وهذا النشاط." };
    }
    return { competitors, source: "gemini_simulation", query };
  } catch {
    return { error: "تعذّر جلب منافسين من خرائط جوجل لهذه المدينة والنشاط." };
  }
}

async function googleApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) return explainGbpGoogleError(`${fallback}: ${parsed.error.message}`);
  } catch {
    /* keep fallback */
  }
  return explainGbpGoogleError(`${fallback}: ${text.slice(0, 240)}`);
}

function locationResourceId(locationId: string): string {
  return locationId.replace(/^.*locations\//, "");
}

async function resolveGbpV4Parent(slug: string, locationId: string): Promise<string> {
  if (locationId.startsWith("accounts/") && locationId.includes("/locations/")) {
    return locationId;
  }

  const locId = locationResourceId(locationId);
  const cached = await readGbpLocationDbCache(slug);
  const hit = cached.find(
    (loc) => loc.id === locationId || locationResourceId(loc.id) === locId
  );
  if (hit?.id.startsWith("accounts/") && hit.id.includes("/locations/")) {
    return hit.id;
  }

  if (locationId.startsWith("locations/")) {
    throw new Error("معرّف الفرع ناقص حساب جوجل. اضغط جلب الفروع ثم احفظ الفرع مرة أخرى.");
  }
  return locationId;
}

export async function syncGbpServices(
  slug: string,
  locationId: string,
  serviceIds?: string[]
): Promise<{ count?: number; error?: string }> {
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  const { catalog, error } = await fetchTenantCatalog(slug);
  if (error || !catalog) return { error: error || "تعذّر قراءة الخدمات" };

  const selected = new Set((serviceIds || []).map((id) => id.trim()).filter(Boolean));
  const website = (await tenantWebsiteUrl(slug)).replace(/\/$/, "");
  const services = catalog.services
    .filter((service) => service.enabled && service.available)
    .filter((service) => !selected.size || selected.has(service.id))
    .map((service) => {
      const title = service.overrides.title || service.title;
      const description = service.overrides.description || service.description || "";
      const priceLabel = service.overrides.price || service.price || service.priceLabel || "";
      const bookUrl = `${website}/book?service=${encodeURIComponent(service.id)}`;
      return { id: service.id, title, description, priceLabel, bookUrl };
    })
    .filter((service) => service.title)
    .slice(0, 30);

  if (!services.length) return { error: "لا توجد خدمات مفعّلة لمزامنتها" };

  try {
    const token = await getValidAccessToken(slug);
    const categoryRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=primaryCategory`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!categoryRes.ok) return { error: await googleApiError(categoryRes, "تعذّر قراءة تصنيف الفرع") };

    const categoryData = (await categoryRes.json()) as { primaryCategory?: { name?: string } };
    const categoryId = categoryData.primaryCategory?.name || "";
    if (!categoryId) return { error: "الفرع على جوجل بلا تصنيف أساسي" };

    const serviceItems = services.map((svc) => {
      const bookingLine = `احجز مباشرة: ${svc.bookUrl}`;
      const room = Math.max(0, 300 - bookingLine.length - 1);
      const desc = [svc.description.slice(0, room), bookingLine].filter(Boolean).join("\n").slice(0, 300);
      const label: { displayName: string; languageCode: string; description?: string } = {
        displayName: svc.title,
        languageCode: "ar",
        description: desc,
      };
      const item: Record<string, unknown> = {
        isOffered: true,
        freeFormServiceItem: { category: categoryId, label },
      };
      const money = parseSarMoney(svc.priceLabel);
      if (money) item.price = money;
      return item;
    });

    const updateRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=serviceItems`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceItems }),
      }
    );
    if (!updateRes.ok) return { error: await googleApiError(updateRes, "تعذّر مزامنة الخدمات") };
    return { count: services.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر مزامنة الخدمات" };
  }
}

function parseSarMoney(price: string): { currencyCode: "SAR"; units: string; nanos: number } | null {
  const match = String(price || "").replace(/,/g, "").match(/(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return null;
  const units = match[1];
  const frac = (match[2] || "").padEnd(2, "0").slice(0, 2);
  const nanos = frac ? Number(frac) * 10_000_000 : 0;
  if (!Number.isFinite(Number(units))) return null;
  return { currencyCode: "SAR", units, nanos };
}

export async function publishGbpPost(
  slug: string,
  locationId: string,
  text: string
): Promise<{ error?: string }> {
  const summary = text.trim();
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };
  if (!summary) return { error: "لا يوجد نص للنشر" };
  if (summary.length > 1500) return { error: "النص أطول من 1500 حرف" };

  try {
    const token = await getValidAccessToken(slug);
    const parent = await resolveGbpV4Parent(slug, locationId);
    const createRes = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        languageCode: "ar",
        summary,
        topicType: "STANDARD",
        callToAction: {
          actionType: "BOOK",
          url: await tenantWebsiteUrl(slug),
        },
      }),
    });
    if (!createRes.ok) return { error: await googleApiError(createRes, "تعذّر نشر المنشور على جوجل") };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر نشر المنشور" };
  }
}

export const GBP_POST_STATUSES = ["PENDING", "PUBLISHED", "FAILED"] as const;
export type GbpPostStatus = (typeof GBP_POST_STATUSES)[number];

export interface ScheduledGbpPost {
  id: string;
  tenantSlug: string;
  topic: string;
  content: string;
  imageUrl: string;
  callToAction: string;
  ctaUrl: string;
  status: GbpPostStatus;
  publishAt: string;
  publishedAt: string | null;
  errorLog: string;
  createdAt: string;
}

interface GbpPostRow {
  id: string;
  tenant_slug?: string | null;
  topic?: string | null;
  content?: string | null;
  image_url?: string | null;
  call_to_action?: string | null;
  cta_url?: string | null;
  status?: string | null;
  publish_at?: string | null;
  published_at?: string | null;
  error_log?: string | null;
  created_at?: string | null;
}

function toScheduledPost(row: GbpPostRow): ScheduledGbpPost {
  const status = (GBP_POST_STATUSES as readonly string[]).includes(row.status || "")
    ? (row.status as GbpPostStatus)
    : "PENDING";
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "",
    topic: row.topic || "",
    content: row.content || "",
    imageUrl: row.image_url || "",
    callToAction: row.call_to_action || "BOOK",
    ctaUrl: row.cta_url || "",
    status,
    publishAt: row.publish_at || "",
    publishedAt: row.published_at || null,
    errorLog: row.error_log || "",
    createdAt: row.created_at || "",
  };
}

export async function listScheduledGbpPosts(
  slug: string
): Promise<{ posts?: ScheduledGbpPost[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db
    .from("mken_gbp_scheduled_posts")
    .select("*")
    .eq("tenant_slug", slug)
    .order("publish_at", { ascending: false })
    .limit(40);
  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return { posts: [] };
    return { error: error.message };
  }
  return { posts: ((data || []) as GbpPostRow[]).map(toScheduledPost) };
}

export async function scheduleGbpPost(input: {
  slug: string;
  topic: string;
  content: string;
  publishAt: string;
}): Promise<{ post?: ScheduledGbpPost; publishedNow?: boolean; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const topic = input.topic.trim().slice(0, 80) || "عرض";
  const content = input.content.trim().slice(0, 1500);
  if (!content) return { error: "اكتب نص المنشور أولاً" };
  const at = new Date(input.publishAt);
  if (!Number.isFinite(at.getTime())) return { error: "موعد النشر غير صالح" };

  const website = await tenantWebsiteUrl(input.slug);
  const { data, error } = await db
    .from("mken_gbp_scheduled_posts")
    .insert({
      tenant_slug: input.slug,
      topic,
      content,
      call_to_action: "BOOK",
      cta_url: website,
      status: "PENDING",
      publish_at: at.toISOString(),
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: error?.message || "تعذّر جدولة المنشور" };

  const post = toScheduledPost(data as GbpPostRow);
  if (at.getTime() <= Date.now() + 15_000) {
    const published = await publishOneScheduledPost(post);
    return { post: published.post || post, publishedNow: !published.error, error: published.error };
  }
  return { post };
}

async function publishOneScheduledPost(
  post: ScheduledGbpPost
): Promise<{ post?: ScheduledGbpPost; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { status } = await fetchGbpStatus(post.tenantSlug);
  const locationId = status?.selectedLocationId || "";
  const result = await publishGbpPost(post.tenantSlug, locationId, post.content);
  const now = new Date().toISOString();
  if (result.error) {
    await db
      .from("mken_gbp_scheduled_posts")
      .update({ status: "FAILED", error_log: result.error, published_at: now })
      .eq("id", post.id);
    return { error: result.error };
  }
  const { data } = await db
    .from("mken_gbp_scheduled_posts")
    .update({ status: "PUBLISHED", published_at: now, error_log: null })
    .eq("id", post.id)
    .select("*")
    .maybeSingle();
  return { post: data ? toScheduledPost(data as GbpPostRow) : post };
}

export async function publishDueGbpPosts(): Promise<{ published: number; failed: number }> {
  const db = getTenantDb();
  if (!db) return { published: 0, failed: 0 };
  const { data, error } = await db
    .from("mken_gbp_scheduled_posts")
    .select("*")
    .eq("status", "PENDING")
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: true })
    .limit(12);
  if (error || !data?.length) return { published: 0, failed: 0 };

  let published = 0;
  let failed = 0;
  for (const row of data as GbpPostRow[]) {
    const result = await publishOneScheduledPost(toScheduledPost(row));
    if (result.error) failed += 1;
    else published += 1;
  }
  return { published, failed };
}
