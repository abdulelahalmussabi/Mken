import { getTenantDb, fetchTenantRow, TENANT_TABLE } from "@/lib/mken/tenant";

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
  return typeof value === "boolean" ? value : fallback;
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

export async function fetchWhatsappApi(
  tenantSlug: string
): Promise<{ config?: WhatsappApiPublic; error?: string }> {
  const row = await fetchTenantRow(tenantSlug);
  if (!row) return { error: "المنشأة غير موجودة" };
  return { config: toPublicWhatsappApi(readStored(row.config_data?.whatsappApi), tenantSlug) };
}

export async function saveWhatsappApi(
  tenantSlug: string,
  patch: Partial<WhatsappApiPublic> & { token?: string; gatewayToken?: string }
): Promise<{ config?: WhatsappApiPublic; error?: string }> {
  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const row = await fetchTenantRow(tenantSlug);
  if (!row) return { error: "المنشأة غير موجودة" };

  const current = readStored(row.config_data?.whatsappApi);
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
    token: patch.token?.trim() ? patch.token.trim() : current.token,
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

  const config = { ...(row.config_data || {}), whatsappApi: next, updatedAt: new Date().toISOString() };
  const { error } = await db.from(TENANT_TABLE).update({ config_data: config }).eq("tenant_slug", tenantSlug);
  if (error) return { error: "تعذّر حفظ إعدادات واتساب" };
  return { config: toPublicWhatsappApi(next, tenantSlug) };
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
  }
): Promise<void> {
  const db = getTenantDb();
  if (!db) return;
  await db.from("mken_whatsapp_logs").insert({
    tenant_slug: tenantSlug,
    phone: entry.phone,
    body: entry.body,
    provider: entry.provider,
    status: entry.status,
    error_message: entry.errorMessage || null,
    event_type: entry.eventType,
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
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
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
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud HTTP ${res.status}`);
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

export async function sendOutboundWhatsapp(
  tenantSlug: string,
  phoneRaw: string,
  bodyRaw: string,
  eventType: "test" | "crm_reply"
): Promise<{ error?: string }> {
  const row = await fetchTenantRow(tenantSlug);
  if (!row) return { error: "المنشأة غير موجودة" };

  const stored = readStored(row.config_data?.whatsappApi);
  if (!stored.enabled || stored.provider === "none") {
    return { error: "واتساب غير مفعّل لهذه المنشأة" };
  }

  const phone = normalizeWaPhone(phoneRaw);
  const body = bodyRaw.trim();
  if (!phone) return { error: "رقم الجوال غير صالح" };
  if (!body) return { error: "نص الرسالة فارغ" };
  if (body.length > 1000) return { error: "النص أطول من 1000 حرف" };

  try {
    await dispatchWhatsapp(stored, phone, body, tenantSlug, eventType);
    await insertWhatsappLog(tenantSlug, {
      phone,
      body,
      provider: stored.provider,
      status: "success",
      eventType,
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
    });
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

  const stored = readStored(row.config_data?.whatsappApi);
  if (!stored.enabled || stored.provider === "none") {
    return { error: "واتساب غير مفعّل لهذه المنشأة" };
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
