import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createPublicAppointment } from "@/lib/mken/appointments";
import { rememberCtwaClid, sendMetaCapiEvent } from "@/lib/mken/meta-ads";
import { handleReviewRatingReply } from "@/lib/mken/review-funnel";
import { listOpenSlots } from "@/lib/mken/slots";
import { fetchTenantRow, getServiceRoleDb, TENANT_TABLE } from "@/lib/mken/tenant";
import { generateAIReply, resolveSiteDomain } from "@/lib/mken/whatsapp-ai-agent";
import { matchCannedReply } from "@/lib/mken/whatsapp-canned-replies";
import {
  logInboundWhatsapp,
  normalizeWaPhone,
  sendOutboundWhatsapp,
  whatsappApiIsReady,
} from "@/lib/mken/whatsapp";

type Json = Record<string, unknown>;

type ToolCall = {
  type: "tool_call";
  name: string;
  args: Record<string, string | undefined>;
};

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const AR_DAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function waConfig(config: Json) {
  return asRecord(config.whatsappApi);
}

function waEnabled(config: Json): boolean {
  return whatsappApiIsReady(config.whatsappApi);
}

function waPhoneNumberId(config: Json): string {
  const wa = waConfig(config);
  return str(wa.phoneNumberId) || (str(wa.provider) === "whatsapp_business" ? str(wa.instanceId) : "");
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(parts[1], expected);
}

