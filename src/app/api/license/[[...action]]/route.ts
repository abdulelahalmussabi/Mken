import { NextResponse } from "next/server";
import {
  activateLicenseDevice,
  deactivateLicenseDevice,
  isLicenseAdminToken,
  issueLicense,
  listLicenses,
  setLicenseStatus,
  verifyLicenseDevice,
  type LicenseStatus,
} from "@/lib/mken/licenses";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
};

const WINDOW_MS = 60 * 1000;
const MAX_ACTIVATE = 20;
const buckets = new Map<string, { windowStart: number; count: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function limited(key: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
  }
  if (bucket.count >= MAX_ACTIVATE) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return false;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: CORS });
}

function actionOf(request: Request, parts?: string[]): string {
  if (parts?.[0]) return parts[0];
  return new URL(request.url).searchParams.get("action") || "";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function requireAdmin(request: Request): NextResponse | null {
  const token = request.headers.get("x-admin-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!isLicenseAdminToken(token)) {
    return json(401, { error: "غير مصرّح — يتطلب رمز الإدارة" });
  }
  return null;
}

async function handle(request: Request, parts?: string[]) {
  const action = actionOf(request, parts);
  const adminActions = new Set(["issue", "list", "revoke", "suspend", "resume"]);
  if (adminActions.has(action)) {
    const denied = requireAdmin(request);
    if (denied) return denied;
  }

  if (action === "list" && request.method === "GET") {
    const url = new URL(request.url);
    const { licenses, error } = await listLicenses(url.searchParams.get("status") || "", url.searchParams.get("q") || "");
    if (error || !licenses) return json(500, { error: error || "تعذّر التحميل" });
    return json(200, { licenses });
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const body = await readBody(request);
  const ip = clientIp(request);

  if (action === "activate") {
    if (limited(`lic_act_${ip}`)) {
      return json(429, { error: "طلبات كثيرة، حاول لاحقاً" });
    }
    const result = await activateLicenseDevice({
      licenseKey: str(body.licenseKey),
      machineId: str(body.machineId),
      hostname: str(body.hostname),
      ip,
    });
    return json(result.status, result.body);
  }

  if (action === "verify") {
    const result = await verifyLicenseDevice({
      licenseKey: str(body.licenseKey),
      machineId: str(body.machineId),
      ip,
    });
    return json(result.status, result.body);
  }

  if (action === "deactivate") {
    const result = await deactivateLicenseDevice({
      licenseKey: str(body.licenseKey),
      machineId: str(body.machineId),
      ip,
    });
    return json(result.status, result.body);
  }

  if (action === "issue") {
    const issued = await issueLicense({
      plan: str(body.plan) || "Lite",
      customerName: str(body.customerName || body.customer_name),
      phone: str(body.phone || body.customer_phone),
      email: str(body.email || body.customer_email),
      months: Number(body.months) || undefined,
      maxDevices: Number(body.maxDevices) || undefined,
      billingCycle: str(body.billingCycle) || "annual",
      crNumber: str(body.crNumber || body.cr_number || body.commercialRegistryNumber || body.commercial_registry_number),
      taxNumber: str(body.taxNumber || body.tax_number),
      notes: str(body.notes),
      source: "admin",
    });
    if (issued.error || !issued.license) return json(400, { error: issued.error || "تعذّر الإصدار" });
    return json(201, { success: true, license: issued.license });
  }

  const statusMap: Record<string, LicenseStatus> = {
    revoke: "revoked",
    suspend: "suspended",
    resume: "active",
  };
  if (statusMap[action]) {
    const { error } = await setLicenseStatus(str(body.licenseKey), statusMap[action]);
    if (error) return json(400, { error });
    return json(200, { success: true });
  }

  return json(400, {
    error: "إجراء غير معروف. استخدم action=activate|verify|deactivate|issue|list|revoke|suspend|resume",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request, context: { params: Promise<{ action?: string[] }> }) {
  const params = await context.params;
  return handle(request, params.action);
}

export async function POST(request: Request, context: { params: Promise<{ action?: string[] }> }) {
  const params = await context.params;
  return handle(request, params.action);
}
