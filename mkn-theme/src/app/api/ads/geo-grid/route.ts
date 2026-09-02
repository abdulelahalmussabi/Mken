import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  dataforseoConfigured,
  geoCreditsForSlug,
  listRecentRankScans,
  runGeoGridScan,
} from "@/lib/mken/geo-grid";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const [credits, listed] = await Promise.all([
    geoCreditsForSlug(scope.slug),
    listRecentRankScans(scope.slug),
  ]);
  if (listed.error) {
    return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    credits,
    scans: listed.scans,
    dataforseoReady: dataforseoConfigured(),
  });
}

export async function POST(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }

  const result = await runGeoGridScan({
    slug: scope.slug,
    keyword: typeof body.keyword === "string" ? body.keyword : "",
    gridSize: typeof body.gridSize === "string" ? body.gridSize : "3x3",
    radiusKm: Number(body.radiusKm),
  });
  if (result.error || !result.scan) {
    return NextResponse.json(
      { success: false, message: result.error, credits: result.credits },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true, scan: result.scan, credits: result.credits });
}