function formatDateArabic(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function formatTimeArabic(time: string): string {
  try {
    const parts = time.split(":");
    const h = Number.parseInt(parts[0], 10);
    const suffix = h < 12 ? "صباحاً" : "مساءً";
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${display}:${parts[1]} ${suffix}`;
  } catch {
    return time;
  }
}

function paymentLink(siteDomain: string, appointmentId: string): string {
  return `https://${siteDomain}/book?apt_id=${appointmentId}`;
}

function extractInteractiveText(message: Json): string {
  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive.button_reply);
  const listReply = asRecord(interactive.list_reply);
  const button = asRecord(message.button);
  return (
    str(buttonReply.title) ||
    str(listReply.title) ||
    str(button.text) ||
    str(buttonReply.id) ||
    str(listReply.id)
  );
}

function parseInbound(
  body: Json,
  contentType: string
): { phone: string; text: string; provider: string; phoneNumberId: string; ctwaClid: string } {
  if (str(body.From) && str(body.Body)) {
    return {
      phone: str(body.From).replace("whatsapp:", "").replace("+", "").trim(),
      text: str(body.Body).trim(),
      provider: "twilio",
      phoneNumberId: "",
      ctwaClid: "",
    };
  }

  const data = asRecord(body.data);
  if (str(data.from) && str(data.body)) {
    return {
      phone: str(data.from).split("@")[0].replace("+", "").trim(),
      text: str(data.body).trim(),
      provider: "ultramsg",
      phoneNumberId: "",
      ctwaClid: "",
    };
  }

  if (str(body.object) === "whatsapp_business_account") {
    const entry = Array.isArray(body.entry) ? asRecord(body.entry[0]) : {};
    const changes = Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : {};
    const value = asRecord(changes.value);
    const metadata = asRecord(value.metadata);
    const messages = Array.isArray(value.messages) ? asRecord(value.messages[0]) : {};
    const phoneNumberId = str(metadata.phone_number_id);
    const from = str(messages.from).replace("+", "").trim();
    const referral = asRecord(messages.referral);
    const ctwaClid = str(referral.ctwa_clid).trim();
    if (!from) {
      return { phone: "", text: "", provider: "whatsapp_business", phoneNumberId, ctwaClid };
    }
    const type = str(messages.type);
    let text = "";
    if (type === "text") text = str(asRecord(messages.text).body).trim();
    else if (type === "interactive" || type === "button") text = extractInteractiveText(messages).trim();
    else text = "[غير مقروء - ميديا/مستند/تفاعل]";
    return { phone: from, text, provider: "whatsapp_business", phoneNumberId, ctwaClid };
  }

  void contentType;
  return { phone: "", text: "", provider: "unknown", phoneNumberId: "", ctwaClid: "" };
}

async function findTenantByPhoneNumberId(phoneNumberId: string) {
  if (!phoneNumberId) return null;
  const db = getServiceRoleDb();
  if (!db) return null;
  const { data } = await db.from(TENANT_TABLE).select("tenant_slug, phone, config_data");
  const rows = Array.isArray(data) ? data : [];
  return (
    rows.find((row) => {
      const config = asRecord(row.config_data);
      return waEnabled(config) && waPhoneNumberId(config) === phoneNumberId;
    }) || null
  );
}

async function findAnyReadyTenant() {
  const db = getServiceRoleDb();
  if (!db) return null;
  const { data } = await db.from(TENANT_TABLE).select("tenant_slug, phone, config_data");
  const rows = Array.isArray(data) ? data : [];
  return rows.find((row) => waEnabled(asRecord(row.config_data))) || null;
}

async function resolveTenant(querySlug: string, phoneNumberId: string) {
  const slug = querySlug.trim().toLowerCase();
  if (phoneNumberId) {
    const matched = await findTenantByPhoneNumberId(phoneNumberId);
    if (matched) return matched;
  }
  if (slug) {
    const row = await fetchTenantRow(slug);
    if (row) return row;
  }
  const fallback = await fetchTenantRow("default");
  if (fallback && waEnabled(asRecord(fallback.config_data))) return fallback;
  return findAnyReadyTenant();
}

async function replyAndLog(tenantSlug: string, phone: string, text: string) {
  return sendOutboundWhatsapp(tenantSlug, phone, text, "chatbot_reply", { maxBody: 4000 });
}

export function whatsappVerifyResponse(request: Request): NextResponse {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const tenantSlug = url.searchParams.get("tenant") || url.searchParams.get("slug") || "default";

  if (!mode && !token) {
    return NextResponse.json({
      ok: true,
      service: "mken-whatsapp-webhook",
      tenant: tenantSlug,
      message: "Webhook endpoint is live. Meta must POST inbound messages here. Subscribe the messages field in developers.facebook.com → WhatsApp → Configuration.",
    });
  }

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "mken_verify_token_2026";
  if (mode === "subscribe" && token && safeEqual(token, verifyToken)) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return new NextResponse("Forbidden: Token mismatch", { status: 403 });
}

export async function handleWhatsappInbound(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const contentType = request.headers.get("content-type") || "";
  let body: Json = {};
  if (contentType.includes("application/json") || rawBody.trim().startsWith("{")) {
    try {
      body = asRecord(JSON.parse(rawBody || "{}"));
    } catch {
      body = {};
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      body[key] = value;
    });
  }

  const url = new URL(request.url);
  const querySlug = url.searchParams.get("tenant") || url.searchParams.get("slug") || "";
  const parsed = parseInbound(body, contentType);
  const db = getServiceRoleDb();
  if (!db) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const tenant = await resolveTenant(querySlug, parsed.phoneNumberId);
  console.info("whatsapp-webhook POST", {
    object: str(body.object) || "none",
    phoneNumberId: parsed.phoneNumberId || "",
    hasPhone: Boolean(parsed.phone),
    hasText: Boolean(parsed.text.trim()),
    tenant: tenant?.tenant_slug || "",
  });
  if (!tenant?.config_data) {
    console.warn("whatsapp-webhook: tenant config not found", { querySlug, phoneNumberId: parsed.phoneNumberId });
    return NextResponse.json({ status: "ignored", message: "Tenant config not found" });
  }

  const tenantSlug = tenant.tenant_slug;
  const config = asRecord(tenant.config_data);
  const wa = waConfig(config);
  if (!waEnabled(config)) {
    console.warn("whatsapp-webhook: WhatsApp API not enabled", { tenantSlug });
    return NextResponse.json({ status: "ignored", message: "WhatsApp API not enabled for tenant" });
  }

  if (str(wa.provider) === "whatsapp_business") {
    const appSecret = process.env.WHATSAPP_APP_SECRET || "";
    const signature = request.headers.get("x-hub-signature-256");
    if (appSecret && signature && !verifyMetaSignature(rawBody, signature, appSecret)) {
      console.warn("whatsapp-webhook: Meta signature failed", { tenantSlug });
      return NextResponse.json({ error: "Forbidden: Invalid Meta signature" }, { status: 403 });
    }
    if (appSecret && !signature) {
      console.warn("whatsapp-webhook: missing x-hub-signature-256, continuing");
    }
  }

  const phone = normalizeWaPhone(parsed.phone);
  if (phone && parsed.ctwaClid) {
    await rememberCtwaClid(tenantSlug, phone, parsed.ctwaClid);
  }
  const bodyText = parsed.text.trim();
  if (!phone || !bodyText) {
    if (phone && parsed.ctwaClid) {
      return NextResponse.json({ status: "ok", message: "ctwa click stored" });
    }
    return NextResponse.json({ status: "ignored", message: "No message contents found" });
  }

  await logInboundWhatsapp(tenantSlug, phone, bodyText, parsed.provider);

  try {
    const review = await handleReviewRatingReply(tenantSlug, phone, bodyText);
    if (review.handled && review.reply) {
      await replyAndLog(tenantSlug, phone, review.reply);
      return NextResponse.json({ status: "success", message: "Review funnel handled" });
    }
  } catch (error) {
    console.warn("whatsapp-webhook: review funnel skipped", error);
  }

  const cleanedMsg = bodyText.toLowerCase();
  const brandName =
    /لوحة التحكم|admin|dashboard|تحكم عامة/i.test(str(asRecord(config.brand).name))
      ? "مكّن لايف"
      : str(asRecord(config.brand).name) || "مكّن لايف";
  const siteDomain = resolveSiteDomain(config);
  let replyText = "";

  const isCancel =
    (cleanedMsg.includes("إلغاء") || cleanedMsg.includes("الغاء") || cleanedMsg.includes("ألغ") || cleanedMsg.includes("الغ")) &&
    (cleanedMsg.includes("موعد") || cleanedMsg.includes("حجز"));

  if (isCancel) {
    const { data: apts } = await db
      .from("mken_appointments")
      .select("*")
      .eq("tenant_slug", tenantSlug)
      .eq("phone", phone)
      .in("status", ["confirmed", "pending"])
      .order("date", { ascending: false })
      .order("time", { ascending: false })
      .limit(1);

    if (apts && apts.length > 0) {
      const apt = apts[0] as Json;
      if (str(apt.payment_status) === "paid") {
        await db
          .from("mken_appointments")
          .update({ cancel_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", apt.id);
        replyText = "طلبك قيد المراجعة ولن يُسترد المبلغ إلا بعد اعتماد المنشأة";
        const merchantPhone = normalizeWaPhone(str(tenant.phone) || str(config.phone));
        if (merchantPhone) {
          const merchantMsg = `⚠️ طلب إلغاء موعد مدفوع يحتاج اعتمادك\nرقم الموعد: ${str(apt.id)}\nالمبلغ: ${apt.payment_amount || 0}\nجوال العميل: ${phone}`;
          void replyAndLog(tenantSlug, merchantPhone, merchantMsg);
        }
      } else {
        await db
          .from("mken_appointments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", apt.id);
        replyText = `تم إلغاء موعدك القادم بنجاح.\nالخدمة: ${str(apt.service_id)}\nالتاريخ: ${formatDateArabic(str(apt.date))} - الوقت: ${formatTimeArabic(str(apt.time))}\n\nنشكرك لتفهمك!`;
      }
    } else {
      replyText = "عذراً، لم نجد أي موعد نشط ومسجل برقم جوالك حالياً لإلغائه.";
    }
  } else {
    let appointmentsInfo = "لا توجد مواعيد قادمة مسجلة لهذا العميل.";
    try {
      const { data: apts } = await db
        .from("mken_appointments")
        .select("service_id,date,time,status")
        .eq("tenant_slug", tenantSlug)
        .eq("phone", phone)
        .in("status", ["confirmed", "pending"])
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(3);
      if (apts && apts.length > 0) {
        appointmentsInfo = apts
          .map(
            (apt, i) =>
              `${i + 1}. ${apt.service_id} — ${formatDateArabic(apt.date)} ${formatTimeArabic(apt.time)} (${
                apt.status === "confirmed" ? "مؤكد" : "قيد الانتظار"
              })`
          )
          .join("\n");
      }
    } catch {
      appointmentsInfo = "";
    }

    let conversationHistory: Array<{ role: string; text: string }> = [];
    try {
      const { data: recentLogs } = await db
        .from("mken_whatsapp_logs")
        .select("event_type, body")
        .eq("tenant_slug", tenantSlug)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(8);
      conversationHistory = (recentLogs || [])
        .reverse()
        .slice(0, -1)
        .map((row) => ({
          role: row.event_type === "inbound" ? "customer" : "agent",
          text: str(row.body),
        }))
        .filter((turn) => turn.text.trim());
    } catch {
      conversationHistory = [];
    }

    let cannedReply = "";
    try {
      cannedReply = String(matchCannedReply(bodyText, config, { conversationHistory, appointmentsInfo }) || "").trim();
    } catch {
      cannedReply = "";
    }

    if (cannedReply) {
      replyText = cannedReply;
    } else {
    const aiReply = (await generateAIReply(
      bodyText,
      config,
      tenantSlug,
      phone,
      appointmentsInfo,
      conversationHistory,
      null
    )) as string | ToolCall;

    if (aiReply && typeof aiReply === "object" && aiReply.type === "tool_call") {
      try {
        const args = aiReply.args || {};
        if (aiReply.name === "list_slots") {
          const date = str(args.date);
          const available = date ? await listOpenSlots({ tenantSlug, date }) : [];
          replyText =
            available.length > 0
              ? `الأوقات المتاحة في ${date} هي:\n${available.join(" | ")}\n\nللحجز، يرجى تزويدي بالوقت المناسب لك والخدمة التي ترغب بها.`
              : `لا توجد أوقات متاحة في ${date || "هذا اليوم"}.`;
        } else if (aiReply.name === "create_booking") {
          const price = Number.parseFloat(String(args.servicePrice || "0").replace(/[^\d.]/g, "")) || 0;
          const booking = await createPublicAppointment({
            tenantSlug,
            customerName: str(args.name) || "عميل واتساب",
            phone,
            date: str(args.date),
            time: str(args.time).slice(0, 5),
            serviceId: str(args.serviceId) || "general",
            serviceName: str(args.serviceName),
            servicePrice: str(args.servicePrice),
            paymentAmount: price > 0 ? price : undefined,
            notes: "عبر واتساب",
          });
          if (booking.error || !booking.appointment) {
            replyText = `عذراً: ${booking.error || "تعذّر إنشاء الحجز"}`;
          } else {
            void sendMetaCapiEvent({
              eventName: "Schedule",
              slug: tenantSlug,
              phone,
              eventId: `book_${booking.appointment.id}`,
              sourceUrl: `https://${siteDomain}/book`,
            });
            replyText = `تم تسجيل حجزك مبدئياً بنجاح! 📅\nالخدمة: ${args.serviceName || args.serviceId}\nالتاريخ: ${args.date}\nالوقت: ${args.time}`;
            const payment = asRecord(config.payment);
            const paymentEnabled = payment.enabled === true && str(payment.provider) !== "none";
            if (price > 0 && paymentEnabled) {
              replyText += `\n\nلإكمال الحجز وتأكيده، يرجى الدفع عبر الرابط التالي:\n${paymentLink(siteDomain, booking.appointment.id)}`;
            } else {
              replyText += `\n\nبانتظار حضورك في الوقت المحدد!`;
            }
          }
        } else {
          replyText = `أعتذر، حدث خطأ أثناء تنفيذ طلبك. يمكنك المحاولة مجدداً أو الحجز عبر الرابط:\nhttps://${siteDomain}/book`;
        }
      } catch (toolErr) {
        replyText = `عذراً: ${toolErr instanceof Error ? toolErr.message : "تعذّر تنفيذ الطلب"}`;
      }
    } else if (typeof aiReply === "string" && aiReply.trim()) {
      replyText = aiReply.trim();
    } else {
      replyText = `مرحباً بك في ${brandName}! 🌟\nأنا سعد مساعدك الذكي 😊\n\nيمكنك الحجز عبر:\n🌐 https://${siteDomain}/book\n\nأو أرسل استفسارك وسأرد عليك مباشرة 💚`;
    }
    }
  }

  if (replyText) {
    const sent = await replyAndLog(tenantSlug, phone, replyText);
    if (sent.error) {
      console.error("whatsapp-webhook: send failed", { tenantSlug, error: sent.error });
    }
  }

  return NextResponse.json({ status: "success", message: "Inbound message processed" });
}
