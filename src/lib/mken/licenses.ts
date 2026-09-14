import { randomBytes, sign as ecdsaSign, timingSafeEqual, verify as ecdsaVerify } from "crypto";
import { getTenantDb } from "@/lib/mken/tenant";
import { sendOutboundWhatsapp } from "@/lib/mken/whatsapp";

export const LICENSE_PLANS = ["Lite", "Pro", "Business"] as const;
export type LicensePlan = (typeof LICENSE_PLANS)[number];

export const LICENSE_CYCLES = ["annual", "perpetual", "trial"] as const;
export type LicenseCycle = (typeof LICENSE_CYCLES)[number];

export const LICENSE_STATUSES = ["active", "suspended", "revoked"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

const PLAN_DEVICES: Record<LicensePlan, number> = { Lite: 1, Pro: 3, Business: 25 };

export const LICENSE_PLAN_PRICES: Record<LicensePlan, { annual: number; perpetual: number; maxDevices: number; label: string }> = {
  Lite: { annual: 399, perpetual: 750, maxDevices: 1, label: "Lite" },
  Pro: { annual: 899, perpetual: 2200, maxDevices: 3, label: "Pro" },
  Business: { annual: 1800, perpetual: 5000, maxDevices: 25, label: "Business" },
};

export function licensePriceFor(plan: string, billingCycle: string): number {
  const def = LICENSE_PLAN_PRICES[(LICENSE_PLANS as readonly string[]).includes(plan) ? (plan as LicensePlan) : "Lite"];
  return billingCycle === "perpetual" ? def.perpetual : def.annual;
}

function normalizePem(pem: string | undefined): string {
  return (pem || "").replace(/\\n/g, "\n").trim();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

export function signLicenseToken(payload: Record<string, unknown>): string {
  const pem = normalizePem(process.env.LICENSE_PRIVATE_KEY);
  if (!pem) throw new Error("LICENSE_PRIVATE_KEY غير مهيّأ في البيئة");
  const header = { alg: "ES256", typ: "MKEN-LIC", v: 1 };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = ecdsaSign("sha256", Buffer.from(signingInput), {
    key: pem,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(signature)}`;
}

export function verifyLicenseToken(token: string): Record<string, unknown> | null {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const pem = normalizePem(process.env.LICENSE_PUBLIC_KEY);
    const signingInput = `${parts[0]}.${parts[1]}`;
    const sig = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const padded = sig + "=".repeat((4 - (sig.length % 4)) % 4);
    const ok = ecdsaVerify(
      "sha256",
      Buffer.from(signingInput),
      { key: pem, dsaEncoding: "ieee-p1363" },
      Buffer.from(padded, "base64")
    );
    if (!ok) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadPadded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    return JSON.parse(Buffer.from(payloadPadded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isLicenseAdminToken(headerValue: string | null): boolean {
  const expected = process.env.LICENSE_ADMIN_TOKEN || "";
  if (!expected || !headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function logLicenseEvent(
  licenseKey: string | null,
  type: string,
  detail: unknown,
  ip?: string | null
): Promise<void> {
  const db = getTenantDb();
  if (!db) return;
  await db.from("mken_license_events").insert({
    license_key: licenseKey,
    type,
    detail: detail || null,
    ip: ip || null,
  });
}

function tokenFor(lic: {
  license_key: string;
  plan: string;
  max_devices: number;
  customer_name?: string | null;
  expires_at?: string | null;
}, machineId: string): string {
  return signLicenseToken({
    k: lic.license_key,
    plan: lic.plan,
    mid: machineId,
    max: lic.max_devices,
    cust: lic.customer_name || "",
    iat: Date.now(),
    exp: lic.expires_at ? new Date(lic.expires_at).getTime() : 0,
  });
}

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
  crNumber?: string;
  taxNumber?: string;
  plan?: string;
  billingCycle?: string;
  months?: number;
  maxDevices?: number;
  notes?: string;
  paymentId?: string;
  source?: string;
  requireCr?: boolean;
}): Promise<{ license?: LicenseRow; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const customerName = (input.customerName || "").trim();
  const crNumber = (input.crNumber || "").trim();
  if (!customerName) return { error: "أدخل اسم العميل" };
  if ((input.requireCr !== false) && !crNumber) return { error: "أدخل رقم السجل التجاري أو وثيقة العمل الحر" };
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
    source: input.source || "admin",
    payment_id: input.paymentId || null,
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

type LicenseDeviceRow = {
  id: string;
  license_key: string;
  machine_id: string;
  hostname?: string | null;
};

export async function activateLicenseDevice(input: {
  licenseKey: string;
  machineId: string;
  hostname?: string;
  ip?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = getTenantDb();
  if (!db) return { status: 500, body: { error: "Supabase غير مهيّأ في البيئة" } };

  const licenseKey = input.licenseKey.trim().toUpperCase();
  const machineId = input.machineId.trim();
  const hostname = (input.hostname || "").trim();
  if (!licenseKey || !machineId) {
    return { status: 400, body: { error: "licenseKey و machineId مطلوبان" } };
  }

  const { data: lic, error } = await db.from("mken_licenses").select("*").eq("license_key", licenseKey).maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!lic) {
    await logLicenseEvent(licenseKey, "denied", { reason: "not_found", machineId }, input.ip);
    return { status: 404, body: { error: "مفتاح ترخيص غير صحيح" } };
  }
  if (lic.status !== "active") {
    await logLicenseEvent(licenseKey, "denied", { reason: lic.status, machineId }, input.ip);
    return { status: 403, body: { error: `الترخيص ${lic.status === "revoked" ? "ملغى" : "موقوف"}` } };
  }
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    await logLicenseEvent(licenseKey, "denied", { reason: "expired", machineId }, input.ip);
    return { status: 403, body: { error: "انتهت صلاحية الترخيص", expiresAt: lic.expires_at } };
  }

  const { data: devices, error: devErr } = await db.from("mken_license_devices").select("*").eq("license_key", licenseKey);
  if (devErr) return { status: 500, body: { error: devErr.message } };
  const existing = ((devices || []) as LicenseDeviceRow[]).find((d) => d.machine_id === machineId);
  if (!existing) {
    if ((devices || []).length >= lic.max_devices) {
      await logLicenseEvent(licenseKey, "denied", { reason: "device_limit", machineId, max: lic.max_devices }, input.ip);
      return {
        status: 409,
        body: {
          error: `تم بلوغ الحد الأقصى للأجهزة (${lic.max_devices}). فعِّل الترخيص على جهاز واحد فقط أو افكّ ربط جهاز آخر.`,
          code: "DEVICE_LIMIT",
        },
      };
    }
    const { error: insErr } = await db
      .from("mken_license_devices")
      .insert({ license_key: licenseKey, machine_id: machineId, hostname });
    if (insErr) return { status: 500, body: { error: insErr.message } };
  } else {
    await db
      .from("mken_license_devices")
      .update({ last_seen_at: new Date().toISOString(), hostname: hostname || existing.hostname })
      .eq("id", existing.id);
  }

  let token: string;
  try {
    token = tokenFor(lic, machineId);
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : "تعذّر توقيع الترخيص" } };
  }
  await logLicenseEvent(licenseKey, "activated", { machineId, hostname }, input.ip);
  return {
    status: 200,
    body: {
      token,
      plan: lic.plan,
      customerName: lic.customer_name,
      maxDevices: lic.max_devices,
      expiresAt: lic.expires_at,
      publicKeyHint: "verify offline with embedded LICENSE_PUBLIC_KEY",
    },
  };
}

export async function verifyLicenseDevice(input: {
  licenseKey: string;
  machineId: string;
  ip?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = getTenantDb();
  if (!db) return { status: 500, body: { error: "Supabase غير مهيّأ في البيئة" } };

  const licenseKey = input.licenseKey.trim().toUpperCase();
  const machineId = input.machineId.trim();
  if (!licenseKey || !machineId) {
    return { status: 400, body: { error: "licenseKey و machineId مطلوبان" } };
  }

  const { data: lic, error } = await db.from("mken_licenses").select("*").eq("license_key", licenseKey).maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!lic) return { status: 404, body: { valid: false, reason: "not_found" } };

  const { data: device } = await db
    .from("mken_license_devices")
    .select("id")
    .eq("license_key", licenseKey)
    .eq("machine_id", machineId)
    .maybeSingle();

  const expired = Boolean(lic.expires_at && new Date(lic.expires_at) < new Date());
  const valid = lic.status === "active" && !expired && Boolean(device);
  if (device) {
    await db.from("mken_license_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  }
  await logLicenseEvent(licenseKey, "verified", { machineId, valid }, input.ip);

  let token: string | null = null;
  if (valid) {
    try {
      token = tokenFor(lic, machineId);
    } catch {
      token = null;
    }
  }

  return {
    status: 200,
    body: {
      valid,
      status: lic.status,
      expired,
      boundToThisDevice: Boolean(device),
      plan: lic.plan,
      expiresAt: lic.expires_at,
      token,
    },
  };
}

export async function deactivateLicenseDevice(input: {
  licenseKey: string;
  machineId: string;
  ip?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = getTenantDb();
  if (!db) return { status: 500, body: { error: "Supabase غير مهيّأ في البيئة" } };

  const licenseKey = input.licenseKey.trim().toUpperCase();
  const machineId = input.machineId.trim();
  if (!licenseKey || !machineId) {
    return { status: 400, body: { error: "licenseKey و machineId مطلوبان" } };
  }
  const { error } = await db
    .from("mken_license_devices")
    .delete()
    .eq("license_key", licenseKey)
    .eq("machine_id", machineId);
  if (error) return { status: 500, body: { error: error.message } };
  await logLicenseEvent(licenseKey, "deactivated", { machineId }, input.ip);
  return { status: 200, body: { success: true } };
}

export function licenseCheckoutConfig(): Record<string, unknown> {
  const publishableKey =
    process.env.MOYASAR_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || "";
  return {
    publishableKey,
    currency: "﷼",
    plans: LICENSE_PLANS.map((key) => ({
      key,
      label: LICENSE_PLAN_PRICES[key].label,
      annual: LICENSE_PLAN_PRICES[key].annual,
      perpetual: LICENSE_PLAN_PRICES[key].perpetual,
      maxDevices: LICENSE_PLAN_PRICES[key].maxDevices,
    })),
  };
}

export async function licenseCheckoutStatus(paymentIdRaw: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const paymentId = paymentIdRaw.trim();
  if (!paymentId) return { status: 400, body: { error: "paymentId مطلوب" } };

  const secret = process.env.MOYASAR_SECRET_KEY;
  if (!secret) return { status: 500, body: { error: "مفتاح Moyasar غير مهيّأ" } };

  let payment: { status?: string };
  try {
    const auth = Buffer.from(`${secret}:`).toString("base64");
    const r = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    payment = (await r.json()) as { status?: string };
  } catch (err) {
    return { status: 400, body: { error: `تعذّر التحقق من الدفعة: ${err instanceof Error ? err.message : "خطأ"}` } };
  }

  const paid = payment.status === "paid" || payment.status === "captured";
  if (!paid) return { status: 200, body: { paid: false, status: payment.status || "unknown" } };

  const db = getTenantDb();
  if (!db) return { status: 500, body: { error: "قاعدة البيانات غير مهيأة على الخادم" } };
  const { data: lic } = await db
    .from("mken_licenses")
    .select("license_key, plan, expires_at, max_devices")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!lic) {
    return { status: 200, body: { paid: true, issued: false, message: "تم الدفع — جارٍ إصدار الترخيص، حدّث بعد لحظات." } };
  }

  return {
    status: 200,
    body: {
      paid: true,
      issued: true,
      licenseKey: lic.license_key,
      plan: lic.plan,
      expiresAt: lic.expires_at,
      maxDevices: lic.max_devices,
    },
  };
}

export async function issuePaidLiteLicense(input: {
  paymentId: string;
  amountHalalah: number;
  metadata: Record<string, unknown>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = getTenantDb();
  if (!db) return { status: 500, body: { error: "قاعدة البيانات غير مهيأة على الخادم" } };

  const md = input.metadata;
  const plan = String(md.plan || "Lite");
  const billingCycle = String(md.billing_cycle || md.billingCycle || "annual");
  const expected = licensePriceFor(plan, billingCycle);
  const paid = input.amountHalalah / 100;
  if (Math.abs(paid - expected) > 0.01) {
    return { status: 400, body: { error: "Payment amount mismatch for Mken Lite license" } };
  }

  const { data: existing } = await db
    .from("mken_licenses")
    .select("license_key")
    .eq("payment_id", input.paymentId)
    .maybeSingle();
  if (existing) {
    return { status: 200, body: { success: true, message: "Already processed", type: "mken_lite_license", licenseKey: existing.license_key } };
  }

  const issued = await issueLicense({
    plan,
    billingCycle,
    months: Number(md.months) || undefined,
    maxDevices: Number(md.max_devices || md.maxDevices) || undefined,
    customerName: String(md.customer_name || md.customerName || ""),
    phone: String(md.phone || ""),
    email: String(md.email || ""),
    crNumber: String(md.commercial_registry_number || md.cr_number || md.crNumber || ""),
    taxNumber: String(md.tax_number || md.taxNumber || ""),
    paymentId: input.paymentId,
    source: "moyasar",
    notes: `Moyasar ${input.paymentId}`,
    requireCr: false,
  });
  if (issued.error || !issued.license) {
    return { status: 500, body: { error: issued.error || "تعذّر إصدار الترخيص" } };
  }

  const lic = issued.license;
  const phone = String(md.phone || "");
  if (phone) {
    const expiryText = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("ar-EG") : "رخصة دائمة";
    const msg = [
      "تم تفعيل اشتراكك في Mken Lite بنجاح! 🎉",
      "━━━━━━━━━━━━━━",
      `الباقة: ${lic.plan}`,
      "مفتاح الترخيص:",
      lic.license_key,
      `عدد الأجهزة: ${lic.max_devices}`,
      `الصلاحية حتى: ${expiryText}`,
      "━━━━━━━━━━━━━━",
      "افتح التطبيق ← الإعدادات ← الترخيص، وألصق المفتاح للتفعيل وربطه بجهازك.",
      "شكراً لثقتك بمكن!",
    ].join("\n");
    await sendOutboundWhatsapp("default", phone, msg, "confirmation", {
      credentialsSlug: "default",
      maxBody: 4000,
    });
  }

  return { status: 200, body: { success: true, type: "mken_lite_license", licenseKey: lic.license_key } };
}
