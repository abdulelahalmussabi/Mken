'use strict';

/**
 * WhatsApp Canned Replies — Hybrid Layer
 *
 * High-quality, pre-written persuasive replies for the most common customer
 * intents. These guarantee professional, convincing answers (unreliable with
 * the weak gemini-flash-latest model). Anything unmatched falls through to AI.
 *
 * Each intent has:
 *  - keywords: Arabic phrases that trigger it (matched against the message)
 *  - reply: function(config, ctx) => string, so replies can use live data
 */

// ---------- Helpers ----------

function getDomain(config) {
  return (config.saas && config.saas.baseDomain) || config.domain || 'mken.live';
}

function getBrandName(config) {
  // Force 'مكّن' for the main platform; allow override for real tenants
  const raw = (config.brand && config.brand.name) || 'مكّن';
  // Fix wrong admin-tenant brand names
  if (/لوحة التحكم|admin|dashboard/i.test(raw)) return 'مكّن';
  return raw;
}

function getFeaturesList(config) {
  const enabled = (config.enabled || []);
  // Map feature keys to Arabic labels
  const featureMap = {
    'web-design': 'تصميم وتطوير المواقع',
    'mobile-apps': 'تطبيقات الجوال',
    'landing-pages': 'صفحات الهبوط',
    'seo': 'تحسين محركات البحث (SEO)',
    'whatsapp-crm': 'نظام واتساب CRM',
    'social-media': 'إدارة السوشيال ميديا',
    'branding': 'الهوية البصرية',
    'ecommerce': 'المتاجر الإلكترونية',
    'computer': 'صيانة الحاسب',
    'laptop-repair': 'صيانة اللابتوب'
  };
  const list = enabled.length > 0
    ? enabled.filter(k => featureMap[k]).map(k => featureMap[k])
    : Object.values(featureMap);
  return list;
}

function includesAny(text, words) {
  return words.some(w => text.includes(w));
}

// ---------- Intent definitions ----------
// NOTE: order matters — more specific intents (pricing, booking, thanks)
// are listed BEFORE general ones (services, website) so that a message like
// "كم سعر تصميم موقع" matches pricing (specific) not website (general).

