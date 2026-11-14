import {
  getTenantDb,
  getServiceRoleDb,
  fetchTenantRow,
  writeTenantConfig,
  canonicalTenantSlug,
  type MkenConfig,
} from "@/lib/mken/tenant";

/**
 * WhatsApp message log in `mken_whatsapp_logs`, written by the automation layer
 * (js/whatsapp-automation.js) and by inbound webhooks. Inbound messages are
 * marked by `event_type = 'inbound'` or `status = 'received'`, which is the same
 * rule the legacy admin panel uses to split the two directions.
 */

export const WHATSAPP_STATUSES = ["success", "failed", "received", "pending"] as const;
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

export const EVENT_LABELS: Record<string, string> = {
  confirmation: "تأكيد الحجز",
  reminder: "تذكير موعد",
  cancellation: "إلغاء الحجز",
  reschedule: "تعديل موعد",
  subscription_reminder: "تذكير اشتراك",
  subscription_expired: "انتهاء اشتراك",
  test: "رسالة تجريبية",
  inbound: "رسالة واردة",
  chatbot_reply: "رد المساعد الذكي",
  crm_reply: "رد مباشر (CRM)",
  marketing_campaign: "حملة تسويقية",
  review_request: "طلب تقييم بعد الزيارة",
  review_followup: "متابعة تقييم",
};

export const PROVIDER_LABELS: Record<string, string> = {
  ultramsg: "UltraMsg",
  twilio: "Twilio",
  custom: "n8n / Webhook",
  whatsapp_business: "WhatsApp Business",
};

export interface WhatsappLog {
  id: string;
  tenantSlug: string;
  phone: string;
  body: string;
  provider: string;
  status: string;
  errorMessage: string;
  eventType: string;
  appointmentId: string | null;
  createdAt: string | null;
  retryCount: number;
  inbound: boolean;
}

interface LogRow {
  id: string;
  tenant_slug?: string | null;
  phone?: string | null;
  body?: string | null;
  provider?: string | null;
  status?: string | null;
  error_message?: string | null;
  event_type?: string | null;
  appointment_id?: string | null;
  created_at?: string | null;
  retry_count?: number | null;
}

function toLog(row: LogRow): WhatsappLog {
  const status = row.status || "";
  const eventType = row.event_type || "";

  return {
    id: row.id,
    tenantSlug: row.tenant_slug || "default",
    phone: row.phone || "",
    body: row.body || "",
    provider: row.provider || "",
    status,
    errorMessage: row.error_message || "",
    eventType,
    appointmentId: row.appointment_id || null,
    createdAt: row.created_at || null,
    retryCount: Number(row.retry_count) || 0,
    inbound: eventType === "inbound" || status === "received",
  };
}

export interface WhatsappStats {
  total: number;
  inbound: number;
  outbound: number;
  success: number;
  failed: number;
}

export function summarize(logs: WhatsappLog[]): WhatsappStats {
  const outbound = logs.filter((l) => !l.inbound);
  return {
    total: logs.length,
    inbound: logs.length - outbound.length,
    outbound: outbound.length,
    success: outbound.filter((l) => l.status === "success").length,
    failed: outbound.filter((l) => l.status === "failed").length,
  };
}

export async function fetchWhatsappLogs(
  tenantSlug: string,
  limit = 300
): Promise<{ logs?: WhatsappLog[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_whatsapp_logs")
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000));

  if (error) return { error: error.message };
  return { logs: (data as LogRow[]).map(toLog) };
}

export async function deleteWhatsappLog(
  tenantSlug: string,
  id: string
): Promise<{ deleted?: boolean; error?: string; notFound?: boolean }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  // Scoped by tenant so one tenant can never delete another tenant's log.
  const { data, error } = await db
    .from("mken_whatsapp_logs")
    .delete()
    .eq("id", id)
    .eq("tenant_slug", tenantSlug)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "السجل غير موجود أو لا توجد صلاحية حذف", notFound: true };
  return { deleted: true };
}

export const WHATSAPP_PROVIDERS = ["none", "ultramsg", "whatsapp_business", "twilio", "custom"] as const;
export type WhatsappProvider = (typeof WHATSAPP_PROVIDERS)[number];

