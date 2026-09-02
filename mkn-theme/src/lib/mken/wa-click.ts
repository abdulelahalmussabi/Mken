/**
 * Click-to-chat helpers for the visitor's own WhatsApp app.
 * `wa.me/{business}?text=` prefills the composer; the visitor taps Send.
 * Keep this module client-safe (no tenant DB / server imports).
 */

export type BookingWhatsappFields = {
  businessName: string;
  customerName?: string;
  customerPhone?: string;
  serviceName?: string;
  servicePrice?: string;
  date?: string;
  time?: string;
  notes?: string;
  coupon?: string;
  appointmentId?: string;
};

export function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function normalizeClickPhone(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

function line(label: string, value: string | undefined): string {
  const text = (value || "").trim();
  return text ? `• ${label}: ${text}` : "";
}

export function buildBookingWhatsappText(fields: BookingWhatsappFields): string {
  const rows = [
    `السلام عليكم، أود تأكيد موعد في *${fields.businessName.trim() || "المنشأة"}*:`,
    line("الاسم", fields.customerName),
    line("الجوال", fields.customerPhone),
    line("الخدمة", fields.serviceName),
    line("السعر", fields.servicePrice),
    line("التاريخ", fields.date),
    line("الوقت", fields.time),
    line("الملاحظات", fields.notes),
    line("كود الخصم", fields.coupon),
    line("رقم الحجز", fields.appointmentId),
  ].filter(Boolean);
  return rows.join("\n");
}

export function buildInquiryWhatsappText(businessName: string, extra?: string): string {
  const name = businessName.trim() || "المنشأة";
  const note = (extra || "").trim();
  return note
    ? `السلام عليكم، أود الاستفسار عن *${name}*\n${note}`
    : `السلام عليكم، أود الاستفسار عن *${name}*`;
}

export function buildContactWhatsappText(fields: {
  businessName: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
}): string {
  const rows = [
    `طلب تواصل مع *${fields.businessName.trim() || "المنشأة"}*:`,
    line("الاسم", fields.name),
    line("الجوال", fields.phone),
    line("البريد", fields.email),
    line("الرسالة", fields.message),
  ].filter(Boolean);
  return rows.join("\n");
}

export function buildWhatsappClickUrl(businessPhone: string, text: string): string {
  const phone = normalizeClickPhone(businessPhone);
  if (!phone) return "";
  const body = (text || "").trim();
  if (!body) return `https://wa.me/${phone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

/** Open click-to-chat from a user gesture. Avoids setTimeout so iOS/Safari keep the prefilled text. */
export function openWhatsappClick(href: string): boolean {
  if (!href) return false;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobile) {
    window.location.assign(href);
    return true;
  }
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(href);
  return true;
}
