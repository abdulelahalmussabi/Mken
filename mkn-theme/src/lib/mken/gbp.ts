import { fetchTenantRow, getTenantDb, TENANT_TABLE } from "@/lib/mken/tenant";
import { fetchTenantCatalog } from "@/lib/mken/catalog";
import { buildNapAuditReport, planNapSync, type NapReport, type NapSiteSnapshot } from "@/lib/mken/nap";

export interface GbpStatus {
  connected: boolean;
  expiry: string | null;
  selectedLocationId: string | null;
}

export interface GbpLocation {
  id: string;
  title: string;
  websiteUri: string;
  newReviewUrl: string;
  mapsUri: string;
  city: string;
}

export async function fetchGbpStatus(slug: string): Promise<{ status?: GbpStatus; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select(
      "google_refresh_token, google_access_token, google_token_expiry, google_business_location_id"
    )
    .eq("tenant_slug", slug)
    .maybeSingle();

  if (error) return { error: "تعذّر قراءة حالة الربط" };

  const row = data as {
    google_refresh_token?: string | null;
    google_access_token?: string | null;
    google_token_expiry?: string | null;
    google_business_location_id?: string | null;
  } | null;

  return {
    status: {
      connected: Boolean(row?.google_refresh_token || row?.google_access_token),
      expiry: row?.google_token_expiry || null,
      selectedLocationId: row?.google_business_location_id || null,
    },
  };
}

export async function disconnectGbp(slug: string): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_business_location_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  return error ? { error: "تعذّر إلغاء الربط" } : {};
}