export const GATEWAY_PROVIDERS = ["", "ultramsg", "twilio"] as const;
export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export interface WhatsappGatewayPublic {
  provider: GatewayProvider;
  instanceId: string;
  accountSid: string;
  fromNumber: string;
  tokenSet: boolean;
}

export interface WhatsappApiPublic {
  enabled: boolean;
  provider: WhatsappProvider;
  url: string;
  instanceId: string;
  phoneNumberId: string;
  accountSid: string;
  fromNumber: string;
  templateName: string;
  languageCode: string;
  sendConfirmation: boolean;
  sendReminder: boolean;
  tokenSet: boolean;
  gateway: WhatsappGatewayPublic;
  inboundWebhookUrl: string;
  n8nWebhookExample: string;
  templates: { confirmation: string; reminder: string };
}

interface WhatsappGatewayStored {
  provider: GatewayProvider;
  instanceId: string;
  accountSid: string;
  fromNumber: string;
  token?: string;
}

interface WhatsappApiStored {
  enabled: boolean;
  provider: WhatsappProvider;
  url: string;
  instanceId: string;
  phoneNumberId: string;
  accountSid: string;
  fromNumber: string;
  templateName: string;
  languageCode: string;
  sendConfirmation: boolean;
  sendReminder: boolean;
  token?: string;
  gateway: WhatsappGatewayStored;
  templates: { confirmation: string; reminder: string };
}

function asProvider(value: unknown): WhatsappProvider {
  return (WHATSAPP_PROVIDERS as readonly string[]).includes(String(value))
    ? (value as WhatsappProvider)
    : "none";
}

function asGatewayProvider(value: unknown): GatewayProvider {
  return (GATEWAY_PROVIDERS as readonly string[]).includes(String(value))
    ? (value as GatewayProvider)
    : "";
}

export function inboundWebhookUrl(slug: string): string {
  return `https://mken.live/api/whatsapp-webhook?tenant=${encodeURIComponent(slug)}`;
}

