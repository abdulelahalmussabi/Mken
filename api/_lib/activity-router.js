'use strict';

/**
 * Activity Router — classifies an inbound WhatsApp message into a business
 * activity (activity_id) using keyword rules, and provides context continuity.
 *
 * STRICT DATA ISOLATION: every query/memory fetch downstream is scoped by
 * (tenant_slug, activity_id), so a conversation about one activity never
 * leaks knowledge or context from another activity.
 *
 * This is the keyword-based Phase 1 router. Phase 4 can replace detectActivity
 * with an AI classifier once a stronger model is available.
 */

// ---------- Keyword dictionary ----------
// Order within each activity matters for tie-breaking only; scoring is
// count-based. Strong/cue keywords are weighted higher (see WEIGHTS).
// Only activities the tenant has enabled are considered at runtime.

var KEYWORDS = {
  // PRIORITY 1 — enabled for the mken platform tenant
  'tech-digital': {
    title: 'الحاسب والتقنية الرقمية',
    words: ['موقع', 'مواقع', 'موقع الكتروني', 'موقع إلكتروني', 'تصميم موقع', 'تصميم مواقع',
      'تصميم', 'ويب', 'web', 'website', 'متجر', 'متاجر', 'متجر الكتروني', 'متجر إلكتروني',
      'تجارة الكترونية', 'تجارة إلكترونية', 'ecommerce', 'صفحة', 'صفحات', 'صفحة هبوط',
      'صفحة تعريفية', 'لاندينج', 'landing', 'تطبيق جوال', 'موبايل', 'جوال',
      'seo', 'سيو', 'تحسين محركات البحث', 'ظهور في جوجل', 'ظهور بجوجل', 'بحث جوجل',
      'كلمات مفتاحية', 'واتساب', 'whatsapp', 'crm', 'سي آر ام', 'رد آلي', 'ردود آلية',
      'شات بوت', 'chatbot', 'بوت ذكي', 'سوشيال', 'سوشل', 'سوشيال ميديا', 'وسائل التواصل',
      'انستقرام', 'انستغرام', 'تويتر', 'اكس', 'سناب', 'سناب شات', 'تيك توك', 'منشورات',
      'هوية', 'هوية بصرية', 'شعار', 'لوجو', 'logo', 'علامة تجارية', 'براند', 'تسويق',
      'تسويق رقمي', 'تسويق الكتروني', 'تسويق إلكتروني', 'حملة اعلانية', 'حملة إعلانية',
      'اعلانات', 'إعلانات', 'جوجل ادز', 'google ads', 'استضافة', 'hosting', 'نطاق',
      'domain', 'دومين', 'متجاوب', 'دفع الكتروني', 'دفع إلكتروني', 'مدى', 'آبل باي',
      'shopify', 'ووكومرس', 'woocommerce']
  },

  'it-support': {
    title: 'صيانة الحاسب والشبكات',
    words: ['صيانة', 'صيانة جهاز', 'صيانة كمبيوتر', 'كمبيوتر', 'حاسب', 'حاسب آلي', 'pc',
      'computer', 'لابتوب', 'لاب توب', 'labtop', 'laptop', 'macbook', 'ماك بوك', 'ديل',
      'اسوس', 'جهاز', 'اجهزة', 'أجهزة', 'عطل', 'اعطال', 'أعطال', 'خراب', 'لا يشتغل',
      'معلق', 'بطيء', 'يهنج', 'سواد الشاشة', 'تجميع', 'تجميعة', 'تجميع كمبيوتر',
      'جيمنج', 'gaming', 'اوفيس', 'office', 'ترقية', 'رام', 'ram', 'هارد', 'هاردسك',
      'ssd', 'ذاكرة', 'تخزين', 'شاشة', 'بطارية', 'لوحة ام', 'لوحة مفاتيح', 'كيبورد',
      'تبريد', 'حرارة', 'مروحة', 'ويندوز', 'windows', 'تثبيت', 'تنصيب', 'برامج', 'فورمات',
      'اعادة تثبيت', 'إعادة تثبيت', 'شبكة', 'شبكات', 'network', 'واي فاي', 'وايفاي',
      'wifi', 'راوتر', 'router', 'انترنت', 'نت', 'بطء النت', 'اشارة ضعيفة', 'كابل',
      'كيبل', 'طابعة', 'طابعات', 'printer', 'حبر', 'تعبئة حبر', 'ليزر', 'راس الطباعة',
      'رأس الطباعة', 'استعادة', 'استعادة بيانات', 'استرجاع', 'استرجاع ملفات', 'ملفات محذوفة',
      'فقدت ملفات', 'هاردسك تالف', 'data recovery', 'فيروس', 'فيروسات', 'فيرس', 'مالوير',
      'malware', 'مضاد فيروس', 'انتي فيروس', 'انتيفيروس', 'حماية', 'تأمين', 'اختراق']
  },

  'legal': {
    title: 'المحاماة والاستشارات القانونية',
    words: ['محامي', 'محاماة', 'محامون', 'محامى', 'مكتب محاماة', 'مستشار قانوني',
      'مستشارين قانونيين', 'قانوني', 'قانون', 'قانونية', 'استشارة قانونية', 'استشارة محامي',
      'استشارات قانونية', 'راي قانوني', 'رأي قانوني', 'عقد', 'عقود', 'صياغة عقد',
      'صياغة عقود', 'كتابة عقد', 'اعداد عقد', 'إعداد عقد', 'مراجعة عقد', 'تدقيق عقد',
      'ثغرات', 'بنود', 'تأسيس شركة', 'تاسيس شركة', 'حوكمة', 'لوائح', 'امتثال',
      'سجل تجاري', 'عمالي', 'عامل', 'عمال', 'نزاع عمالي', 'منازعة عمالية', 'فصل تعسفي',
      'مستحقات', 'راتب', 'حقوق عمالية', 'قضية', 'قضايا', 'دعوى', 'محكمة', 'المحكمة',
      'ترافع', 'تمثيل قضائي', 'مذكرة دفاع', 'جلسة', 'لجان', 'احوال شخصية', 'الأحوال الشخصية',
      'طلاق', 'خلع', 'حضانة', 'نفقة', 'ميراث', 'مواريث', 'إرث', 'وصية', 'ظهار',
      'تحكيم', 'وساطة', 'صلح', 'فض منازعات', 'نزاع', 'منازعة', 'نزاعات', 'منظومة',
      'ناجز', 'عدل', 'تراخيص', 'اعتماد']
  },

  'app-development': {
    title: 'تطوير وإدارة التطبيقات',
    words: ['تطوير تطبيقات', 'تطوير تطبيق', 'طور تطبيق', 'طور تطبيقات', 'برمجة تطبيقات',
      'برمجة تطبيق', 'برمجة', 'مبرمج', 'مطور', 'flutter', 'فلاتر', 'react native',
      'ios', 'ايفون', 'آيفون', 'اوس', 'android', 'اندرويد', 'أندرويد', 'app store',
      'google play', 'متجر التطبيقات', 'متجر ابل', 'متجر جوجل', 'aso', 'تحسين متجر',
      'تنزيلات', 'مراجعات', 'تقييمات', 'صيانة تطبيق', 'دعم تطبيق', 'دعم فني', 'تحديث',
      'تحديثات', 'اصلاح اخطاء', 'إصلاح أخطاء', 'bug', 'مراقبة', 'crashlytics',
      'صفحة خصوصية', 'سياسة خصوصية', 'الخصوصية', 'الشروط', 'بنود الاستخدام', 'pdpl',
      'gdpr', 'حماية بيانات', 'امن', 'طهور', 'tahoor', 'سوبر بيز', 'فايربيز', 'firebase',
      'سيرفر', 'api', 'قاعدة بيانات', 'خلفية', 'backend']
  },

  // PRIORITY 2 — broader catalog (active only for tenants that enable them)
  'maintenance': {
    title: 'التشغيل والصيانة',
    words: ['مكيف', 'مكيفات', 'سبليت', 'شباك', 'مركزي', 'كونسول', 'فريون', 'غاز',
      'كمبروسر', 'تبريد', 'تكييف', 'سباكة', 'تسرب', 'تسربات', 'مياه', 'مجاري', 'بالوعة',
      'مسدود', 'انسداد', 'خلاط', 'حنفية', 'تسليك', 'كهرباء', 'انارة', 'إنارة', 'قواطع',
      'تمديد', 'لمبات', 'لوحة كهرباء', 'حشرات', 'حشرة', 'صراصير', 'صرصور', 'نمل', 'بق',
      'فئران', 'قوارض', 'رش', 'مبيدات', 'مبيد', 'تعقيم', 'خزان', 'خزانات', 'تنظيف خزان',
      'تطهير', 'عزل', 'عزل حراري', 'عزل مائي', 'فوم', 'عوازل', 'غسالة', 'غسالات',
      'ثلاجة', 'ثلاجات', 'فرن', 'أفران', 'سخان', 'سخانات', 'بوتاجاز', 'اجهزة منزلية']
  },

  'cleaning': {
    title: 'النظافة والتعقيم',
    words: ['نظافة', 'تنظيف', 'تعقيم', 'بخار', 'سجاد', 'موكيت', 'كنب', 'كنبات', 'كراسي',
      'بقع', 'غسيل سجاد', 'واجهات', 'زجاج', 'غبار', 'دهانات', 'تلميع ارضيات']
  },

  'renovation': {
    title: 'التشطيب والديكور',
    words: ['تشطيب', 'تشطيبات', 'دهان', 'دهانات', 'بوية', 'نقاش', 'نقاشين', 'رطوبة',
      'تشققات', 'نجار', 'نجارة', 'ابواب', 'أبواب', 'باب', 'خزائن', 'مطابخ', 'مطبخ',
      'بلاط', 'سيراميك', 'بورسلان', 'رخام', 'ارضيات', 'جدران', 'ورق جدران', 'ديكور',
      'ديكورات', 'جبس', 'جبسون']
  },

  'security': {
    title: 'الأمن والمراقبة',
    words: ['كاميرات', 'كاميرا', 'مراقبة', 'cctv', 'camera', 'سرقة', 'سارق', 'حماية',
      'حراسة', 'انذار', 'إنذار', 'حساسات', 'مجسات', 'بصمة', 'rfid', 'اقفال ذكية',
      'قفل ذكي', 'منزل ذكي', 'smart home', 'تحكم', 'انتركم', 'intercom', 'جرس', 'حريق',
      'دخان', 'كاشف دخان', 'fire alarm', 'سلامة']
  },

  'barber-salon': {
    title: 'صالونات الحلاقة والتجميل',
    words: ['حلاقة', 'حلاق', 'حلاقين', 'صالون', 'صالونات', 'باربر', 'barber', 'قص شعر',
      'قص', 'تسريحة', 'تصفيف', 'غسيل شعر', 'لحية', 'تهذيب لحية', 'موس', 'ماكينة', 'حف',
      'صبغ', 'صبغة', 'صبغات', 'هايلايت', 'تلوين', 'بشرة', 'عناية بالبشرة', 'تنظيف بشرة',
      'قناع', 'مانيكير', 'باديكير', 'manicure', 'pedicure', 'اظافر', 'أظافر', 'نسائي',
      'كوافيرة', 'كوفير', 'بلو دراي', 'blow dry', 'حلاقة منزلية']
  },

  'car-care': {
    title: 'مغاسل وعناية السيارات',
    words: ['غسيل سيارة', 'غسيل سيارات', 'مغسلة', 'غسالة سيارات', 'تنظيف سيارة', 'كرف',
      'تلميع', 'شمع', 'واكس', 'wax', 'polish', 'لمعان', 'حماية طلاء', 'حجرة المحرك',
      'تنظيف داخلي', 'تفصيل', 'detailing', 'تعطير', 'عجلات', 'دواليب', 'رنجات', 'غسيل متنقل']
  },

  'healthcare': {
    title: 'الخدمات الطبية والصحية',
    words: ['طبيب', 'دكتور', 'كشف طبي', 'استشارة طبية', 'عيادة', 'تشخيص', 'وصفة', 'روشتة',
      'ممرض', 'ممرضة', 'تمريض', 'حقن', 'محاليل', 'ضماد', 'جروح', 'رعاية منزلية', 'مسنين',
      'كبار السن', 'تحاليل', 'تحليل دم', 'سحب دم', 'مختبر', 'علاج طبيعي', 'فيزيو',
      'تاهيل', 'تأهيل', 'اصابة', 'إصابة', 'اسنان', 'أسنان', 'dentist', 'حشو', 'خلع',
      'تقويم', 'استشارة عن بعد', 'تيليميديسن']
  },

  'hotels': {
    title: 'ضيافة وفنادق',
    words: ['فندق', 'فنادق', 'غرفة', 'غرف', 'اقامة', 'إقامة', 'مبيت', 'ليلة', 'ليال',
      'جناح', 'اجنحة', 'أجنحة', 'ديلوكس', 'قياسية', 'شاليه', 'شاليهات', 'استراحة',
      'مزرعة', 'ضيافة', 'فطور', 'افطار', 'إفطار', 'مسبح', 'حجز غرفة', 'حجز فندق']
  },

  'travel': {
    title: 'سفر وسياحة',
    words: ['عمرة', 'عمره', 'معتمر', 'باقة عمرة', 'مكة', 'مدينة', 'سياحة', 'رحلة',
      'رحلات', 'جولة', 'مرشد', 'العيدي', 'سفر', 'دولي', 'دولية', 'تاشيرة', 'فيزا',
      'جواز', 'شهر عسل', 'honeymoon', 'طيران', 'باقة', 'تذاكر']
  },

  'events': {
    title: 'مناسبات وقاعات',
    words: ['قاعة', 'قاعات', 'قاعة اعراس', 'قاعة إعراس', 'قاعة افراح', 'صالة', 'صالات',
      'عرس', 'اعراس', 'أعراس', 'زواج', 'زفاف', 'ملكة', 'خطوبة', 'مؤتمر', 'مؤتمرات',
      'ندوة', 'فعالية', 'فعاليات', 'عيد ميلاد', 'ميلاد', 'حفلة', 'حفلات', 'تنسيق مناسبات']
  }
};

