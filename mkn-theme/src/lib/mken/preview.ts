import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/mken/gbp";
import {
  TENANT_TABLE,
  getTenantDb,
  isPlatformSlug,
  type MkenConfig,
  type TenantRow,
} from "@/lib/mken/tenant";
import { sha256Hex } from "@/lib/auth/session";

/**
 * Safe Magic Preview — inbound only.
 * Hard stop: never scrape wa.me/c, never persist Places reviews/photos/addresses,
 * never pass Google reviews into an LLM, never send cold WhatsApp.
 * Persist place_id (and owner phone / consent) only.
 */

export const PREVIEW_TTL_DAYS = 7;
export const PREVIEW_RATE_IP_LIMIT = 3;
export const PREVIEW_RATE_IP_WINDOW_MS = 10 * 60 * 1000;
export const PREVIEW_RATE_PHONE_LIMIT = 3;
export const PREVIEW_RATE_PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type PreviewClaimStatus = "unclaimed" | "pending" | "claimed";

export interface PreviewState {
  claimStatus: PreviewClaimStatus;
  placeId: string;
  expiresAt: string;
  otpHash?: string;
  otpExpiresAt?: string;
}

export interface LivePlaceReview {
  authorName: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating?: number;
  text?: string;
  relativeTime?: string;
  publishTime?: string;
}

export interface LivePlacePhoto {
  reference: string;
  attributions: string[];
}

export interface LivePlaceDetails {
  placeId: string;
  name: string;
  address?: string;
  mapsUrl?: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingsTotal?: number;
  weekdayText?: string[];
  openingPeriods?: Array<{
    openDay?: number;
    openTime?: { hours: number; minutes: number };
    closeTime?: { hours: number; minutes: number };
  }>;
  types?: string[];
  reviews: LivePlaceReview[];
  photos: LivePlacePhoto[];
  attribution: "Google Maps";
}

function placesTimeParts(time?: string): { hours: number; minutes: number } | undefined {
  if (!time || !/^\d{3,4}$/.test(time)) return undefined;
  const padded = time.padStart(4, "0");
  return { hours: Number(padded.slice(0, 2)), minutes: Number(padded.slice(2)) };
}

function openingPeriodsFromLegacy(
  periods?: Array<{ open?: { day?: number; time?: string }; close?: { day?: number; time?: string } }>
): LivePlaceDetails["openingPeriods"] {
  if (!periods?.length) return undefined;
  return periods
    .map((period) => {
      const openTime = placesTimeParts(period.open?.time);
      const closeTime = placesTimeParts(period.close?.time);
      if (!openTime || !closeTime || period.open?.day == null) return null;
      return { openDay: period.open.day, openTime, closeTime };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

const PLACE_DETAILS_FIELDS = [
  "place_id",
  "name",
  "formatted_address",
  "international_phone_number",
  "website",
  "url",
  "rating",
  "user_ratings_total",
  "opening_hours",
  "reviews",
  "photos",
  "types",
].join(",");

const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const SMS_IP_LIMIT = 1;
const SMS_IP_WINDOW_MS = 10 * 60 * 1000;

const rateBuckets = new Map<string, { windowStart: number; count: number }>();
const placesMemoryCache = new Map<string, { exp: number; value: LivePlaceDetails }>();

function mapsKey(): string {
  return (process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

export function isPlacesApiConfigured(): boolean {
  return Boolean(mapsKey());
}

const MAPS_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripBidiMarks(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

function safeUrl(input: string): URL | null {
  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

function isShortMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "share.google" ||
    host.endsWith(".app.goo.gl")
  );
}

function unwrapGoogleConsentUrl(url: string): string {
  const parsed = safeUrl(url);
  if (!parsed) return url;
  if (!parsed.hostname.toLowerCase().includes("consent.google")) return url;
  const cont = parsed.searchParams.get("continue");
  return cont ? cont : url;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  increment = true
): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (!increment) return { limited: false, retryAfterSec: 0 };
    bucket = { windowStart: now, count: 0 };
  }
  if (bucket.count >= limit) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - bucket.windowStart)) / 1000)),
    };
  }
  if (increment) {
    bucket.count += 1;
    rateBuckets.set(key, bucket);
  }
  return { limited: false, retryAfterSec: 0 };
}

export function previewExpiryIso(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + PREVIEW_TTL_DAYS);
  return d.toISOString();
}

