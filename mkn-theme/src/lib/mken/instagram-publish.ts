import { ALMAHRUSA_PAGES } from "@/lib/mken/almahrusa-content";
import { tenantWebsiteUrl } from "@/lib/mken/custom-domain";
import { normalizeMetaPageId, metaAdsTokenConfigured } from "@/lib/mken/meta-ads";
import {
  canonicalTenantSlug,
  fetchTenantRow,
  getServiceRoleDb,
  getTenantDb,
  writeTenantConfig,
} from "@/lib/mken/tenant";

const GRAPH = "https://graph.facebook.com/v18.0";
const BUCKET = "mken-ig-media";
const MAX_IMAGES = 10;
const MAX_CAPTION = 2200;
const MISSING_TABLE = /does not exist|42P01/i;
const TABLE_HINT = "نفّذ db/instagram-posts-schema.sql في محرر SQL على Supabase ثم أعد المحاولة.";

export const IG_POST_STATUSES = ["PENDING", "PUBLISHING", "PUBLISHED", "FAILED", "CANCELLED"] as const;
export type IgPostStatus = (typeof IG_POST_STATUSES)[number];

export type ScheduledIgPost = {
  id: string;
  tenantSlug: string;
  caption: string;
  imageUrls: string[];
  alsoFacebook: boolean;
  status: IgPostStatus;
  publishAt: string;
  publishedAt: string | null;
  igMediaId: string;
  fbPostId: string;
  errorLog: string;
  createdAt: string;
};

export type IgConnection = {
  tokenReady: boolean;
  pageId: string;
  pageName: string;
  igUserId: string;
  igUsername: string;
  connected: boolean;
  blockers: string[];
};

export type IgGalleryItem = { url: string; label: string };

type IgPostRow = {
  id: string;
  tenant_slug?: string;
  caption?: string;
  image_urls?: unknown;
  also_facebook?: boolean;
  status?: string;
  publish_at?: string;
  published_at?: string | null;
  ig_media_id?: string | null;
  fb_post_id?: string | null;
  error_log?: string | null;
  created_at?: string;
};

function adsToken(): string {
  return process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const typed = err as { message?: string; code?: number; error_subcode?: number };
    if (typed.code === 10 || typed.code === 200 || typed.error_subcode === 33) {
      return `${fallback}: أضف صلاحيات instagram_content_publish و instagram_basic و pages_manage_posts إلى توكن المستخدم النظامي، اربط الصفحة بحساب إنستقرام المهني، ثم أعد توليد التوكن وانشر من Vercel.`;
    }
    if (typed.message) return `${fallback}: ${typed.message}`;
  }
  return fallback;
}

function asStatus(value: string | undefined): IgPostStatus {
  return IG_POST_STATUSES.includes(value as IgPostStatus) ? (value as IgPostStatus) : "PENDING";
}

function asUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^https:\/\//i.test(item))
    .slice(0, MAX_IMAGES);
}

function toPost(row: IgPostRow): ScheduledIgPost {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "",
    caption: row.caption || "",
    imageUrls: asUrls(row.image_urls),
    alsoFacebook: row.also_facebook !== false,
    status: asStatus(row.status),
    publishAt: row.publish_at || "",
    publishedAt: row.published_at || null,
    igMediaId: row.ig_media_id || "",
    fbPostId: row.fb_post_id || "",
    errorLog: row.error_log || "",
    createdAt: row.created_at || "",
  };
}

function dbClient() {
  return getServiceRoleDb() || getTenantDb();
}

function readPageId(config: { adsMeta?: { pageId?: string } } | null | undefined): string {
  return normalizeMetaPageId(config?.adsMeta?.pageId || "");
}

async function ensureBucket(): Promise<string | undefined> {
  const db = dbClient();
  if (!db) return "قاعدة البيانات غير مهيأة على الخادم";
  const { data } = await db.storage.getBucket(BUCKET);
  if (data?.id) {
    if (!data.public) {
      await db.storage.updateBucket(BUCKET, { public: true });
    }
    return undefined;
  }
  const created = await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 8_388_608 });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
    return `تعذّر إنشاء مخزن الصور: ${created.error.message}`;
  }
  return undefined;
}

