import { createHash } from "crypto";
import { loadNapSiteSnapshot } from "@/lib/mken/gbp";
import { fetchTenantRow } from "@/lib/mken/tenant";
import { normalizeWaPhone } from "@/lib/mken/whatsapp";

const GRAPH = "https://graph.facebook.com/v18.0";

export type MetaCapiEvent = "Schedule" | "Purchase";

export type TenantAdsMeta = {
  adAccountId: string;
  pageId: string;
};

export function metaAdsTokenConfigured(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN?.trim());
}

/** Token is platform-wide. Ad account and Page must come from the tenant. */
export function metaAdsConfigured(): boolean {
  return metaAdsTokenConfigured();
}

export function normalizeMetaAdAccountId(raw: string): string {
  return raw.trim().replace(/^act_/i, "").replace(/\D/g, "");
}

export function normalizeMetaPageId(raw: string): string {
  return raw.trim().replace(/\D/g, "");
}

export function readTenantAdsMeta(slugConfig: { adsMeta?: { adAccountId?: string; pageId?: string } } | null | undefined): TenantAdsMeta | null {
  const adAccountId = normalizeMetaAdAccountId(slugConfig?.adsMeta?.adAccountId || "");
  const pageId = normalizeMetaPageId(slugConfig?.adsMeta?.pageId || "");
  if (adAccountId.length < 6 || pageId.length < 5) return null;
  return { adAccountId, pageId };
}

export async function resolveTenantAdsMeta(slug: string): Promise<{ meta?: TenantAdsMeta; error?: string }> {
  const row = await fetchTenantRow(slug);
  const meta = readTenantAdsMeta(row?.config_data);
  if (!meta) {
    return {
      error: "أضف حساب إعلانات ميتا ومعرّف الصفحة لهذه المنشأة قبل النشر. لا يُستخدم حساب المنصة المشترك.",
    };
  }
  return { meta };
}

export function metaCapiConfigured(): boolean {
  return Boolean(
    (process.env.META_PIXEL_ID || process.env.META_CAPI_PIXEL_ID)?.trim() &&
      (process.env.META_CAPI_ACCESS_TOKEN || process.env.META_ADS_ACCESS_TOKEN)?.trim()
  );
}

function adsToken(): string {
  return process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
}

function adAccountPath(adAccountId: string): string {
  return `act_${normalizeMetaAdAccountId(adAccountId)}`;
}

async function graphJson(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const res = await fetch(`${GRAPH}/${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, body };
}

function graphError(body: Record<string, unknown>, fallback: string): string {
  const err = body.error;
  if (err && typeof err === "object") {
    const message = (err as { message?: string }).message;
    if (message) return `${fallback}: ${message}`;
  }
  return fallback;
}

function hashPhone(phone: string): string {
  const digits = normalizeWaPhone(phone);
  if (!digits) return "";
  return createHash("sha256").update(digits).digest("hex");
}

function parseDataImage(raw: string | undefined): { mime: string; bytes: string } | null {
  if (!raw) return null;
  const match = raw.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const bytes = match[2].replace(/\s+/g, "");
  if (bytes.length < 80 || bytes.length > 800_000) return null;
  return { mime: match[1], bytes };
}

async function uploadMetaAdImage(
  account: string,
  token: string,
  imageDataUrl: string | undefined
): Promise<string> {
  const parsed = parseDataImage(imageDataUrl);
  if (!parsed) return "";
  const { ok, body } = await graphJson(`${account}/adimages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bytes: parsed.bytes }),
  });
  if (!ok) return "";
  const images = body.images;
  if (!images || typeof images !== "object") return "";
  for (const value of Object.values(images as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      const hash = (value as { hash?: string }).hash;
      if (hash) return hash;
    }
  }
  return "";
}

export type CtwaCampaignInput = {
  name: string;
  dailyBudgetHalalas: number;
  radiusKm: number;
  centerLat: number;
  centerLng: number;
  headline: string;
  primaryText: string;
  prefilledMessage: string;
  whatsappNumber: string;
  adAccountId: string;
  pageId: string;
  imageDataUrl?: string;
};

