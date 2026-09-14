/** Client-side public booking POST. Safe to import from storefront components. */

export type PublicBookingPayload = {
  id?: string;
  tenant: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: string;
  notes?: string;
  coupon?: string;
  ctwa_clid?: string;
};

export function newBookingId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `apt_${Date.now().toString(36)}_${rand}`;
}

export function persistCtwaClid(raw?: string | null): string {
  if (typeof window === "undefined") return "";
  const fromQuery = (raw || "").trim() || new URLSearchParams(window.location.search).get("ctwa_clid") || "";
  if (fromQuery) {
    document.cookie = `ctwa_clid=${encodeURIComponent(fromQuery)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    try {
      window.localStorage.setItem("mken_ctwa_clid", fromQuery);
    } catch {
      /* ignore */
    }
    return fromQuery;
  }
  const match = document.cookie.match(/(?:^|; )ctwa_clid=([^;]*)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  try {
    return window.localStorage.getItem("mken_ctwa_clid") || "";
  } catch {
    return "";
  }
}

export async function submitPublicBooking(
  payload: PublicBookingPayload
): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; id?: string; message?: string }
      | null;
    if (!res.ok || !data?.success) {
      return { error: data?.message || "تعذّر حفظ الحجز" };
    }
    return { id: data.id };
  } catch {
    return { error: "تعذّر الاتصال لحفظ الحجز" };
  }
}