export function previewStateFromConfig(config: MkenConfig | null | undefined): PreviewState | null {
  const raw = config?.preview;
  if (!raw || typeof raw !== "object") return null;
  const preview = raw as Record<string, unknown>;
  const placeId = typeof preview.placeId === "string" ? preview.placeId.trim() : "";
  const rawStatus = typeof preview.claimStatus === "string" ? preview.claimStatus : "claimed";
  const claimStatus: PreviewClaimStatus =
    rawStatus === "unclaimed" || rawStatus === "pending" ? rawStatus : "claimed";
  if (!placeId) return null;
  return {
    claimStatus,
    placeId,
    expiresAt: typeof preview.expiresAt === "string" ? preview.expiresAt : "",
    otpHash: typeof preview.otpHash === "string" ? preview.otpHash : undefined,
    otpExpiresAt: typeof preview.otpExpiresAt === "string" ? preview.otpExpiresAt : undefined,
  };
}

export function isNoIndexPreviewStatus(status: string | null | undefined): boolean {
  const value = (status || "").toLowerCase();
  return value === "unclaimed" || value === "pending";
}

export function isUnclaimedPreviewConfig(config: MkenConfig | null | undefined): boolean {
  return isNoIndexPreviewStatus(previewStateFromConfig(config)?.claimStatus);
}

/** Always reads claim_status (indexed). Do not cache "unclaimed" — stale noindex after GBP is worse than one lookup. */
export async function isUnclaimedPreviewSlug(slug: string): Promise<boolean> {
  const key = slug.trim().toLowerCase();
  if (!key || isPlatformSlug(key)) return false;

  const db = getTenantDb();
  if (!db) return false;
  type PreviewFlags = { claim_status?: string | null; config_data?: MkenConfig | null };
  const full = await db
    .from(TENANT_TABLE)
    .select("claim_status")
    .eq("tenant_slug", key)
    .maybeSingle();
  if (!full.error) {
    return isNoIndexPreviewStatus((full.data as PreviewFlags | null)?.claim_status);
  }
  const fallback = await db
    .from(TENANT_TABLE)
    .select("config_data")
    .eq("tenant_slug", key)
    .maybeSingle();
  return isUnclaimedPreviewConfig((fallback.data as PreviewFlags | null)?.config_data);
}

export async function attachUnclaimedRobotsHeader(
  response: NextResponse,
  slug: string | null
): Promise<NextResponse> {
  if (slug && (await isUnclaimedPreviewSlug(slug))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("00966")) n = n.slice(2);
  if (n.startsWith("966")) {
    /* keep */
  } else if (n.startsWith("0") && n.length === 10) {
    n = `966${n.slice(1)}`;
  } else if (n.length === 9 && n.startsWith("5")) {
    n = `966${n}`;
  } else {
    return null;
  }
  if (!/^9665\d{8}$/.test(n)) return null;
  return n;
}