export function n8nWebhookExample(slug: string): string {
  return `https://YOUR-N8N-DOMAIN/webhook/mken-whatsapp?tenant=${encodeURIComponent(slug)}`;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function flag(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function tenantWhatsappRaw(config: unknown): unknown {
  if (!config || typeof config !== "object") return null;
  return (config as Record<string, unknown>).whatsappApi;
}

export function whatsappApiIsReady(raw: unknown): boolean {
  const stored = readStored(raw);
  return stored.enabled && stored.provider !== "none";
}

function whatsappNotReadyMessage(raw: unknown): string {
  const stored = readStored(raw);
  if (stored.provider === "none") {
    return "اختر المزود (WhatsApp Cloud API) ثم اضغط حفظ الإعدادات";
  }
  if (!stored.enabled) {
    return "فعّل «تفعيل الإرسال» ثم اضغط حفظ الإعدادات";
  }
  return "واتساب غير مفعّل لهذه المنشأة";
}

function readStored(raw: unknown): WhatsappApiStored {
  const wa = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const templates = (wa.templates && typeof wa.templates === "object" ? wa.templates : {}) as Record<
    string,
    unknown
  >;
  const provider = asProvider(wa.provider);
  const gatewayRaw = (wa.gateway && typeof wa.gateway === "object" ? wa.gateway : {}) as Record<
    string,
    unknown
  >;
  const gatewayProvider = asGatewayProvider(gatewayRaw.provider);
  return {
    enabled: flag(wa.enabled),
    provider,
    url: str(wa.url),
    instanceId: str(wa.instanceId),
    phoneNumberId: str(wa.phoneNumberId) || (provider === "whatsapp_business" ? str(wa.instanceId) : ""),
    accountSid: str(wa.accountSid),
    fromNumber: str(wa.fromNumber),
    templateName: str(wa.templateName),
    languageCode: str(wa.languageCode) || "ar",
    sendConfirmation: flag(wa.sendConfirmation, true),
    sendReminder: flag(wa.sendReminder, true),
    token: str(wa.token),
    gateway: {
      provider: gatewayProvider,
      instanceId: str(gatewayRaw.instanceId),
      accountSid: str(gatewayRaw.accountSid) || (gatewayProvider === "twilio" ? str(gatewayRaw.instanceId) : ""),
      fromNumber: str(gatewayRaw.fromNumber),
      token: str(gatewayRaw.token),
    },
    templates: {
      confirmation: str(templates.confirmation),
      reminder: str(templates.reminder),
    },
  };
}

export function toPublicWhatsappApi(stored: WhatsappApiStored, slug: string): WhatsappApiPublic {
  const { token, gateway, ...rest } = stored;
  const { token: gatewayToken, ...gatewayRest } = gateway;
  return {
    ...rest,
    tokenSet: Boolean(token),
    gateway: { ...gatewayRest, tokenSet: Boolean(gatewayToken) },
    inboundWebhookUrl: inboundWebhookUrl(slug),
    n8nWebhookExample: n8nWebhookExample(slug),
  };
}

export function normalizeWaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

/** Saudi mobile: 05X… (10 digits). X is 0 or 3–9 (not 051/052 land-line ranges). */
export function whatsappPhoneIssue(phoneRaw: string): string | null {
  const phone = normalizeWaPhone(phoneRaw);
  if (!phone) return "رقم الجوال غير صالح";
  // 966 + 5 + [03456789] + 7 digits = 12 digits (0543530333 → 966543530333)
  if (!/^9665[03456789]\d{7}$/.test(phone)) {
    return `الرقم (${phoneRaw.trim()} → ${phone}) ليس جوالاً سعودياً يبدأ بـ 05. مثال: 0551234567`;
  }
  return null;
}

function explainWhatsappCloudError(status: number, raw: string): string {
  let code = 0;
  let subcode = 0;
  let message = "";
  try {
    const data = JSON.parse(raw) as {
      error?: {
        code?: number;
        error_subcode?: number;
        message?: string;
        error_user_msg?: string;
        error_data?: { details?: string };
      };
    };
    const err = data.error;
    if (err) {
      code = Number(err.code) || 0;
      subcode = Number(err.error_subcode) || 0;
      message = err.error_user_msg || err.error_data?.details || err.message || "";
    }
  } catch {
    message = raw.slice(0, 180);
  }

  if (code === 190 || subcode === 463 || /expired|invalid.?token|session has expired/i.test(message)) {
    return "توكن ميتا منتهٍ أو غير صالح. الصق Access Token الجديد في حقل التوكن ثم احفظ — تحديثه في ميتا وحده لا يكفي.";
  }
  if (
    code === 100 ||
    /unsupported post request|does not exist|cannot be loaded|missing permissions/i.test(message)
  ) {
    const objectId = message.match(/Object with ID '(\d+)'/i)?.[1] || "";
    return (
      `التوكن لا يملك صلاحية على Phone Number ID${objectId ? ` (${objectId})` : ""}. ` +
      "هذا ليس خطأ الرقم نفسه: انسخ Access Token من نفس شاشة WhatsApp → API Setup التي تظهر فيها هذا الـ ID، " +
      "ثم الصقه هنا واحفظ. لا تستخدم توكن تطبيق قديم، ولا تضع WABA ID في حقل Phone Number ID."
    );
  }
  if (code === 10 || /permission|whatsapp_business_messaging/i.test(message)) {
    return "التوكن بلا صلاحية إرسال واتساب (whatsapp_business_messaging). أنشئ System User token دائم وامنحه WABA.";
  }
  if (code === 133010 || /phone number id/i.test(message)) {
    return "Phone Number ID لا يطابق هذا التوكن. انسخه من نفس التطبيق في Meta for Developers.";
  }
  if (code === 131047) {
    return "خارج نافذة الـ 24 ساعة. اطلب من الرقم مراسلة واتساب المنشأة أولاً، ثم أعد الإرسال التجريبي.";
  }
  if (code === 131026 || /not a whatsapp/i.test(message)) {
    return "هذا الرقم غير مسجّل على واتساب، أو التطبيق ما زال Development Mode ولا يسمح إلا بأرقام المختبرين.";
  }
  if (code === 130429 || /experimental|not approved|not live/i.test(message)) {
    return "تطبيق ميتا في وضع التطوير. حوّله إلى Live أو أضف رقم الاختبار ضمن Testers.";
  }
  return message || `WhatsApp Cloud HTTP ${status}`;
}

export async function fetchWhatsappApi(
  tenantSlug: string
): Promise<{ config?: WhatsappApiPublic; error?: string }> {
  const row = await fetchTenantRow(tenantSlug);
  if (!row) return { error: "المنشأة غير موجودة" };
  return { config: toPublicWhatsappApi(readStored(tenantWhatsappRaw(row.config_data)), tenantSlug) };
}

export async function saveWhatsappApi(
  tenantSlug: string,
  patch: Partial<WhatsappApiPublic> & { token?: string; gatewayToken?: string }
): Promise<{ config?: WhatsappApiPublic; error?: string; webhook?: { ok: boolean; message: string } }> {
  const slug = canonicalTenantSlug(tenantSlug);
  const row = await fetchTenantRow(slug);
  if (!row) return { error: "المنشأة غير موجودة" };

  const current = readStored(tenantWhatsappRaw(row.config_data));
  const next: WhatsappApiStored = {
    ...current,
    enabled: patch.enabled ?? current.enabled,
    provider: patch.provider ? asProvider(patch.provider) : current.provider,
    url: patch.url !== undefined ? patch.url.trim() : current.url,
    instanceId: patch.instanceId !== undefined ? patch.instanceId.trim() : current.instanceId,
    phoneNumberId:
      patch.phoneNumberId !== undefined ? patch.phoneNumberId.trim() : current.phoneNumberId,
    accountSid: patch.accountSid !== undefined ? patch.accountSid.trim() : current.accountSid,
    fromNumber: patch.fromNumber !== undefined ? patch.fromNumber.trim() : current.fromNumber,
    templateName: patch.templateName !== undefined ? patch.templateName.trim() : current.templateName,
    languageCode: patch.languageCode !== undefined ? patch.languageCode.trim() || "ar" : current.languageCode,
    sendConfirmation: patch.sendConfirmation ?? current.sendConfirmation,
    sendReminder: patch.sendReminder ?? current.sendReminder,
    token: patch.token?.trim() ? sanitizeGraphToken(patch.token) : current.token,
    gateway: {
      provider:
        patch.gateway?.provider !== undefined
          ? asGatewayProvider(patch.gateway.provider)
          : current.gateway.provider,
      instanceId:
        patch.gateway?.instanceId !== undefined
          ? patch.gateway.instanceId.trim()
          : current.gateway.instanceId,
      accountSid:
        patch.gateway?.accountSid !== undefined
          ? patch.gateway.accountSid.trim()
          : current.gateway.accountSid,
      fromNumber:
        patch.gateway?.fromNumber !== undefined
          ? patch.gateway.fromNumber.trim()
          : current.gateway.fromNumber,
      token: patch.gatewayToken?.trim() ? patch.gatewayToken.trim() : current.gateway.token,
    },
    templates: {
      confirmation:
        patch.templates?.confirmation !== undefined
          ? patch.templates.confirmation
          : current.templates.confirmation,
      reminder:
        patch.templates?.reminder !== undefined ? patch.templates.reminder : current.templates.reminder,
    },
  };

  if (next.provider === "whatsapp_business" && !next.phoneNumberId && next.instanceId) {
    next.phoneNumberId = next.instanceId;
  }
  if (next.gateway.provider === "twilio" && !next.gateway.accountSid && next.gateway.instanceId) {
    next.gateway.accountSid = next.gateway.instanceId;
  }

  if (next.provider === "custom") {
    if (!next.url || !/^https?:\/\//i.test(next.url)) {
      return { error: "رابط Webhook لـ n8n يجب أن يبدأ بـ http:// أو https://" };
    }
  }

  const config = { ...(row.config_data || {}), whatsappApi: next, updatedAt: new Date().toISOString() } as MkenConfig;
  const written = await writeTenantConfig(slug, config);
  if (written.error || !written.row) {
    return { error: written.error || "تعذّر حفظ إعدادات واتساب" };
  }

  let webhook: { ok: boolean; message: string } | undefined;
  if (next.provider === "whatsapp_business" && next.token && next.phoneNumberId) {
    webhook = await subscribeCloudApiWebhook(next.token, next.phoneNumberId);
  }

  return { config: toPublicWhatsappApi(next, slug), webhook };
}

const META_INBOUND_CALLBACK = "https://mken.live/api/whatsapp-webhook";
const GRAPH_VERSION = "v22.0";

function graphErrorMessage(data: unknown): string {
  const err = data && typeof data === "object" ? (data as { error?: { message?: string; error_user_msg?: string } }).error : null;
  return (err?.error_user_msg || err?.message || "").trim();
}

function sanitizeGraphToken(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/[\s\u200b\u200c\u200d\ufeff]+/g, "")
    .trim();
}

function explainGraphTokenError(message: string): string {
  if (/cannot parse access token|invalid oauth access token/i.test(message)) {
    return "التوكن المحفوظ ليس Access Token صالحاً لميتـا. من developers.facebook.com → التطبيق → WhatsApp → API Setup انسخ Temporary access token (يبدأ عادة بـ EAA) والصقه في خانة التوكن ثم احفظ. لا تلصق Verify Token أو App Secret أو Phone Number ID.";
  }
  return message;
}

async function graphRequest(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { raw: raw.slice(0, 180) };
  }
  return { ok: res.ok, data };
}