const INTENTS = [
  // HIGH PRIORITY — specific intents first

  // Thanks / appreciation (must be before pricing — "شكراً لكم")
  {
    id: 'thanks',
    priority: 10,
    match: function (msg) {
      return includesAny(msg, ['شكرا', 'شكراً', 'مشكور', 'مشكوره', 'يعطيك العافية', 'يعطيك الف عافية', 'تسلم', 'thank']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      return 'العفو يا غالي! 🌟 هذا واجبنا.\n\n'
        + 'سعداء بخدمتك في ' + name + '. نحن دائماً هنا لأي استفسار مستقبلي 💚\n\n'
        + 'ولا تنسى — لو عندك صديق يحتاج خدماتنا، نكون سعداء بخدمته أيضاً 😊';
    }
  },

  // Bye / end (must be early)
  {
    id: 'bye',
    priority: 10,
    match: function (msg) {
      return includesAny(msg, ['مع السلامة', 'باي', 'الى اللقاء', 'إلى اللقاء', 'تشنك', 'bye', 'goodbye']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      return 'مع السلامة! 🌟\n\n'
        + 'كان شرف لنا خدمتك في ' + name + '.\n'
        + 'نحن دائماً هنا متى احتجتنا — فقط أرسل رسالة 😊\n\n'
        + 'تمنياتنا لك بالتوفيق والنجاح! 💚';
    }
  },

  // Pricing (must be before services/website — "كم سعر تصميم موقع")
  {
    id: 'pricing',
    priority: 8,
    match: function (msg) {
      return includesAny(msg, ['سعر', 'أسعار', 'اسعار', 'بكام', 'بكم', 'تكلفة', 'عرض سعر', 'عروض أسعار', 'باقات', 'باقة', 'كم سعر', 'وش السعر', 'كم تكل']) &&
             !includesAny(msg, ['شكر', 'مشكور', 'يعطيك', 'تسلم']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'أسعار ' + name + ' مرنة وتناسب كل حجم منشأة! 💰\n\n'
        + 'لأن كل عميل له احتياج مختلف، نحنا ما عندنا سعر ثابت للكل.\n'
        + 'نعطيك باقة مصممة خصيصاً لك حسب:\n'
        + '✦ نوع الخدمة اللي تحتاجها\n'
        + '✦ حجم منشأتك وأهدافك\n'
        + '✦ ميزانيتك\n\n'
        + '💡 لكن أصغر باقة عندنا تبدأ بأسعار تنافسية جداً!\n\n'
        + 'أفضل طريقة أعطيك سعر دقيق: احجز استشارة مجانية (10 دقايق فقط) وأفهم احتياجك بالضبط 🎯\n'
        + '🌐 https://' + domain + '/book.html\n\n'
        + 'تكرم، وش نوع الخدمة اللي تبحث عنها؟ أقدر أعطيك فكرة مبدئية 😊';
    }
  },

  // Book / appointment (must be before greeting ambiguity)
  {
    id: 'book',
    priority: 8,
    match: function (msg) {
      return includesAny(msg, ['حجز', 'احجز', 'موعد', 'أستشارة', 'استشارة', 'مقابلة', 'ألتقي', 'التقي']) &&
             !includesAny(msg, ['إلغاء', 'الغاء', 'ألغ', 'الغ']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'ممتاز! خطوة ذكية جداً 🎯\n\n'
        + 'احجز استشارتك المجانية مع فريق ' + name + ' عبر الرابط:\n'
        + '🌐 https://' + domain + '/book.html\n\n'
        + 'الاستشارة مجانية تماماً (10-15 دقيقة) وتشمل:\n'
        + '✦ تحليل احتياجك الحالي\n'
        + '✦ خطة واضحة للنمو\n'
        + '✦ عرض أسعار شفاف بدون التزام\n\n'
        + 'بانتظارك! 💪';
    }
  },

  // GENERAL INTENTS — matched after specific ones

  // Greeting (السلام عليكم، مرحبا، مساء الخير)
  {
    id: 'greeting',
    priority: 5,
    match: function (msg) {
      return includesAny(msg, ['السلام', 'سلام عليكم', 'مرحبا', 'مرحبتين', 'اهلا', 'أهلا', 'هلا', 'صباح الخير', 'مساء الخير', 'مساء النور', 'صباح النور', 'هاي', 'hi', 'hello']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'وعليكم السلام ورحمة الله وبركاته! 🌟\n\n'
        + 'أهلاً وسهلاً بك في ' + name + ' — منصتك المتكاملة للنمو الرقمي! 🚀\n\n'
        + 'أنا مستشارك هنا لمساعدتك. كيف أقدر أخدمك اليوم؟ 😊\n'
        + '• تصميم موقع أو متجر إلكتروني\n'
        + '• تحسين ظهورك في جوجل (SEO)\n'
        + '• نظام واتساب ذكي للرد على عملائك\n'
        + '• أو أي خدمة رقمية أخرى\n\n'
        + 'قول لي وش تحتاج وأنا أرشدك لأفضل حل 💪';
    }
  },

  // 2. What services / features (وش الخدمات، الميزات، وش تسوون)
  {
    id: 'services_list',
    match: function (msg) {
      return includesAny(msg, ['خدمات', 'خدمه', 'خدماتكم', 'وش تسوون', 'ايش تسوون', 'وش تقدمون', 'ميزات', 'ميزة', 'منتجات', 'اعمال', 'أعمالكم', 'خدماتك']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      const features = getFeaturesList(config);
      const topFeatures = features.slice(0, 6);

      let text = name + ' منصة متكاملة تساعد المنشآات تنمو رقمياً من الألف للياء! 🎯\n\n';
      text += 'إليك أهم خدماتنا:\n\n';
      topFeatures.forEach((f, i) => {
        text += (i + 1) + '. ' + f + '\n';
      });
      text += '\n💡 كل خدمة مصممة لتجيب لك نتائج حقيقية: عملاء أكثر، مبيعات أعلى، وترة أقوى!\n\n';
      text += 'أي خدمة تهمك أكثر؟ أعطيك التفاصيل الكاملة والأسعار 💪\n';
      text += 'أو احجز استشارتك المجانية مباشرة:\n🌐 https://' + domain + '/book.html';
      return text;
    }
  },

  // 3. SEO / Google visibility (ظهور، جوجل، SEO، بحث)
  {
    id: 'seo',
    match: function (msg) {
      return includesAny(msg, ['ظهور', 'جوجل', 'seo', 'سيو', 'محركات البحث', 'بحث', 'أول جوجل', 'اول جوجل', 'ترتيب', 'ب搜索', 'بuzzle', 'أرشفة', 'ارشفة']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'سؤال ممتاز! 🎯 تحسين الظهور في جوجل (SEO) من أهم خدمات ' + name + '.\n\n'
        + 'إليك كيف نرفع ترتيبك في نتائج البحث:\n'
        + '✦ تحليل شامل لكلماتك المفتاحية ومنافسيك\n'
        + '✦ تحسين تقني لموقعك (سرعة، بنية، جوال)\n'
        + '✦ محتوى محسّن يجذب العملاء فعلاً\n'
        + '✦ بناء روابط قوية ترفع ثقة جوجل بموقعك\n\n'
        + '📈 النتيجة؟ عملاء يوصلكون وأنت نائم — لأنك أول من يشوفونه!\n\n'
        + 'تبين أعمل لك تحليل مجاني لموقعك الحالي وأوريّك وين تقف ولحقتك؟ 🔥\n'
        + 'احجز استشارتك:\n🌐 https://' + domain + '/book.html';
    }
  },

  // 4. Website design (موقع، تصميم، web)
  {
    id: 'website',
    match: function (msg) {
      return includesAny(msg, ['موقع', 'تصميم موقع', 'ويب', 'web', 'موقع الكتروني', 'موقع إلكتروني', 'صفحة', 'landing']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'تصميم المواقع من قوة ' + name + '! 🎨\n\n'
        + 'مواقعنا تختلف عن أي مكان ثاني لأنها:\n'
        + '✦ سريعة جداً (تجربة احترافية لعميلك)\n'
        + '✦ متجاوبة 100% مع الجوال (أغلب عملائك من الهاتف)\n'
        + '✦ محسّنة للـ SEO (تظهر في جوجل)\n'
        + '✦ مرتبطة بنظام حجز ودفع مباشر\n'
        + '✦ تصميم فريد يعكس هويتك — لا قوالب جاهزة\n\n'
        + '💡 الموقع ما هو بس صورة حلوة، هو ماكينة مبيعات تشتغل 24 ساعة!\n\n'
        + 'أساعدك تبدأ؟ احجز استشارتك المجانية:\n🌐 https://' + domain + '/book.html';
    }
  },

  // 5. WhatsApp CRM / AI bot (واتساب، بوت، رد تلقائي)
  {
    id: 'whatsapp_crm',
    match: function (msg) {
      return includesAny(msg, ['واتساب', 'whatsapp', 'بوت', 'رد تلقائي', 'رد آلي', 'crm', 'سي آر ام', 'المحادثات', 'شات بوت']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'خدمة واتساب CRM من ' + name + ' — وهي اللي تكلمني منها الحين! 🤖✨\n\n'
        + 'تخيل هذا البوت الذكي يشتغل عندك 24 ساعة:\n'
        + '✦ يرد على عملائك فوراً (بدون ما تنتظرهم)\n'
        + '✦ يحاورهم ويقنعهم بالخدمة\n'
        + '✦ يحجز المواعيد تلقائياً\n'
        + '✦ يسجل كل محادثة في نظامك\n'
        + '✦ يتذكر كل عميل وآخر محادثة معه\n\n'
        + '🔥 النتيجة؟ ترد على 100% من عملائك وتزيد مبيعاتك بدون توظيف أحد!\n\n'
        + 'جاهز تركّبها عندك؟ احجز عرضك:\n🌐 https://' + domain + '/book.html';
    }
  },

  // 7. E-commerce / online store (متجر، بيع، منتجات)
  {
    id: 'ecommerce',
    match: function (msg) {
      return includesAny(msg, ['متجر', 'متاجر', 'بيع', 'منتجات', 'اون لاين', 'أون لاين', 'online', 'تجارة', 'سلة', 'زد', 'shopify', 'cart']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'المتاجر الإلكترونية من تخصص ' + name + '! 🛒\n\n'
        + 'نبني لك متجر احترافي يبيع فعلاً:\n'
        + '✦ تصميم جذاب يخلي العميل يشتري\n'
        + '✦ دفع إلكتروني آمن (مدى، آبل باي، تابي)\n'
        + '✦ إدارة مخزون سهلة\n'
        + '✦ تقارير مبيعات واضحة\n'
        + '✦ مرتبط بواتساب CRM للرد على العملاء\n\n'
        + '🚀 متجرك يشتغل وأنت نايم — يبيع ويحصّل أوتوماتيك!\n\n'
        + 'جاهز تفتح متجرك الإلكتروني؟ احجز استشارتك:\n🌐 https://' + domain + '/book.html';
    }
  },

  // 8. Social media (سوشيال، انستقرام، تويتر، تيك توك)
  {
    id: 'social_media',
    match: function (msg) {
      return includesAny(msg, ['سوشيال', 'سوشل', 'انستقرام', 'انستغرام', 'تويتر', 'تيك توك', 'سناب', 'snap', 'فيسبوك', 'منشورات', 'محتوى', 'ادارة حسابات']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'إدارة السوشيال ميديا من ' + name + ' تفرق جداً! 📱\n\n'
        + 'نحوّل حساباتك من صامتة إلى ماكينة تفاعل:\n'
        + '✦ محتوى إبداعي يجذب ويقنع\n'
        + '✦ تصميم منشورات احترافي\n'
        + '✦ جدولة منتظمة (انتظام = نمو)\n'
        + '✦ إعلانات مدفوعة تستهدف عملاءك الحقيقيين\n'
        + '✦ تحليل أداء شهري\n\n'
        + '📈 نجمك يطلع وثقتك تزيد — وكل هذا يتحول لمبيعات!\n\n'
        + 'تبين ندرس حساباتك الحالية مجاناً؟ احجز:\n🌐 https://' + domain + '/book.html';
    }
  },

  // 9. Branding (هوية، شعار، لوجو، هوية بصرية)
  {
    id: 'branding',
    match: function (msg) {
      return includesAny(msg, ['هوية', 'شعار', 'لوجو', 'logo', 'هوية بصرية', 'ألوان', 'الوان', 'تصميم هوية']);
    },
    reply: function (config, ctx) {
      const name = getBrandName(config);
      const domain = getDomain(config);
      return 'الهوية البصرية هي قلب علامتك التجارية! 🎨\n\n'
        + name + ' تصمم لك هوية تنطق احترافية:\n'
        + '✦ شعار (لوجو) مميز يعلق بالبال\n'
        + '✦ دليل ألوان وخطوط متناسق\n'
        + '✦ بطاقات عمل ومطبوعات\n'
        + '✦ قوالب سوشيال ميديا بهويتك\n\n'
        + '💎 هوية قوية = ثقة فورية من عميلك قبل ما يكلمك!\n\n'
        + 'جاهز تطلع بهويتك الجديدة؟ احجز:\n🌐 https://' + domain + '/book.html';
    }
  }
];

// ---------- Public API ----------

/**
 * Try to match the message against a canned reply.
 * Returns the reply string if matched, or null if it should fall through to AI.
 *
 * @param {string} message  - the customer's message (original case)
 * @param {object} config   - tenant config_data
 * @param {object} ctx      - { conversationHistory, appointmentsInfo }
 * @returns {string|null}
 */
function matchCannedReply(message, config, ctx) {
  if (!message) return null;
  const msg = message.toLowerCase().trim();

  // Don't match canned replies if the message is very long (likely a complex
  // question that deserves a thoughtful AI answer)
  if (msg.length > 200) return null;

  for (const intent of INTENTS) {
    try {
      if (intent.match(msg)) {
        return intent.reply(config, ctx || {});
      }
    } catch (e) {
      // If a template errors, fall through to AI
      continue;
    }
  }

  return null;
}

module.exports = {
  matchCannedReply: matchCannedReply,
  INTENTS: INTENTS
};
