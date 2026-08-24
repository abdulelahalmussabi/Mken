import { randomBytes } from "crypto";
import { getTenantDb } from "@/lib/mken/tenant";

export const LICENSE_PLANS = ["Lite", "Pro", "Business"] as const;
export type LicensePlan = (typeof LICENSE_PLANS)[number];

export const LICENSE_CYCLES = ["annual", "perpetual", "trial"] as const;
export type LicenseCycle = (typeof LICENSE_CYCLES)[number];

export const LICENSE_STATUSES = ["active", "suspended", "revoked"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

const PLAN_DEVICES: Record<LicensePlan, number> = { Lite: 1, Pro: 3, Business: 25 };

export interface LicenseRow {
  license_key: string;
  plan: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  max_devices: number;
  status: string;
  billing_cycle: string | null;
  issued_at: string | null;
  expires_at: string | null;
  notes: string | null;
  tax_number: string | null;
  commercial_registry_number: string | null;
  device_count: number;
}

function generateLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if ((i + 1) % 4 === 0 && i !== 15) out += "-";
  }
  return `MKEN-${out}`;
}

export async function listLicenses(
  status?: string,
  q?: string
): Promise<{ licenses?: LicenseRow[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  let query = db.from("mken_licenses").select("*").order("created_at", { ascending: false }).limit(500);
  if (status && (LICENSE_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) return { error: "تعذّر تحميل التراخيص" };

  const { data: devices } = await db.from("mken_license_devices").select("license_key");
  const counts: Record<string, number> = {};
  for (const row of devices || []) {
    const key = (row as { license_key: string }).license_key;
    counts[key] = (counts[key] || 0) + 1;
  }

  let licenses = ((data || []) as Omit<LicenseRow, "device_count">[]).map((row) => ({
    ...row,
    device_count: counts[row.license_key] || 0,
  }));

  if (q?.trim()) {
    const term = q.trim().toLowerCase();
    licenses = licenses.filter(
      (row) =>
        row.license_key.toLowerCase().includes(term) ||
        (row.customer_name || "").toLowerCase().includes(term) ||
        (row.customer_phone || "").includes(term)
    );
  }

  return { licenses };
}

export async function issueLicense(input: {
  customerName: string;
  phone?: string;
  email?: string;
  crNumber: string;
  taxNumber?: string;
  plan?: string;
  billingCycle?: string;
  months?: number;
  maxDevices?: number;
  notes?: string;
}): Promise<{ license?: LicenseRow; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const customerName = input.customerName.trim();
  const crNumber = input.crNumber.trim();
  if (!customerName) return { error: "أدخل اسم العميل" };
  if (!crNumber) return { error: "أدخل رقم السجل التجاري أو وثيقة العمل الحر" };
  if (input.taxNumber && !/^[0-9]{15}$/.test(input.taxNumber.trim())) {
    return { error: "الرقم الضريبي غير صالح (15 رقماً)" };
  }

  const plan = (LICENSE_PLANS as readonly string[]).includes(input.plan || "")
    ? (input.plan as LicensePlan)
    : "Lite";
  const billingCycle = (LICENSE_CYCLES as readonly string[]).includes(input.billingCycle || "")
    ? (input.billingCycle as LicenseCycle)
    : "annual";
  const months = billingCycle === "perpetual" ? 1200 : Number(input.months) || 12;
  const maxDevices = Math.max(1, Number(input.maxDevices) || PLAN_DEVICES[plan]);
  const now = new Date();
  const expiresAt =
    billingCycle === "perpetual" ? null : new Date(now.getTime() + months * 30 * 86400000).toISOString();

  let licenseKey = generateLicenseKey();
  for (let i = 0; i < 4; i++) {
    const { data: clash } = await db
      .from("mken_licenses")
      .select("license_key")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (!clash) break;
    licenseKey = generateLicenseKey();
  }

  const row = {
    license_key: licenseKey,
    plan,
    customer_name: customerName,
    customer_phone: input.phone?.trim() || null,
    customer_email: input.email?.trim() || null,
    max_devices: maxDevices,
    status: "active",
    billing_cycle: billingCycle,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    source: "admin",
    notes: input.notes?.trim() || null,
    tax_number: input.taxNumber?.trim() || null,
    commercial_registry_number: crNumber,
    updated_at: now.toISOString(),
  };

  const { data, error } = await db.from("mken_licenses").insert(row).select().single();
  if (error || !data) return { error: "تعذّر إصدار الترخيص" };

  await db.from("mken_license_events").insert({
    license_key: licenseKey,
    type: "issued",
    detail: { plan, maxDevices },
  });

  return { license: { ...(data as Omit<LicenseRow, "device_count">), device_count: 0 } };
}

export async function setLicenseStatus(
  licenseKeyRaw: string,
  status: LicenseStatus
): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const licenseKey = licenseKeyRaw.trim().toUpperCase();
  if (!licenseKey) return { error: "المفتاح مطلوب" };

  const { data, error } = await db
    .from("mken_licenses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("license_key", licenseKey)
    .select("license_key")
    .maybeSingle();

  if (error) return { error: "تعذّر تحديث الحالة" };
  if (!data) return { error: "ترخيص غير موجود" };

  const eventType = status === "active" ? "resumed" : status === "suspended" ? "suspended" : "revoked";
  await db.from("mken_license_events").insert({ license_key: licenseKey, type: eventType });
  return {};
}