function normalizeMapsInput(input: string): string {
  let value = stripBidiMarks(input).replace(/\u00a0/g, " ").trim();
  const urlMatch = value.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch) return urlMatch[0].replace(/[)\].,،؛]+$/g, "");
  if (/^(?:www\.)?(?:maps\.app\.goo\.gl|goo\.gl|share\.google)\//i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

export function extractPlaceIdCandidate(input: string): string | null {
  const trimmed = normalizeMapsInput(input);
  if (/^(?:ChIJ|GhIJ|EhIJ)[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  const fromQuery = decoded.match(/[?&](?:place_id|query_place_id)=((?:ChIJ|GhIJ|EhIJ)[^&]+)/i);
  if (fromQuery?.[1]) return fromQuery[1];
  const fromBang = decoded.match(/!1s((?:ChIJ|GhIJ|EhIJ)[A-Za-z0-9_-]+)/);
  if (fromBang?.[1]) return fromBang[1];
  const anywhere = decoded.match(/\b((?:ChIJ|GhIJ|EhIJ)[A-Za-z0-9_-]{10,})\b/);
  return anywhere?.[1] || null;
}

export function extractPlaceNameFromMapsUrl(url: string): string | null {
  const match = url.match(/\/maps\/place\/([^/@?#]+)/i);
  if (!match?.[1]) return null;
  let name = match[1].replace(/\+/g, " ");
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  name = stripBidiMarks(name.replace(/\|/g, " ").replace(/\s+/g, " "));
  return name.length >= 2 ? name : null;
}

export function extractLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const bang = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: Number(bang[1]), lng: Number(bang[2]) };
  return null;
}

function extractCidFromMapsUrl(url: string): string | null {
  const match = url.match(/!1s0x[0-9a-f]+:0x([0-9a-f]+)/i);
  if (!match?.[1]) return null;
  try {
    return BigInt(`0x${match[1]}`).toString(10);
  } catch {
    return null;
  }
}

function extractMapsUrlFromHtml(html: string): string | null {
  const refresh =
    html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=['"]?([^"'>]+)/i) ||
    html.match(/content=["'][^"']*url=['"]?([^"'>]+)[^"']*["'][^>]*http-equiv=["']refresh["']/i);
  if (refresh?.[1]) return refresh[1].replace(/&amp;/g, "&");
  const canonical =
    html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/i) ||
    html.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (canonical?.[1]?.includes("/maps/")) return canonical[1];
  const href = html.match(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'<\s]+/i);
  return href?.[0]?.replace(/&amp;/g, "&") || null;
}

const MAPS_FETCH_HEADERS = {
  "User-Agent": MAPS_FETCH_UA,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ar,en;q=0.8",
};

const GOOGLE_FETCH_MS = 3500;
const RESOLVE_PLACE_MS = 5000;
const PLACE_DETAILS_MS = 3500;
const CACHE_READ_MS = 800;

async function mapsFetch(url: string, init: RequestInit = {}, timeoutMs = GOOGLE_FETCH_MS): Promise<Response | null> {
  try {
    return await fetch(url, {
      cache: "no-store",
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
}

async function mapsFetchJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T | null> {
  const res = await mapsFetch(url, init, timeoutMs);
  if (!res?.ok) return null;
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

async function resolveMapsShortUrl(url: string): Promise<string> {
  let current = unwrapGoogleConsentUrl(normalizeMapsInput(url));
  const parsed = safeUrl(current);
  if (!parsed || !isShortMapsHost(parsed.hostname)) return current;

  for (let hop = 0; hop < 5; hop++) {
    current = unwrapGoogleConsentUrl(current);
    const host = safeUrl(current)?.hostname || "";
    if (host && !isShortMapsHost(host) && !host.includes("consent.google")) break;
    const res = await mapsFetch(
      current,
      { method: "GET", redirect: "manual", headers: MAPS_FETCH_HEADERS },
      3500
    );
    if (!res) break;
    const location = res.headers.get("location");
    if (location && res.status >= 300 && res.status < 400) {
      current = new URL(location, current).href;
      continue;
    }
    const html = await res.text().catch(() => "");
    const fromHtml = html ? extractMapsUrlFromHtml(html) : null;
    if (fromHtml) {
      current = new URL(fromHtml, current).href;
      continue;
    }
    if (res.url && res.url !== current) {
      current = res.url;
      continue;
    }
    break;
  }

  if (isShortMapsHost(safeUrl(current)?.hostname || "")) {
    const followed = await mapsFetch(
      current,
      { method: "GET", redirect: "follow", headers: MAPS_FETCH_HEADERS },
      3500
    );
    if (followed?.url) current = followed.url;
    if (followed && isShortMapsHost(safeUrl(current)?.hostname || "")) {
      const html = await followed.text().catch(() => "");
      const fromHtml = html ? extractMapsUrlFromHtml(html) : null;
      if (fromHtml) current = new URL(fromHtml, current).href;
    }
  }
  return unwrapGoogleConsentUrl(current);
}

async function findPlaceIdFromTextNew(
  query: string,
  bias?: { lat: number; lng: number }
): Promise<string | null> {
  const key = mapsKey();
  if (!key || !query.trim()) return null;
  const body: Record<string, unknown> = {
    textQuery: query.trim(),
    languageCode: "ar",
  };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: 400,
      },
    };
  }
  const data = await mapsFetchJson<{ places?: Array<{ id?: string }> }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify(body),
    }
  );
  return data?.places?.[0]?.id || null;
}

async function findPlaceIdFromText(
  query: string,
  bias?: { lat: number; lng: number }
): Promise<string | null> {
  const key = mapsKey();
  if (!key || !query.trim()) return null;
  const params = new URLSearchParams({
    input: query.trim(),
    inputtype: "textquery",
    fields: "place_id",
    language: "ar",
    key,
  });
  if (bias) params.set("locationbias", `point:${bias.lat},${bias.lng}`);
  const data = await mapsFetchJson<{
    status?: string;
    candidates?: Array<{ place_id?: string }>;
  }>(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`);
  if (data) {
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("findplacefromtext", data.status);
    }
    if (data.candidates?.[0]?.place_id) return data.candidates[0].place_id;
  }
  return findPlaceIdFromTextNew(query, bias);
}

async function findPlaceIdFromCid(cid: string): Promise<string | null> {
  const key = mapsKey();
  if (!key) return null;
  const data = await mapsFetchJson<{ result?: { place_id?: string } }>(
    `https://maps.googleapis.com/maps/api/place/details/json?cid=${encodeURIComponent(cid)}&fields=place_id&language=ar&key=${key}`
  );
  return data?.result?.place_id || null;
}

async function findPlaceIdFromLatLng(
  bias: { lat: number; lng: number },
  name?: string | null
): Promise<string | null> {
  const key = mapsKey();
  if (!key) return null;
  const params = new URLSearchParams({
    latlng: `${bias.lat},${bias.lng}`,
    language: "ar",
    key,
  });
  const data = await mapsFetchJson<{
    results?: Array<{ place_id?: string; formatted_address?: string; types?: string[] }>;
  }>(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!data) return null;
  const results = data.results || [];
  if (name) {
    const needle = name.slice(0, 8);
    const hit = results.find((row) => (row.formatted_address || "").includes(needle));
    if (hit?.place_id) return hit.place_id;
  }
  const poi = results.find((row) =>
    (row.types || []).some((type) => type === "establishment" || type === "point_of_interest" || type === "premise")
  );
  return poi?.place_id || results[0]?.place_id || null;
}

export async function resolvePlaceId(mapsInput: string): Promise<string | null> {
  return withTimeout(resolvePlaceIdUncapped(mapsInput), RESOLVE_PLACE_MS);
}

async function resolvePlaceIdUncapped(mapsInput: string): Promise<string | null> {
  const trimmed = normalizeMapsInput(mapsInput);
  if (!trimmed) return null;
  const direct = extractPlaceIdCandidate(trimmed);
  if (direct) return direct;

  const expanded = await resolveMapsShortUrl(trimmed);
  const fromExpanded = extractPlaceIdCandidate(expanded);
  if (fromExpanded) return fromExpanded;

  const name = extractPlaceNameFromMapsUrl(expanded);
  const bias = extractLatLngFromMapsUrl(expanded);
  const cid = extractCidFromMapsUrl(expanded);

  if (cid) {
    const fromCid = await findPlaceIdFromCid(cid);
    if (fromCid) return fromCid;
  }
  if (name) {
    const fromName = await findPlaceIdFromText(name, bias || undefined);
    if (fromName) return fromName;
  }
  if (bias) {
    const fromCoords = await findPlaceIdFromText(name || `${bias.lat},${bias.lng}`, bias);
    if (fromCoords) return fromCoords;
    const fromGeo = await findPlaceIdFromLatLng(bias, name);
    if (fromGeo) return fromGeo;
  }
  return findPlaceIdFromText(name || expanded, bias || undefined);
}

function placesCacheKey(placeId: string): string {
  return `mken:places:details:${placeId}`;
}

async function readUpstash(key: string): Promise<string | null> {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CACHE_READ_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    return typeof body.result === "string" ? body.result : null;
  } catch {
    return null;
  }
}

