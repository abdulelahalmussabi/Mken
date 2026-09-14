/** Riyadh calendar day as YYYY-MM-DD. Empty dates mean the ad has no schedule. */
export function riyadhTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now);
}

export function isAdLive(
  ad: { enabled: boolean; startDate?: string; endDate?: string },
  now = new Date()
): boolean {
  if (!ad.enabled) return false;
  const today = riyadhTodayYmd(now);
  const start = typeof ad.startDate === "string" ? ad.startDate.trim() : "";
  const end = typeof ad.endDate === "string" ? ad.endDate.trim() : "";
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

export function liveAds<T extends { enabled: boolean; startDate?: string; endDate?: string }>(
  ads: T[],
  now = new Date()
): T[] {
  return ads.filter((ad) => isAdLive(ad, now));
}
