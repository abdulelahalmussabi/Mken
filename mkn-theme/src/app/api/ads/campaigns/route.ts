import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/lib/auth/scope";
import { gatedTenantScope, tenantSaasFeatures } from "@/lib/mken/saas-guard";
import {
  LIVE_AD_PLATFORM,
  LIVE_AD_PLATFORM_ERROR,
  collectAdIntel,
  adGenerateCreditsForSlug,
  createAdCampaign,
  generateAdCreatives,
  getAdPublishReadiness,
  listAdCampaigns,
  parseLivePlatform,
  publishAdCampaign,
  saveTenantAdsMeta,
  saveTenantGoogleAds,
  setAdCampaignStatus,
  unlinkTenantGoogleAds,
  type AdCreative,
  type AdStatus,
} from "@/lib/mken/ads";
import { metaCapiConfigured } from "@/lib/mken/meta-ads";
import { buildGoogleAdsAuthUrl } from "@/lib/mken/google-ads";

export async function GET(request: Request) {
  const scope = await resolveTenantScope(request);
  if (!scope.slug) {
    return NextResponse.json(
      { success: false, message: scope.message },
      { status: scope.status || 400 }
    );
  }

  const action = new URL(request.url).searchParams.get("action") || "";
  if (action === "googleAuthUrl") {
    const built = buildGoogleAdsAuthUrl(scope.slug);
    if (built.error || !built.url) {
      return NextResponse.json({ success: false, message: built.error }, { status: 503 });
    }
    return NextResponse.json({ success: true, url: built.url });
  }

  const { campaigns, error } = await listAdCampaigns(scope.slug);
  if (error) {
    return NextResponse.json({ success: false, message: error }, { status: 500 });
  }
  const [readiness, generateCredits, features, intel] = await Promise.all([
    getAdPublishReadiness(scope.slug),
    adGenerateCreditsForSlug(scope.slug),
    tenantSaasFeatures(scope.slug, scope.session),
    collectAdIntel(scope.slug, campaigns),
  ]);
  return NextResponse.json({
    success: true,
    tenant: scope.slug,
    campaigns,
    metaReady: readiness.ready,
    googleReady: readiness.googleReady,
    tokenReady: readiness.tokenReady,
    googleTokenReady: readiness.googleTokenReady,
    geoReady: readiness.geoReady,
    placementReady: readiness.placementReady,
    googlePlacementReady: readiness.googlePlacementReady,
    adsMeta: readiness.adsMeta,
    adsGoogle: {
      customerId: readiness.adsGoogle.customerId,
      loginCustomerId: readiness.adsGoogle.loginCustomerId,
      descriptiveName: readiness.adsGoogle.descriptiveName,
      connected: readiness.adsGoogle.connected,
      pendingAccounts: readiness.adsGoogle.pendingAccounts,
    },
    geo: readiness.geo,
    blockers: readiness.blockers,
    googleBlockers: readiness.googleBlockers,
    generateCredits,
    adsAllowed: features.hasWhatsApp,
    intel: { mcs: intel.mcs, gridNote: intel.gridNote, winnerHeadlines: intel.winnerHeadlines },
    capiReady: metaCapiConfigured(),
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const scope = await gatedTenantScope(request, "whatsapp");
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

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "generate") {
    const requested =
      typeof body.platform === "string" && body.platform.trim() ? body.platform.trim() : LIVE_AD_PLATFORM;
    const platform = parseLivePlatform(requested);
    if (!platform) {
      return NextResponse.json({ success: false, message: LIVE_AD_PLATFORM_ERROR }, { status: 400 });
    }
    const result = await generateAdCreatives({
      slug: scope.slug,
      serviceName: typeof body.serviceName === "string" ? body.serviceName : "",
      platform,
      dialect: body.dialect === "fusha" ? "fusha" : "gulf",
    });
    if (result.error || !result.creative) {
      return NextResponse.json(
        { success: false, message: result.error, generateCredits: result.credits },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, creative: result.creative, generateCredits: result.credits });
  }

  if (action === "create") {
    const creative = isObject(body.creative) ? (body.creative as unknown as AdCreative) : null;
    if (!creative) {
      return NextResponse.json({ success: false, message: "النصوص الإعلانية ناقصة" }, { status: 400 });
    }
    const platform = parseLivePlatform(body.platform);
    if (!platform) {
      return NextResponse.json({ success: false, message: LIVE_AD_PLATFORM_ERROR }, { status: 400 });
    }
    const result = await createAdCampaign({
      slug: scope.slug,
      platform,
      campaignName: typeof body.campaignName === "string" ? body.campaignName : "",
      objective:
        typeof body.objective === "string"
          ? body.objective
          : platform === "google_ads"
            ? "LOCAL_LEADS"
            : "MESSAGES",
      dailyBudgetSar: Number(body.dailyBudgetSar),
      radiusKm: Number(body.radiusKm),
      serviceName: typeof body.serviceName === "string" ? body.serviceName : "",
      creative,
    });
    if (result.error || !result.campaign) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, campaign: result.campaign });
  }

  if (action === "publish") {
    const id = typeof body.id === "string" ? body.id : "";
    const result = await publishAdCampaign(scope.slug, id);
    if (result.error) {
      return NextResponse.json(
        { success: false, message: result.error, campaign: result.campaign },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, campaign: result.campaign });
  }

  if (action === "pause" || action === "resume") {
    const id = typeof body.id === "string" ? body.id : "";
    const status: AdStatus = action === "pause" ? "PAUSED" : "ACTIVE";
    const result = await setAdCampaignStatus(scope.slug, id, status);
    if (result.error || !result.campaign) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, campaign: result.campaign });
  }

  if (action === "saveMeta") {
    const result = await saveTenantAdsMeta(scope.slug, {
      adAccountId: typeof body.adAccountId === "string" ? body.adAccountId : "",
      pageId: typeof body.pageId === "string" ? body.pageId : "",
    });
    if (result.error || !result.adsMeta) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    const readiness = await getAdPublishReadiness(scope.slug);
    return NextResponse.json({
      success: true,
      adsMeta: result.adsMeta,
      metaReady: readiness.ready,
      blockers: readiness.blockers,
    });
  }

  if (action === "saveGoogle") {
    const result = await saveTenantGoogleAds(scope.slug, {
      customerId: typeof body.customerId === "string" ? body.customerId : "",
      loginCustomerId: typeof body.loginCustomerId === "string" ? body.loginCustomerId : "",
      descriptiveName: typeof body.descriptiveName === "string" ? body.descriptiveName : "",
    });
    if (result.error || !result.adsGoogle) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    const readiness = await getAdPublishReadiness(scope.slug);
    return NextResponse.json({
      success: true,
      adsGoogle: {
        customerId: result.adsGoogle.customerId,
        loginCustomerId: result.adsGoogle.loginCustomerId,
        descriptiveName: result.adsGoogle.descriptiveName,
        connected: result.adsGoogle.connected,
        pendingAccounts: result.adsGoogle.pendingAccounts,
      },
      googleReady: readiness.googleReady,
      googleBlockers: readiness.googleBlockers,
    });
  }

  if (action === "disconnectGoogle") {
    const result = await unlinkTenantGoogleAds(scope.slug);
    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }
    const readiness = await getAdPublishReadiness(scope.slug);
    return NextResponse.json({
      success: true,
      googleReady: readiness.googleReady,
      googleBlockers: readiness.googleBlockers,
      adsGoogle: {
        customerId: readiness.adsGoogle.customerId,
        connected: readiness.adsGoogle.connected,
        pendingAccounts: readiness.adsGoogle.pendingAccounts,
      },
    });
  }

  return NextResponse.json({ success: false, message: "إجراء غير معروف" }, { status: 400 });
}
