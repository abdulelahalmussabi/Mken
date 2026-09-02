import { createHmac } from "crypto";
import { fetchTenantRow, getTenantDb, TENANT_TABLE, writeTenantConfig } from "@/lib/mken/tenant";

const ADS_API = "https://googleads.googleapis.com/v18";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const AUTH_COLUMNS =
  "google_ads_refresh_token, google_ads_access_token, google_ads_token_expiry, google_ads_customer_id, google_ads_login_customer_id";

export type GoogleAdsAccount = {
  customerId: string;
  name: string;
  manager: boolean;
  testAccount: boolean;
  currency: string;
  loginCustomerId: string;
};

export type TenantGoogleAds = {
  customerId: string;
  loginCustomerId: string;
  descriptiveName: string;
  connected: boolean;
  pendingAccounts: GoogleAdsAccount[];
};

type AdsAuthRow = {
  google_ads_refresh_token?: string | null;
  google_ads_access_token?: string | null;
  google_ads_token_expiry?: string | null;
  google_ads_customer_id?: string | null;
  google_ads_login_customer_id?: string | null;
};

const tokenCache = new Map<string, { access: string; expiresAt: number }>();

export function googleAdsApiConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      clientId() &&
      clientSecret()
  );
}

export function normalizeGoogleCustomerId(raw: string): string {
  return raw.trim().replace(/-/g, "").replace(/\D/g, "");
}

export function readTenantGoogleAds(
  config: {
    adsGoogle?: { customerId?: string; loginCustomerId?: string; descriptiveName?: string; pendingAccounts?: GoogleAdsAccount[] };
  } | null | undefined
): Pick<TenantGoogleAds, "customerId" | "loginCustomerId" | "descriptiveName" | "pendingAccounts"> {
  const pending = Array.isArray(config?.adsGoogle?.pendingAccounts) ? config.adsGoogle.pendingAccounts : [];
  return {
    customerId: normalizeGoogleCustomerId(config?.adsGoogle?.customerId || ""),
    loginCustomerId: normalizeGoogleCustomerId(config?.adsGoogle?.loginCustomerId || ""),
    descriptiveName: typeof config?.adsGoogle?.descriptiveName === "string" ? config.adsGoogle.descriptiveName : "",
    pendingAccounts: pending.filter((item) => normalizeGoogleCustomerId(item?.customerId || "").length >= 8),
  };
}

async function loadAdsAuthRow(slug: string): Promise<{ row?: AdsAuthRow; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db.from(TENANT_TABLE).select(AUTH_COLUMNS).eq("tenant_slug", slug).maybeSingle();
  if (error) {
    if (/does not exist|42703/i.test(error.message || "")) {
      return { error: "نفّذ أعمدة google_ads_* على mken_saas_clients ثم أعد المحاولة." };
    }
    return { error: "تعذّر قراءة ربط إعلانات جوجل" };
  }
  return { row: (data as AdsAuthRow) || {} };
}

export async function fetchGoogleAdsConnection(slug: string): Promise<TenantGoogleAds> {
  const [auth, row] = await Promise.all([loadAdsAuthRow(slug), fetchTenantRow(slug)]);
  const fromConfig = readTenantGoogleAds(row?.config_data);
  const customerId = normalizeGoogleCustomerId(auth.row?.google_ads_customer_id || fromConfig.customerId);
  const loginCustomerId = normalizeGoogleCustomerId(
    auth.row?.google_ads_login_customer_id || fromConfig.loginCustomerId
  );
  return {
    customerId,
    loginCustomerId,
    descriptiveName: fromConfig.descriptiveName,
    connected: Boolean(auth.row?.google_ads_refresh_token),
    pendingAccounts: fromConfig.pendingAccounts,
  };
}

export async function resolveTenantGoogleAds(
  slug: string
): Promise<{ ads?: TenantGoogleAds; error?: string }> {
  const ads = await fetchGoogleAdsConnection(slug);
  if (!ads.connected) {
    return { error: "اربط حساب إعلانات جوجل لهذه المنشأة أولاً. الإنفاق يتم على وسيلة دفع ذلك الحساب." };
  }
  if (ads.customerId.length < 8) {
    return { error: "اختر حساب إعلانات جوجل بعد الربط قبل النشر." };
  }
  return { ads };
}