// Cue words that disambiguate overlapping activities. When present, they bump
// the score of the indicated activity (strong signal).
var CUE_WORDS = {
  'app-development': ['طهور', 'tahoor', 'خصوصية', 'سياسة خصوصية', 'pdpl', 'flutter', 'فلاتر',
    'crashlytics', 'aso', 'firebase', 'فايربيز', 'طور تطبيق', 'تطوير تطبيق', 'برمجة تطبيق',
    'برمجة تطبيقات', 'android', 'اندرويد', 'أندرويد', 'ios', 'ايفون', 'app store',
    'google play', 'سوبر بيز', 'سوبربيز'],
  'tech-digital': ['seo', 'سيو', 'سوشيال', 'سوشل', 'انستقرام', 'انستغرام', 'متجر الكتروني',
    'متجر إلكتروني', 'woocommerce', 'shopify', 'logo', 'لوجو', 'هوية بصرية', 'تصميم موقع',
    'تصميم مواقع', 'موقع الكتروني', 'موقع إلكتروني', 'اطلع اول', 'أطلع أول', 'اول جوجل',
    'أول جوجل', 'ظهور بجوجل', 'ظهور في جوجل', 'كلمات مفتاحية', 'جوجل ادز', 'google ads',
    'تسويق رقمي', 'تسويق الكتروني', 'تسويق إلكتروني'],
  'it-support': ['صيانة كمبيوتر', 'لابتوب', 'لاب توب', 'لابتب', 'رام', 'هاردسك', 'ويندوز',
    'طابعة', 'راوتر', 'واي فاي', 'فيروس', 'كمبيوتري', 'جهازي', 'لابتوبي'],
  'maintenance': ['مكيف', 'سبليت', 'سباكة', 'تسرب', 'خزان', 'صراصير', 'غسالة', 'ثلاجة'],
  'legal': ['محامي', 'قانوني', 'محكمة', 'قضية', 'قضيه', 'طلاق', 'حضانة', 'نفقة', 'عقد',
    'صياغة', 'احوال شخصية', 'الأحوال الشخصية', 'نزاع عمالي', 'فصل تعسفي']
};

