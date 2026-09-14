import {
  fetchGbpStatus,
  getValidAccessToken,
  googleApiError,
  isGbpQuotaError,
  resolveGbpV4Parent,
} from "@/lib/mken/gbp";

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewerName: string;
  starRating: number;
  comment: string;
  createTime: string;
  reply: string;
  replyTime: string;
}

const GBP_REPLY_MAX_CHARS = 4096;
const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function starRatingToNumber(value: unknown): number {
  if (typeof value === "number" && value >= 1 && value <= 5) return value;
  const key = String(value || "").trim().toUpperCase();
  if (STAR_RATING_MAP[key]) return STAR_RATING_MAP[key];
  const parsed = Number(key);
  return parsed >= 1 && parsed <= 5 ? parsed : 0;
}

function mapGbpReview(raw: {
  name?: string;
  reviewId?: string;
  reviewer?: { displayName?: string };
  starRating?: string | number;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}): GbpReview | null {
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    name,
    reviewId: String(raw.reviewId || name.split("/reviews/").pop() || ""),
    reviewerName: String(raw.reviewer?.displayName || "عميل").trim() || "عميل",
    starRating: starRatingToNumber(raw.starRating),
    comment: String(raw.comment || "").trim(),
    createTime: String(raw.createTime || ""),
    reply: String(raw.reviewReply?.comment || "").trim(),
    replyTime: String(raw.reviewReply?.updateTime || ""),
  };
}

function reviewResourceName(parent: string, reviewName: string): string {
  const value = reviewName.replace(/^\/+/, "").trim();
  if (value.includes("/reviews/")) return value;
  return `${parent}/reviews/${value}`;
}

export async function listGbpReviews(
  slug: string,
  locationId: string
): Promise<{
  reviews?: GbpReview[];
  total?: number;
  averageRating?: number;
  quotaBlocked?: boolean;
  error?: string;
}> {
  const selected = locationId.trim() || (await fetchGbpStatus(slug)).status?.selectedLocationId || "";
  if (!selected) {
    return { reviews: [], error: "اختر فرعاً أولاً لنشر الرد على خرائط جوجل." };
  }

  try {
    const token = await getValidAccessToken(slug);
    const parent = await resolveGbpV4Parent(slug, selected);
    const listRes = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=25`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      const message = await googleApiError(listRes, "تعذّر جلب تقييمات جوجل");
      return { reviews: [], error: message, quotaBlocked: isGbpQuotaError(message) };
    }
    const body = (await listRes.json()) as {
      reviews?: Array<Parameters<typeof mapGbpReview>[0]>;
      totalReviewCount?: number;
      averageRating?: number;
    };
    const reviews = (body.reviews || []).map(mapGbpReview).filter((row): row is GbpReview => Boolean(row));
    return {
      reviews,
      total: Number(body.totalReviewCount) || reviews.length,
      averageRating: Number(body.averageRating) || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر جلب تقييمات جوجل";
    return { reviews: [], error: message, quotaBlocked: isGbpQuotaError(message) };
  }
}

export async function publishGbpReviewReply(
  slug: string,
  locationId: string,
  reviewName: string,
  comment: string
): Promise<{ reply?: string; error?: string; quotaBlocked?: boolean }> {
  const selected = locationId.trim();
  const name = reviewName.trim();
  const reply = comment.trim();
  if (!selected) return { error: "اختر فرعاً أولاً" };
  if (!name) return { error: "اختر تقييماً من خرائط جوجل" };
  if (!reply) return { error: "اكتب الرد قبل النشر" };
  if (reply.length > GBP_REPLY_MAX_CHARS) return { error: `الرد أطول من ${GBP_REPLY_MAX_CHARS} حرف` };

  try {
    const token = await getValidAccessToken(slug);
    const parent = await resolveGbpV4Parent(slug, selected);
    const resource = reviewResourceName(parent, name);
    const updateRes = await fetch(`https://mybusiness.googleapis.com/v4/${resource}/reply`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: reply }),
    });
    if (!updateRes.ok) {
      const message = await googleApiError(updateRes, "تعذّر نشر الرد على جوجل");
      if (isGbpQuotaError(message)) {
        return {
          error: `${message} انسخ الرد والصقه في تطبيق بيزنس. التوليد لا ينشر التقييم.`,
          quotaBlocked: true,
        };
      }
      return { error: message };
    }
    const body = (await updateRes.json()) as { comment?: string };
    return { reply: String(body.comment || reply) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذّر نشر الرد";
    return { error: message, quotaBlocked: isGbpQuotaError(message) };
  }
}