function parseDataImage(raw: string): { mime: string; bytes: Buffer } | null {
  const match = raw.trim().match(/^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const bytes = Buffer.from(match[3].replace(/\s+/g, ""), "base64");
  if (bytes.length < 80 || bytes.length > 6_000_000) return null;
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  return { mime, bytes };
}

export async function uploadInstagramImage(
  slug: string,
  imageDataUrl: string
): Promise<{ url?: string; error?: string }> {
  const parsed = parseDataImage(imageDataUrl);
  if (!parsed) return { error: "الصورة غير صالحة. صدّر JPEG أقل من 1.5 ميجا قبل الرفع." };
  const bucketError = await ensureBucket();
  if (bucketError) return { error: bucketError };
  const db = dbClient();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const ext = parsed.mime === "image/png" ? "png" : "jpg";
  const path = `${canonicalTenantSlug(slug)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploaded = await db.storage.from(BUCKET).upload(path, parsed.bytes, {
    contentType: parsed.mime === "image/png" ? "image/png" : "image/jpeg",
    upsert: false,
  });
  if (uploaded.error) return { error: uploaded.error.message };
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: "تعذّر الحصول على رابط عام للصورة" };
  return { url: data.publicUrl };
}

async function cacheIgAccount(slug: string, igUserId: string, igUsername: string): Promise<void> {
  const row = await fetchTenantRow(slug);
  if (!row) return;
  const prev = row.config_data?.adsMeta || {};
  if (prev.igUserId === igUserId && prev.igUsername === igUsername) return;
  await writeTenantConfig(slug, {
    ...(row.config_data || {}),
    adsMeta: { ...prev, igUserId, igUsername },
  });
}

export async function instagramGallery(slug: string): Promise<IgGalleryItem[]> {
  const key = canonicalTenantSlug(slug);
  if (key !== "almahrusa") return [];
  const origin = (await tenantWebsiteUrl(key)).replace(/\/$/, "");
  return ALMAHRUSA_PAGES.work.gallery.map((item) => ({
    url: item.image.startsWith("http") ? item.image : `${origin}${item.image}`,
    label: item.caption,
  }));
}

export async function fetchIgConnection(slug: string): Promise<IgConnection> {
  const tokenReady = metaAdsTokenConfigured();
  const row = await fetchTenantRow(slug);
  const pageId = readPageId(row?.config_data);
  const cachedId = typeof row?.config_data?.adsMeta?.igUserId === "string" ? row.config_data.adsMeta.igUserId : "";
  const cachedName =
    typeof row?.config_data?.adsMeta?.igUsername === "string" ? row.config_data.adsMeta.igUsername : "";
  const blockers: string[] = [];
  if (!tokenReady) {
    blockers.push("أضف META_ADS_ACCESS_TOKEN بصلاحيات إنستقرام ثم أعد النشر على Vercel.");
  }
  if (pageId.length < 5) {
    blockers.push("أضف معرّف صفحة فيسبوك للمنشأة من لوحة الحملات. لا تستخدم صفحة mken.live.");
  }

  if (!tokenReady || pageId.length < 5) {
    return {
      tokenReady,
      pageId,
      pageName: "",
      igUserId: cachedId,
      igUsername: cachedName,
      connected: false,
      blockers,
    };
  }

  const { ok, body } = await graphJson(`${pageId}?fields=name,instagram_business_account{id,username}`, {
    headers: { Authorization: `Bearer ${adsToken()}` },
  });
  if (!ok) {
    blockers.push(graphError(body, "تعذّر قراءة الصفحة"));
    return {
      tokenReady,
      pageId,
      pageName: "",
      igUserId: cachedId,
      igUsername: cachedName,
      connected: false,
      blockers,
    };
  }

  const pageName = typeof body.name === "string" ? body.name : "";
  const ig = body.instagram_business_account;
  const igUserId =
    ig && typeof ig === "object" && typeof (ig as { id?: string }).id === "string"
      ? (ig as { id: string }).id
      : "";
  const igUsername =
    ig && typeof ig === "object" && typeof (ig as { username?: string }).username === "string"
      ? (ig as { username: string }).username
      : "";

  if (!igUserId) {
    blockers.push("اربط حساب إنستقرام المهني (Business) بهذه الصفحة من إعدادات فيسبوك، ثم حدّث الربط هنا.");
  } else {
    await cacheIgAccount(slug, igUserId, igUsername);
  }

  return {
    tokenReady,
    pageId,
    pageName,
    igUserId,
    igUsername,
    connected: Boolean(igUserId),
    blockers,
  };
}

export async function listScheduledIgPosts(
  slug: string
): Promise<{ posts?: ScheduledIgPost[]; error?: string }> {
  const db = dbClient();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db
    .from("mken_instagram_scheduled_posts")
    .select("*")
    .eq("tenant_slug", canonicalTenantSlug(slug))
    .order("publish_at", { ascending: false })
    .limit(40);
  if (error) {
    if (MISSING_TABLE.test(error.message)) return { posts: [] };
    return { error: error.message };
  }
  return { posts: ((data || []) as IgPostRow[]).map(toPost) };
}

async function waitForContainer(creationId: string, token: string): Promise<{ error?: string }> {
  for (let i = 0; i < 12; i += 1) {
    const { ok, body } = await graphJson(`${creationId}?fields=status_code`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const code = typeof body.status_code === "string" ? body.status_code : "";
    if (!ok) return { error: graphError(body, "تعذّر التحقق من حاوية إنستقرام") };
    if (code === "FINISHED") return {};
    if (code === "ERROR" || code === "EXPIRED") {
      return { error: "رفض إنستقرام الصورة. استخدم JPEG بنسبة بين 4:5 و 1.91:1 ورابطاً عاماً." };
    }
    await sleep(2000);
  }
  return { error: "انتهت مهلة تجهيز صورة إنستقرام. أعد المحاولة بعد دقيقة." };
}

async function createIgContainer(
  igUserId: string,
  token: string,
  fields: Record<string, string>
): Promise<{ id?: string; error?: string }> {
  const params = new URLSearchParams({ ...fields, access_token: token });
  const { ok, body } = await graphJson(`${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!ok || typeof body.id !== "string") {
    return { error: graphError(body, "تعذّر إنشاء منشور إنستقرام") };
  }
  return { id: body.id };
}

async function publishInstagramFeed(
  igUserId: string,
  caption: string,
  imageUrls: string[],
  token: string
): Promise<{ mediaId?: string; error?: string }> {
  let creationId = "";
  if (imageUrls.length === 1) {
    const created = await createIgContainer(igUserId, token, {
      image_url: imageUrls[0],
      caption,
    });
    if (created.error || !created.id) return { error: created.error };
    creationId = created.id;
  } else {
    const children: string[] = [];
    for (const url of imageUrls) {
      const child = await createIgContainer(igUserId, token, {
        image_url: url,
        is_carousel_item: "true",
      });
      if (child.error || !child.id) return { error: child.error };
      const ready = await waitForContainer(child.id, token);
      if (ready.error) return { error: ready.error };
      children.push(child.id);
    }
    const parent = await createIgContainer(igUserId, token, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    });
    if (parent.error || !parent.id) return { error: parent.error };
    creationId = parent.id;
  }

  const ready = await waitForContainer(creationId, token);
  if (ready.error) return { error: ready.error };

  const { ok, body } = await graphJson(`${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  if (!ok || typeof body.id !== "string") {
    return { error: graphError(body, "تعذّر نشر إنستقرام") };
  }
  return { mediaId: body.id };
}

async function publishFacebookPhoto(
  pageId: string,
  caption: string,
  imageUrl: string,
  token: string
): Promise<{ postId?: string; error?: string }> {
  const { ok, body } = await graphJson(`${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      url: imageUrl,
      caption,
      published: "true",
      access_token: token,
    }),
  });
  if (!ok) return { error: graphError(body, "تعذّر النشر على فيسبوك") };
  const postId = typeof body.post_id === "string" ? body.post_id : typeof body.id === "string" ? body.id : "";
  return { postId };
}