async function writeUpstash(key: string, value: string, ttlSec: number): Promise<void> {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", key, value, "EX", String(ttlSec)]),
      cache: "no-store",
      signal: AbortSignal.timeout(CACHE_READ_MS),
    });
  } catch {
    /* session cache is best-effort */
  }
}

async function readPlacesCache(placeId: string): Promise<LivePlaceDetails | null> {
  const mem = placesMemoryCache.get(placeId);
  if (mem && mem.exp > Date.now()) return mem.value;
  const raw = await readUpstash(placesCacheKey(placeId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LivePlaceDetails;
    placesMemoryCache.set(placeId, { exp: Date.now() + PREVIEW_CACHE_TTL_MS, value: parsed });
    return parsed;
  } catch {
    return null;
  }
}

async function writePlacesCache(placeId: string, value: LivePlaceDetails): Promise<void> {
  placesMemoryCache.set(placeId, { exp: Date.now() + PREVIEW_CACHE_TTL_MS, value });
  await writeUpstash(placesCacheKey(placeId), JSON.stringify(value), Math.floor(PREVIEW_CACHE_TTL_MS / 1000));
}

export async function fetchLivePlaceDetails(placeId: string): Promise<LivePlaceDetails | null> {
  const cached = await withTimeout(readPlacesCache(placeId), CACHE_READ_MS);
  if (cached) return cached;
  const fetched = await withTimeout(fetchLivePlaceDetailsFromGoogle(placeId), PLACE_DETAILS_MS);
  if (fetched) void writePlacesCache(placeId, fetched);
  return fetched;
}

async function fetchLivePlaceDetailsFromGoogle(placeId: string): Promise<LivePlaceDetails | null> {
  const key = mapsKey();
  if (!key) return null;
  const legacy = await fetchLivePlaceDetailsLegacy(placeId, key);
  if (legacy) return legacy;
  return fetchLivePlaceDetailsNew(placeId, key);
}

async function fetchLivePlaceDetailsLegacy(placeId: string, key: string): Promise<LivePlaceDetails | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}&fields=${PLACE_DETAILS_FIELDS}&language=ar&key=${key}`;
  const data = await mapsFetchJson<{
    status?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      international_phone_number?: string;
      website?: string;
      url?: string;
      rating?: number;
      user_ratings_total?: number;
      types?: string[];
      opening_hours?: {
        weekday_text?: string[];
        periods?: Array<{ open?: { day?: number; time?: string }; close?: { day?: number; time?: string } }>;
      };
      reviews?: Array<{
        author_name?: string;
        author_url?: string;
        profile_photo_url?: string;
        rating?: number;
        text?: string;
        relative_time_description?: string;
        time?: number;
      }>;
      photos?: Array<{ photo_reference?: string; html_attributions?: string[] }>;
    };
  }>(url);
  if (!data || data.status !== "OK" || !data.result?.place_id) return null;
  const result = data.result;
  const resolvedId = data.result.place_id;
  return {
    placeId: resolvedId || placeId,
    name: result.name || "",
    address: result.formatted_address,
    mapsUrl: result.url,
    phone: result.international_phone_number,
    website: result.website,
    rating: result.rating,
    ratingsTotal: result.user_ratings_total,
    weekdayText: result.opening_hours?.weekday_text,
    openingPeriods: openingPeriodsFromLegacy(result.opening_hours?.periods),
    types: result.types,
    reviews: (result.reviews || []).map((review) => ({
      authorName: review.author_name || "",
      authorUrl: review.author_url,
      profilePhotoUrl: review.profile_photo_url,
      rating: review.rating,
      text: review.text,
      relativeTime: review.relative_time_description,
      publishTime: review.time ? new Date(review.time * 1000).toISOString() : undefined,
    })),
    photos: (result.photos || [])
      .filter((photo) => photo.photo_reference)
      .slice(0, 6)
      .map((photo) => ({
        reference: photo.photo_reference as string,
        attributions: photo.html_attributions || [],
      })),
    attribution: "Google Maps",
  };
}

async function fetchLivePlaceDetailsNew(placeId: string, key: string): Promise<LivePlaceDetails | null> {
  const result = await mapsFetchJson<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    regularOpeningHours?: {
      weekdayDescriptions?: string[];
      periods?: Array<{
        open?: { day?: number; hour?: number; minute?: number };
        close?: { day?: number; hour?: number; minute?: number };
      }>;
    };
    reviews?: Array<{
      authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
    }>;
    photos?: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string }> }>;
  }>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ar`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,googleMapsUri,rating,userRatingCount,regularOpeningHours,types,reviews,photos",
    },
  });
  if (!result?.id) return null;
  return {
    placeId: result.id,
    name: result.displayName?.text || "",
    address: result.formattedAddress,
    mapsUrl: result.googleMapsUri,
    phone: result.internationalPhoneNumber,
    website: result.websiteUri,
    rating: result.rating,
    ratingsTotal: result.userRatingCount,
    weekdayText: result.regularOpeningHours?.weekdayDescriptions,
    openingPeriods: (result.regularOpeningHours?.periods || [])
      .map((period) => {
        if (period.open?.day == null || period.open.hour == null || period.close?.hour == null) return null;
        return {
          openDay: period.open.day,
          openTime: { hours: period.open.hour, minutes: period.open.minute || 0 },
          closeTime: { hours: period.close.hour, minutes: period.close.minute || 0 },
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    types: result.types,
    reviews: (result.reviews || []).map((review) => ({
      authorName: review.authorAttribution?.displayName || "",
      authorUrl: review.authorAttribution?.uri,
      profilePhotoUrl: review.authorAttribution?.photoUri,
      rating: review.rating,
      text: review.text?.text,
      relativeTime: review.relativePublishTimeDescription,
      publishTime: review.publishTime,
    })),
    photos: (result.photos || [])
      .filter((photo) => photo.name)
      .slice(0, 6)
      .map((photo) => ({
        reference: photo.name as string,
        attributions: (photo.authorAttributions || []).map((row) => row.displayName || "").filter(Boolean),
      })),
    attribution: "Google Maps",
  };
}

export async function proxyPlacePhoto(photoReference: string): Promise<Response | null> {
  const key = mapsKey();
  if (!key || !photoReference || photoReference.length > 1500) return null;
  const url = photoReference.startsWith("places/")
    ? `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=800&key=${key}`
    : "https://maps.googleapis.com/maps/api/place/photo" +
      `?maxwidth=800&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`;
  const res = await mapsFetch(url, { redirect: "follow" }, 5000);
  if (!res?.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Source": "Google Maps",
    },
  });
}

