import { createHash } from "crypto";
import { getTenantDb } from "@/lib/mken/tenant";

/**
 * Staff in `mken_staff`, with an optional many-to-many link table
 * `mken_staff_activities`. `pin_code` holds a SHA-256 hash used by the staff
 * portal login, so it is never selected or returned — the legacy panel masks it
 * the same way.
 */

export const STAFF_ROLES = ["technician", "coordinator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ["active", "inactive"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const AVAILABILITY = ["online", "busy", "offline"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  technician: "فني / منفّذ خدمة",
  coordinator: "منسّق مواعيد / مشرف",
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  online: "متصل",
  busy: "مشغول",
  offline: "غير متصل",
};

export interface StaffMember {
  id: string;
  tenantSlug: string;
  name: string;
  phone: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  availability: Availability;
  currentChatLoad: number;
  hasPin: boolean;
  activities: string[];
  createdAt: string | null;
}

interface StaffRow {
  id: string;
  tenant_slug?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  availability?: string | null;
  current_chat_load?: number | null;
  pin_code?: string | null;
  created_at?: string | null;
}

// pin_code is deliberately excluded from reads; only its presence is reported.
const STAFF_COLUMNS =
  "id, tenant_slug, name, phone, email, role, status, availability, current_chat_load, created_at";

function toMember(row: StaffRow, activities: string[], hasPin: boolean): StaffMember {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    role: (STAFF_ROLES as readonly string[]).includes(row.role || "")
      ? (row.role as StaffRole)
      : "technician",
    status: (STAFF_STATUSES as readonly string[]).includes(row.status || "")
      ? (row.status as StaffStatus)
      : "active",
    availability: (AVAILABILITY as readonly string[]).includes(row.availability || "")
      ? (row.availability as Availability)
      : "offline",
    currentChatLoad: Number(row.current_chat_load) || 0,
    hasPin,
    activities,
    createdAt: row.created_at || null,
  };
}

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

/** The activity link table is optional, so failures degrade to "no links". */
async function fetchActivityLinks(
  tenantSlug: string
): Promise<Record<string, string[]>> {
  const db = getTenantDb();
  if (!db) return {};

  const { data, error } = await db
    .from("mken_staff_activities")
    .select("staff_id, activity_id")
    .eq("tenant_slug", tenantSlug);

  if (error || !data) return {};

  const map: Record<string, string[]> = {};
  for (const row of data as { staff_id: string; activity_id: string }[]) {
    if (!map[row.staff_id]) map[row.staff_id] = [];
    map[row.staff_id].push(row.activity_id);
  }
  return map;
}

export async function fetchStaff(
  tenantSlug: string
): Promise<{ staff?: StaffMember[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_staff")
    .select(`${STAFF_COLUMNS}, pin_code`)
    .eq("tenant_slug", tenantSlug)
    .order("name", { ascending: true });

  if (error) return { error: error.message };

  const links = await fetchActivityLinks(tenantSlug);
  const staff = (data as StaffRow[]).map((row) =>
    toMember(row, links[row.id] || [], Boolean(row.pin_code))
  );

  return { staff };
}

export interface StaffUpdate {
  name?: string;
  phone?: string;
  email?: string;
  role?: StaffRole;
  status?: StaffStatus;
  pinCode?: string;
  activities?: string[];
}

/** Returns the parsed update, or an Arabic error message for a bad payload. */
export function parseStaffBody(body: Record<string, unknown>): StaffUpdate | string {
  const update: StaffUpdate = {};

  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.phone === "string") update.phone = body.phone;
  if (typeof body.email === "string") update.email = body.email;
  if (typeof body.pinCode === "string") update.pinCode = body.pinCode;

  if (body.role !== undefined) {
    if (!(STAFF_ROLES as readonly string[]).includes(body.role as string)) {
      return "الدور الوظيفي غير صحيح";
    }
    update.role = body.role as StaffRole;
  }

  if (body.status !== undefined) {
    if (!(STAFF_STATUSES as readonly string[]).includes(body.status as string)) {
      return "حالة الموظف غير صحيحة";
    }
    update.status = body.status as StaffStatus;
  }

  if (body.activities !== undefined) {
    if (!Array.isArray(body.activities)) return "الأنشطة يجب أن تكون قائمة معرّفات";
    update.activities = body.activities.filter((a): a is string => typeof a === "string");
  }

  return update;
}

export function validateStaff(update: StaffUpdate, requireName = false): string | null {
  if (requireName && !update.name?.trim()) return "اسم الموظف مطلوب";
  if (update.name !== undefined && !update.name.trim()) return "اسم الموظف مطلوب";

  if (update.phone !== undefined && update.phone.trim()) {
    const digits = update.phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) return "رقم الجوال غير صحيح";
  }

  if (update.email !== undefined && update.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(update.email.trim())) return "البريد غير صحيح";
  }

  if (update.pinCode !== undefined && update.pinCode !== "") {
    if (!/^\d{4,8}$/.test(update.pinCode.trim())) return "رمز الدخول يجب أن يكون 4-8 أرقام";
  }

  return null;
}