async function graphFormPost(path: string, fields: Record<string, string>) {
  return graphRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

function graphIds(data: Record<string, unknown>): string[] {
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows
    .map((row) => (row && typeof row === "object" && "id" in row ? String((row as { id?: string }).id || "") : ""))
    .filter(Boolean);
}

function debugTokenWabaIds(data: Record<string, unknown>): string[] {
  const payload =
    data.data && typeof data.data === "object" ? (data.data as { granular_scopes?: Array<{ scope?: string; target_ids?: string[] }> }) : {};
  const ids: string[] = [];
  for (const scope of payload.granular_scopes || []) {
    if (!/whatsapp_business_management/i.test(scope.scope || "")) continue;
    for (const id of scope.target_ids || []) {
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

async function resolveWabaId(token: string, phoneNumberId: string): Promise<{ wabaId?: string; error?: string }> {
  const asWaba = await graphRequest(
    `/${encodeURIComponent(phoneNumberId)}/phone_numbers?access_token=${encodeURIComponent(token)}`
  );
  if (asWaba.ok && graphIds(asWaba.data).length) {
    return { wabaId: phoneNumberId };
  }

  const debug = await graphRequest(
    `/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
  );
  const candidates = debugTokenWabaIds(debug.data);
  for (const candidate of candidates) {
    const phones = await graphRequest(
      `/${encodeURIComponent(candidate)}/phone_numbers?access_token=${encodeURIComponent(token)}`
    );
    if (!phones.ok) continue;
    const ids = graphIds(phones.data);
    if (ids.includes(phoneNumberId) || ids.length === 1) {
      return { wabaId: candidate };
    }
  }
  if (candidates.length === 1) return { wabaId: candidates[0] };

  return {
    error:
      explainGraphTokenError(graphErrorMessage(debug.data) || graphErrorMessage(asWaba.data)) ||
      "تعذّر معرفة WhatsApp Business Account ID من التوكن. أنشئ توكن مستخدم نظام بصلاحية whatsapp_business_management على حساب Mken.",
  };
}

/** Point this WABA at مكّن so Meta POSTs inbound messages. */
export async function subscribeCloudApiWebhook(
  tokenRaw: string,
  phoneNumberIdRaw: string
): Promise<{ ok: boolean; message: string }> {
  const token = sanitizeGraphToken(tokenRaw);
  const phoneNumberId = phoneNumberIdRaw.replace(/\D/g, "");
  const verifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
  if (!verifyToken) {
    return { ok: false, message: "WHATSAPP_VERIFY_TOKEN غير معيّن على Vercel — لا يمكن ربط الوارد." };
  }
  if (!token || token.length < 20) {
    return {
      ok: false,
      message:
        "التوكن ناقص أو قصير جداً. الصق Access Token من مستخدم النظام (يبدأ بـ EAA) ثم احفظ.",
    };
  }
  if (!phoneNumberId) {
    return { ok: false, message: "Phone Number ID ناقص أو غير رقمي." };
  }

  const resolved = await resolveWabaId(token, phoneNumberId);
  const wabaId = resolved.wabaId || "";
  if (!wabaId) {
    return { ok: false, message: resolved.error || "تعذّر قراءة حساب واتساب (WABA)." };
  }

  const override = await graphFormPost(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    access_token: token,
    override_callback_uri: META_INBOUND_CALLBACK,
    verify_token: verifyToken,
  });
  if (override.ok) {
    return { ok: true, message: "تم ربط وارد ميتا. أرسل رسالة إلى رقم المنشأة، لا ترد داخل الإرسال التجريبي فقط." };
  }

  const plain = await graphFormPost(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    access_token: token,
  });
  if (plain.ok) {
    return {
      ok: true,
      message:
        "اشتُرك التطبيق في الحساب. إن لم يصل الوارد، اضبط Callback URL في ميتا على https://mken.live/api/whatsapp-webhook",
    };
  }

  const last = graphErrorMessage(override.data) || graphErrorMessage(plain.data);
  return {
    ok: false,
    message:
      explainGraphTokenError(last) ||
      "تعذّر ربط وارد ميتا. في developers.facebook.com → WhatsApp → Configuration ضع Callback URL: https://mken.live/api/whatsapp-webhook واشترك في حقل messages.",
  };
}

export async function subscribeTenantWhatsappWebhook(
  tenantSlug: string
): Promise<{ ok: boolean; message: string }> {
  const row = await fetchTenantRow(canonicalTenantSlug(tenantSlug));
  if (!row) return { ok: false, message: "المنشأة غير موجودة" };
  const stored = readStored(tenantWhatsappRaw(row.config_data));
  if (stored.provider !== "whatsapp_business") {
    return { ok: false, message: "اختر WhatsApp Cloud API ثم احفظ" };
  }
  if (!stored.token || !stored.phoneNumberId) {
    return { ok: false, message: "Phone Number ID والتوكن مطلوبان لربط الوارد" };
  }
  return subscribeCloudApiWebhook(stored.token, stored.phoneNumberId);
}

export async function logInboundWhatsapp(
  tenantSlug: string,
  phone: string,
  body: string,
  provider: string
): Promise<void> {
  await insertWhatsappLog(tenantSlug, {
    phone,
    body,
    provider,
    status: "received",
    eventType: "inbound",
  });
}

async function insertWhatsappLog(
  tenantSlug: string,
  entry: {
    phone: string;
    body: string;
    provider: string;
    status: string;
    errorMessage?: string;
    eventType: string;
    appointmentId?: string | null;
    retryCount?: number;
  }
): Promise<void> {
  const db = getServiceRoleDb() || getTenantDb();
  if (!db) return;
  await db.from("mken_whatsapp_logs").insert({
    tenant_slug: tenantSlug,
    phone: entry.phone,
    body: entry.body,
    provider: entry.provider,
    status: entry.status,
    error_message: entry.errorMessage || null,
    event_type: entry.eventType,
    appointment_id: entry.appointmentId || null,
    retry_count: entry.retryCount || 0,
  });
}

async function dispatchWhatsapp(
  stored: WhatsappApiStored,
  phone: string,
  body: string,
  tenantSlug: string,
  eventType = "test"
): Promise<void> {
  if (stored.provider === "custom") {
    if (!stored.url) throw new Error("ناقص رابط Webhook لـ n8n");
    const res = await fetch(stored.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(stored.token ? { Authorization: `Bearer ${stored.token}` } : {}),
      },
      body: JSON.stringify({
        to: phone,
        body,
        event: eventType,
        tenant: tenantSlug,
      }),
    });
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
    return;
  }
  if (stored.provider === "ultramsg") {
    if (!stored.instanceId || !stored.token) throw new Error("ناقص instanceId أو التوكن");
    const params = new URLSearchParams({ token: stored.token, to: phone, body });
    const res = await fetch(`https://api.ultramsg.com/${stored.instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`UltraMsg HTTP ${res.status}`);
    return;
  }

  if (stored.provider === "whatsapp_business") {
    const phoneNumberId = stored.phoneNumberId || stored.instanceId;
    if (!phoneNumberId || !stored.token) throw new Error("ناقص رقم الواتساب أو التوكن");
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stored.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(explainWhatsappCloudError(res.status, raw));
    }
    try {
      const data = JSON.parse(raw) as { error?: unknown };
      if (data.error) throw new Error(explainWhatsappCloudError(res.status, raw));
    } catch (err) {
      if (err instanceof SyntaxError) return;
      throw err;
    }
    return;
  }

  if (stored.provider === "twilio") {
    if (!stored.accountSid || !stored.token || !stored.fromNumber) {
      throw new Error("ناقص بيانات Twilio");
    }
    const from = stored.fromNumber.replace(/^\+?/, "+");
    const params = new URLSearchParams({
      Body: body,
      From: `whatsapp:${from}`,
      To: `whatsapp:+${phone}`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${stored.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${stored.accountSid}:${stored.token}`).toString("base64")}`,
        },
        body: params.toString(),
      }
    );
    if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`);
    return;
  }

  throw new Error("اختر مزود واتساب أولاً");
}

export type WhatsappOutboundEvent =
  | "test"
  | "crm_reply"
  | "review_request"
  | "review_followup"
  | "reminder"
  | "subscription_reminder"
  | "subscription_expired"
  | "trial_reminder"
  | "marketing_campaign"
  | "confirmation"
  | "order_confirmation"
  | "chatbot_reply";

export async function sendOutboundWhatsapp(
  tenantSlug: string,
  phoneRaw: string,
  bodyRaw: string,
  eventType: WhatsappOutboundEvent,
  opts?: { appointmentId?: string | null; maxBody?: number; credentialsSlug?: string }
): Promise<{ error?: string }> {
  const credentialsSlug = opts?.credentialsSlug || tenantSlug;
  const row = await fetchTenantRow(credentialsSlug);
  if (!row) return { error: "المنشأة غير موجودة" };

  const waRaw = tenantWhatsappRaw(row.config_data);
  const stored = readStored(waRaw);
  if (!whatsappApiIsReady(waRaw)) {
    return { error: whatsappNotReadyMessage(waRaw) };
  }

  const phone = normalizeWaPhone(phoneRaw);
  const body = bodyRaw.trim();
  const maxBody = opts?.maxBody ?? 1000;
  if (!phone) return { error: "رقم الجوال غير صالح" };
  if (stored.provider === "whatsapp_business") {
    const phoneIssue = whatsappPhoneIssue(phoneRaw);
    if (phoneIssue) return { error: phoneIssue };
  }
  if (!body) return { error: "نص الرسالة فارغ" };
  if (body.length > maxBody) return { error: `النص أطول من ${maxBody} حرف` };

  try {
    await dispatchWhatsapp(stored, phone, body, tenantSlug, eventType);
    await insertWhatsappLog(tenantSlug, {
      phone,
      body,
      provider: stored.provider,
      status: "success",
      eventType,
      appointmentId: opts?.appointmentId,
    });
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل الإرسال";
    await insertWhatsappLog(tenantSlug, {
      phone,
      body,
      provider: stored.provider,
      status: "failed",
      errorMessage: message,
      eventType,
      appointmentId: opts?.appointmentId,
    });
    return { error: message };
  }
}

export async function retryFailedWhatsappLog(log: {
  id: string;
  tenant_slug?: string | null;
  phone?: string | null;
  body?: string | null;
  retry_count?: number | null;
}): Promise<{ error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const tenantSlug = log.tenant_slug || "default";
  const row = await fetchTenantRow(tenantSlug);
  const waRaw = tenantWhatsappRaw(row?.config_data);
  const stored = readStored(waRaw);
  if (!whatsappApiIsReady(waRaw)) {
    return { error: whatsappNotReadyMessage(waRaw) };
  }

  const phone = normalizeWaPhone(log.phone || "");
  const body = (log.body || "").trim();
  if (!phone || !body) return { error: "سجل غير صالح لإعادة المحاولة" };

  const nextRetry = (Number(log.retry_count) || 0) + 1;
  try {
    await dispatchWhatsapp(stored, phone, body, tenantSlug, "retry");
    await db
      .from("mken_whatsapp_logs")
      .update({ status: "success", error_message: null, retry_count: nextRetry })
      .eq("id", log.id);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل الإرسال";
    await db
      .from("mken_whatsapp_logs")
      .update({ error_message: message, retry_count: nextRetry })
      .eq("id", log.id);
    return { error: message };
  }
}

export async function sendTestWhatsapp(
  tenantSlug: string,
  phoneRaw: string,
  bodyRaw: string
): Promise<{ error?: string }> {
  return sendOutboundWhatsapp(tenantSlug, phoneRaw, bodyRaw, "test");
}

export const CAMPAIGN_TARGETS = ["all", "booking", "order"] as const;
export type CampaignTarget = (typeof CAMPAIGN_TARGETS)[number];
export const CAMPAIGN_MAX_RECIPIENTS = 40;

export async function sendCampaignWhatsapp(
  tenantSlug: string,
  targetRaw: string,
  templateRaw: string
): Promise<{ sent?: number; failed?: number; total?: number; truncated?: boolean; error?: string }> {
  const target = (CAMPAIGN_TARGETS as readonly string[]).includes(targetRaw)
    ? (targetRaw as CampaignTarget)
    : null;
  if (!target) return { error: "فئة الحملة غير صالحة" };

  const template = templateRaw.trim();
  if (!template) return { error: "نص الرسالة فارغ" };
  if (template.length > 1000) return { error: "نص الحملة أطول من 1000 حرف" };

  const row = await fetchTenantRow(tenantSlug);
  if (!row) return { error: "المنشأة غير موجودة" };

  const waRaw = tenantWhatsappRaw(row.config_data);
  const stored = readStored(waRaw);
  if (!whatsappApiIsReady(waRaw)) {
    return { error: whatsappNotReadyMessage(waRaw) };
  }

  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const brandName = row.config_data?.brand?.name || row.business_name || tenantSlug;
  const targets = new Map<string, string>();

  if (target === "all" || target === "booking") {
    const { data } = await db
      .from("mken_appointments")
      .select("phone, customer_name")
      .eq("tenant_slug", tenantSlug)
      .limit(500);
    for (const item of data || []) {
      const phone = normalizeWaPhone(String((item as { phone?: string }).phone || ""));
      if (!phone || targets.has(phone)) continue;
      targets.set(phone, String((item as { customer_name?: string }).customer_name || "عميل"));
    }
  }

  if (target === "all" || target === "order") {
    const { data } = await db
      .from("mken_orders")
      .select("phone, customer_name")
      .eq("tenant_slug", tenantSlug)
      .limit(500);
    for (const item of data || []) {
      const phone = normalizeWaPhone(String((item as { phone?: string }).phone || ""));
      if (!phone || targets.has(phone)) continue;
      targets.set(phone, String((item as { customer_name?: string }).customer_name || "عميل"));
    }
  }

  const list = [...targets.entries()].map(([phone, customerName]) => ({ phone, customerName }));
  if (!list.length) return { error: "لا يوجد عملاء مستهدفون في هذه الفئة" };

  const truncated = list.length > CAMPAIGN_MAX_RECIPIENTS;
  const batch = list.slice(0, CAMPAIGN_MAX_RECIPIENTS);
  let sent = 0;
  let failed = 0;

  for (const client of batch) {
    const body = template
      .replaceAll("{customerName}", client.customerName)
      .replaceAll("{brandName}", brandName);
    try {
      await dispatchWhatsapp(stored, client.phone, body, tenantSlug, "marketing_campaign");
      await insertWhatsappLog(tenantSlug, {
        phone: client.phone,
        body,
        provider: stored.provider,
        status: "success",
        eventType: "marketing_campaign",
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      await insertWhatsappLog(tenantSlug, {
        phone: client.phone,
        body,
        provider: stored.provider,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "فشل الإرسال",
        eventType: "marketing_campaign",
      });
    }
  }

  return { sent, failed, total: batch.length, truncated };
}
