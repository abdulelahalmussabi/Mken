import { getServiceRoleDb, fetchTenantRow } from "@/lib/mken/tenant";

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function listOpenSlots({
  tenantSlug,
  date,
  serviceId,
  slotDurationMinutes = 30,
  hoursStart = '09:00',
  hoursEnd = '21:00'
}: {
  tenantSlug: string;
  date: string;
  serviceId?: string;
  slotDurationMinutes?: number;
  hoursStart?: string;
  hoursEnd?: string;
}): Promise<string[]> {
  const db = getServiceRoleDb();
  if (!db) return [];

  // Read config from tenant if available
  const tenant = await fetchTenantRow(tenantSlug);
  let finalStart = hoursStart;
  let finalEnd = hoursEnd;
  let finalDuration = slotDurationMinutes;

  if (tenant?.config_data?.booking) {
    const booking = tenant.config_data.booking;
    if (booking.workingHours?.start) finalStart = booking.workingHours.start;
    if (booking.workingHours?.end) finalEnd = booking.workingHours.end;
    if (typeof booking.slotDurationMinutes === 'number') {
      finalDuration = booking.slotDurationMinutes;
    }
  }

  // Fetch all pending/confirmed appointments for this date
  const { data, error } = await db
    .from("mken_appointments")
    .select("time")
    .eq("tenant_slug", tenantSlug)
    .eq("date", date)
    .in("status", ["pending", "confirmed"]);

  if (error) return [];

  // The 'time' in DB might be 'HH:MM:SS' or 'HH:MM', so slice(0,5) normalizes to 'HH:MM'
  const bookedTimes = new Set((data || []).map(row => row.time?.slice(0, 5)));

  const startMin = parseTime(finalStart);
  const endMin = parseTime(finalEnd);
  
  const slots: string[] = [];
  for (let m = startMin; m + finalDuration <= endMin; m += finalDuration) {
    const timeStr = formatTime(m);
    if (!bookedTimes.has(timeStr)) {
      slots.push(timeStr);
    }
  }

  return slots;
}

export async function isSlotFree({
  tenantSlug,
  date,
  time,
  excludeId
}: {
  tenantSlug: string;
  date: string;
  time: string;
  excludeId?: string;
}): Promise<boolean> {
  const db = getServiceRoleDb();
  if (!db) return false;

  // Ensure time is compared in same format, usually "HH:MM"
  const normalizedTime = time.slice(0, 5);

  let query = db
    .from("mken_appointments")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("date", date)
    .like("time", `${normalizedTime}%`) // matches "HH:MM:SS" or "HH:MM"
    .in("status", ["pending", "confirmed"]);
    
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) return false;

  return data.length === 0;
}