// WEIGHTS — cue words count more than generic keywords.
var CUE_WEIGHT = 3;
var WORD_WEIGHT = 1;

// ---------- Helpers ----------

function normalize(text) {
  if (!text) return '';
  // Lowercase + normalize Arabic forms
  return String(text).toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '') // strip tashkeel/diacritics
    .replace(/[إأآا]/g, 'ا')              // unify alef
    .replace(/ى/g, 'ي')                   // alef maqsura → ya
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .trim();
}

function includesNormalized(haystack, needle) {
  return haystack.indexOf(normalize(needle)) !== -1;
}

/**
 * Score a single activity against the normalized message.
 * @returns {number} total score
 */
function scoreActivity(activityId, messageNorm) {
  var def = KEYWORDS[activityId];
  if (!def) return 0;

  var score = 0;
  // Generic keywords
  for (var i = 0; i < def.words.length; i++) {
    if (includesNormalized(messageNorm, def.words[i])) {
      score += WORD_WEIGHT;
    }
  }
  // Cue words (heavier)
  var cues = CUE_WORDS[activityId] || [];
  for (var j = 0; j < cues.length; j++) {
    if (includesNormalized(messageNorm, cues[j])) {
      score += CUE_WEIGHT;
    }
  }
  return score;
}

// ---------- Public API ----------