function previewConfig(opts: {
  phone: string;
  placeId: string;
  expiresAt: string;
  activityId?: string;
}): MkenConfig {
  return {
    enabledActivities: ["tech-digital"],
    enabled: ["web-design", "whatsapp-crm", "seo"],
    featuredActivity: "tech-digital",
    featured: "web-design",
    theme: "slate",
    phone: opts.phone,
    brand: {
      name: "معاينة مكّن",
      tagline: "معاينة بموافقة المالك — غير مفهرسة حتى المطالبة",
      logo: "",
    },
    activities: {},
    services: {},
    booking: { enabled: false, mode: "form", requirePayment: false },
    serviceArea: { enabled: false, city: "", radiusKm: 15 },
    saas: { baseDomain: "mken.live", useSubdomains: true },
    whatsappApi: { enabled: false },
    payment: { enabled: false },
    subscription: {
      tier: "growth",
      status: "trial",
      trialDays: PREVIEW_TTL_DAYS,
    },
    onboarding: {
      catalogVersion: 1,
      activityId: opts.activityId || "tech-digital",
      completedSteps: ["preview_consent"],
    },
    preview: {
      claimStatus: "unclaimed",
      placeId: opts.placeId,
      expiresAt: opts.expiresAt,
    },
    demoNotice: "هذه معاينة تجريبية غير مفهرسة. اطلب المطالبة لربط Google Business وواتساب رسمياً.",
  } as MkenConfig;
}

