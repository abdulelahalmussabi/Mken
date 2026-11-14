'use strict';

/**
 * api/_lib/cst-time-guard.js
 * محرك الامتثال الزمني والخصوصية للرسائل السحابية بالمملكة العربية السعودية
 * متوافق مع: ضوابط هيئة الاتصالات والفضاء والتقنية (CST Anti-Spam) ونظام PDPL (سدايا)
 */

// المنطقة الزمنية الرسمية للمملكة العربية السعودية: آسيا/الرياض (توقيت مكة المكرمة UTC+3)
const KSA_TIMEZONE = 'Asia/Riyadh';

/**
 * استخراج الساعة والدقيقة الحالية بتوقيت مكة المكرمة
 */
function getKsaTimeDetails(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  
  // تنسيق الوقت بالمنطقة الزمنية الرسمية للرياض
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KSA_TIMEZONE,
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(d);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  return {
    hour: hour,
    minute: minute,
    second: second,
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    timeString: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
  };
}

/**
 * 1. التحقق من مطابقة توقيت الإرسال لنافذة هيئة الاتصالات CST المسموحة
 * تُلزم الهيئة بحظر إرسال الرسائل الإعلانية والتنبيهية الآلية بين 9:00 مساءً و 9:00 صباحاً.
 * النافذة القانونية المسموحة حصراً: من 09:00:00 صباحاً حتى 21:00:00 مساءً بتوقيت مكة المكرمة.
 */
function isWithinCstAllowedHours(date = new Date()) {
  const { hour, minute, second } = getKsaTimeDetails(date);

  // قبل 9:00 صباحاً ممنوع تماماً
  if (hour < 9) return false;

  // بعد 21:00 (9 مساءً) ممنوع تماماً
  if (hour > 21) return false;

  // عند الساعة 21 تماماً: يُسمح بالثانية 00 فقط، بعدها يُقفل الباب
  if (hour === 21 && (minute > 0 || second > 0)) return false;

  return true;
}

/**
 * 2. حساب موعد فتح النافذة القانونية التالية (الساعة 9:00 صباحاً بتوقيت مكة)
 * لتأجيل وإعادة جدولة الرسائل الممنوعة ليلاً
 */
function getNextAllowedCstWindow(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const { hour, year, month, day } = getKsaTimeDetails(d);

  // إذا كنا ليلاً بعد التاسعة مساءً (أو قبل الفجر)، النافذة القادمة هي 9 صباحاً
  // حساب فرق التوقيت بين خادم النظم وتوقيت الرياض (UTC+3)
  const ksaDate = new Date(Date.UTC(year, month - 1, day, hour < 9 ? 6 : 6, 0, 0)); // 06:00 UTC = 09:00 KSA
  
  if (hour >= 21) {
    // ترحيل لصباح اليوم التالي
    ksaDate.setUTCDate(ksaDate.getUTCDate() + 1);
  }

  return ksaDate;
}

/**
 * 3. فحص نية إلغاء الاشتراك (Opt-Out Detection) وفق نظام PDPL (سدايا)
 * كلمات مفتاحية معيارية بالعربية والإنجليزية
 */
const OPT_OUT_KEYWORDS = [
  'إلغاء الاشتراك',
  'الغاء الاشتراك',
  'إلغاء',
  'الغاء',
  'وقف',
  'قف',
  'توقف',
  'stop',
  'unsubscribe',
  'cancel',
  'arret'
];

function isOptOutIntent(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase().replace(/[\u064B-\u065F]/g, ''); // إزالة التشكيل
  return OPT_OUT_KEYWORDS.some(kw => clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw));
}

/**
 * 4. فحص نية إعادة التفعيل (Opt-In / Resubscribe Detection)
 */
const OPT_IN_KEYWORDS = [
  'تفعيل',
  'اعادة تفعيل',
  'إعادة تفعيل',
  'اشتراك',
  'ابدأ',
  'start',
  'unstop',
  'subscribe'
];

function isOptInIntent(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase().replace(/[\u064B-\u065F]/g, '');
  return OPT_IN_KEYWORDS.some(kw => clean === kw || clean.startsWith(kw + ' '));
}

/**
 * 5. فحص ما إذا كان الرقم مدرجاً في قائمة حظر الإرسال (Do Not Contact - DNC)
 */
async function isPhoneOptedOut(supabase, phone, tenantSlug = 'default') {
  if (!supabase || !phone) return false;
  try {
    const { data, error } = await supabase
      .from('mken_dnc_list')
      .select('is_active')
      .eq('phone', phone)
      .eq('tenant_slug', tenantSlug)
      .maybeSingle();

    if (error || !data) return false;
    return Boolean(data.is_active);
  } catch (err) {
    console.error('[CST Guard] Error checking DNC list:', err.message);
    return false;
  }
}

/**
 * 6. تسجيل أو تحديث حالة الرقم في قائمة حظر الإرسال
 */
async function setPhoneDncStatus(supabase, phone, tenantSlug = 'default', isActive = true, reason = 'customer_opt_out') {
  if (!supabase || !phone) return false;
  try {
    const { error } = await supabase
      .from('mken_dnc_list')
      .upsert({
        phone: phone,
        tenant_slug: tenantSlug,
        reason: reason,
        is_active: isActive,
        opted_out_at: isActive ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone,tenant_slug' });

    return !error;
  } catch (err) {
    console.error('[CST Guard] Error updating DNC list:', err.message);
    return false;
  }
}

/**
 * 7. فحص نافذة الـ 24 ساعة لخدمة العملاء من Meta
 * تقضي سياسة واتساب بأن أي رسالة بعد 24 ساعة من آخر تفاعل للعميل يجب أن تكون قالب معتمد
 */
function isWithin24HourWindow(lastCustomerMessageTime) {
  if (!lastCustomerMessageTime) return false;
  const lastTime = new Date(lastCustomerMessageTime).getTime();
  if (isNaN(lastTime)) return false;
  const now = Date.now();
  const diffHours = (now - lastTime) / (1000 * 60 * 60);
  return diffHours <= 24.0;
}

/**
 * 8. صياغة حمولة قالب Meta الرسمي للرسائل التذكيرية المعتمدة
 */
function buildMetaTemplatePayload(phone, templateName, languageCode = 'ar', parameters = []) {
  const componentParams = parameters.map(val => ({
    type: 'text',
    text: String(val)
  }));

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'body',
          parameters: componentParams
        }
      ]
    }
  };
}

module.exports = {
  KSA_TIMEZONE: KSA_TIMEZONE,
  getKsaTimeDetails: getKsaTimeDetails,
  isWithinCstAllowedHours: isWithinCstAllowedHours,
  getNextAllowedCstWindow: getNextAllowedCstWindow,
  isOptOutIntent: isOptOutIntent,
  isOptInIntent: isOptInIntent,
  isPhoneOptedOut: isPhoneOptedOut,
  setPhoneDncStatus: setPhoneDncStatus,
  isWithin24HourWindow: isWithin24HourWindow,
  buildMetaTemplatePayload: buildMetaTemplatePayload
};