function clientId(): string {
  return (process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
}

function clientSecret(): string {
  return (process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

function adsRedirectUri(): string {
  const explicit = process.env.GOOGLE_ADS_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://mken.live").replace(/\/$/, "");
  return `${site}/api/ads/google/callback`;
}

function stateSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET || clientSecret() || "mken-ads").trim();
}

export function buildGoogleAdsAuthUrl(tenantSlug: string): { url?: string; error?: string } {
  if (!googleAdsApiConfigured()) {
    return {
      error: "أضف GOOGLE_ADS_DEVELOPER_TOKEN مع GOOGLE_CLIENT_ID/SECRET بعد اعتماد Google Ads API.",
    };
  }
  const slug = tenantSlug.trim().toLowerCase();
  if (!slug) return { error: "المنشأة ناقصة" };
  const exp = String(Date.now() + 15 * 60 * 1000);
  const payload = `${slug}.${exp}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: adsRedirectUri(),
    response_type: "code",
    scope: ADS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: Buffer.from(`${payload}.${sig}`).toString("base64url"),
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

export function parseGoogleAdsOAuthState(state: string): { slug?: string; error?: string } {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const [slug, exp, sig] = raw.split(".");
    if (!slug || !exp || !sig) return { error: "حالة الربط غير صالحة" };
    if (Number(exp) < Date.now()) return { error: "انتهت صلاحية طلب الربط. أعد المحاولة." };
    const expected = createHmac("sha256", stateSecret()).update(`${slug}.${exp}`).digest("hex").slice(0, 32);
    if (expected !== sig) return { error: "حالة الربط غير صالحة" };
    return { slug: slug.toLowerCase() };
  } catch {
    return { error: "حالة الربط غير صالحة" };
  }
}

async function accessToken(slug: string): Promise<{ token?: string; loginCustomerId?: string; error?: string }> {
  const cached = tokenCache.get(slug);
  const auth = await loadAdsAuthRow(slug);
  if (auth.error) return { error: auth.error };
  const refresh = auth.row?.google_ads_refresh_token?.trim() || "";
  if (!refresh) {
    return { error: "اربط حساب إعلانات جوجل لهذه المنشأة أولاً. لا يُستخدم حساب المنصة." };
  }
  const loginCustomerId = normalizeGoogleCustomerId(auth.row?.google_ads_login_customer_id || "");
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return { token: cached.access, loginCustomerId };
  }
  if (!googleAdsApiConfigured()) {
    return { error: "أضف GOOGLE_ADS_DEVELOPER_TOKEN مع GOOGLE_CLIENT_ID/SECRET بعد اعتماد Google Ads API." };
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    return { error: `تعذّر تجديد توكن إعلانات جوجل لهذه المنشأة: ${body.error || res.status}` };
  }
  const expiresAt = Date.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000;
  tokenCache.set(slug, { access: body.access_token, expiresAt });
  const db = getTenantDb();
  if (db) {
    await db
      .from(TENANT_TABLE)
      .update({
        google_ads_access_token: body.access_token,
        google_ads_token_expiry: new Date(expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_slug", slug);
  }
  return { token: body.access_token, loginCustomerId };
}

function adsHeaders(token: string, loginCustomerId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || "",
  };
  const login = normalizeGoogleCustomerId(loginCustomerId || "");
  if (login) headers["login-customer-id"] = login;
  return headers;
}

function adsError(body: Record<string, unknown>, fallback: string): string {
  const err = body.error;
  if (err && typeof err === "object") {
    const details = (err as { details?: Array<{ errors?: Array<{ message?: string }> }> }).details;
    const first = details?.[0]?.errors?.[0]?.message;
    if (first) return `${fallback}: ${first}`;
    const message = (err as { message?: string }).message;
    if (message) return `${fallback}: ${message}`;
  }
  return fallback;
}

async function mutate(
  customerId: string,
  collection: string,
  operations: unknown[],
  token: string,
  loginCustomerId?: string
): Promise<{ resourceName?: string; error?: string }> {
  const res = await fetch(`${ADS_API}/customers/${customerId}/${collection}:mutate`, {
    method: "POST",
    headers: adsHeaders(token, loginCustomerId),
    body: JSON.stringify({ operations }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { error: adsError(body, "تعذّر طلب Google Ads") };
  const results = Array.isArray(body.results) ? body.results : [];
  const name = (results[0] as { resourceName?: string } | undefined)?.resourceName;
  if (!name) return { error: "Google Ads لم يُرجع معرّف المورد" };
  return { resourceName: name };
}

function uniqShort(values: string[], maxLen: number, minCount: number, filler: string[]): string[] {
  const out: string[] = [];
  for (const value of [...values, ...filler]) {
    const text = value.trim().slice(0, maxLen);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= Math.max(minCount, values.length)) break;
  }
  let i = 1;
  while (out.length < minCount) {
    const extra = `${filler[0] || "مكّن"} ${i}`.slice(0, maxLen);
    if (!out.includes(extra)) out.push(extra);
    i += 1;
    if (i > 8) break;
  }
  return out;
}

export type GoogleLocalCampaignInput = {
  slug: string;
  name: string;
  dailyBudgetHalalas: number;
  radiusKm: number;
  centerLat: number;
  centerLng: number;
  website: string;
  serviceName: string;
  city: string;
  headlines: string[];
  descriptions: string[];
  negativeKeywords: string[];
  customerId: string;
};

export async function publishGoogleLocalSearch(
  input: GoogleLocalCampaignInput
): Promise<{ campaignId?: string; error?: string }> {
  const auth = await accessToken(input.slug);
  if (auth.error || !auth.token) return { error: auth.error };
  const loginCustomerId = auth.loginCustomerId;
  const customerId = normalizeGoogleCustomerId(input.customerId);
  if (customerId.length < 8) return { error: "معرّف حساب إعلانات جوجل غير صالح" };
  const website = input.website.trim();
  if (!/^https?:\/\//i.test(website)) return { error: "رابط موقع المنشأة ناقص — احفظ الدومين أو الرابط قبل النشر" };

  const micros = String(Math.max(15_000_000, input.dailyBudgetHalalas * 10_000));
  const budget = await mutate(
    customerId,
    "campaignBudgets",
    [
      {
        create: {
          name: `${input.name.slice(0, 80)} budget`,
          amountMicros: micros,
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (budget.error || !budget.resourceName) return { error: budget.error };

  const campaign = await mutate(
    customerId,
    "campaigns",
    [
      {
        create: {
          name: input.name.slice(0, 120),
          advertisingChannelType: "SEARCH",
          status: "PAUSED",
          campaignBudget: budget.resourceName,
          maximizeClicks: {},
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          geoTargetTypeSetting: {
            positiveGeoTargetType: "PRESENCE",
            negativeGeoTargetType: "PRESENCE",
          },
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: false,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
        },
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (campaign.error || !campaign.resourceName) return { error: campaign.error };

  const geo = await mutate(
    customerId,
    "campaignCriteria",
    [
      {
        create: {
          campaign: campaign.resourceName,
          proximity: {
            geoPoint: {
              latitudeInMicroDegrees: Math.round(input.centerLat * 1_000_000),
              longitudeInMicroDegrees: Math.round(input.centerLng * 1_000_000),
            },
            radius: input.radiusKm,
            radiusUnits: "KILOMETERS",
          },
        },
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (geo.error) return { error: geo.error };

  const adGroup = await mutate(
    customerId,
    "adGroups",
    [
      {
        create: {
          name: `${input.name.slice(0, 80)} - group`,
          campaign: campaign.resourceName,
          status: "ENABLED",
          type: "SEARCH_STANDARD",
          cpcBidMicros: "2000000",
        },
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (adGroup.error || !adGroup.resourceName) return { error: adGroup.error };

  const headlines = uniqShort(
    input.headlines,
    30,
    3,
    [input.serviceName, input.city ? `${input.serviceName} ${input.city}` : "", "احجز الآن"]
  ).map((text) => ({ text }));
  const descriptions = uniqShort(
    input.descriptions,
    90,
    2,
    [`${input.serviceName} قريب منك. احجز بسهولة.`, "تواصل معنا عبر الموقع واحجز موعدك."]
  ).map((text) => ({ text }));

  const ad = await mutate(
    customerId,
    "adGroupAds",
    [
      {
        create: {
          adGroup: adGroup.resourceName,
          status: "ENABLED",
          ad: {
            responsiveSearchAd: { headlines, descriptions },
            finalUrls: [website],
          },
        },
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (ad.error) return { error: ad.error };

  const keywordText = `${input.serviceName} ${input.city}`.trim().slice(0, 80) || input.serviceName.slice(0, 80);
  if (keywordText) {
    const keyword = await mutate(
      customerId,
      "adGroupCriteria",
      [
        {
          create: {
            adGroup: adGroup.resourceName,
            keyword: { text: keywordText, matchType: "PHRASE" },
          },
        },
      ],
      auth.token,
    loginCustomerId
    );
    if (keyword.error) return { error: keyword.error };
  }

  const negatives = input.negativeKeywords.map((word) => word.trim()).filter(Boolean).slice(0, 12);
  if (negatives.length) {
    const neg = await mutate(
      customerId,
      "adGroupCriteria",
      negatives.map((text) => ({
        create: {
          adGroup: adGroup.resourceName,
          negative: true,
          keyword: { text: text.slice(0, 80), matchType: "PHRASE" },
        },
      })),
      auth.token,
    loginCustomerId
    );
    if (neg.error) return { error: neg.error };
  }

  const enabled = await mutate(
    customerId,
    "campaigns",
    [
      {
        update: { resourceName: campaign.resourceName, status: "ENABLED" },
        updateMask: "status",
      },
    ],
    auth.token,
    loginCustomerId
  );
  if (enabled.error) return { error: enabled.error };

  const campaignId = campaign.resourceName.split("/").pop();
  if (!campaignId) return { error: "تعذّر قراءة معرّف حملة جوجل" };
  return { campaignId };
}

async function setGoogleCampaignStatus(
  slug: string,
  customerId: string,
  campaignId: string,
  status: "PAUSED" | "ENABLED",
  fallback: string
): Promise<{ error?: string }> {
  const auth = await accessToken(slug);
  if (auth.error || !auth.token) return { error: auth.error };
  const cid = normalizeGoogleCustomerId(customerId);
  const id = campaignId.replace(/\D/g, "");
  if (!cid || !id) return { error: "معرّف حملة جوجل ناقص" };
  const updated = await mutate(
    cid,
    "campaigns",
    [
      {
        update: { resourceName: `customers/${cid}/campaigns/${id}`, status },
        updateMask: "status",
      },
    ],
    auth.token,
    auth.loginCustomerId
  );
  if (updated.error) return { error: updated.error || fallback };
  return {};
}

export async function pauseGoogleCampaign(
  slug: string,
  customerId: string,
  campaignId: string
): Promise<{ error?: string }> {
  return setGoogleCampaignStatus(slug, customerId, campaignId, "PAUSED", "تعذّر إيقاف حملة جوجل");
}

export async function resumeGoogleCampaign(
  slug: string,
  customerId: string,
  campaignId: string
): Promise<{ error?: string }> {
  return setGoogleCampaignStatus(slug, customerId, campaignId, "ENABLED", "تعذّر استئناف حملة جوجل");
}

export async function fetchGoogleCampaignInsights(
  slug: string,
  customerId: string,
  campaignId: string
): Promise<{ insights?: { impressions: number; clicks: number; conversations: number; spentHalalas: number }; error?: string }> {
  const auth = await accessToken(slug);
  if (auth.error || !auth.token) return { error: auth.error };
  const cid = normalizeGoogleCustomerId(customerId);
  const id = campaignId.replace(/\D/g, "");
  if (!cid || !id) return { error: "معرّف حملة جوجل ناقص" };
  const res = await fetch(`${ADS_API}/customers/${cid}/googleAds:search`, {
    method: "POST",
    headers: adsHeaders(auth.token, auth.loginCustomerId),
    body: JSON.stringify({
      query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.id = ${id}`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { error: adsError(body, "تعذّر قراءة مقاييس جوجل") };
  const row = Array.isArray(body.results) ? (body.results[0] as { metrics?: Record<string, string | number> } | undefined) : undefined;
  const metrics = row?.metrics || {};
  const costMicros = Number(metrics.costMicros ?? metrics.cost_micros) || 0;
  return {
    insights: {
      impressions: Number(metrics.impressions) || 0,
      clicks: Number(metrics.clicks) || 0,
      conversations: Math.round(Number(metrics.conversions) || 0),
      spentHalalas: Math.round(costMicros / 10_000),
    },
  };
}

async function googleAdsSearch(
  customerId: string,
  token: string,
  loginCustomerId: string,
  query: string
): Promise<{ results?: Array<Record<string, unknown>>; error?: string }> {
  const res = await fetch(`${ADS_API}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: adsHeaders(token, loginCustomerId),
    body: JSON.stringify({ query }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { error: adsError(body, "تعذّر قراءة حسابات جوجل Ads") };
  return { results: Array.isArray(body.results) ? (body.results as Array<Record<string, unknown>>) : [] };
}

function asAccount(raw: Record<string, unknown> | undefined, loginCustomerId: string): GoogleAdsAccount | null {
  if (!raw) return null;
  const customerId = normalizeGoogleCustomerId(String(raw.id || ""));
  if (customerId.length < 8) return null;
  return {
    customerId,
    name: typeof raw.descriptiveName === "string" ? raw.descriptiveName : typeof raw.descriptive_name === "string" ? raw.descriptive_name : customerId,
    manager: raw.manager === true,
    testAccount: raw.testAccount === true || raw.test_account === true,
    currency: String(raw.currencyCode || raw.currency_code || ""),
    loginCustomerId: raw.manager === true ? customerId : loginCustomerId,
  };
}

export async function listGoogleAdsAccounts(
  slug: string
): Promise<{ accounts?: GoogleAdsAccount[]; error?: string }> {
  const auth = await accessToken(slug);
  if (auth.error || !auth.token) return { error: auth.error };
  const listed = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: adsHeaders(auth.token),
  });
  const listedBody = (await listed.json().catch(() => ({}))) as { resourceNames?: string[]; error?: unknown };
  if (!listed.ok) {
    return { error: adsError(listedBody as Record<string, unknown>, "تعذّر قراءة الحسابات المتاحة") };
  }
  const ids = (listedBody.resourceNames || [])
    .map((name) => normalizeGoogleCustomerId(name.split("/").pop() || ""))
    .filter((id) => id.length >= 8);
  const accounts: GoogleAdsAccount[] = [];
  const seen = new Set<string>();
  for (const id of ids.slice(0, 20)) {
    const searched = await googleAdsSearch(
      id,
      auth.token,
      id,
      "SELECT customer.id, customer.descriptive_name, customer.manager, customer.test_account, customer.currency_code FROM customer LIMIT 1"
    );
    if (searched.error || !searched.results?.[0]) continue;
    const customer = (searched.results[0].customer || searched.results[0]) as Record<string, unknown>;
    const account = asAccount(customer, "");
    if (!account || seen.has(account.customerId)) continue;
    seen.add(account.customerId);
    if (account.manager) {
      const clients = await googleAdsSearch(
        id,
        auth.token,
        id,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.test_account, customer_client.currency_code FROM customer_client WHERE customer_client.status = 'ENABLED' AND customer_client.manager = FALSE"
      );
      for (const row of clients.results || []) {
        const child = asAccount((row.customerClient || row.customer_client || row) as Record<string, unknown>, id);
        if (!child || seen.has(child.customerId)) continue;
        seen.add(child.customerId);
        accounts.push({ ...child, manager: false, loginCustomerId: id });
      }
      continue;
    }
    accounts.push(account);
  }
  return { accounts };
}

async function writeAdsGoogleConfig(
  slug: string,
  adsGoogle: {
    customerId?: string;
    loginCustomerId?: string;
    descriptiveName?: string;
    pendingAccounts?: GoogleAdsAccount[];
  }
): Promise<{ error?: string }> {
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const written = await writeTenantConfig(slug, {
    ...(row.config_data || {}),
    adsGoogle,
  });
  return written.error ? { error: written.error } : {};
}

export async function completeGoogleAdsOAuth(
  slug: string,
  code: string
): Promise<{ ads?: TenantGoogleAds; error?: string }> {
  if (!googleAdsApiConfigured()) {
    return { error: "أضف GOOGLE_ADS_DEVELOPER_TOKEN مع GOOGLE_CLIENT_ID/SECRET بعد اعتماد Google Ads API." };
  }
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: adsRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    return { error: `تعذّر ربط حساب جوجل Ads: ${tokenData.error || tokenRes.status}` };
  }
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!tokenData.refresh_token) {
    const existing = await loadAdsAuthRow(slug);
    if (!existing.row?.google_ads_refresh_token) {
      return { error: "جوجل لم يُرجع توكن التجديد. أعد الربط ووافق على الصلاحيات." };
    }
  }
  const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  const update: Record<string, unknown> = {
    google_ads_access_token: tokenData.access_token,
    google_ads_token_expiry: expiry,
    updated_at: new Date().toISOString(),
  };
  if (tokenData.refresh_token) update.google_ads_refresh_token = tokenData.refresh_token;
  const { error } = await db.from(TENANT_TABLE).update(update).eq("tenant_slug", slug);
  if (error) {
    if (/does not exist|42703/i.test(error.message || "")) {
      return { error: "نفّذ أعمدة google_ads_* على mken_saas_clients ثم أعد الربط." };
    }
    return { error: "تعذّر حفظ توكن إعلانات جوجل" };
  }
  tokenCache.delete(slug);
  if (tokenData.access_token) {
    tokenCache.set(slug, {
      access: tokenData.access_token,
      expiresAt: Date.now() + Math.max(60, Number(tokenData.expires_in) || 3600) * 1000,
    });
  }
  const listed = await listGoogleAdsAccounts(slug);
  if (listed.error) return { error: listed.error };
  if (!(listed.accounts || []).length) {
    return { error: "لا يوجد حساب إعلانات يمكن الوصول إليه بهذا المستخدم. سجّل الدخول بحساب يملك Google Ads ووسيلة دفع." };
  }
  const billable = (listed.accounts || []).filter((item) => !item.manager && !item.testAccount);
  const pickFrom = billable.length ? billable : (listed.accounts || []).filter((item) => !item.manager);
  if (pickFrom.length === 1) {
    return selectGoogleAdsCustomer(slug, pickFrom[0].customerId, pickFrom[0].loginCustomerId, pickFrom[0].name);
  }
  const pending = await writeAdsGoogleConfig(slug, {
    customerId: "",
    loginCustomerId: "",
    descriptiveName: "",
    pendingAccounts: listed.accounts || [],
  });
  if (pending.error) return { error: pending.error };
  return { ads: await fetchGoogleAdsConnection(slug) };
}

export async function selectGoogleAdsCustomer(
  slug: string,
  customerIdRaw: string,
  loginCustomerIdRaw = "",
  descriptiveName = ""
): Promise<{ ads?: TenantGoogleAds; error?: string }> {
  const connected = await fetchGoogleAdsConnection(slug);
  if (!connected.connected) {
    return { error: "اربط حساب إعلانات جوجل لهذه المنشأة أولاً." };
  }
  const customerId = normalizeGoogleCustomerId(customerIdRaw);
  if (customerId.length < 8) return { error: "معرّف حساب إعلانات جوجل غير صالح" };
  const pendingMatch = connected.pendingAccounts.find((item) => item.customerId === customerId);
  if (pendingMatch?.manager) {
    return { error: "اختر حساب إعلانات العميل وليس حساب المدير. الفوترة يجب أن تكون على حساب المنشأة." };
  }
  const loginCustomerId = normalizeGoogleCustomerId(loginCustomerIdRaw || pendingMatch?.loginCustomerId || "");
  const name = descriptiveName || pendingMatch?.name || "";
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_ads_customer_id: customerId,
      google_ads_login_customer_id: loginCustomerId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);
  if (error) return { error: "تعذّر حفظ حساب إعلانات جوجل" };
  const written = await writeAdsGoogleConfig(slug, {
    customerId,
    loginCustomerId,
    descriptiveName: name,
    pendingAccounts: [],
  });
  if (written.error) return { error: written.error };
  return { ads: await fetchGoogleAdsConnection(slug) };
}

export async function disconnectGoogleAds(slug: string): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  tokenCache.delete(slug);
  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_ads_refresh_token: null,
      google_ads_access_token: null,
      google_ads_token_expiry: null,
      google_ads_customer_id: null,
      google_ads_login_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);
  if (error) return { error: "تعذّر إلغاء الربط" };
  return writeAdsGoogleConfig(slug, {
    customerId: "",
    loginCustomerId: "",
    descriptiveName: "",
    pendingAccounts: [],
  });
}