async function slugForPlace(placeId: string): Promise<string> {
  const hash = await sha256Hex(placeId);
  return `pv-${hash.slice(0, 10)}`;
}

export async function findTenantByPlaceId(placeId: string): Promise<TenantRow | null> {
  const db = getTenantDb();
  if (!db) return null;
  const byColumn = await db
    .from(TENANT_TABLE)
    .select("tenant_slug, business_name, email, phone, subscription_status, config_data")
    .eq("google_place_id", placeId)
    .limit(1);
  if (!byColumn.error && byColumn.data?.length) return byColumn.data[0] as TenantRow;
  const { data } = await db
    .from(TENANT_TABLE)
    .select("tenant_slug, business_name, email, phone, subscription_status, config_data")
    .eq("config_data->preview->>placeId", placeId)
    .limit(1);
  return data?.length ? (data[0] as TenantRow) : null;
}

export async function logPdplConsent(opts: {
  tenantSlug: string;
  phone: string;
  ip: string;
  userAgent: string;
  consentType?: string;
}): Promise<void> {
  const db = getTenantDb();
  if (!db) return;
  const row = {
    tenant_slug: opts.tenantSlug,
    user_phone: opts.phone,
    consent_type: opts.consentType || "DATA_PROCESSING",
    consent_status: "GRANTED",
    ip_address: opts.ip.slice(0, 45),
    user_agent: opts.userAgent.slice(0, 500),
  };
  const { error } = await db.from("pdpl_consent_logs").insert(row);
  if (error) {
    console.error("pdpl_consent_logs insert failed", error.message);
  }
}

export async function createUnclaimedPreview(opts: {
  placeId: string;
  phone: string;
  ip: string;
  userAgent: string;
}): Promise<{ slug: string; expiresAt: string; existing?: boolean; error?: string }> {
  const db = getTenantDb();
  if (!db) return { slug: "", expiresAt: "", error: "قاعدة البيانات غير مهيأة على الخادم" };

  const existing = await findTenantByPlaceId(opts.placeId);
  if (existing?.tenant_slug) {
    const state = previewStateFromConfig(existing.config_data);
    if (state?.claimStatus === "unclaimed") {
      return { slug: existing.tenant_slug, expiresAt: state.expiresAt, existing: true };
    }
    return { slug: "", expiresAt: "", error: "هذا النشاط مرتبط مسبقاً بمنشأة على مكّن" };
  }

  const slug = await slugForPlace(opts.placeId);
  if (isPlatformSlug(slug)) {
    return { slug: "", expiresAt: "", error: "تعذّر إنشاء المعاينة" };
  }
  const expiresAt = previewExpiryIso();
  const config = previewConfig({ phone: opts.phone, placeId: opts.placeId, expiresAt });
  const email = `preview-${slug}@unclaimed.mken.live`;

  const payloads: Record<string, unknown>[] = [
    {
      tenant_slug: slug,
      business_name: "معاينة مكّن",
      email,
      phone: opts.phone,
      subscription_status: "trial",
      subscription_tier: "growth",
      subscription_end: expiresAt,
      google_place_id: opts.placeId,
      claim_status: "unclaimed",
      preview_expires_at: expiresAt,
      config_data: config,
    },
    {
      tenant_slug: slug,
      business_name: "معاينة مكّن",
      email,
      phone: opts.phone,
      subscription_status: "trial",
      subscription_end: expiresAt,
      config_data: config,
    },
  ];

  let lastError = "";
  for (const payload of payloads) {
    const { error } = await db.from(TENANT_TABLE).insert(payload);
    if (!error) {
      await logPdplConsent({
        tenantSlug: slug,
        phone: opts.phone,
        ip: opts.ip,
        userAgent: opts.userAgent,
        consentType: "DATA_PROCESSING",
      });
      return { slug, expiresAt };
    }
    lastError = error.message;
    if (/duplicate|unique/i.test(error.message)) {
      return { slug, expiresAt, existing: true };
    }
  }
  return { slug: "", expiresAt: "", error: lastError || "تعذّر إنشاء المعاينة" };
}

