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
};

export function newBookingId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `apt_${Date.now().toString(36)}_${rand}`;
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