export function buildGoogleAuthUrl(tenantSlug: string): { url?: string; error?: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return { error: "GOOGLE_CLIENT_ID و GOOGLE_REDIRECT_URI غير معيّنين على الخادم" };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
    state: tenantSlug,
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

async function getValidAccessToken(slug: string): Promise<string> {
  const db = getTenantDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة على الخادم");

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("tenant_slug", slug)
    .maybeSingle();

  if (error || !data) throw new Error("Google Business account is not connected");

  const row = data as {
    google_access_token?: string | null;
    google_refresh_token?: string | null;
    google_token_expiry?: string | null;
  };

  if (!row.google_refresh_token) throw new Error("Google Business account is not connected");

  const stillValid =
    row.google_access_token &&
    row.google_token_expiry &&
    new Date(row.google_token_expiry).getTime() - Date.now() >= 60_000;

  if (stillValid && row.google_access_token) return row.google_access_token;

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET غير معيّنين");
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) throw new Error("فشل تجديد توكن جوجل");

  const tokenData = (await refreshRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw new Error("فشل تجديد توكن جوجل");

  const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await db
    .from(TENANT_TABLE)
    .update({
      google_access_token: tokenData.access_token,
      google_token_expiry: expiry,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  return tokenData.access_token;
}

export async function listGbpLocations(
  slug: string
): Promise<{ connected: boolean; selectedLocationId: string | null; locations: GbpLocation[]; error?: string }> {
  try {
    const token = await getValidAccessToken(slug);
    const db = getTenantDb();
    const { data: client } = db
      ? await db
          .from(TENANT_TABLE)
          .select("google_business_location_id")
          .eq("tenant_slug", slug)
          .maybeSingle()
      : { data: null };

    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!accountsRes.ok) throw new Error("تعذّر جلب حسابات جوجل");

    const accountsData = (await accountsRes.json()) as { accounts?: { name: string }[] };
    const locations: GbpLocation[] = [];

    for (const account of accountsData.accounts || []) {
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,websiteUri,metadata,storefrontAddress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!locationsRes.ok) continue;
      const locationsData = (await locationsRes.json()) as {
        locations?: Array<{
          name?: string;
          title?: string;
          websiteUri?: string;
          metadata?: { newReviewUrl?: string; mapsUri?: string };
          storefrontAddress?: { locality?: string };
        }>;
      };
      for (const loc of locationsData.locations || []) {
        if (!loc.name) continue;
        locations.push({
          id: loc.name,
          title: loc.title || loc.name,
          websiteUri: loc.websiteUri || "",
          newReviewUrl: loc.metadata?.newReviewUrl || "",
          mapsUri: loc.metadata?.mapsUri || "",
          city: loc.storefrontAddress?.locality || "",
        });
      }
    }

    return {
      connected: true,
      selectedLocationId:
        (client as { google_business_location_id?: string | null } | null)?.google_business_location_id ||
        null,
      locations,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر جلب الفروع";
    if (message.includes("not connected")) {
      return { connected: false, selectedLocationId: null, locations: [] };
    }
    return { connected: true, selectedLocationId: null, locations: [], error: message };
  }
}

export function tenantWebsiteUrl(slug: string): string {
  return `https://${slug}.mken.live/`;
}

export async function selectGbpLocation(
  slug: string,
  locationId: string,
  syncWebsite: boolean
): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  if (syncWebsite) {
    try {
      const token = await getValidAccessToken(slug);
      const websiteUrl = tenantWebsiteUrl(slug);
      const updateRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=websiteUri`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ websiteUri: websiteUrl }),
        }
      );
      if (!updateRes.ok) return { error: "تعذّر تحديث رابط الموقع على جوجل" };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "تعذّر تحديث رابط الموقع على جوجل" };
    }
  }

  const { error } = await db
    .from(TENANT_TABLE)
    .update({
      google_business_location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", slug);

  return error ? { error: "تعذّر حفظ الفرع" } : {};
}

const GBP_POST_MAX_CHARS = 1500;
const GBP_LOCATION_READ_MASK =
  "title,phoneNumbers,websiteUri,storefrontAddress,regularHours,primaryCategory";

export interface GbpCompetitor {
  name: string;
  rating: number;
  userRatingsTotal: number;
  address: string;
  placeId?: string;
}

async function callGemini(promptText: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY غير معيّن على الخادم");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
    }
  );
  if (!response.ok) throw new Error("فشل طلب Gemini");
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("تعذّر قراءة رد Gemini");
  return text;
}

function trimGbpPostText(text: string): string {
  if (!text || text.length <= GBP_POST_MAX_CHARS) return text || "";
  return `${text.slice(0, GBP_POST_MAX_CHARS - 1).trim()}…`;
}

export async function loadNapSiteSnapshot(
  slug: string
): Promise<{ site?: NapSiteSnapshot & { lat: number; lng: number; category: string }; error?: string }> {
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };
  const config = row.config_data || {};
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as Record<string, unknown>)
      : {};
  const wh =
    booking.workingHours && typeof booking.workingHours === "object"
      ? (booking.workingHours as Record<string, unknown>)
      : {};
  const area = config.serviceArea || {};
  return {
    site: {
      name: config.brand?.name || row.business_name || slug,
      phone: config.phone || row.phone || "",
      website: tenantWebsiteUrl(slug),
      city: area.city || "",
      hoursStart: typeof wh.start === "string" ? wh.start : "",
      hoursEnd: typeof wh.end === "string" ? wh.end : "",
      lat: Number(area.center?.lat) || 21.485811,
      lng: Number(area.center?.lng) || 39.192505,
      category: typeof config.featuredActivity === "string" ? config.featuredActivity : "خدمات",
    },
  };
}

async function fetchGbpLocationDetail(slug: string, locationId: string) {
  const token = await getValidAccessToken(slug);
  const locationRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=${GBP_LOCATION_READ_MASK}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!locationRes.ok) throw new Error("تعذّر جلب بيانات الفرع من جوجل");
  return locationRes.json() as Promise<import("@/lib/mken/nap").GbpLocationDetail>;
}

export async function runNapAudit(
  slug: string,
  locationId: string
): Promise<{ report?: NapReport; error?: string }> {
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };
  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };
  try {
    const gbp = await fetchGbpLocationDetail(slug, locationId);
    return { report: buildNapAuditReport(snap.site, gbp) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر فحص NAP" };
  }
}

export async function syncNapFromMken(
  slug: string,
  locationId: string
): Promise<{
  report?: NapReport;
  updated?: { field: string; label: string; value: string }[];
  skipped?: { field: string; label: string; reason: string }[];
  message?: string;
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };

  try {
    const token = await getValidAccessToken(slug);
    const gbp = await fetchGbpLocationDetail(slug, locationId);
    const plan = planNapSync(snap.site, gbp);

    if (!plan.updateMask) {
      return {
        report: plan.report,
        updated: [],
        skipped: plan.skipped,
        message: "لا توجد حقول قابلة للمزامنة التلقائية — البيانات متطابقة أو ناقصة في مكّن.",
      };
    }

    const updateRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=${plan.updateMask}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(plan.patchBody),
      }
    );
    if (!updateRes.ok) return { error: "تعذّر مزامنة NAP مع جوجل" };

    await db
      .from(TENANT_TABLE)
      .update({
        google_business_location_id: locationId,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_slug", slug);

    const after = await fetchGbpLocationDetail(slug, locationId);
    return {
      report: buildNapAuditReport(snap.site, after),
      updated: plan.updated,
      skipped: plan.skipped,
      message: `تمت مزامنة ${plan.updated.length} حقل/حقول إلى جوجل بيزنس.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر مزامنة NAP" };
  }
}

export async function generateGbpPost(
  slug: string,
  prompt: string,
  serviceName: string
): Promise<{ text?: string; error?: string }> {
  const trimmed = prompt.trim();
  if (!trimmed) return { error: "اكتب فكرة المنشور أولاً" };
  if (trimmed.length > 2000) return { error: "النص أطول من 2000 حرف" };

  const snap = await loadNapSiteSnapshot(slug);
  const businessName = snap.site?.name || slug;
  const systemPrompt = `أنت خبير سيو محلي (Local SEO) متمرس. اكتب منشور تسويقي جذاب وملائم لخرائط جوجل (Google Business Profile) باللغة العربية.
اسم المنشأة: "${businessName}"
الخدمة أو العرض المستهدف: "${serviceName || ""}"
تفاصيل إضافية من التاجر: "${trimmed}"

شروط الكتابة:
1. اكتب بنبرة مهنية وترحيبية تلائم الجمهور السعودي والعربي، واستخدم الرموز التعبيرية (Emojis) بشكل معقول.
2. ركز على حث العميل على اتخاذ إجراء (Call to Action) مثل الحجز أو الاتصال.
3. استخدم كلمات مفتاحية طبيعية ومحسنة لمحركات البحث المحلية.
4. لا تذكر أي روابط أو أرقام هواتف إلا إذا حددها المستخدم.
5. اجعل المنشور قصيراً ومباشراً ومناسباً لمتصفحي خرائط جوجل.
6. لا تتجاوز ${GBP_POST_MAX_CHARS} حرفاً في النص النهائي.`;

  try {
    return { text: trimGbpPostText(await callGemini(systemPrompt)) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر توليد المنشور" };
  }
}

export async function generateGbpReply(
  slug: string,
  reviewText: string,
  rating: string
): Promise<{ text?: string; error?: string }> {
  if (!reviewText.trim() && !rating) return { error: "أدخل نص التقييم أو النجوم" };
  if (reviewText.length > 2000) return { error: "نص التقييم أطول من 2000 حرف" };

  const snap = await loadNapSiteSnapshot(slug);
  const businessName = snap.site?.name || slug;
  const systemPrompt = `أنت ممثل خدمة عملاء محترف لشركة "${businessName}". اكتب رداً لبقاً واحترافياً باللغة العربية للرد على تقييم عميل على خرائط جوجل.
تقييم العميل: ${rating ? `${rating} نجوم` : "غير محدد"}
نص المراجعة: "${reviewText.trim() || "لا يوجد نص مراجعة، فقط تقييم بالنجوم"}"

شروط الرد:
1. إذا كان التقييم إيجابياً (4-5 نجوم)، اشكر العميل بعبارات لطيفة ودافئة وعبر عن سعادتك بخدمته.
2. إذا كان التقييم سلبياً (1-3 نجوم)، كن متعاطفاً للغاية، اعتذر عن التقصير بأدب ووقار، واقترح عليه التواصل لحل المشكلة (دون ذكر رقم محدد إلا بشكل عام مثل "يسعدنا تواصلكم معنا عبر أرقامنا الرسمية").
3. اكتب باللغة العربية الفصحى أو بلهجة بيضاء مهذبة ومناسبة.
4. حافظ على الإيجاز والاحترافية.`;

  try {
    return { text: await callGemini(systemPrompt) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر توليد الرد" };
  }
}

export async function listGbpCompetitors(
  slug: string
): Promise<{ competitors?: GbpCompetitor[]; source?: string; error?: string }> {
  const snap = await loadNapSiteSnapshot(slug);
  if (snap.error || !snap.site) return { error: snap.error || "تعذّر قراءة بيانات المنشأة" };

  const { city, lat, lng, category } = snap.site;
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (mapsApiKey) {
    try {
      const query = encodeURIComponent(`${category || "خدمات"} ${city || ""}`);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${lat},${lng}&radius=5000&key=${mapsApiKey}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Places API ${response.status}`);
      const data = (await response.json()) as {
        results?: Array<{
          name?: string;
          rating?: number;
          user_ratings_total?: number;
          formatted_address?: string;
          place_id?: string;
        }>;
      };
      const competitors = (data.results || []).slice(0, 5).map((item) => ({
        name: item.name || "",
        rating: item.rating || 0,
        userRatingsTotal: item.user_ratings_total || 0,
        address: item.formatted_address || "",
        placeId: item.place_id,
      }));
      return { competitors, source: "google_places" };
    } catch {
      // fall through to Gemini
    }
  }

  const prompt = `أريد منك جلب أو محاكاة 4 منافسين حقيقيين ومشهورين في نفس مجال ونشاط المنشأة في هذه المدينة.
النشاط: "${category || "صالون حلاقة ورعاية"}"
المدينة: "${city || "جدة"}"

شروط الإرجاع:
1. أرجع النتيجة على شكل مصفوفة JSON صالحة ومباشرة فقط دون أي نصوص تمهيدية أو شرح أو علامات ترميز (ممنوع كتابة \`\`\`json أو أي شيء، فقط أرجع مصفوفة JSON تبدأ بـ [ وتنتهي بـ ]).
2. يجب أن يحتوي كل عنصر في المصفوفة على الحقول التالية:
   - "name": اسم المنافس باللغة العربية.
   - "rating": تقييم تقريبي بين 3.8 و 4.9 (عدد عشري).
   - "userRatingsTotal": عدد التقييمات التقريبي بين 50 و 1500 (عدد صحيح).
   - "address": عنوان تقريبي في المدينة المذكورة.
3. تأكد من أن الأسماء لمنافسين حقيقيين أو واقعيين جداً في تلك المدينة.`;

  try {
    let cleanJson = (await callGemini(prompt)).trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(cleanJson) as GbpCompetitor[];
    return { competitors: parsed, source: "gemini_simulation" };
  } catch {
    return {
      competitors: [
        { name: "صالون الأناقة والجمال الراقي", rating: 4.6, userRatingsTotal: 340, address: "شارع التحلية، جدة" },
        { name: "صالون الحلاقة الذهبي للرجال", rating: 4.4, userRatingsTotal: 180, address: "شارع الأمير سلطان، جدة" },
        { name: "مركز عناية الرجل المتكامل", rating: 4.7, userRatingsTotal: 520, address: "حي النعيم، جدة" },
      ],
      source: "static_fallback",
    };
  }
}

async function googleApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) return `${fallback}: ${parsed.error.message}`;
  } catch {
    /* keep fallback */
  }
  return `${fallback}: ${text.slice(0, 240)}`;
}

function locationResourceId(locationId: string): string {
  return locationId.replace(/^.*locations\//, "");
}

async function resolveGbpV4Parent(slug: string, locationId: string): Promise<string> {
  if (locationId.startsWith("accounts/") && locationId.includes("/locations/")) {
    return locationId;
  }

  const token = await getValidAccessToken(slug);
  const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!accountsRes.ok) throw new Error(await googleApiError(accountsRes, "تعذّر جلب حسابات جوجل"));

  const accountsData = (await accountsRes.json()) as { accounts?: { name: string }[] };
  const locId = locationResourceId(locationId);

  for (const account of accountsData.accounts || []) {
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!locationsRes.ok) continue;
    const locationsData = (await locationsRes.json()) as { locations?: Array<{ name?: string }> };
    for (const loc of locationsData.locations || []) {
      if (!loc.name) continue;
      if (loc.name === locationId || locationResourceId(loc.name) === locId) {
        return `${account.name}/locations/${locId}`;
      }
    }
  }

  throw new Error("تعذّر مطابقة الفرع مع حساب جوجل");
}

export async function syncGbpServices(
  slug: string,
  locationId: string
): Promise<{ count?: number; error?: string }> {
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };

  const { catalog, error } = await fetchTenantCatalog(slug);
  if (error || !catalog) return { error: error || "تعذّر قراءة الخدمات" };

  const services = catalog.services
    .filter((service) => service.enabled && service.available)
    .map((service) => ({
      title: service.overrides.title || service.title,
      description: service.overrides.description || service.description || "",
    }))
    .filter((service) => service.title)
    .slice(0, 30);

  if (!services.length) return { error: "لا توجد خدمات مفعّلة لمزامنتها" };

  try {
    const token = await getValidAccessToken(slug);
    const categoryRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=primaryCategory`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!categoryRes.ok) return { error: await googleApiError(categoryRes, "تعذّر قراءة تصنيف الفرع") };

    const categoryData = (await categoryRes.json()) as { primaryCategory?: { name?: string } };
    const categoryId = categoryData.primaryCategory?.name || "";
    if (!categoryId) return { error: "الفرع على جوجل بلا تصنيف أساسي" };

    const serviceItems = services.map((svc) => {
      const label: { displayName: string; languageCode: string; description?: string } = {
        displayName: svc.title,
        languageCode: "ar",
      };
      if (svc.description) label.description = svc.description.slice(0, 300);
      return { freeFormServiceItem: { category: categoryId, label } };
    });

    const updateRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=serviceItems`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceItems }),
      }
    );
    if (!updateRes.ok) return { error: await googleApiError(updateRes, "تعذّر مزامنة الخدمات") };
    return { count: services.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر مزامنة الخدمات" };
  }
}

export async function publishGbpPost(
  slug: string,
  locationId: string,
  text: string
): Promise<{ error?: string }> {
  const summary = text.trim();
  if (!locationId.trim()) return { error: "اختر فرعاً أولاً" };
  if (!summary) return { error: "لا يوجد نص للنشر" };
  if (summary.length > 1500) return { error: "النص أطول من 1500 حرف" };

  try {
    const token = await getValidAccessToken(slug);
    const parent = await resolveGbpV4Parent(slug, locationId);
    const createRes = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        languageCode: "ar",
        summary,
        topicType: "STANDARD",
        callToAction: {
          actionType: "BOOK",
          url: tenantWebsiteUrl(slug),
        },
      }),
    });
    if (!createRes.ok) return { error: await googleApiError(createRes, "تعذّر نشر المنشور على جوجل") };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذّر نشر المنشور" };
  }
}