export async function loadPreviewRow(slug: string): Promise<{
  row?: TenantRow & { google_place_id?: string | null; claim_status?: string | null };
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const full = await db
    .from(TENANT_TABLE)
    .select("tenant_slug, business_name, email, phone, subscription_status, config_data, google_place_id, claim_status, preview_expires_at")
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (!full.error) {
    if (!full.data) return {};
    return { row: full.data as TenantRow };
  }
  const fallback = await db
    .from(TENANT_TABLE)
    .select("tenant_slug, business_name, email, phone, subscription_status, config_data")
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (fallback.error) return { error: fallback.error.message };
  if (!fallback.data) return {};
  return { row: fallback.data as TenantRow };
}

function authenticaKey(): string {
  return (process.env.AUTHENTICA_API_KEY || "").trim();
}

export async function startClaimOtp(
  slug: string,
  phone: string,
  gate: { ip: string; turnstileToken?: string }
): Promise<{ error?: string; devOtp?: string; retryAfterSec?: number }> {
  const captchaOk = await verifyTurnstile(gate.turnstileToken, gate.ip);
  if (!captchaOk) {
    return { error: "فشل التحقق. حدّث الصفحة وحاول مجدداً." };
  }

  const ipLimit = isRateLimited(`preview:sms:ip:${gate.ip}`, SMS_IP_LIMIT, SMS_IP_WINDOW_MS);
  if (ipLimit.limited) {
    return {
      error: "تجاوزت حد طلبات التحقق. أعد المحاولة بعد 10 دقائق.",
      retryAfterSec: ipLimit.retryAfterSec,
    };
  }

  const loaded = await loadPreviewRow(slug);
  if (!loaded.row) return { error: loaded.error || "المعاينة غير موجودة" };
  const state = previewStateFromConfig(loaded.row.config_data);
  if (state?.claimStatus && state.claimStatus !== "unclaimed") {
    return { error: "هذه المنشأة مُطالب بها مسبقاً" };
  }
  const storedPhone = normalizeSaudiPhone(loaded.row.phone || "") || "";
  if (storedPhone !== phone) return { error: "رقم الجوال لا يطابق سجل الموافقة" };

  const phoneLimit = isRateLimited(
    `preview:sms:phone:${phone}`,
    PREVIEW_RATE_PHONE_LIMIT,
    PREVIEW_RATE_PHONE_WINDOW_MS
  );
  if (phoneLimit.limited) {
    return {
      error: "تجاوزت حد رسائل التحقق لهذا الرقم اليوم (3 رسائل).",
      retryAfterSec: phoneLimit.retryAfterSec,
    };
  }

  const key = authenticaKey();
  if (key) {
    const res = await fetch("https://api.authentica.sa/api/v2/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Authorization": key,
      },
      body: JSON.stringify({
        method: "sms",
        phone,
        template_id: Number(process.env.AUTHENTICA_TEMPLATE_ID || "1"),
      }),
    });
    if (!res.ok) return { error: "تعذّر إرسال رمز التحقق. حاول لاحقاً." };
    return {};
  }

  if (process.env.VERCEL_ENV === "production" && process.env.ALLOW_PREVIEW_DEV_OTP !== "1") {
    return { error: "خدمة التحقق النصي غير مهيأة. عيّن AUTHENTICA_API_KEY." };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await sha256Hex(`${slug}:${phone}:${otp}`);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const config: MkenConfig = {
    ...(loaded.row.config_data || {}),
    preview: {
      ...(state || { claimStatus: "unclaimed", placeId: "", expiresAt: "" }),
      otpHash,
      otpExpiresAt,
    },
  };
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  await db.from(TENANT_TABLE).update({ config_data: config }).eq("tenant_slug", slug);
  const allowDev = process.env.NODE_ENV !== "production";
  return allowDev ? { devOtp: otp } : {};
}

