import { fetchTenantRow, getTenantDb, writeTenantConfig } from "@/lib/mken/tenant";
import { loadNapSiteSnapshot } from "@/lib/mken/gbp";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { generateGeminiImage, generateGeminiText } from "@/lib/mken/gemini";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { listRecentRankScans } from "@/lib/mken/geo-grid";
import { riyadhTodayYmd } from "@/lib/mken/ad-schedule";
import {
  adGenerateDailyLimit,
  saasFeaturesFromConfig,
  SAAS_FEATURE_MESSAGES,
} from "@/lib/mken/saas";
import {
  fetchMetaCampaignInsights,
  metaAdsTokenConfigured,
  normalizeMetaAdAccountId,
  normalizeMetaPageId,
  pauseMetaCampaign,
  publishMetaCtwa,
  readTenantAdsMeta,
  resolveTenantAdsMeta,
  resolveTenantWhatsapp,
  resumeMetaCampaign,
  type TenantAdsMeta,
} from "@/lib/mken/meta-ads";
import {
  disconnectGoogleAds,
  fetchGoogleAdsConnection,
  fetchGoogleCampaignInsights,
  googleAdsApiConfigured,
  pauseGoogleCampaign,
  publishGoogleLocalSearch,
  resolveTenantGoogleAds,
  resumeGoogleCampaign,
  selectGoogleAdsCustomer,
  type TenantGoogleAds,
} from "@/lib/mken/google-ads";

export const AD_PLATFORMS = ["meta_ctwa", "google_ads", "snapchat", "tiktok"] as const;
export type AdPlatformId = (typeof AD_PLATFORMS)[number];
export const LIVE_AD_PLATFORMS = ["meta_ctwa", "google_ads"] as const;
export const LIVE_AD_PLATFORM: AdPlatformId = "meta_ctwa";
export const LIVE_AD_PLATFORM_ERROR = "التوليد والنشر متاحان حالياً لواتساب ميتا وإعلانات جوجل المحلية فقط";

export const AD_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export const AD_OBJECTIVES = ["MESSAGES", "LOCAL_LEADS", "STORE_VISITS"] as const;
export type AdObjective = (typeof AD_OBJECTIVES)[number];

export const PLATFORM_LABELS: Record<AdPlatformId, string> = {
  meta_ctwa: "واتساب ميتا (انقر للمحادثة)",
  google_ads: "إعلانات جوجل المحلية",
  snapchat: "سناب شات",
  tiktok: "تيك توك",
};

export const MCS_WEIGHTS = {
  rating: 0.15,
  volume: 0.25,
  grid: 0.35,
  nap: 0.1,
  activity: 0.15,
} as const;

const MIN_SAR = 15;
const MAX_SAR = 500;

export interface AdCreativeVariant {
  headline: string;
  primaryText: string;
  cta: string;
  prefilledMessage: string;
}

export interface AdCreative {
  selectedIndex: number;
  variants: AdCreativeVariant[];
  negativeKeywords: string[];
  dialect: "gulf" | "fusha";
  imageDataUrl?: string;
}