export async function publishMetaCtwa(
  input: CtwaCampaignInput
): Promise<{ campaignId?: string; error?: string }> {
  if (!metaAdsTokenConfigured()) {
    return { error: "أضف META_ADS_ACCESS_TOKEN بعد اعتماد تطبيق Meta، ثم أعد النشر." };
  }

  const token = adsToken();
  const accountId = normalizeMetaAdAccountId(input.adAccountId);
  const page = normalizeMetaPageId(input.pageId);
  if (accountId.length < 6 || page.length < 5) {
    return { error: "حساب إعلانات ميتا أو معرّف الصفحة غير صالح لهذه المنشأة" };
  }
  const account = adAccountPath(accountId);
  const wa = normalizeWaPhone(input.whatsappNumber || "");
  if (!wa) return { error: "رقم واتساب المنشأة ناقص — أضفه في الإعدادات" };

  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const campaignRes = await graphJson(`${account}/campaigns`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: input.name.slice(0, 120),
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
    }),
  });
  if (!campaignRes.ok || typeof campaignRes.body.id !== "string") {
    return { error: graphError(campaignRes.body, "تعذّر إنشاء حملة ميتا") };
  }
  const campaignId = campaignRes.body.id;

  const targeting = {
    geo_locations: {
      custom_locations: [
        {
          latitude: input.centerLat,
          longitude: input.centerLng,
          radius: input.radiusKm,
          distance_unit: "kilometer",
        },
      ],
    },
  };

  const adsetRes = await graphJson(`${account}/adsets`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: `${input.name.slice(0, 80)} - set`,
      campaign_id: campaignId,
      daily_budget: String(Math.max(1500, input.dailyBudgetHalalas)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "CONVERSATIONS",
      destination_type: "WHATSAPP",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: { page_id: page },
      targeting,
      status: "PAUSED",
    }),
  });
  if (!adsetRes.ok || typeof adsetRes.body.id !== "string") {
    return { error: graphError(adsetRes.body, "تعذّر إنشاء مجموعة الإعلانات") };
  }

  const prefilled = input.prefilledMessage.trim().slice(0, 300);
  const waLink = prefilled
    ? `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(prefilled)}`
    : "https://api.whatsapp.com/send";

  const imageHash = await uploadMetaAdImage(account, token, input.imageDataUrl);
  const linkData: Record<string, unknown> = {
    name: input.headline.slice(0, 40),
    message: input.primaryText.slice(0, 220),
    link: waLink,
    call_to_action: {
      type: "WHATSAPP_MESSAGE",
      value: {
        link: waLink,
        whatsapp_number: wa,
      },
    },
  };
  if (imageHash) linkData.image_hash = imageHash;

  const creativeRes = await graphJson(`${account}/adcreatives`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: input.headline.slice(0, 80),
      object_story_spec: {
        page_id: page,
        link_data: linkData,
      },
    }),
  });
  if (!creativeRes.ok || typeof creativeRes.body.id !== "string") {
    return { error: graphError(creativeRes.body, "تعذّر إنشاء التصميم الإعلاني") };
  }

  const adRes = await graphJson(`${account}/ads`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: input.name.slice(0, 120),
      adset_id: adsetRes.body.id,
      creative: { creative_id: creativeRes.body.id },
      status: "ACTIVE",
    }),
  });
  if (!adRes.ok || typeof adRes.body.id !== "string") {
    return { error: graphError(adRes.body, "تعذّر نشر الإعلان") };
  }

  await graphJson(campaignId, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  await graphJson(adsetRes.body.id, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ status: "ACTIVE" }),
  });

  return { campaignId };
}