export async function scheduleIgPost(input: {
  slug: string;
  caption: string;
  imageUrls: string[];
  publishAt: string;
  alsoFacebook?: boolean;
}): Promise<{ post?: ScheduledIgPost; publishedNow?: boolean; error?: string }> {
  const db = dbClient();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const caption = input.caption.trim().slice(0, MAX_CAPTION);
  const imageUrls = asUrls(input.imageUrls);
  if (!imageUrls.length) return { error: "أضف صورة واحدة على الأقل برابط عام أو عبر الرفع" };
  const at = new Date(input.publishAt);
  if (!Number.isFinite(at.getTime())) return { error: "موعد النشر غير صالح" };

  const connection = await fetchIgConnection(input.slug);
  if (!connection.connected) {
    return { error: connection.blockers[0] || "إنستقرام غير مربوط بهذه المنشأة" };
  }

  const { data, error } = await db
    .from("mken_instagram_scheduled_posts")
    .insert({
      tenant_slug: canonicalTenantSlug(input.slug),
      caption,
      image_urls: imageUrls,
      also_facebook: input.alsoFacebook !== false,
      status: "PENDING",
      publish_at: at.toISOString(),
    })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING_TABLE.test(error.message)) return { error: TABLE_HINT };
    return { error: error?.message || "تعذّر جدولة المنشور" };
  }

  const post = toPost(data as IgPostRow);
  if (at.getTime() <= Date.now() + 15_000) {
    const published = await publishOneScheduledPost(post);
    return { post: published.post || post, publishedNow: !published.error, error: published.error };
  }
  return { post };
}

