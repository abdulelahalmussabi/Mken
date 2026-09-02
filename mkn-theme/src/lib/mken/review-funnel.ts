import { getTenantDb, fetchTenantRow } from "@/lib/mken/tenant";
import { sendOutboundWhatsapp, normalizeWaPhone } from "@/lib/mken/whatsapp";

const DELAY_MS = 30 * 60 * 1000;
const MAX_PER_RUN = 20;

export type ReviewRequestStatus =
  | "PENDING"
  | "SENT"
  | "RATED_GOOGLE"
  | "RATED_INTERNAL"
  | "FAILED"
  | "SKIPPED";

interface AppointmentRow {
  id: string;
  tenant_slug?: string | null;
  date?: string | null;
  time?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  status?: string | null;
  payment_status?: string | null;
}

function parseAppointmentEnd(dateText: string, timeText: string): number | null {
  const date = (dateText || "").trim();
  const time = (timeText || "").trim() || "12:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const iso = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function googleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function surveyBody(businessName: string): string {
  return `كيف كانت تجربتك معنا اليوم في ${businessName}؟\nأرسل رقم من 1 إلى 5 (5 = ممتاز).`;
}

function thanksGoogleBody(name: string, url: string): string {
  return `شكراً لك${name ? ` ${name}` : ""}. يسعدنا تقييمك على خرائط جوجل من هنا:\n${url}`;
}

function internalFollowupBody(): string {
  return "نأسف إن التجربة ما كانت على المطلوب. اكتب ملاحظتك هنا وسنعالجها مع المدير فوراً — بدون نشر على الخرائط.";
}

async function placeIdForTenant(slug: string): Promise<string> {
  const row = await fetchTenantRow(slug);
  const fromPreview = row?.config_data?.preview?.placeId?.trim() || "";
  if (fromPreview) return fromPreview;

  const db = getTenantDb();
  if (!db) return "";
  const { data } = await db
    .from("mken_saas_clients")
    .select("google_place_id")
    .eq("tenant_slug", slug)
    .maybeSingle();
  return typeof data?.google_place_id === "string" ? data.google_place_id.trim() : "";
}

export function parseStarRating(text: string): number | null {
  const trimmed = (text || "").trim();
  const digit = trimmed.match(/^([1-5])(?:\s*(?:نجوم|نجمة|star|stars))?$/i);
  if (digit) return Number(digit[1]);
  if (/ممتاز|رائع|خمس/.test(trimmed)) return 5;
  if (/جيد جدا|أربع/.test(trimmed)) return 4;
  if (/متوسط|ثلاث/.test(trimmed)) return 3;
  if (/سيء|سيئ|نجمتين/.test(trimmed)) return 2;
  if (/فظيع|نجمة واحدة|أسوأ/.test(trimmed)) return 1;
  return null;
}

export async function dispatchDueReviewRequests(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { sent: 0, skipped: 0, failed: 0, error: "قاعدة البيانات غير مهيأة" };

  const { data, error } = await db
    .from("mken_appointments")
    .select("id, tenant_slug, date, time, customer_name, phone, status, payment_status")
    .eq("status", "confirmed")
    .order("date", { ascending: false })
    .limit(80);

  if (error) {
    if (/does not exist|42P01/i.test(error.message)) {
      return { sent: 0, skipped: 0, failed: 0 };
    }
    return { sent: 0, skipped: 0, failed: 0, error: error.message };
  }

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (data || []) as AppointmentRow[]) {
    if (sent + failed >= MAX_PER_RUN) break;
    const slug = (row.tenant_slug || "").trim();
    const phone = normalizeWaPhone(row.phone || "");
    if (!slug || !phone) {
      skipped += 1;
      continue;
    }
    const end = parseAppointmentEnd(row.date || "", row.time || "");
    if (!end || now < end + DELAY_MS) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await db
      .from("mken_review_requests")
      .select("id, status")
      .eq("tenant_slug", slug)
      .eq("appointment_id", row.id)
      .maybeSingle();
    if (existing && existing.status !== "FAILED" && existing.status !== "PENDING") {
      skipped += 1;
      continue;
    }

    const tenant = await fetchTenantRow(slug);
    const brand = tenant?.config_data?.brand?.name || tenant?.business_name || slug;
    const placeId = await placeIdForTenant(slug);
    const reviewUrl = placeId ? googleReviewUrl(placeId) : "";

    let requestId = existing?.id as string | undefined;
    if (!requestId) {
      const { error: insertError, data: inserted } = await db
        .from("mken_review_requests")
        .insert({
          tenant_slug: slug,
          appointment_id: row.id,
          phone,
          customer_name: row.customer_name || "",
          status: "PENDING",
          google_review_url: reviewUrl || null,
        })
        .select("id")
        .maybeSingle();

      if (insertError || !inserted) {
        failed += 1;
        continue;
      }
      requestId = inserted.id;
    }

    const send = await sendOutboundWhatsapp(slug, phone, surveyBody(brand), "review_request");
    if (send.error) {
      await db.from("mken_review_requests").update({ status: "FAILED" }).eq("id", requestId);
      failed += 1;
      continue;
    }

    await db
      .from("mken_review_requests")
      .update({ status: "SENT", sent_at: new Date().toISOString(), google_review_url: reviewUrl || null })
      .eq("id", requestId);
    sent += 1;
  }

  return { sent, skipped, failed };
}

export async function handleReviewRatingReply(
  slug: string,
  phoneRaw: string,
  text: string
): Promise<{ handled: boolean; reply?: string }> {
  const db = getTenantDb();
  if (!db) return { handled: false };
  const phone = normalizeWaPhone(phoneRaw);
  const stars = parseStarRating(text);
  if (!phone || !stars) return { handled: false };

  const { data } = await db
    .from("mken_review_requests")
    .select("id, customer_name, google_review_url")
    .eq("tenant_slug", slug)
    .eq("phone", phone)
    .eq("status", "SENT")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return { handled: false };

  if (stars >= 4) {
    const url = data.google_review_url || "";
    await db
      .from("mken_review_requests")
      .update({
        stars,
        status: url ? "RATED_GOOGLE" : "RATED_INTERNAL",
        rated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return {
      handled: true,
      reply: url
        ? thanksGoogleBody(data.customer_name || "", url)
        : `شكراً لتقييمك ${stars} نجوم. نقدّر ثقتك.`,
    };
  }

  await db
    .from("mken_review_requests")
    .update({
      stars,
      status: "RATED_INTERNAL",
      rated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  return { handled: true, reply: internalFollowupBody() };
}
