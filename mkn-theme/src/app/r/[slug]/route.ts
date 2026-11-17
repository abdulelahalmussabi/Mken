import { NextResponse } from "next/server";
import { canonicalTenantSlug, fetchTenantRow, getTenantDb } from "@/lib/mken/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Short redirect route for Google Reviews: https://mken.live/r/[slug]
 *
 * Implements strict zero-gating and PDPL compliance:
 * 1. Immediate HTTP 307 redirect directly to Google Maps / Google Review box.
 * 2. Zero pre-filtering or review gating (no star survey before review).
 * 3. Zero tracking cookies, zero PII collection, no analytics logging.
 * 4. Cache-Control: no-store to ensure the latest GBP review link is always resolved.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = canonicalTenantSlug(rawSlug);

    if (!slug) {
      return NextResponse.redirect("https://mken.live", {
        status: 307,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    const tenantRow = await fetchTenantRow(slug);
    const config = tenantRow?.config_data || {};

    // 1. Direct newReviewUrl from GBP locations cache
    const gbpLocations = config.gbp?.locations || [];
    const directReviewUrl = gbpLocations.find(
      (loc) => loc.newReviewUrl && loc.newReviewUrl.startsWith("http")
    )?.newReviewUrl;

    if (directReviewUrl) {
      return redirectResponse(directReviewUrl);
    }

    // 2. Google Place ID -> direct write review URL
    let placeId =
      config.preview?.placeId?.trim() ||
      gbpLocations.find((loc) => loc.placeId)?.placeId?.trim() ||
      "";

    if (!placeId) {
      const db = getTenantDb();
      if (db) {
        const { data } = await db
          .from("mken_saas_clients")
          .select("google_place_id")
          .eq("tenant_slug", slug)
          .maybeSingle();
        if (data && typeof data.google_place_id === "string") {
          placeId = data.google_place_id.trim();
        }
      }
    }

    if (placeId) {
      const writeReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
      return redirectResponse(writeReviewUrl);
    }

    // 3. Known Google Maps URL
    const mapsUrl =
      (typeof config.mapsUrl === "string" && config.mapsUrl.startsWith("http") && config.mapsUrl) ||
      gbpLocations.find((loc) => loc.mapsUri && loc.mapsUri.startsWith("http"))?.mapsUri;

    if (mapsUrl) {
      return redirectResponse(mapsUrl);
    }

    // 4. Search query fallback on Google Maps
    const businessName =
      tenantRow?.business_name ||
      config.brand?.name ||
      slug;
    const city =
      (typeof config.location === "string" && config.location) ||
      config.serviceArea?.city ||
      "";
    const searchQuery = [businessName, city].filter(Boolean).join(" ");

    if (searchQuery) {
      const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
      return redirectResponse(searchUrl);
    }

    // 5. Ultimate fallback: tenant storefront
    return redirectResponse(`https://mken.live/${slug}`);
  } catch {
    return NextResponse.redirect("https://mken.live", {
      status: 307,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
}

function redirectResponse(targetUrl: string) {
  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