export async function verifyClaimOtp(
  slug: string,
  phone: string,
  otp: string
): Promise<{ error?: string; googleAuthUrl?: string }> {
  const loaded = await loadPreviewRow(slug);
  if (!loaded.row) return { error: loaded.error || "المعاينة غير موجودة" };
  const state = previewStateFromConfig(loaded.row.config_data);
  const status =
    state?.claimStatus ||
    (loaded.row as { claim_status?: string | null }).claim_status ||
    "unclaimed";
  if (status !== "unclaimed") return { error: "هذه المنشأة مُطالب بها مسبقاً" };
  const storedPhone = normalizeSaudiPhone(loaded.row.phone || "") || "";
  if (storedPhone !== phone) return { error: "رقم الجوال لا يطابق سجل الموافقة" };

  const key = authenticaKey();
  if (key) {
    const res = await fetch("https://api.authentica.sa/api/v2/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Authorization": key,
      },
      body: JSON.stringify({ phone, otp }),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (!res.ok || body.success === false) return { error: "رمز التحقق غير صحيح" };
  } else {
    if (!state?.otpHash || !state.otpExpiresAt || new Date(state.otpExpiresAt).getTime() < Date.now()) {
      return { error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً." };
    }
    const hashed = await sha256Hex(`${slug}:${phone}:${otp.trim()}`);
    if (hashed !== state.otpHash) return { error: "رمز التحقق غير صحيح" };
  }

  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const nextConfig: MkenConfig = {
    ...(loaded.row.config_data || {}),
    preview: {
      claimStatus: "pending",
      placeId: state?.placeId || "",
      expiresAt: state?.expiresAt || "",
    },
    whatsappApi: { enabled: false },
    onboarding: {
      ...((loaded.row.config_data?.onboarding as object) || {}),
      completedSteps: ["preview_consent", "otp_verified"],
    },
  };
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  await db
    .from(TENANT_TABLE)
    .update({
      claim_status: "pending",
      config_data: nextConfig,
      subscription_status: "trial",
      subscription_end: trialEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);
  const built = buildGoogleAuthUrl(slug);
  return { googleAuthUrl: built.url };
}

export async function markPreviewIndexedAfterGbp(slug: string): Promise<void> {
  const key = slug.trim().toLowerCase();
  if (!key || isPlatformSlug(key)) return;
  const loaded = await loadPreviewRow(key);
  if (!loaded.row) return;
  const state = previewStateFromConfig(loaded.row.config_data);
  const status =
    (loaded.row as { claim_status?: string | null }).claim_status || state?.claimStatus || "";
  if (status !== "pending" && status !== "unclaimed") return;
  const db = getTenantDb();
  if (!db) return;
  const nextConfig: MkenConfig = {
    ...(loaded.row.config_data || {}),
    preview: {
      claimStatus: "claimed",
      placeId: state?.placeId || "",
      expiresAt: state?.expiresAt || "",
    },
    onboarding: {
      ...((loaded.row.config_data?.onboarding as object) || {}),
      completedSteps: ["preview_consent", "otp_verified", "google_business"],
    },
  };
  await db
    .from(TENANT_TABLE)
    .update({
      claim_status: "claimed",
      preview_expires_at: null,
      config_data: nextConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", key);
}

export async function purgeExpiredUnclaimedPreviews(): Promise<{ deleted: number; error?: string }> {
  const db = getTenantDb();
  if (!db) return { deleted: 0, error: "db_unconfigured" };
  const now = new Date().toISOString();
  const indexed = await db
    .from(TENANT_TABLE)
    .select("tenant_slug")
    .eq("claim_status", "unclaimed")
    .lt("preview_expires_at", now);
  if (!indexed.error) {
    const rows = indexed.data || [];
    let deleted = 0;
    for (const row of rows) {
      const slug = (row as { tenant_slug: string }).tenant_slug;
      const { error: delError } = await db.from(TENANT_TABLE).delete().eq("tenant_slug", slug);
      if (!delError) deleted += 1;
    }
    return { deleted };
  }

  const { data, error } = await db.from(TENANT_TABLE).select("tenant_slug, config_data");
  if (error) return { deleted: 0, error: error.message };
  let deleted = 0;
  for (const row of data || []) {
    const rec = row as { tenant_slug: string; config_data?: MkenConfig | null };
    const state = previewStateFromConfig(rec.config_data);
    if (state?.claimStatus !== "unclaimed") continue;
    if (!state.expiresAt || state.expiresAt >= now) continue;
    const { error: delError } = await db.from(TENANT_TABLE).delete().eq("tenant_slug", rec.tenant_slug);
    if (!delError) deleted += 1;
  }
  return { deleted };
}

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(2500),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function previewCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set([
    "https://mken.live",
    "https://www.mken.live",
    "http://localhost:3113",
    "http://127.0.0.1:3113",
    "http://localhost:3120",
    "http://127.0.0.1:3120",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (site) allowed.add(site);
  const allow = allowed.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow || "https://mken.live",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function previewSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://www.mken.live";
}
