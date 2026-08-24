import { getTenantDb } from "@/lib/mken/tenant";

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
    if (item.staffId !== staffId) return false;
    if (!allowed.size) return true;
    if (!item.activityId) return true;
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