/**
 * Detect the activity for an inbound message.
 *
 * @param {string} message       - the customer's message text
 * @param {string[]|null} enabledActivities - whitelist of activity IDs enabled
 *                                for the tenant (config.enabledActivities).
 *                                If null/empty, all KEYWORDS are considered.
 * @param {string|null} previousActivityId  - last detected activity for this
 *                                customer (continuity bonus).
 * @returns {{activity_id: string, title: string, score: number, confidence: string}|null}
 *          null when no activity matches (general/platform conversation).
 */
function detectActivity(message, enabledActivities, previousActivityId) {
  if (!message) return null;
  var messageNorm = normalize(message);

  // Candidate pool: only activities enabled for this tenant (or all if none given)
  var pool;
  if (enabledActivities && enabledActivities.length > 0) {
    pool = enabledActivities.filter(function (id) { return !!KEYWORDS[id]; });
  } else {
    pool = Object.keys(KEYWORDS);
  }
  if (pool.length === 0) return null;

  // Score each candidate
  var scored = pool.map(function (id) {
    var s = scoreActivity(id, messageNorm);
    // Continuity bonus: if this matches the previous activity, boost slightly
    // so short follow-ups ("نعم", "تابع") stay in the same context.
    if (previousActivityId && id === previousActivityId) {
      s += 1;
    }
    return { activity_id: id, title: KEYWORDS[id].title, score: s };
  }).filter(function (r) { return r.score > 0; })
    .sort(function (a, b) { return b.score - a.score; });

  if (scored.length === 0) return null;

  var best = scored[0];

  // Confidence label based on score and gap to second-best
  var second = scored[1];
  var gap = second ? (best.score - second.score) : best.score;
  var confidence;
  if (best.score >= 5 && gap >= 2) confidence = 'high';
  else if (best.score >= 3) confidence = 'medium';
  else confidence = 'low';

  // Low-confidence single-hit matches with no continuity: treat as ambiguous,
  // but still return the best guess (downstream can decide to use general context).
  return {
    activity_id: best.activity_id,
    title: best.title,
    score: best.score,
    confidence: confidence
  };
}

/**
 * Build a focused knowledge context for ONE activity only (data isolation).
 * Returns service titles/descriptions scoped to the activity, plus any
 * tenant-enabled services that belong to it.
 *
 * @param {string} activityId
 * @param {object} config  - tenant config_data (has services/activities)
 * @returns {string} context block, or '' if activity unknown
 */
function buildActivityContext(activityId, config) {
  var def = KEYWORDS[activityId];
  if (!def) return '';

  var lines = [];
  lines.push('### النشاط الحالي للعميل: ' + def.title);
  lines.push('(أجب العميل فقط ضمن خدمات هذا النشاط. لا تذكر خدمات أنشطة أخرى.)');

  // If tenant config has activity metadata, surface it
  if (config && config.activities && config.activities[activityId]) {
    var act = config.activities[activityId];
    if (act.title) lines.push('- القسم: ' + act.title);
    if (act.description) lines.push('- الوصف: ' + act.description);
  }

  return lines.join('\n');
}

module.exports = {
  detectActivity: detectActivity,
  buildActivityContext: buildActivityContext,
  normalize: normalize,
  KEYWORDS: KEYWORDS
};
