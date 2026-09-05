import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  buildGoogleAuthUrl,
  bindMapsListing,
  disconnectGbp,
  fetchGbpStatus,
  generateGbpPost,
  generateGbpReply,
  listGbpCompetitors,
  listGbpLocations,
  listScheduledGbpPosts,
  publishGbpPost,
  scheduleGbpPost,
  runNapAudit,
  selectGbpLocation,
  syncGbpServices,
  syncNapFromMken,
  syncNapToMken,
} from "@/lib/mken/gbp";
import { markPreviewIndexedAfterGbp } from "@/lib/mken/preview";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const action = new URL(request.url).searchParams.get("action") || "status";

  if (action === "auth-url") {
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const built = buildGoogleAuthUrl(scope.slug, requestHost);
    if (built.error || !built.url) {
      return NextResponse.json({ success: false, message: built.error }, { status: 503 });
    }
    return NextResponse.json({ success: true, tenant: scope.slug, url: built.url });
  }

  if (action === "locations") {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const listed = await listGbpLocations(scope.slug, { refresh });
    if (listed.error && listed.locations.length === 0 && !listed.connected) {
      return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      tenant: scope.slug,
      connected: listed.connected,
      selectedLocationId: listed.selectedLocationId,
      locations: listed.locations,
      message: listed.error || undefined,
    });
  }

  if (action === "scheduled-posts") {
    const listed = await listScheduledGbpPosts(scope.slug);
    if (listed.error) {
      return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, tenant: scope.slug, posts: listed.posts });
  }

  const { status, error } = await fetchGbpStatus(scope.slug);
  if (error || !status) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }
  if (status.connected) {
    await markPreviewIndexedAfterGbp(scope.slug);
  }
  return NextResponse.json({ success: true, tenant: scope.slug, ...status });
}

export async function POST(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  let body: {
    action?: string;
    locationId?: string;
    syncWebsite?: boolean;
    includeName?: boolean;
    mapsUrl?: string;
    selectedFields?: string[];
    serviceIds?: string[];
    prompt?: string;
    serviceName?: string;
    reviewText?: string;
    rating?: string;
    text?: string;
    topic?: string;
    publishAt?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action === "bind-maps-url") {
    const result = await bindMapsListing(scope.slug, body.mapsUrl || "");
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      mapsUrl: result.mapsUrl,
      mapsPlaceId: result.mapsPlaceId,
      city: result.city,
      message: "تم حفظ رابط الخرائط. يمكنك فحص NAP وجلب المنافسين الآن.",
    });
  }

  if (body.action === "select-location") {
    const { error } = await selectGbpLocation(scope.slug, body.locationId || "", body.syncWebsite !== false);
    if (error) {
      return NextResponse.json({ success: false, message: error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.action === "nap-audit") {
    const result = await runNapAudit(scope.slug, body.locationId || "");
    if (result.error || !result.report) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, report: result.report });
  }

  if (body.action === "sync-nap") {
    const result = await syncNapFromMken(scope.slug, body.locationId || "", {
      includeName: body.includeName === true,
    });
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      report: result.report,
      updated: result.updated || [],
      skipped: result.skipped || [],
      message: result.message,
    });
  }

  if (body.action === "sync-nap-reverse") {
    const selectedFields = (body.selectedFields || []).filter(
      (field): field is "phone" | "city" | "name" => field === "phone" || field === "city" || field === "name"
    );
    const result = await syncNapToMken(scope.slug, body.locationId || "", selectedFields);
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      report: result.report,
      updated: result.updated || [],
      skipped: result.skipped || [],
      message: result.message,
    });
  }

  if (body.action === "generate-post") {
    const result = await generateGbpPost(scope.slug, body.prompt || "", body.serviceName || "");
    if (result.error || !result.text) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, text: result.text });
  }

  if (body.action === "generate-reply") {
    const result = await generateGbpReply(scope.slug, body.reviewText || "", body.rating || "");
    if (result.error || !result.text) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, text: result.text });
  }

  if (body.action === "competitors") {
    const result = await listGbpCompetitors(scope.slug);
    if (result.error || !result.competitors) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      competitors: result.competitors,
      source: result.source,
      query: result.query,
    });
  }

  if (body.action === "sync-services") {
    const result = await syncGbpServices(scope.slug, body.locationId || "", body.serviceIds);
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, count: result.count });
  }

  if (body.action === "schedule-post") {
    const result = await scheduleGbpPost({
      slug: scope.slug,
      topic: body.topic || "",
      content: body.text || "",
      publishAt: body.publishAt || new Date().toISOString(),
    });
    if (result.error && !result.post) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      post: result.post,
      publishedNow: result.publishedNow,
      message: result.error,
    });
  }

  if (body.action === "publish-post") {
    const result = await publishGbpPost(scope.slug, body.locationId || "", body.text || "");
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.action !== "disconnect") {
    return NextResponse.json({ success: false, message: "طلب غير صالح" }, { status: 400 });
  }

  const { error } = await disconnectGbp(scope.slug);
  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
