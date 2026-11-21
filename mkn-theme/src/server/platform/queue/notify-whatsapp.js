'use strict';

/**
 * منصة مكّن (mken.live) — نظام إشعارات واتساب لطابور الانتظار والطلبات
 * POST /api/v1/queue/notify-whatsapp
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const cstGuard = require('../_lib/cst-time-guard');

/**
 * صياغة نص الرسالة بالعربية بحسب نوع الحدث
 */
function buildMessageContent(eventType, data) {
  data = data || {};
  const ticketNumber = data.ticket_number || data.ticketNumber || 'A-001';
  const queueName = data.queue_name || data.queueName || 'الخدمة';
  const customerName = data.customer_name || data.customerName || 'عميلنا العزيز';
  const total = data.total ? `${Number(data.total).toFixed(2)} ر.س` : '';
  const etaMinutes = data.eta_minutes || data.eta || '5';
  const counterName = data.counter_name || data.counterName || (data.counter_number ? `كاونتر ${data.counter_number}` : 'كاونتر الخدمة');
  const sessionUrl = data.session_url || `https://mken.live/q/${ticketNumber}`;

  let title = '';
  let body = '';

  switch (eventType) {
    case 'ticket_issued':
      title = `🎟️ تم إصدار رقمك: *${ticketNumber}*`;
      body = `مرحباً ${customerName}،\nتم تأكيد طلبك وإصدار رقم الطابور بنجاح!\n\n` +
        `• *الرقم:* ${ticketNumber}\n` +
        `• *القسم:* ${queueName}\n` +
        (total ? `• *إجمالي الحساب:* ${total}\n` : '') +
        `• *وقت الانتظار التقريبي:* ~${etaMinutes} دقيقة\n\n` +
        (data.items_summary ? `📋 *تفاصيل الطلب:*\n${data.items_summary}\n\n` : '') +
        `📲 *تابع موقعك الحي في الطابور:*\n${sessionUrl}`;
      break;

    case 'almost_called':
      const ahead = data.ahead_count != null ? data.ahead_count : 1;
      title = `⚡ اقترب دورك: *${ticketNumber}*`;
      body = `تنبيه: أنت الآن التالي في الطابور لمسار (*${queueName}*)، تفصلك ${ahead} تذكرة فقط.\n` +
        `يرجى التواجد بالقرب من منطقة الاستلام أو شاشة العرض.\n` +
        `رقمك: *${ticketNumber}*`;
      break;

    case 'called':
      title = `🔔 حان دورك الآن! — *${ticketNumber}*`;
      body = `تفضل الآن إلى: *${counterName}*\n` +
        `• *رقم التذكرة:* ${ticketNumber}\n` +
        (data.table_number ? `• *طاولة:* ${data.table_number}\n` : '') +
        `طلبك قيد التحضير والتجهيز، يسعدنا خدمتك!`;
      break;

    case 'order_ready':
      title = `✅ طلبك جاهز للاستلام! — *${ticketNumber}*`;
      body = `عزيزي ${customerName}،\nطلبك للرقم *${ticketNumber}* أصبح جاهزاً بالكامل الآن! ` +
        (data.table_number ? `جارٍ تقديمه لطاولة ${data.table_number}.` : `تفضل باستلامه من ${counterName}.`) +
        `\nصحة وعافية ☕`;
      break;

    case 'prayer_pause':
      const prayerName = data.prayer_name || 'الصلاة';
      const resumeMinutes = data.resume_minutes || 20;
      title = `🕌 استراحة صلاة — تذكرتك محفوظة`;
      body = `تقبل الله طاعتكم، استراحة ${prayerName}.\n` +
        `دورك محفوظ بالكامل وسنستأنف خدمتكم فور انتهاء وقت الصلاة (خلال ~${resumeMinutes} دقيقة بإذن الله).\n` +
        `رقمك: *${ticketNumber}*`;
      break;

    default:
      title = `📢 إشعار الطابور — ${ticketNumber}`;
      body = data.message || `إشعار بخصوص التذكرة رقم ${ticketNumber}`;
      break;
  }

  return { title, body, fullText: `${title}\n\n${body}` };
}

/**
 * جلب إعدادات واتساب للمستأجر
 */
async function resolveWhatsAppConfig(tenantSlug) {
  // 1. فحص متغيرات البيئة العامة
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;

  if (envPhoneId && envToken) {
    return { phoneNumberId: envPhoneId, token: envToken, provider: 'whatsapp_business' };
  }

  // 2. فحص قاعدة بيانات المستأجر
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();
  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey);
      const { data } = await sb
        .from('mken_saas_clients')
        .select('config_data')
        .eq('tenant_slug', tenantSlug || 'default')
        .maybeSingle();

      const conf = (data && data.config_data) || {};
      const wa = conf.whatsapp || conf;
      if (wa.phone_number_id && (wa.access_token || wa.token)) {
        return {
          phoneNumberId: wa.phone_number_id,
          token: wa.access_token || wa.token,
          provider: 'whatsapp_business'
        };
      }
    } catch (e) {
      console.warn('[WhatsApp Config Resolve Warning]', e.message);
    }
  }

  return null;
}

/**
 * إرسال إشعار واتساب فعلي أو محاكاة في بيئة الاختبار
 */
async function sendQueueWhatsAppNotification(tenantSlug, phone, eventType, data) {
  if (!phone) {
    return { ok: false, error: 'رقم الجوال غير متوفر.' };
  }

  // تنظيف رقم الهاتف بصيغة دولية (+966)
  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.startsWith('05')) {
    cleanPhone = '966' + cleanPhone.slice(1);
  } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
    cleanPhone = '966' + cleanPhone;
  }

  const { title, body, fullText } = buildMessageContent(eventType, data);
  const waConfig = await resolveWhatsAppConfig(tenantSlug);

  // إذا كانت بيانات واتساب غير متوفرة (بيئة محلية أو تجريبية)، نسجل المحاكاة بنجاح
  if (!waConfig || !waConfig.phoneNumberId || !waConfig.token) {
    return {
      ok: true,
      simulated: true,
      phone: cleanPhone,
      eventType: eventType,
      title: title,
      body: body,
      sentAt: new Date().toISOString()
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${waConfig.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + waConfig.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: fullText }
      })
    });

    const resJson = await res.json();
    if (res.ok) {
      return { ok: true, messageId: resJson.messages?.[0]?.id, simulated: false };
    }
    return { ok: false, error: resJson.error?.message || 'فشل إرسال رسالة واتساب' };
  } catch (err) {
    console.warn('[WhatsApp Dispatch Error]', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * معالج الـ Serverless Handler
 */
module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'طريقة غير مقبولة. يرجى استخدام POST.' });
  }

  const body = req.body || {};
  const tenantSlug = body.tenant || body.tenantSlug || 'default';
  const phone = body.phone || body.customer_phone;
  const eventType = body.eventType || body.event_type || 'ticket_issued';
  const data = body.data || body;

  const result = await sendQueueWhatsAppNotification(tenantSlug, phone, eventType, data);
  return res.status(result.ok ? 200 : 400).json(result);
};

module.exports.sendQueueWhatsAppNotification = sendQueueWhatsAppNotification;
module.exports.buildMessageContent = buildMessageContent;