export interface AdCampaign {
  id: string;
  tenantSlug: string;
  platform: AdPlatformId;
  externalCampaignId: string | null;
  campaignName: string;
  objective: AdObjective;
  status: AdStatus;
  dailyBudgetHalalas: number;
  spentHalalas: number;
  radiusKm: number;
  serviceName: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversations: number;
    bookings: number;
  };
  adCreative: AdCreative;
  startDate: string | null;
  endDate: string | null;
  errorLog: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignRow {
  id: string;
  tenant_slug?: string | null;
  platform?: string | null;
  external_campaign_id?: string | null;
  campaign_name?: string | null;
  objective?: string | null;
  status?: string | null;
  daily_budget_halalas?: number | null;
  spent_halalas?: number | null;
  radius_km?: number | string | null;
  service_name?: string | null;
  metrics?: AdCampaign["metrics"] | null;
  ad_creative?: AdCreative | null;
  start_date?: string | null;
  end_date?: string | null;
  error_log?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function sarToHalalas(sar: number): number {
  return Math.round(sar * 100);
}

export function halalasToSar(halalas: number): number {
  return Math.round(halalas) / 100;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Mken Competitor Score — weights calibrated for Saudi local maps. */
export function computeMcs(input: {
  rating: number;
  volume: number;
  grid: number;
  nap: number;
  activity: number;
}): { score: number; breakdown: Record<keyof typeof MCS_WEIGHTS, number> } {
  const breakdown = {
    rating: clampScore(input.rating) * MCS_WEIGHTS.rating,
    volume: clampScore(input.volume) * MCS_WEIGHTS.volume,
    grid: clampScore(input.grid) * MCS_WEIGHTS.grid,
    nap: clampScore(input.nap) * MCS_WEIGHTS.nap,
    activity: clampScore(input.activity) * MCS_WEIGHTS.activity,
  };
  const score = Math.round(
    (breakdown.rating + breakdown.volume + breakdown.grid + breakdown.nap + breakdown.activity) * 100
  ) / 100;
  return { score, breakdown };
}

function isPlatform(value: string): value is AdPlatformId {
  return (AD_PLATFORMS as readonly string[]).includes(value);
}

export function isLivePlatform(value: string): value is AdPlatformId {
  return (LIVE_AD_PLATFORMS as readonly string[]).includes(value);
}

export function parseLivePlatform(value: unknown): AdPlatformId | null {
  const platform = typeof value === "string" ? value.trim() : "";
  return isLivePlatform(platform) ? platform : null;
}

export type TenantAdGeo = { lat: number; lng: number; city: string };

export function readTenantAdGeo(config: {
  serviceArea?: { city?: string; center?: { lat?: number; lng?: number } };
} | null | undefined): TenantAdGeo | null {
  const lat = Number(config?.serviceArea?.center?.lat);
  const lng = Number(config?.serviceArea?.center?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return {
    lat,
    lng,
    city: typeof config?.serviceArea?.city === "string" ? config.serviceArea.city.trim() : "",
  };
}

export async function resolveTenantAdGeo(slug: string): Promise<{ geo?: TenantAdGeo; error?: string }> {
  const row = await fetchTenantRow(slug);
  const geo = readTenantAdGeo(row?.config_data);
  if (!geo) {
    return {
      error: "حدّد موقع الفرع في إعدادات المنشأة (خط العرض والطول المحفوظان) قبل النشر. لا يُستخدم موقع افتراضي.",
    };
  }
  return { geo };
}

export type AdPublishReadiness = {
  ready: boolean;
  googleReady: boolean;
  tokenReady: boolean;
  googleTokenReady: boolean;
  geoReady: boolean;
  placementReady: boolean;
  googlePlacementReady: boolean;
  adsMeta: TenantAdsMeta;
  adsGoogle: TenantGoogleAds;
  geo: TenantAdGeo | null;
  blockers: string[];
  googleBlockers: string[];
};

export async function getAdPublishReadiness(slug: string): Promise<AdPublishReadiness> {
  const row = await fetchTenantRow(slug);
  const geo = readTenantAdGeo(row?.config_data);
  const placement = readTenantAdsMeta(row?.config_data);
  const google = await fetchGoogleAdsConnection(slug);
  const tokenReady = metaAdsTokenConfigured();
  const googleTokenReady = googleAdsApiConfigured();
  const blockers: string[] = [];
  if (!tokenReady) blockers.push("أضف META_ADS_ACCESS_TOKEN على الخادم بعد اعتماد تطبيق Meta.");
  if (!placement) blockers.push("أضف حساب إعلانات ميتا ومعرّف الصفحة لهذه المنشأة.");
  if (!geo) blockers.push("احفظ خط العرض والطول الحقيقيين للفرع من إعدادات المنشأة.");
  const googleBlockers: string[] = [];
  if (!googleTokenReady) {
    googleBlockers.push(
      "أضف GOOGLE_ADS_DEVELOPER_TOKEN مع GOOGLE_CLIENT_ID/SECRET بعد اعتماد Google Ads API. لا تضع refresh token عاماً."
    );
  }
  if (!google.connected) {
    googleBlockers.push("اربط حساب إعلانات جوجل لهذه المنشأة. الإنفاق ووسيلة الدفع تكون على ذلك الحساب.");
  } else if (google.customerId.length < 8) {
    googleBlockers.push("اختر حساب إعلانات العميل بعد الربط. لا تستخدم حساب مدير للفوترة.");
  }
  if (!geo) googleBlockers.push("احفظ خط العرض والطول الحقيقيين للفرع من إعدادات المنشأة.");
  return {
    ready: blockers.length === 0,
    googleReady: googleBlockers.length === 0,
    tokenReady,
    googleTokenReady,
    geoReady: Boolean(geo),
    placementReady: Boolean(placement),
    googlePlacementReady: google.connected && google.customerId.length >= 8,
    adsMeta: placement || { adAccountId: "", pageId: "" },
    adsGoogle: google,
    geo,
    blockers,
    googleBlockers,
  };
}

export async function saveTenantAdsMeta(
  slug: string,
  input: { adAccountId: string; pageId: string }
): Promise<{ adsMeta?: TenantAdsMeta; error?: string }> {
  const adAccountId = normalizeMetaAdAccountId(input.adAccountId);
  const pageId = normalizeMetaPageId(input.pageId);
  if (adAccountId.length < 6) return { error: "معرّف حساب الإعلانات غير صالح" };
  if (pageId.length < 5) return { error: "معرّف صفحة ميتا غير صالح" };

  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const written = await writeTenantConfig(slug, {
    ...(row.config_data || {}),
    adsMeta: { adAccountId, pageId },
  });
  if (written.error) return { error: written.error };
  return { adsMeta: { adAccountId, pageId } };
}

export async function saveTenantGoogleAds(
  slug: string,
  input: { customerId: string; loginCustomerId?: string; descriptiveName?: string }
): Promise<{ adsGoogle?: TenantGoogleAds; error?: string }> {
  const result = await selectGoogleAdsCustomer(
    slug,
    input.customerId,
    input.loginCustomerId || "",
    input.descriptiveName || ""
  );
  if (result.error || !result.ads) return { error: result.error };
  return { adsGoogle: result.ads };
}

export async function unlinkTenantGoogleAds(slug: string): Promise<{ error?: string }> {
  return disconnectGoogleAds(slug);
}

export type AdGenerateCredits = {
  used: number;
  limit: number;
  remaining: number;
  day: string;
};

export async function adGenerateCreditsForSlug(slug: string): Promise<AdGenerateCredits> {
  const row = await fetchTenantRow(slug);
  const features = saasFeaturesFromConfig(row?.config_data, { slug });
  const day = riyadhTodayYmd();
  const stored = row?.config_data?.localGrowth || {};
  const used = stored.genDay === day ? Number(stored.genUsed) || 0 : 0;
  const limit = adGenerateDailyLimit(features.tier);
  return { used, limit, remaining: Math.max(0, limit - used), day };
}

async function debitAdGenerate(slug: string): Promise<{ error?: string; credits?: AdGenerateCredits }> {
  const credits = await adGenerateCreditsForSlug(slug);
  if (credits.remaining < 1) return { error: SAAS_FEATURE_MESSAGES.adGenerate, credits };
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة", credits };
  const next = {
    ...(row.config_data || {}),
    localGrowth: {
      ...(row.config_data?.localGrowth || {}),
      genDay: credits.day,
      genUsed: credits.used + 1,
    },
  };
  const written = await writeTenantConfig(slug, next);
  if (written.error) return { error: written.error, credits };
  return {
    credits: {
      ...credits,
      used: credits.used + 1,
      remaining: Math.max(0, credits.limit - credits.used - 1),
    },
  };
}

function isStatus(value: string): value is AdStatus {
  return (AD_STATUSES as readonly string[]).includes(value);
}

function isObjective(value: string): value is AdObjective {
  return (AD_OBJECTIVES as readonly string[]).includes(value);
}

function emptyCreative(): AdCreative {
  return { selectedIndex: 0, variants: [], negativeKeywords: [], dialect: "gulf" };
}

function arTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function pickWinningVariantIndex(
  variants: AdCreativeVariant[],
  winnerHeadlines: string[]
): number {
  if (variants.length < 2 || winnerHeadlines.length < 1) return 0;
  const win = new Set(winnerHeadlines.flatMap(arTokens));
  let best = 0;
  let bestScore = -1;
  variants.forEach((variant, index) => {
    const score = arTokens(`${variant.headline} ${variant.primaryText}`).filter((token) => win.has(token)).length;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function ratingScore(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 5) return clampScore((value / 5) * 100);
  return clampScore(value);
}

export type AdLocalIntel = {
  mcs: number;
  gridNote: string;
  winnerHeadlines: string[];
  promptBlock: string;
};

export async function collectAdIntel(slug: string, knownCampaigns?: AdCampaign[]): Promise<AdLocalIntel> {
  const [row, listed, scans] = await Promise.all([
    fetchTenantRow(slug),
    knownCampaigns ? Promise.resolve({ campaigns: knownCampaigns }) : listAdCampaigns(slug),
    listRecentRankScans(slug),
  ]);
  const scan = scans.scans?.[0];
  const grid =
    scan?.top3Percentage != null
      ? clampScore(scan.top3Percentage)
      : scan?.averageRank != null
        ? clampScore(Math.max(0, 100 - (scan.averageRank - 1) * 5))
        : 0;
  const geo = readTenantAdGeo(row?.config_data);
  const phone = String(row?.config_data?.phone || row?.phone || "").trim();
  const nap = geo && phone ? 90 : geo || phone ? 55 : 0;
  const campaigns = listed.campaigns || [];
  const activity = campaigns.some((item) => item.status === "ACTIVE") ? 75 : 35;
  const mcs = computeMcs({
    rating: ratingScore(row?.config_data?.rating),
    volume: clampScore(Number(row?.config_data?.reviewsCount) / 8),
    grid,
    nap,
    activity,
  });
  const winnerHeadlines = campaigns
    .filter((item) => (item.metrics.conversations || 0) > 0)
    .sort((a, b) => (b.metrics.conversations || 0) - (a.metrics.conversations || 0))
    .slice(0, 3)
    .map((item) => item.adCreative.variants[item.adCreative.selectedIndex]?.headline || "")
    .filter(Boolean);

  const gridNote = scan
    ? `كلمة "${scan.keyword}" — متوسط ترتيب ${scan.averageRank ?? "—"} — تغطية أول 3 نتائج ${scan.top3Percentage ?? 0}%`
    : "لا يوجد مسح رانك محفوظ";
  const promptBlock = [
    `مؤشر المنافسة المحلي MCS: ${mcs.score}/100 (الشبكة ${Math.round(mcs.breakdown.grid)}، التقييم ${Math.round(mcs.breakdown.rating)}).`,
    `رانك الخرائط: ${gridNote}.`,
    winnerHeadlines.length
      ? `عناوين حملات حققت محادثات سابقاً: ${winnerHeadlines.join(" | ")}. قرّب النسخة الأولى من هذا الأسلوب دون نسخ حرفي.`
      : "لا توجد محادثات مسجّلة بعد؛ اكتب نسخاً محلية واضحة الدعوة.",
    grid < 40
      ? "الترتيب المحلي ضعيف: ركّز على الحي والقرب والحجز السريع لا على ادعاء الشهرة."
      : "الترتيب المحلي مقبول: اذكر الثقة والقرب دون مبالغة.",
  ].join("\n");

  return { mcs: mcs.score, gridNote, winnerHeadlines, promptBlock };
}

function toCampaign(row: CampaignRow): AdCampaign {
  const metrics = (row.metrics && typeof row.metrics === "object" ? row.metrics : {}) as AdCampaign["metrics"];
  const creative = row.ad_creative && typeof row.ad_creative === "object" ? row.ad_creative : emptyCreative();
  const platformRaw = row.platform || "";
  const objectiveRaw = row.objective || "";
  const statusRaw = row.status || "";
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "",
    platform: isPlatform(platformRaw) ? platformRaw : "meta_ctwa",
    externalCampaignId: row.external_campaign_id || null,
    campaignName: row.campaign_name || "",
    objective: isObjective(objectiveRaw) ? objectiveRaw : "MESSAGES",
    status: isStatus(statusRaw) ? statusRaw : "DRAFT",
    dailyBudgetHalalas: Number(row.daily_budget_halalas) || 0,
    spentHalalas: Number(row.spent_halalas) || 0,
    radiusKm: Number(row.radius_km) || 5,
    serviceName: row.service_name || "",
    metrics: {
      impressions: Number(metrics.impressions) || 0,
      clicks: Number(metrics.clicks) || 0,
      conversations: Number(metrics.conversations) || 0,
      bookings: Number(metrics.bookings) || 0,
    },
    adCreative: {
      selectedIndex: Number(creative.selectedIndex) || 0,
      variants: Array.isArray(creative.variants) ? creative.variants : [],
      negativeKeywords: Array.isArray(creative.negativeKeywords) ? creative.negativeKeywords : [],
      dialect: creative.dialect === "fusha" ? "fusha" : "gulf",
      imageDataUrl:
        typeof creative.imageDataUrl === "string" && creative.imageDataUrl.startsWith("data:image/")
          ? creative.imageDataUrl
          : undefined,
    },
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    errorLog: row.error_log || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

async function localTenantAdPhoto(slug: string): Promise<string | undefined> {
  if (slug !== "almahrusa" && slug !== "rewaq") return undefined;
  try {
    const folder = slug === "rewaq" ? "rewaq" : "almahrusa";
    const web = path.join(process.cwd(), "public", folder, "hero.web.jpg");
    const fallback = path.join(process.cwd(), "public", folder, "hero.jpg");
    const buf = await readFile(web).catch(() => readFile(fallback));
    if (buf.length < 2000) return undefined;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function parseCreativeJson(raw: string): AdCreative {
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  const parsed = JSON.parse(clean) as {
    variants?: AdCreativeVariant[];
    negativeKeywords?: string[];
  };
  const variants = (Array.isArray(parsed.variants) ? parsed.variants : [])
    .map((item) => ({
      headline: String(item.headline || "").trim().slice(0, 40),
      primaryText: String(item.primaryText || "").trim().slice(0, 220),
      cta: String(item.cta || "WHATSAPP_MESSAGE").trim().slice(0, 40),
      prefilledMessage: String(item.prefilledMessage || "").trim().slice(0, 300),
    }))
    .filter((item) => item.headline && item.primaryText)
    .slice(0, 3);
  if (variants.length < 1) throw new Error("لم يُرجع الذكاء الاصطناعي نصوصاً صالحة");
  return {
    selectedIndex: 0,
    variants,
    negativeKeywords: (Array.isArray(parsed.negativeKeywords) ? parsed.negativeKeywords : [])
      .map((word) => String(word).trim())
      .filter(Boolean)
      .slice(0, 12),
    dialect: "gulf",
  };
}

export async function generateAdCreatives(input: {
  slug: string;
  serviceName: string;
  platform: AdPlatformId;
  dialect?: "gulf" | "fusha";
}): Promise<{ creative?: AdCreative; credits?: AdGenerateCredits; error?: string }> {
  const serviceName = input.serviceName.trim().slice(0, 80);
  if (!serviceName) return { error: "اختر الخدمة أولاً" };
  if (!isLivePlatform(input.platform)) return { error: LIVE_AD_PLATFORM_ERROR };
  if (!process.env.GEMINI_API_KEY?.trim()) return { error: "GEMINI_API_KEY غير معيّن على الخادم" };

  const debit = await debitAdGenerate(input.slug);
  if (debit.error) return { error: debit.error, credits: debit.credits };

  const snap = await loadNapSiteSnapshot(input.slug);
  const businessName = snap.site?.name || input.slug;
  const city = snap.site?.city || "";
  const dialect = input.dialect === "fusha" ? "فصحى بيضاء مهذبة" : "لهجة سعودية بيضاء طبيعية";
  const website = await tenantWebsiteUrl(input.slug);
  const intel = await collectAdIntel(input.slug);

  const prompt = `أنت مدير إعلانات محلية في السوق السعودي. أنشئ 3 نسخ إعلانية قصيرة لمنصة ${PLATFORM_LABELS[input.platform]}.
اسم المنشأة: "${businessName}"
المدينة: "${city || "السعودية"}"
الخدمة: "${serviceName}"
اللغة: ${dialect}
رابط الحجز: ${website}

سياق محلي من مكّن:
${intel.promptBlock}

أرجع JSON فقط بدون شرح وبدون علامات ترميز بهذا الشكل:
{"variants":[{"headline":"...","primaryText":"...","cta":"${input.platform === "google_ads" ? "LEARN_MORE" : "WHATSAPP_MESSAGE"}","prefilledMessage":"مرحباً، أود الاستفسار عن ${serviceName} عبر مكّن"}],"negativeKeywords":["وظائف","مجاني","تدريب"]}

شروط:
${
  input.platform === "google_ads"
    ? `1. headline حتى 30 حرفاً (إعلان بحث متجاوب)، جذاب ومحلي.
2. primaryText حتى 90 حرفاً، يذكر الحي/المدينة إن وُجدت، ودعوة واضحة للحجز عبر الموقع.
3. cta استخدم LEARN_MORE.
4. prefilledMessage رسالة واتساب احتياطية باللهجة المطلوبة.
5. negativeKeywords كلمات تهدر الميزانية في البحث المحلي.`
    : `1. headline حتى 32 حرفاً، جذاب ومحلي.
2. primaryText حتى 180 حرفاً، يذكر الحي/المدينة إن وُجدت، ودعوة واضحة للحجز أو واتساب.
3. prefilledMessage رسالة واتساب جاهزة باللهجة المطلوبة.
4. negativeKeywords كلمات تهدر الميزانية في السوق المحلي.`
}
6. لا تذكر أسعاراً إلا إذا وردت في اسم الخدمة.
7. لا تدّعَ ترتيباً أو تقييماً غير مذكور في السياق أعلاه.`;

  try {
    const creative = parseCreativeJson(await generateGeminiText(prompt));
    creative.dialect = input.dialect === "fusha" ? "fusha" : "gulf";
    creative.selectedIndex = pickWinningVariantIndex(creative.variants, intel.winnerHeadlines);
    if (input.platform === "meta_ctwa") {
      const row = await fetchTenantRow(input.slug);
      const logoRaw = typeof row?.config_data?.brand?.logo === "string" ? row.config_data.brand.logo : "";
      const logoMatch = logoRaw.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
      const logo =
        logoMatch && logoMatch[2].replace(/\s+/g, "").length < 500_000
          ? { mimeType: logoMatch[1], data: logoMatch[2].replace(/\s+/g, "") }
          : null;
      const realPhoto = await localTenantAdPhoto(input.slug);
      creative.imageDataUrl =
        realPhoto ||
        (await generateGeminiImage({
          prompt: `Square local business ad photo for a Saudi ${serviceName} shop named ${businessName} in ${city || "Saudi Arabia"}. Professional, warm lighting, no text, no logos invented, no watermarks, photorealistic.`,
          logo,
        })) ||
        undefined;
    }
    return { creative, credits: debit.credits };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر توليد الإعلان", credits: debit.credits };
  }
}

export async function listAdCampaigns(
  slug: string
): Promise<{ campaigns?: AdCampaign[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_ad_campaigns")
    .select("*")
    .eq("tenant_slug", slug)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return { campaigns: [] };
    return { error: error.message };
  }
  return { campaigns: ((data || []) as CampaignRow[]).map(toCampaign) };
}

export async function createAdCampaign(input: {
  slug: string;
  platform: string;
  campaignName: string;
  objective: string;
  dailyBudgetSar: number;
  radiusKm: number;
  serviceName: string;
  creative: AdCreative;
}): Promise<{ campaign?: AdCampaign; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!isLivePlatform(input.platform)) return { error: LIVE_AD_PLATFORM_ERROR };
  if (!isObjective(input.objective)) return { error: "هدف الحملة غير صالح" };

  const name = input.campaignName.trim().slice(0, 80);
  if (!name) return { error: "اسم الحملة مطلوب" };

  const sar = Number(input.dailyBudgetSar);
  if (!Number.isFinite(sar) || sar < MIN_SAR || sar > MAX_SAR) {
    return { error: `الميزانية اليومية بين ${MIN_SAR} و ${MAX_SAR} ريال` };
  }

  const radius = Number(input.radiusKm);
  if (![5, 8, 10, 15].includes(radius)) return { error: "اختر نطاق استهداف 5 أو 8 أو 10 أو 15 كم" };

  if (!input.creative?.variants?.length) return { error: "ولّد النصوص الإعلانية أولاً" };

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mken_ad_campaigns")
    .insert({
      tenant_slug: input.slug,
      platform: input.platform,
      campaign_name: name,
      objective: input.objective,
      status: "DRAFT",
      daily_budget_halalas: sarToHalalas(sar),
      radius_km: radius,
      service_name: input.serviceName.trim().slice(0, 80),
      ad_creative: input.creative,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) return { error: error?.message || "تعذّر حفظ الحملة" };
  return { campaign: toCampaign(data as CampaignRow) };
}

export async function getAdCampaign(
  slug: string,
  id: string
): Promise<{ campaign?: AdCampaign; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db
    .from("mken_ad_campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (error || !data) return { error: error?.message || "الحملة غير موجودة" };
  return { campaign: toCampaign(data as CampaignRow) };
}

async function publishMetaCampaign(
  slug: string,
  campaign: AdCampaign,
  variant: AdCreativeVariant,
  geo: TenantAdGeo,
  readiness: AdPublishReadiness
): Promise<{ campaignId?: string; error?: string }> {
  if (!readiness.ready) return { error: readiness.blockers[0] || "النشر على ميتا غير جاهز لهذه المنشأة" };
  const placement = await resolveTenantAdsMeta(slug);
  if (placement.error || !placement.meta) return { error: placement.error };
  return publishMetaCtwa({
    name: campaign.campaignName,
    dailyBudgetHalalas: campaign.dailyBudgetHalalas,
    radiusKm: campaign.radiusKm,
    centerLat: geo.lat,
    centerLng: geo.lng,
    headline: variant.headline,
    primaryText: variant.primaryText,
    prefilledMessage: variant.prefilledMessage,
    whatsappNumber: await resolveTenantWhatsapp(slug),
    adAccountId: placement.meta.adAccountId,
    pageId: placement.meta.pageId,
    imageDataUrl: campaign.adCreative.imageDataUrl,
  });
}

async function publishGoogleCampaign(
  slug: string,
  campaign: AdCampaign,
  variant: AdCreativeVariant,
  geo: TenantAdGeo,
  readiness: AdPublishReadiness
): Promise<{ campaignId?: string; error?: string }> {
  if (!readiness.googleReady) {
    return { error: readiness.googleBlockers[0] || "النشر على جوجل غير جاهز لهذه المنشأة" };
  }
  const placement = await resolveTenantGoogleAds(slug);
  if (placement.error || !placement.ads) return { error: placement.error };
  const descriptions = campaign.adCreative.variants.map((item) => item.primaryText).filter(Boolean);
  if (!descriptions.includes(variant.primaryText)) descriptions.unshift(variant.primaryText);
  return publishGoogleLocalSearch({
    slug,
    name: campaign.campaignName,
    dailyBudgetHalalas: campaign.dailyBudgetHalalas,
    radiusKm: campaign.radiusKm,
    centerLat: geo.lat,
    centerLng: geo.lng,
    website: await tenantWebsiteUrl(slug),
    serviceName: campaign.serviceName || variant.headline,
    city: geo.city,
    headlines: campaign.adCreative.variants.map((item) => item.headline),
    descriptions,
    negativeKeywords: campaign.adCreative.negativeKeywords || [],
    customerId: placement.ads.customerId,
  });
}

export async function publishAdCampaign(
  slug: string,
  id: string
): Promise<{ campaign?: AdCampaign; error?: string }> {
  const loaded = await getAdCampaign(slug, id);
  if (loaded.error || !loaded.campaign) return { error: loaded.error || "الحملة غير موجودة" };
  const campaign = loaded.campaign;
  if (!isLivePlatform(campaign.platform)) {
    return { error: LIVE_AD_PLATFORM_ERROR };
  }
  const readiness = await getAdPublishReadiness(slug);
  const geo = await resolveTenantAdGeo(slug);
  if (geo.error || !geo.geo) return { error: geo.error };

  const variant =
    campaign.adCreative.variants[campaign.adCreative.selectedIndex] || campaign.adCreative.variants[0];
  if (!variant) return { error: "لا يوجد نص إعلاني في المسودة" };

  const published =
    campaign.platform === "google_ads"
      ? await publishGoogleCampaign(slug, campaign, variant, geo.geo, readiness)
      : await publishMetaCampaign(slug, campaign, variant, geo.geo, readiness);

  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  if (published.error || !published.campaignId) {
    const { data } = await db
      .from("mken_ad_campaigns")
      .update({
        status: "FAILED",
        error_log: published.error || "فشل النشر",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_slug", slug)
      .select("*")
      .maybeSingle();
    return { campaign: data ? toCampaign(data as CampaignRow) : campaign, error: published.error };
  }

  const { data, error } = await db
    .from("mken_ad_campaigns")
    .update({
      status: "ACTIVE",
      external_campaign_id: published.campaignId,
      error_log: null,
      start_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_slug", slug)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: error?.message || "نُشرت الحملة وتعذّر حفظ الحالة" };
  return { campaign: toCampaign(data as CampaignRow) };
}

async function pauseGoogleForSlug(slug: string, campaignId: string): Promise<{ error?: string }> {
  const placement = await resolveTenantGoogleAds(slug);
  if (placement.error || !placement.ads) return { error: placement.error };
  return pauseGoogleCampaign(slug, placement.ads.customerId, campaignId);
}

async function resumeGoogleForSlug(slug: string, campaignId: string): Promise<{ error?: string }> {
  const placement = await resolveTenantGoogleAds(slug);
  if (placement.error || !placement.ads) return { error: placement.error };
  return resumeGoogleCampaign(slug, placement.ads.customerId, campaignId);
}

export async function setAdCampaignStatus(
  slug: string,
  id: string,
  status: AdStatus
): Promise<{ campaign?: AdCampaign; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!id.trim()) return { error: "معرّف الحملة ناقص" };

  const loaded = await getAdCampaign(slug, id);
  if (loaded.error || !loaded.campaign) return { error: loaded.error || "الحملة غير موجودة" };

  if (status === "ACTIVE") {
    if (loaded.campaign.status === "ACTIVE" && loaded.campaign.externalCampaignId) {
      return { campaign: loaded.campaign };
    }
    if (loaded.campaign.externalCampaignId && loaded.campaign.status === "PAUSED") {
      const resumed =
        loaded.campaign.platform === "google_ads"
          ? await resumeGoogleForSlug(slug, loaded.campaign.externalCampaignId)
          : await resumeMetaCampaign(loaded.campaign.externalCampaignId);
      if (resumed.error) return { error: resumed.error };
      const { data, error } = await db
        .from("mken_ad_campaigns")
        .update({ status: "ACTIVE", error_log: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_slug", slug)
        .select("*")
        .maybeSingle();
      if (error || !data) return { error: error?.message || "استُؤنفت الحملة وتعذّر حفظ الحالة" };
      return { campaign: toCampaign(data as CampaignRow) };
    }
    return publishAdCampaign(slug, id);
  }

  if (loaded.campaign.externalCampaignId && status === "PAUSED") {
    const paused =
      loaded.campaign.platform === "google_ads"
        ? await pauseGoogleForSlug(slug, loaded.campaign.externalCampaignId)
        : await pauseMetaCampaign(loaded.campaign.externalCampaignId);
    if (paused.error) return { error: paused.error };
  }

  const { data, error } = await db
    .from("mken_ad_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_slug", slug)
    .select("*")
    .maybeSingle();

  if (error || !data) return { error: error?.message || "تعذّر تحديث الحالة" };
  return { campaign: toCampaign(data as CampaignRow) };
}

export async function syncAdCampaignInsights(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { synced: 0, failed: 0, skipped: 0, error: "قاعدة البيانات غير مهيأة على الخادم" };
  const metaReady = metaAdsTokenConfigured();
  const googleReady = googleAdsApiConfigured();
  if (!metaReady && !googleReady) {
    return { synced: 0, failed: 0, skipped: 0, error: "توكن ميتا أو جوجل Ads ناقص" };
  }

  const { data, error } = await db
    .from("mken_ad_campaigns")
    .select("id, tenant_slug, platform, external_campaign_id, metrics, status")
    .not("external_campaign_id", "is", null)
    .in("status", ["ACTIVE", "PAUSED"])
    .limit(80);

  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return { synced: 0, failed: 0, skipped: 0 };
    return { synced: 0, failed: 0, skipped: 0, error: error.message };
  }

  const rows = (data || []) as Array<{
    id: string;
    tenant_slug?: string | null;
    platform?: string | null;
    external_campaign_id?: string | null;
    metrics?: AdCampaign["metrics"] | null;
    status?: string | null;
  }>;

  const googleCustomerBySlug = new Map<string, string | null>();
  async function googleCustomerId(slug: string): Promise<string | null> {
    if (googleCustomerBySlug.has(slug)) return googleCustomerBySlug.get(slug) || null;
    const resolved = await resolveTenantGoogleAds(slug);
    const customerId = resolved.ads?.customerId || null;
    googleCustomerBySlug.set(slug, customerId);
    return customerId;
  }

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const externalId = row.external_campaign_id?.trim() || "";
    const slug = row.tenant_slug || "";
    if (!externalId || !slug) {
      skipped += 1;
      continue;
    }

    let insights: { impressions: number; clicks: number; conversations: number; spentHalalas: number } | undefined;
    if (row.platform === "google_ads") {
      if (!googleReady) {
        skipped += 1;
        continue;
      }
      const customerId = await googleCustomerId(slug);
      if (!customerId) {
        skipped += 1;
        continue;
      }
      const fetched = await fetchGoogleCampaignInsights(slug, customerId, externalId);
      if (fetched.error || !fetched.insights) {
        failed += 1;
        continue;
      }
      insights = fetched.insights;
    } else if (row.platform === "meta_ctwa") {
      if (!metaReady) {
        skipped += 1;
        continue;
      }
      const fetched = await fetchMetaCampaignInsights(externalId);
      if (fetched.error || !fetched.insights) {
        failed += 1;
        continue;
      }
      insights = fetched.insights;
    } else {
      skipped += 1;
      continue;
    }

    const previous = (row.metrics && typeof row.metrics === "object" ? row.metrics : {}) as AdCampaign["metrics"];
    const { error: writeError } = await db
      .from("mken_ad_campaigns")
      .update({
        spent_halalas: insights.spentHalalas,
        metrics: {
          impressions: insights.impressions,
          clicks: insights.clicks,
          conversations: insights.conversations,
          bookings: Number(previous.bookings) || 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("tenant_slug", slug);
    if (writeError) failed += 1;
    else synced += 1;
  }

  return { synced, failed, skipped };
}
