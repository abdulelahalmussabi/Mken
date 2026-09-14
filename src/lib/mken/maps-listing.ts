import { cityFromGbpAddress } from "@/lib/mken/nap";
import {
  extractLatLngFromMapsUrl,
  extractPlaceNameFromMapsUrl,
  expandMapsShortUrl,
  fetchLivePlaceDetails,
  resolvePlaceIdFromListing,
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
): Promise<{ mapsUrl?: string; mapsPlaceId?: string; city?: string; listingTitle?: string; error?: string }> {
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
  try {
    expanded = await expandMapsShortUrl(trimmed);
  } catch (err) {
    console.error("bindMapsListing expand", err);
  }
  const coords = extractLatLngFromMapsUrl(expanded) || extractLatLngFromMapsUrl(trimmed);
  const listingName = extractPlaceNameFromMapsUrl(expanded);
  const brandName = typeof config.brand?.name === "string" ? config.brand.name : "";
  const currentCity =
    config.serviceArea && typeof config.serviceArea === "object" && typeof config.serviceArea.city === "string"
      ? config.serviceArea.city.trim()
      : "";
  const looked = await resolvePlaceIdFromListing({
    mapsUrl: trimmed,
    name: listingName || brandName,
    city: currentCity,
    lat: coords?.lat,
    lng: coords?.lng,
  });
  const placeId = looked.placeId || null;
  if (!placeId) {
    return { error: looked.error || "تعذّر قراءة بيانات الخرائط لهذا الرابط." };
  }
  preview.placeId = placeId;
  config.mapsUrl = trimmed;
  config.preview = preview;

  const details = await fetchLivePlaceDetails(placeId).catch(() => null);
  if (details?.name) config.mapsListingName = details.name;
  const area =
    config.serviceArea && typeof config.serviceArea === "object" ? { ...config.serviceArea } : {};
  const inferredCity = details
    ? cityFromGbpAddress({ addressLines: details.address ? [details.address] : [] }, details.address || "")
    : "";
  if (!currentCity && inferredCity) area.city = inferredCity;
  const center = area.center && typeof area.center === "object" ? { ...area.center } : {};
  const hasCenter = Number.isFinite(Number(center.lat)) && Number(center.lat) !== 0;
  if (!hasCenter && coords) area.center = coords;
  if (Object.keys(area).length) config.serviceArea = area;

  const written = await writeTenantConfig(slug, config);
  if (written.error || !written.row) {
    return { error: written.error || "تعذّر حفظ رابط الخرائط في بيانات المنشأة" };
  }
  return {
    mapsUrl: trimmed,
    mapsPlaceId: placeId || undefined,
    city: typeof area.city === "string" ? area.city : inferredCity,
    listingTitle: details?.name || (typeof config.mapsListingName === "string" ? config.mapsListingName : undefined),
  };
}
