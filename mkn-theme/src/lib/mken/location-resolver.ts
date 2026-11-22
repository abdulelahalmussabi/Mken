export interface LocationTarget {
  name?: string;
  businessName?: string;
  city?: string;
  district?: string;
  address?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export interface LocationMapCoordinates {
  lat: number;
  lng: number;
}

/** Extract coordinates from common Google Maps URL patterns */
export function extractCoordinatesFromMapsUrl(url?: string): LocationMapCoordinates | null {
  if (!url || typeof url !== "string") return null;

  // 1. /@24.4672,39.6111
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // 2. !3d24.4672!4d39.6111
  const d3dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d3dMatch) {
    const lat = parseFloat(d3dMatch[1]);
    const lng = parseFloat(d3dMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // 3. ?q=24.4672,39.6111 or &query=24.4672,39.6111 or ll=...
  const qMatch = url.match(/[?&](?:q|query|ll|loc)=(-?\d+\.\d+)(?:,|%2C|\+)(-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

/** Extract place ID from maps URL if embedded */
export function extractPlaceIdFromMapsUrl(url?: string): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/[?&](?:query_place_id|place_id|ftid)=([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/** Ensure business name never falls back to generic placeholders like "الفرع الرئيسي" */
export function getCleanBusinessName(rawName?: string, fallbackBusinessName = ""): string {
  const candidate = (rawName || "").trim();
  if (!candidate || candidate === "الفرع الرئيسي" || candidate === "الفرع الرئيسي.") {
    const fallback = (fallbackBusinessName || "").trim();
    if (!fallback || fallback === "الفرع الرئيسي") return "الموقع المعتمد";
    return fallback;
  }
  return candidate;
}

/** Resolve numeric coordinates from explicit fields or embedded URL */
export function resolveCoordinates(location: LocationTarget): LocationMapCoordinates | null {
  const lat = typeof location.lat === "number" && Number.isFinite(location.lat)
    ? location.lat
    : typeof location.latitude === "number" && Number.isFinite(location.latitude)
      ? location.latitude
      : undefined;

  const lng = typeof location.lng === "number" && Number.isFinite(location.lng)
    ? location.lng
    : typeof location.longitude === "number" && Number.isFinite(location.longitude)
      ? location.longitude
      : undefined;

  if (lat !== undefined && lng !== undefined) {
    return { lat, lng };
  }

  if (location.googleMapsUrl) {
    const extracted = extractCoordinatesFromMapsUrl(location.googleMapsUrl);
    if (extracted) return extracted;
  }

  return null;
}

/**
 * Strict Priority Map Embed iframe URL Builder:
 * Priority 1: Exact coordinates `lat` & `lng` (stored or extracted) -> maps.google.com/maps?q=${lat},${lng}&hl=ar&z=16&output=embed
 * Priority 2: Actual registered businessName + district/city (NOT "الفرع الرئيسي")
 */
export function resolveMapEmbedSrc(location: LocationTarget, defaultBusinessName = ""): string {
  const coords = resolveCoordinates(location);
  if (coords) {
    return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&hl=ar&z=16&output=embed`;
  }

  const businessName = getCleanBusinessName(location.businessName || location.name, defaultBusinessName);
  const district = (location.district || "").replace(/^حي\s+/, "").trim();
  const city = (location.city || "").trim();
  const query = [businessName, district, city].filter(Boolean).join(" ").trim();

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=ar&z=16&output=embed`;
}

/**
 * Strict Priority Directions Link URL Builder:
 * Priority 1: Exact coordinates `lat` & `lng` (+ optional placeId)
 * Priority 2: Exact stored `googleMapsUrl` if available, otherwise businessName + city (+ optional placeId)
 */
export function resolveGoogleMapsUrl(location: LocationTarget, defaultBusinessName = ""): string {
  if (location.googleMapsUrl && typeof location.googleMapsUrl === "string") {
    const raw = location.googleMapsUrl.trim();
    const isGenericFallback = /الفرع(\+|%20|\s)+الرئيسي/i.test(raw);
    if (raw.length > 0 && !isGenericFallback) {
      return raw;
    }
  }

  const placeId = location.placeId || extractPlaceIdFromMapsUrl(location.googleMapsUrl) || "";

  const coords = resolveCoordinates(location);
  if (coords) {
    const placeIdParam = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : "";
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}${placeIdParam}`;
  }

  const businessName = getCleanBusinessName(location.businessName || location.name, defaultBusinessName);
  const city = (location.city || "").trim();
  const query = city ? `${businessName} ${city}` : businessName;
  const placeIdParam = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${placeIdParam}`;
}
