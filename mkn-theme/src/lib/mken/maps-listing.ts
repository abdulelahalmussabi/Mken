import { cityFromGbpAddress } from "@/lib/mken/nap";
import {
  extractLatLngFromMapsUrl,
  expandMapsShortUrl,
  fetchLivePlaceDetails,
  resolvePlaceId,
} from "@/lib/mken/preview";
import { fetchTenantRow, writeTenantConfig } from "@/lib/mken/tenant";

function isGoogleMapsShareUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^(ChIJ|GhIJ|EhIJ)[A-Za-z0-9_-]+$/.test(v)) return true;
  const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "share.google" ||
      host.endsWith(".app.goo.gl") ||
      (host.includes("google.") && path.includes("/maps"))
    );
  } catch {
    return /maps\.app\.goo\.gl|google\.[^/\s]+\/maps/i.test(v);
  }
}

export async function bindMapsListing(
  slug: string,
  mapsUrl: string
): Promise<{ mapsUrl?: string; mapsPlaceId?: string; city?: string; error?: string }> {
  const trimmed = mapsUrl.trim();
  if (!trimmed) return { error: "الصق رابط خرائط جوجل أو place_id" };
  if (!isGoogleMapsShareUrl(trimmed)) {
    return {
      error: "هذا ليس رابط خرائط جوجل. الصق رابط maps.app.goo.gl أو google.com/maps.",
    };
  }

  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const config = { ...(row.config_data || {}) };
  const preview = { ...(config.preview && typeof config.preview === "object" ? config.preview : {}) };

  let expanded = trimmed;
  let placeId: string | null = null;
  try {
    expanded = await expandMapsShortUrl(trimmed);
    const listingUrl = /\/maps\/place\/|@-?\d+\.\d+,-?\d+\.\d+/i.test(expanded) ? expanded : trimmed;
    placeId = (await resolvePlaceId(listingUrl)) || (await resolvePlaceId(trimmed));
  } catch (err) {
    console.error("bindMapsListing resolve", err);
  }
  if (placeId) preview.placeId = placeId;
  config.mapsUrl = trimmed;
  config.preview = preview;

  const details = placeId ? await fetchLivePlaceDetails(placeId).catch(() => null) : null;
  const area =
    config.serviceArea && typeof config.serviceArea === "object" ? { ...config.serviceArea } : {};
  const currentCity = typeof area.city === "string" ? area.city.trim() : "";
  const inferredCity = details
    ? cityFromGbpAddress({ addressLines: details.address ? [details.address] : [] }, details.address || "")
    : "";
  if (!currentCity && inferredCity) area.city = inferredCity;
  const coords = extractLatLngFromMapsUrl(expanded) || extractLatLngFromMapsUrl(trimmed);
  const center = area.center && typeof area.center === "object" ? { ...area.center } : {};
  const hasCenter = Number.isFinite(Number(center.lat)) && Number(center.lat) !== 0;
  if (!hasCenter && coords) area.center = coords;
  if (Object.keys(area).length) config.serviceArea = area;

  const written = await writeTenantConfig(slug, config);
  if (written.error) return { error: written.error };
  return {
    mapsUrl: trimmed,
    mapsPlaceId: placeId || undefined,
    city: typeof area.city === "string" ? area.city : inferredCity,
  };
}
