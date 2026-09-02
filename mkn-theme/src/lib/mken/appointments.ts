import { getServiceRoleDb, getTenantDb } from "@/lib/mken/tenant";

/**
 * Appointments live in `mken_appointments`, keyed by `tenant_slug`, and are
 * shared with the legacy admin panel — column names and the status vocabulary
 * (pending | confirmed | cancelled) must stay identical.
 */

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Appointment {
  id: string;
  tenantSlug: string;
  activityId: string | null;
  serviceId: string | null;
  date: string;
  time: string;
  customerName: string;
  phone: string;
  district: string;
  locationAddress: string;
  notes: string;
  staffId: string | null;
  partySize: number | null;
  nights: number | null;
  stayUnit: string;
  stayBooking: boolean;
  checkOutTime: string;
  status: AppointmentStatus;
  createdAt: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentAmount: number | null;
}

interface AppointmentRow {
  id: string;
  tenant_slug?: string | null;
  activity_id?: string | null;
  service_id?: string | null;
  date?: string | null;
  time?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  district?: string | null;
  location_address?: string | null;
  notes?: string | null;
  staff_id?: string | null;
  party_size?: number | null;
  nights?: number | null;
  stay_unit?: string | null;
  stay_booking?: boolean | null;
  check_out_time?: string | null;
  status?: string | null;
  created_at?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_amount?: number | string | null;
}

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    activityId: row.activity_id || null,
    serviceId: row.service_id || null,
    date: row.date || "",
    time: row.time || "",
    customerName: row.customer_name || "",
    phone: row.phone || "",
    district: row.district || "",
    locationAddress: row.location_address || "",
    notes: row.notes || "",
    staffId: row.staff_id || null,
    partySize: row.party_size ?? null,
    nights: row.nights ?? null,
    stayUnit: row.stay_unit || "",
    stayBooking: row.stay_booking === true,
    checkOutTime: row.check_out_time || "",
    status: (APPOINTMENT_STATUSES as readonly string[]).includes(row.status || "")
      ? (row.status as AppointmentStatus)
      : "pending",
    createdAt: row.created_at || null,
    paymentStatus: (PAYMENT_STATUSES as readonly string[]).includes(row.payment_status || "")
      ? (row.payment_status as PaymentStatus)
      : "unpaid",
    paymentMethod: row.payment_method || null,
    paymentAmount: row.payment_amount != null ? Number(row.payment_amount) : null,
  };
}

export async function fetchAppointments(
  tenantSlug: string
): Promise<{ appointments?: Appointment[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_appointments")
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) return { error: error.message };
  return { appointments: (data as AppointmentRow[]).map(toAppointment) };
}

export async function fetchAppointmentsForStaff(
  tenantSlug: string,
  staffId: string,
  activities: string[]
): Promise<{ appointments?: Appointment[]; error?: string }> {
  const { appointments, error } = await fetchAppointments(tenantSlug);
  if (error || !appointments) return { error };

  const allowed = new Set(activities);
  const scoped = appointments.filter((item) => {
    const assignedToMe = item.staffId === staffId;
    const unassignedWeb = !item.staffId;
    if (!assignedToMe && !unassignedWeb) return false;
    if (unassignedWeb) return true;
    if (!allowed.size) return true;
    if (!item.activityId || item.activityId === "storefront") return true;
    return allowed.has(item.activityId);
  });

  return { appointments: scoped };
}

export async function updateAppointment(
  tenantSlug: string,
  id: string,
  updates: { status?: AppointmentStatus; notes?: string; paymentStatus?: PaymentStatus }
): Promise<{ appointment?: Appointment; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) patch.status = updates.status;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.paymentStatus) patch.payment_status = updates.paymentStatus;

  // tenant_slug is part of the filter so one tenant can never touch another's rows.
  const { data, error } = await db
    .from("mken_appointments")
    .update(patch)
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("*");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "الموعد غير موجود" };
  return { appointment: toAppointment(data[0] as AppointmentRow) };
}

export type PublicBookingInput = {
  id?: string;
  tenantSlug: string;
  customerName: string;
  phone: string;
  date: string;
  time: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: string;
  notes?: string;
  coupon?: string;
};

const APT_ID_RE = /^apt_[a-z0-9]+_[a-z0-9]+$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function newAppointmentId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `apt_${Date.now().toString(36)}_${rand}`;
}

function addDaysIso(delta: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + delta);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function plusYearsIso(years: number): string {
  const now = new Date();
  now.setUTCFullYear(now.getUTCFullYear() + years);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Public storefront/book-page insert. Status is always pending; client cannot set payment/staff. */
export async function createPublicAppointment(
  input: PublicBookingInput
): Promise<{ appointment?: Appointment; error?: string }> {
  const db = getServiceRoleDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const tenantSlug = clip(input.tenantSlug, 80).toLowerCase();
  const customerName = clip(input.customerName, 80);
  const phone = clip(input.phone, 24);
  const phoneDigits = phone.replace(/\D/g, "");
  const date = clip(input.date, 10);
  const time = clip(input.time, 5);
  const serviceId = clip(input.serviceId || "general", 80) || "general";
  const serviceName = clip(input.serviceName || "", 120);
  const servicePrice = clip(input.servicePrice || "", 40);
  const notes = clip(input.notes || "", 500);
  const coupon = clip(input.coupon || "", 40);

  if (!tenantSlug) return { error: "المنشأة غير محددة" };
  if (customerName.length < 2) return { error: "الاسم غير صالح" };
  if (phoneDigits.length < 8 || phoneDigits.length > 15) return { error: "رقم الجوال غير صالح" };
  if (!DATE_RE.test(date)) return { error: "تاريخ الحجز غير صالح" };
  if (!TIME_RE.test(time)) return { error: "وقت الحجز غير صالح" };

  const minDate = addDaysIso(-1);
  const maxDate = plusYearsIso(1);
  if (date < minDate) return { error: "لا يمكن الحجز في تاريخ سابق" };
  if (date > maxDate) return { error: "تاريخ الحجز بعيد جداً" };

  const id = input.id && APT_ID_RE.test(input.id) ? input.id : newAppointmentId();
  const noteParts = [
    serviceName ? `الخدمة: ${serviceName}` : "",
    servicePrice ? `السعر: ${servicePrice}` : "",
    coupon ? `كود الخصم: ${coupon}` : "",
    notes,
  ].filter(Boolean);

  const row = {
    id,
    tenant_slug: tenantSlug,
    activity_id: "storefront",
    service_id: serviceId,
    date,
    time,
    customer_name: customerName,
    phone,
    notes: noteParts.join(" | ") || null,
    status: "pending",
    payment_status: "unpaid",
    stay_booking: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existing = await db
    .from("mken_appointments")
    .select("*")
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();
  if (existing.data) return { appointment: toAppointment(existing.data as AppointmentRow) };

  const { data, error } = await db.from("mken_appointments").insert(row).select("*").single();
  if (error) return { error: error.message };
  return { appointment: toAppointment(data as AppointmentRow) };
}
