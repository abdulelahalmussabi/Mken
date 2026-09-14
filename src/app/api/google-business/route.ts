import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import {
  buildGoogleAuthUrl,
  disconnectGbp,
  fetchGbpStatus,
  generateGbpPost,
  generateGbpReply,
  isGbpQuotaError,
  listCompetitorAudits,
  listGbpCompetitors,
  listGbpLocations,
  listScheduledGbpPosts,
  previewNapSync,
  publishGbpPost,
  scheduleGbpPost,
  runNapAudit,
  saveGbpOperatorProof,
  selectGbpLocation,
  syncGbpServices,
  syncNapFromMken,
  syncNapToMken,
} from "@/lib/mken/gbp";
import { listGbpReviews, publishGbpReviewReply } from "@/lib/mken/gbp-reviews";
import { bindMapsListing } from "@/lib/mken/maps-listing";
import { markPreviewIndexedAfterGbp } from "@/lib/mken/preview";
import { listReviewRequests } from "@/lib/mken/review-funnel";

export const maxDuration = 30;

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
      quotaBlocked: Boolean(listed.error && isGbpQuotaError(listed.error)),
    });
  }

  if (action === "scheduled-posts") {
    const listed = await listScheduledGbpPosts(scope.slug);
    if (listed.error) {
      return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, tenant: scope.slug, posts: listed.posts });
  }

  if (action === "competitor-audits") {
    const listed = await listCompetitorAudits(scope.slug);
    if (listed.error) {
      return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, tenant: scope.slug, audits: listed.audits || [] });
  }

  if (action === "review-requests") {
    const listed = await listReviewRequests(scope.slug);
    if (listed.error) {
      return NextResponse.json({ success: false, message: listed.error }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      tenant: scope.slug,
      requests: listed.requests || [],
      gbpReviewsApi: false,
    });
  }

  if (action === "gbp-reviews") {
    const locationId = new URL(request.url).searchParams.get("locationId") || "";
    const listed = await listGbpReviews(scope.slug, locationId);
    if (listed.error && !listed.quotaBlocked && !(listed.reviews || []).length) {
      return NextResponse.json(
        { success: false, message: listed.error, quotaBlocked: false, gbpReviewsApi: false },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      tenant: scope.slug,
      reviews: listed.reviews || [],
      total: listed.total || 0,
      averageRating: listed.averageRating,
      quotaBlocked: Boolean(listed.quotaBlocked),
      gbpReviewsApi: !listed.quotaBlocked && !listed.error,
      message: listed.error,
    });
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
    mapsPlaceId?: string;
    selectedFields?: string[];
    serviceIds?: string[];
    prompt?: string;
    serviceName?: string;
    reviewText?: string;
    rating?: string;
    text?: string;
    topic?: string;
    publishAt?: string;
    phase?: "before" | "after";
    reviewName?: string;
    comment?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action === "bind-maps-url" || body.action === "update-website") {
    const result = await bindMapsListing(scope.slug, body.mapsUrl || "");
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      mapsUrl: result.mapsUrl,
      mapsPlaceId: result.mapsPlaceId,
      city: result.city,
      listingTitle: result.listingTitle,
      message: "تم حفظ رابط الخرائط. يمكنك فحص NAP وجلب المنافسين الآن.",
    });
  }

  if (body.action === "save-operator-proof") {
    const result = await saveGbpOperatorProof(scope.slug, body.phase === "after" ? "after" : "before", {
      mapsUrl: body.mapsUrl,
      mapsPlaceId: body.mapsPlaceId,
    });
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      proof: result.proof,
      report: result.report,
      message: result.message,
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
    const result = await runNapAudit(scope.slug, body.locationId || "", {
      mapsUrl: body.mapsUrl,
      mapsPlaceId: body.mapsPlaceId,
    });
    if (result.error || !result.report) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, report: result.report });
  }

  if (body.action === "preview-sync-nap") {
    const result = await previewNapSync(scope.slug, body.locationId || "", {
      includeName: body.includeName === true,
      mapsUrl: body.mapsUrl,
      mapsPlaceId: body.mapsPlaceId,
    });
    if (result.error || !result.report) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      report: result.report,
      updated: result.updated || [],
      skipped: result.skipped || [],
      canWrite: Boolean(result.canWrite),
      updateMask: result.updateMask || "",
    });
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
      proof: result.proof,
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
    return NextResponse.json({
      success: true,
      text: result.text,
      ctaUrl: result.ctaUrl,
      ctaLabel: result.ctaLabel || "احجز",
      city: result.city || "",
    });
  }

  if (body.action === "generate-reply") {
    const result = await generateGbpReply(scope.slug, body.reviewText || "", body.rating || "");
    if (result.error || !result.text) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, text: result.text });
  }

  if (body.action === "publish-review-reply") {
    const result = await publishGbpReviewReply(
      scope.slug,
      body.locationId || "",
      body.reviewName || "",
      body.comment || body.text || ""
    );
    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error, quotaBlocked: result.quotaBlocked },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      reply: result.reply,
      message: "نُشر الرد على خرائط جوجل. التوليد وحده لا ينشر.",
    });
  }

  if (body.action === "competitors") {
    const result = await listGbpCompetitors(scope.slug);
    if (result.error || !result.competitors) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      competitors: result.competitors,
      own: result.own || null,
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
    const result = await publishGbpPost(scope.slug, body.locationId || "", body.text || "", {
      campaign: body.serviceName || body.topic || "",
    });
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