async function setMetaCampaignStatus(
  externalCampaignId: string,
  status: "PAUSED" | "ACTIVE",
  fallback: string
): Promise<{ error?: string }> {
  if (!externalCampaignId.trim()) return { error: "معرّف حملة ميتا ناقص" };
  if (!metaAdsTokenConfigured()) {
    return { error: "أضف META_ADS_ACCESS_TOKEN بعد اعتماد تطبيق Meta" };
  }
  const { ok, body } = await graphJson(externalCampaignId, {
    method: "POST",
    headers: { Authorization: `Bearer ${adsToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!ok) return { error: graphError(body, fallback) };
  return {};
}

export async function pauseMetaCampaign(externalCampaignId: string): Promise<{ error?: string }> {
  return setMetaCampaignStatus(externalCampaignId, "PAUSED", "تعذّر إيقاف الحملة على ميتا");
}

export async function resumeMetaCampaign(externalCampaignId: string): Promise<{ error?: string }> {
  return setMetaCampaignStatus(externalCampaignId, "ACTIVE", "تعذّر استئناف الحملة على ميتا");
}

function actionSum(actions: unknown, match: RegExp): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const item of actions) {
    if (!item || typeof item !== "object") continue;
    const type = String((item as { action_type?: string }).action_type || "");
    if (!match.test(type)) continue;
    total += Number((item as { value?: string | number }).value) || 0;
  }
  return total;
}

export type MetaCampaignInsights = {
  impressions: number;
  clicks: number;
  conversations: number;
  spentHalalas: number;
};

export async function fetchMetaCampaignInsights(
  externalCampaignId: string
): Promise<{ insights?: MetaCampaignInsights; error?: string }> {
  if (!externalCampaignId.trim()) return { error: "معرّف حملة ميتا ناقص" };
  if (!metaAdsTokenConfigured()) {
    return { error: "أضف META_ADS_ACCESS_TOKEN بعد اعتماد تطبيق Meta" };
  }
  const path = `${externalCampaignId}/insights?fields=impressions,clicks,spend,actions&date_preset=maximum`;
  const { ok, body } = await graphJson(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${adsToken()}` },
  });
  if (!ok) return { error: graphError(body, "تعذّر قراءة مقاييس ميتا") };
  const row = Array.isArray(body.data) ? (body.data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    return { insights: { impressions: 0, clicks: 0, conversations: 0, spentHalalas: 0 } };
  }
  const spendSar = Number(row.spend) || 0;
  return {
    insights: {
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      conversations: actionSum(row.actions, /messaging|conversation/i),
      spentHalalas: Math.round(spendSar * 100),
    },
  };
}

export async function sendMetaCapiEvent(input: {
  eventName: MetaCapiEvent;
  phone?: string;
  eventId?: string;
  value?: number;
  ctwaClid?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
}): Promise<{ error?: string }> {
  if (!metaCapiConfigured()) return {};

  const pixel = (process.env.META_PIXEL_ID || process.env.META_CAPI_PIXEL_ID || "").trim();
  const token = (process.env.META_CAPI_ACCESS_TOKEN || process.env.META_ADS_ACCESS_TOKEN || "").trim();
  const ph = input.phone ? hashPhone(input.phone) : "";
  const userData: Record<string, unknown> = {};
  if (ph) userData.ph = [ph];
  if (input.ctwaClid?.trim()) userData.ctwa_clid = input.ctwaClid.trim();
  if (input.fbp?.trim()) userData.fbp = input.fbp.trim();
  if (input.fbc?.trim()) userData.fbc = input.fbc.trim();

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId || undefined,
        action_source: input.ctwaClid ? "business_messaging" : "website",
        event_source_url: input.sourceUrl || undefined,
        user_data: userData,
        custom_data:
          input.eventName === "Purchase" && input.value
            ? { currency: "SAR", value: input.value }
            : undefined,
      },
    ],
  };

  const { ok, body } = await graphJson(`${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!ok) return { error: graphError(body, "تعذّر إرسال تحويل ميتا") };
  return {};
}

export function capiIdsFromRequest(request: Request, body?: Record<string, unknown>) {
  const cookies = request.headers.get("cookie") || "";
  const pick = (name: string) => {
    const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  };
  const fromBody = (key: string) => (typeof body?.[key] === "string" ? String(body[key]).trim() : "");
  return {
    ctwaClid: fromBody("ctwa_clid") || pick("ctwa_clid"),
    fbp: pick("_fbp"),
    fbc: pick("_fbc"),
  };
}

export async function resolveTenantWhatsapp(slug: string): Promise<string> {
  const snap = await loadNapSiteSnapshot(slug);
  return normalizeWaPhone(snap.site?.phone || process.env.META_WHATSAPP_NUMBER || "");
}
