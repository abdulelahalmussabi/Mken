import { getTenantDb, TENANT_TABLE } from "@/lib/mken/tenant";
import {
  retryFailedWhatsappLog,
  sendOutboundWhatsapp,
} from "@/lib/mken/whatsapp";

type TenantCronRow = {
  id: string;
  tenant_slug: string;
  business_name?: string | null;
  phone?: string | null;
  subscription_status?: string | null;
  subscription_start?: string | null;
  subscription_end?: string | null;
  reminders_sent?: unknown;
  config_data?: Record<string, unknown> | null;
  saved_config_data?: Record<string, unknown> | null;
};

type AppointmentCronRow = {
  id: string;
  tenant_slug?: string | null;
  status?: string | null;
  date?: string | null;
  time?: string | null;
  phone?: string | null;
  customer_name?: string | null;
  service_id?: string | null;
  activity_id?: string | null;
  party_size?: number | null;
  nights?: number | null;
  location_address?: string | null;
  reminders_sent?: unknown;
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter((n) => n > 0) : [];
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function reminderLeadText(hoursBefore: number): string {
  if (hoursBefore >= 24 && hoursBefore % 24 === 0) {
    const days = hoursBefore / 24;
    return days === 1 ? "غداً" : `خلال ${days} أيام`;
  }
  if (hoursBefore === 1) return "خلال ساعة";
  return `خلال ${hoursBefore} ساعات`;
}

function formatDateArabic(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTimeArabic(time: string): string {
  const parts = time.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const suffix = h < 12 ? "صباحاً" : "مساءً";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${parts[1] || "00"} ${suffix}`;
}

function parseTemplate(templateText: string, data: Record<string, string | number>): string {
  return templateText
    .replace(/{brandName}/g, String(data.brandName || ""))
    .replace(/{customerName}/g, String(data.customerName || ""))
    .replace(/{phone}/g, String(data.phone || ""))
    .replace(/{serviceTitle}/g, String(data.serviceTitle || ""))
    .replace(/{activityTitle}/g, String(data.activityTitle || ""))
    .replace(/{date}/g, String(data.date || ""))
    .replace(/{time}/g, String(data.time || ""))
    .replace(/{appointmentId}/g, String(data.appointmentId || ""))
    .replace(/{hoursBefore}/g, String(data.hoursBefore || ""))
    .replace(/{reminderLeadText}/g, String(data.reminderLeadText || ""));
}

function buildReminderMessage(
  brandName: string,
  appointment: AppointmentCronRow,
  serviceTitle: string,
  activityTitle: string,
  hoursBefore: number
): string {
  const lines = [
    `تذكير بموعدك — ${brandName}`,
    "━━━━━━━━━━━━━━",
    `مرحباً ${appointment.customer_name || ""}،`,
    `نذكّرك بموعدك ${reminderLeadText(hoursBefore)}:`,
  ];
  if (activityTitle) lines.push(`النشاط: ${activityTitle}`);
  lines.push(
    `الخدمة: ${serviceTitle}`,
    `التاريخ: ${formatDateArabic(appointment.date || "")}`,
    `الوقت: ${formatTimeArabic(appointment.time || "00:00")}`
  );
  if (appointment.party_size) lines.push(`عدد الضيوف: ${appointment.party_size}`);
  if (appointment.nights) lines.push(`عدد الليالي: ${appointment.nights}`);
  if (appointment.location_address) lines.push(`العنوان: ${appointment.location_address}`);
  lines.push("━━━━━━━━━━━━━━", "نتطلع لرؤيتك!", "للاستفسار رد على هذه الرسالة.");
  return lines.join("\n");
}

async function sendPlatform(
  phone: string | null | undefined,
  body: string,
  eventType: "subscription_reminder" | "subscription_expired" | "trial_reminder",
  tenantSlug: string
): Promise<{ error?: string }> {
  if (!phone) return { error: "لا يوجد رقم" };
  return sendOutboundWhatsapp(tenantSlug, phone, body, eventType, {
    credentialsSlug: "default",
    maxBody: 4000,
  });
}

export async function runWhatsappCron(): Promise<{ logs: string[]; error?: string }> {
  const db = getTenantDb();
  if (!db) return { logs: [], error: "قاعدة البيانات غير مهيأة على الخادم" };

  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);
  const now = new Date();

  try {
    log("Checking SAAS Tenant Subscriptions...");
    const { data: tenants, error: tenantsError } = await db.from(TENANT_TABLE).select("*");
    if (tenantsError) throw tenantsError;

    for (const raw of tenants || []) {
      const tenant = raw as TenantCronRow;
      if (tenant.tenant_slug === "default") continue;

      const endDate = new Date(tenant.subscription_end || "");
      if (Number.isNaN(endDate.getTime())) continue;

      const timeDiff = endDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      const sentReminders = asStringArray(tenant.reminders_sent);

      if (timeDiff <= 0 && (tenant.subscription_status === "active" || tenant.subscription_status === "trial")) {
        log(`Tenant ${tenant.tenant_slug} subscription expired. Resetting public profile.`);
        const savedConfig = tenant.config_data || {};
        const expiredConfig = {
          brand: {
            name: tenant.business_name || "مكِّن للخدمات",
            tagline: "عذراً، هذا الحساب منتهي الصلاحية حالياً. يرجى تجديد الاشتراك للوصول إلى الخدمات.",
            logo: "",
          },
          enabledActivities: ["tech-digital"],
          enabled: ["web-design"],
          phone: tenant.phone,
          subscription: {
            status: "expired",
            start: tenant.subscription_start,
            end: tenant.subscription_end,
            businessName: tenant.business_name,
            email: null,
            phone: tenant.phone,
            tenantSlug: tenant.tenant_slug,
          },
        };
        const { error: updateError } = await db
          .from(TENANT_TABLE)
          .update({
            subscription_status: "expired",
            config_data: expiredConfig,
            saved_config_data: savedConfig,
            updated_at: now.toISOString(),
          })
          .eq("id", tenant.id);
        if (updateError) {
          log(`Failed to expire tenant ${tenant.tenant_slug}: ${updateError.message}`);
          continue;
        }
        const expiryMsg = `عذراً شريكنا في منصة مكِّن ⚠️\nانتهى اشتراك نشاطك الموقر (${tenant.business_name}) اليوم.\nتم حفظ كافة بياناتك وإعداداتك بشكل آمن، ولكن تم إرجاع الصفحة العامة للوضع الافتراضي لحين التجديد.\nيرجى الدخول للوحة الإدارة لتجديد الاشتراك واستعادة موقعك فوراً.`;
        const sent = await sendPlatform(tenant.phone, expiryMsg, "subscription_expired", tenant.tenant_slug);
        log(
          sent.error
            ? `Failed to send expiration message to ${tenant.tenant_slug}: ${sent.error}`
            : `Expiration alert sent to ${tenant.tenant_slug}`
        );
        continue;
      }

      if (tenant.subscription_status === "trial" && daysDiff > 0) {
        for (const d of [7, 3, 1]) {
          const key = `trial_${d}`;
          if (daysDiff === d && !sentReminders.includes(key)) {
            const trialMsg = `تذكير تجربتك المجانية — مكن 🔔\nمرحباً ${tenant.business_name}،\nبقي ${d} ${d === 1 ? "يوم" : "أيام"} على انتهاء تجربتك المجانية (14 يوم).\nأكمل ربط الزكاة وواتساب CRM الآن، أو رقِّ باقتك للاستمرار:\nhttps://license.mken.live`;
            const sent = await sendPlatform(tenant.phone, trialMsg, "trial_reminder", tenant.tenant_slug);
            if (sent.error) {
              log(`Failed to send trial reminder to ${tenant.tenant_slug}: ${sent.error}`);
              continue;
            }
            sentReminders.push(key);
            await db
              .from(TENANT_TABLE)
              .update({ reminders_sent: sentReminders, updated_at: now.toISOString() })
              .eq("id", tenant.id);
            log(`Trial reminder (${d}d) sent to ${tenant.tenant_slug}`);
          }
        }
        continue;
      }

      if (tenant.subscription_status === "active") {
        let reminderDays: number | null = null;
        if (daysDiff <= 14 && daysDiff > 0 && !sentReminders.includes("14")) reminderDays = 14;
        else if (daysDiff <= 30 && daysDiff > 14 && !sentReminders.includes("30")) reminderDays = 30;

        if (reminderDays !== null) {
          const textTime = reminderDays === 30 ? "شهر واحد (30 يوماً)" : "أسبوعين (14 يوماً)";
          const reminderMsg = `تنبيه تجديد الاشتراك — منصة مكِّن 🔔\nشريكنا العزيز في (${tenant.business_name})، نود تذكيرك بأن اشتراكك سينتهي بعد ${textTime} بتاريخ ${endDate.toLocaleDateString("ar-EG")}.\nيرجى تجديد الاشتراك مبكراً لضمان استمرار عمل موقعك وتلقي حجوزات عملائك دون انقطاع. 🚀`;
          const sent = await sendPlatform(tenant.phone, reminderMsg, "subscription_reminder", tenant.tenant_slug);
          if (sent.error) {
            log(`Failed to send reminder to ${tenant.tenant_slug}: ${sent.error}`);
          } else {
            sentReminders.push(String(reminderDays));
            await db
              .from(TENANT_TABLE)
              .update({ reminders_sent: sentReminders, updated_at: now.toISOString() })
              .eq("id", tenant.id);
            log(`Sent ${reminderDays}d reminder for ${tenant.tenant_slug}`);
          }
        }
      }
    }

    log("Checking active appointments...");
    const { data: appointments, error: aptError } = await db
      .from("mken_appointments")
      .select("*")
      .eq("status", "confirmed");
    if (aptError) throw aptError;

    const list = (appointments || []) as AppointmentCronRow[];
    log(`Checking ${list.length} confirmed appointments...`);
    const tenantConfigs = new Map<string, Record<string, unknown>>();

    for (const apt of list) {
      const aptTime = new Date(`${apt.date}T${apt.time || "00:00"}:00`);
      if (Number.isNaN(aptTime.getTime()) || aptTime <= now) continue;

      const sent = asNumberArray(apt.reminders_sent);
      const tenantSlug = apt.tenant_slug || "default";
      let tenantConfig = tenantConfigs.get(tenantSlug);
      if (!tenantConfig) {
        const { data: row } = await db
          .from(TENANT_TABLE)
          .select("config_data")
          .eq("tenant_slug", tenantSlug)
          .maybeSingle();
        tenantConfig = obj(row?.config_data);
        tenantConfigs.set(tenantSlug, tenantConfig);
      }

      const wa = obj(tenantConfig.whatsappApi);
      if (!wa.enabled || wa.provider === "none" || !wa.sendReminder) continue;
      const reminders = obj(wa.reminders || obj(tenantConfig.booking).reminders);
      if (reminders.enabled === false) continue;

      const hoursBefore = (Array.isArray(reminders.hoursBefore) ? reminders.hoursBefore : [24, 2])
        .map((h) => parseInt(String(h), 10))
        .filter((h) => h > 0);

      for (const hours of hoursBefore) {
        if (sent.includes(hours)) continue;
        const remindAt = new Date(aptTime.getTime() - hours * 60 * 60 * 1000);
        if (!(now >= remindAt && now < aptTime)) continue;

        const services = obj(tenantConfig.services);
        const activities = obj(tenantConfig.activities);
        const serviceTitle = String(obj(services[apt.service_id || ""]).title || apt.service_id || "");
        const activityTitle = String(obj(activities[apt.activity_id || ""]).title || apt.activity_id || "");
        const brandName = String(obj(tenantConfig.brand).name || "المنشأة الموقرة");
        const customTemplate = String(obj(wa.templates).reminder || "");
        const body = customTemplate
          ? parseTemplate(customTemplate, {
              brandName,
              customerName: apt.customer_name || "",
              phone: apt.phone || "",
              serviceTitle,
              activityTitle,
              date: formatDateArabic(apt.date || ""),
              time: formatTimeArabic(apt.time || "00:00"),
              appointmentId: apt.id,
              hoursBefore: hours,
              reminderLeadText: reminderLeadText(hours),
            })
          : buildReminderMessage(brandName, apt, serviceTitle, activityTitle, hours);

        const result = await sendOutboundWhatsapp(tenantSlug, apt.phone || "", body, "reminder", {
          appointmentId: apt.id,
          maxBody: 4000,
        });
        if (result.error) {
          log(`Failed reminder ${hours}h for ${apt.id}: ${result.error}`);
          continue;
        }
        sent.push(hours);
        await db
          .from("mken_appointments")
          .update({ reminders_sent: sent, updated_at: now.toISOString() })
          .eq("id", apt.id);
        log(`Sent reminder ${hours}h for appointment ${apt.id}`);
      }
    }

    log("Checking failed WhatsApp messages to retry...");
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: failedLogs, error: logsError } = await db
      .from("mken_whatsapp_logs")
      .select("id, tenant_slug, phone, body, retry_count")
      .eq("status", "failed")
      .lt("retry_count", 3)
      .gt("created_at", oneDayAgo);

    if (logsError) {
      log(`Failed to fetch failed logs: ${logsError.message}`);
    } else {
      for (const item of failedLogs || []) {
        const retried = await retryFailedWhatsappLog(item);
        log(
          retried.error
            ? `Retry failed for log ${item.id}: ${retried.error}`
            : `Retried log ${item.id}`
        );
      }
    }

    log("Cron job execution finished successfully.");
    return { logs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل الكرون";
    log(`Cron Job Failed: ${message}`);
    return { logs, error: message };
  }
}