/** Replaces the activity links for one staff member (delete then insert). */
async function syncActivities(
  tenantSlug: string,
  staffId: string,
  activities: string[]
): Promise<void> {
  const db = getTenantDb();
  if (!db) return;

  await db
    .from("mken_staff_activities")
    .delete()
    .eq("staff_id", staffId)
    .eq("tenant_slug", tenantSlug);

  if (!activities.length) return;

  await db.from("mken_staff_activities").insert(
    activities.map((activityId) => ({
      id: `sact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      staff_id: staffId,
      tenant_slug: tenantSlug,
      activity_id: activityId,
    }))
  );
}

export async function createStaff(
  tenantSlug: string,
  update: StaffUpdate
): Promise<{ member?: StaffMember; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const id = `stf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const payload: Record<string, unknown> = {
    id,
    tenant_slug: tenantSlug,
    name: update.name?.trim(),
    phone: update.phone?.trim() || null,
    email: update.email?.trim() || null,
    role: update.role || "technician",
    status: update.status || "active",
    created_at: new Date().toISOString(),
  };
  if (update.pinCode) payload.pin_code = hashPin(update.pinCode);

  const { data, error } = await db.from("mken_staff").insert(payload).select(STAFF_COLUMNS);

  if (error) return { error: error.message };
  if (!data?.length) return { error: "تعذّر إضافة الموظف: لا توجد صلاحية كتابة" };

  if (update.activities) await syncActivities(tenantSlug, id, update.activities);

  return {
    member: toMember(data[0] as StaffRow, update.activities || [], Boolean(update.pinCode)),
  };
}

export async function updateStaff(
  tenantSlug: string,
  id: string,
  update: StaffUpdate
): Promise<{ member?: StaffMember; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const patch: Record<string, unknown> = {};
  if (update.name !== undefined) patch.name = update.name.trim();
  if (update.phone !== undefined) patch.phone = update.phone.trim() || null;
  if (update.email !== undefined) patch.email = update.email.trim() || null;
  if (update.role !== undefined) patch.role = update.role;
  if (update.status !== undefined) patch.status = update.status;
  if (update.pinCode) patch.pin_code = hashPin(update.pinCode);

  if (Object.keys(patch).length === 0 && !update.activities) {
    return { error: "لا توجد حقول للتحديث" };
  }

  let row: StaffRow | null = null;

  if (Object.keys(patch).length) {
    const { data, error } = await db
      .from("mken_staff")
      .update(patch)
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .select(`${STAFF_COLUMNS}, pin_code`);

    if (error) return { error: error.message };
    if (!data?.length) {
      return { error: "الموظف غير موجود أو لا توجد صلاحية تعديل", notFound: true };
    }
    row = data[0] as StaffRow;
  } else {
    const { data } = await db
      .from("mken_staff")
      .select(`${STAFF_COLUMNS}, pin_code`)
      .eq("id", id)
      .eq("tenant_slug", tenantSlug)
      .maybeSingle();

    if (!data) return { error: "الموظف غير موجود", notFound: true };
    row = data as StaffRow;
  }

  if (update.activities) await syncActivities(tenantSlug, id, update.activities);

  const links = update.activities ?? (await fetchActivityLinks(tenantSlug))[id] ?? [];
  return { member: toMember(row, links, Boolean(row.pin_code)) };
}

export async function deleteStaff(
  tenantSlug: string,
  id: string
): Promise<{ deleted?: boolean; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  await db
    .from("mken_staff_activities")
    .delete()
    .eq("staff_id", id)
    .eq("tenant_slug", tenantSlug);

  const { data, error } = await db
    .from("mken_staff")
    .delete()
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "الموظف غير موجود أو لا توجد صلاحية حذف", notFound: true };
  return { deleted: true };
}

function digits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export async function loginStaffByPin(
  tenantSlug: string,
  phone: string,
  pin: string
): Promise<{ member?: StaffMember; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const slug = tenantSlug.trim().toLowerCase();
  const rawPhone = phone.trim();
  if (!slug || !rawPhone || !pin.trim()) {
    return { error: "أدخل معرف المنشأة والجوال والرمز" };
  }

  const { data, error } = await db
    .from("mken_staff")
    .select(`${STAFF_COLUMNS}, pin_code`)
    .eq("tenant_slug", slug)
    .eq("status", "active");

  if (error) return { error: error.message };

  const wanted = digits(rawPhone);
  const row = ((data as StaffRow[]) || []).find((item) => {
    const stored = (item.phone || "").trim();
    return stored === rawPhone || digits(stored) === wanted;
  });

  if (!row?.pin_code) return { error: "بيانات الدخول غير صحيحة أو الحساب غير نشط" };
  if (!safePinEqual(row.pin_code, hashPin(pin))) {
    return { error: "بيانات الدخول غير صحيحة أو الحساب غير نشط" };
  }

  const links = await fetchActivityLinks(slug);
  return { member: toMember(row, links[row.id] || [], true) };
}

function safePinEqual(stored: string, computed: string): boolean {
  if (stored.length !== computed.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) diff |= stored.charCodeAt(i) ^ computed.charCodeAt(i);
  return diff === 0;
}

export async function loadStaffForLogin(
  tenantSlug: string,
  phone: string
): Promise<{ member?: StaffMember; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const slug = tenantSlug.trim().toLowerCase();
  const rawPhone = phone.trim();
  const { data, error } = await db
    .from("mken_staff")
    .select(`${STAFF_COLUMNS}, pin_code`)
    .eq("tenant_slug", slug)
    .eq("status", "active");

  if (error) return { error: error.message };

  const wanted = digits(rawPhone);
  const row = ((data as StaffRow[]) || []).find((item) => {
    const stored = (item.phone || "").trim();
    return stored === rawPhone || digits(stored) === wanted;
  });

  if (!row) return { error: "الموظف غير موجود أو غير نشط" };
  const links = await fetchActivityLinks(slug);
  return { member: toMember(row, links[row.id] || [], Boolean(row.pin_code)) };
}