export async function cancelIgPost(
  slug: string,
  id: string
): Promise<{ post?: ScheduledIgPost; error?: string }> {
  const db = dbClient();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const { data, error } = await db
    .from("mken_instagram_scheduled_posts")
    .update({ status: "CANCELLED", error_log: "أُلغي من الإدارة" })
    .eq("id", id)
    .eq("tenant_slug", canonicalTenantSlug(slug))
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "لا يمكن إلغاء منشور نُشر أو بدأ نشره" };
  return { post: toPost(data as IgPostRow) };
}

async function claimDuePost(id: string): Promise<boolean> {
  const db = dbClient();
  if (!db) return false;
  const { data } = await db
    .from("mken_instagram_scheduled_posts")
    .update({ status: "PUBLISHING" })
    .eq("id", id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  return Boolean(data?.id);
}

async function publishOneScheduledPost(
  post: ScheduledIgPost
): Promise<{ post?: ScheduledIgPost; error?: string }> {
  const db = dbClient();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };
  const claimed = post.status === "PUBLISHING" || (await claimDuePost(post.id));
  if (!claimed && post.status !== "PUBLISHING") {
    const { data } = await db.from("mken_instagram_scheduled_posts").select("*").eq("id", post.id).maybeSingle();
    return { post: data ? toPost(data as IgPostRow) : post };
  }

  const connection = await fetchIgConnection(post.tenantSlug);
  const now = new Date().toISOString();
  if (!connection.connected || !connection.igUserId) {
    const message = connection.blockers[0] || "إنستقرام غير مربوط";
    await db
      .from("mken_instagram_scheduled_posts")
      .update({ status: "FAILED", error_log: message, published_at: now })
      .eq("id", post.id);
    return { error: message };
  }

  const ig = await publishInstagramFeed(connection.igUserId, post.caption, post.imageUrls, adsToken());
  if (ig.error || !ig.mediaId) {
    await db
      .from("mken_instagram_scheduled_posts")
      .update({ status: "FAILED", error_log: ig.error || "فشل النشر", published_at: now })
      .eq("id", post.id);
    return { error: ig.error };
  }

  let fbPostId = "";
  let warning = "";
  if (post.alsoFacebook && connection.pageId) {
    const fb = await publishFacebookPhoto(connection.pageId, post.caption, post.imageUrls[0], adsToken());
    if (fb.error) warning = `إنستقرام نُشر. فيسبوك: ${fb.error}`;
    else fbPostId = fb.postId || "";
  }

  const { data } = await db
    .from("mken_instagram_scheduled_posts")
    .update({
      status: "PUBLISHED",
      published_at: now,
      ig_media_id: ig.mediaId,
      fb_post_id: fbPostId || null,
      error_log: warning || null,
    })
    .eq("id", post.id)
    .select("*")
    .maybeSingle();
  return { post: data ? toPost(data as IgPostRow) : post, error: warning || undefined };
}

export async function publishDueIgPosts(): Promise<{ published: number; failed: number }> {
  const db = dbClient();
  if (!db) return { published: 0, failed: 0 };

  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  await db
    .from("mken_instagram_scheduled_posts")
    .update({ status: "PENDING" })
    .eq("status", "PUBLISHING")
    .lte("publish_at", stale);

  const { data, error } = await db
    .from("mken_instagram_scheduled_posts")
    .select("*")
    .eq("status", "PENDING")
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: true })
    .limit(8);
  if (error || !data?.length) return { published: 0, failed: 0 };

  let published = 0;
  let failed = 0;
  for (const row of data as IgPostRow[]) {
    const result = await publishOneScheduledPost(toPost(row));
    if (result.error && result.post?.status === "FAILED") failed += 1;
    else if (result.post?.status === "PUBLISHED" || (!result.error && result.post)) published += 1;
    else if (result.error) failed += 1;
    else published += 1;
  }
  return { published, failed };
}
