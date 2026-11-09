const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const { isRateLimited } = require('../_lib/rate-limit');

// Helper to sanitize text for SVG
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Activity Sector Metadata (Arabic & Context)
const ACTIVITY_PROFILES = {
  'barber-salon': { name: 'صالونات الحلاقة والتجميل', keywords: ['حلاقة', 'تصفيف', 'عناية بالبشرة', 'مظهر أنيق', 'حجز سريع'] },
  'spa-wellness': { name: 'سبا ومساج واستجمام', keywords: ['استرخاء', 'مساج', 'جلسة علاجية', 'راحة', 'هدوء'] },
  'car-care': { name: 'مغاسل وتلميع سيارات', keywords: ['تلميع نانو', 'غسيل بخار', 'حماية سيارات', 'نظافة كاملة'] },
  'healthcare': { name: 'عيادات ومراكز طبية', keywords: ['كشف طبي', 'فحص شامل', 'صحتك تهمنا', 'أطباء مختصون'] },
  'maintenance': { name: 'تشغيل وصيانة منزلية وتجارية', keywords: ['صيانة فورية', 'سباكة وكهرباء', 'تكييف', 'فنيين معتمدين'] },
  'cleaning': { name: 'نظافة وتعقيم', keywords: ['تنظيف عميق', 'تعقيم منازل', 'نظافة واجهات', 'خدمة سريعة'] },
  'it-support': { name: 'حاسب وشبكات وتقنية', keywords: ['دعم فني', 'شبكات وكاميرات', 'صيانة سيرفرات', 'حلول تقنية'] },
  'renovation': { name: 'تشطيب وديكور ومقاولات', keywords: ['ديكور عصري', 'تصميم داخلي', 'أعمال دهانات', 'إشراف هندسي'] },
  'security': { name: 'أنظمة أمنية ومراقبة', keywords: ['كاميرات مراقبة', 'أجهزة إنذار', 'حماية 24/7', 'أنظمة تحكم'] },
  'tech-digital': { name: 'تقنية رقمية وبرمجيات', keywords: ['حلول سحابية', 'تطوير تطبيقات', 'تحول رقمي', 'أتمتة أعمال'] },
  'training': { name: 'تدريب وتطوير مهني', keywords: ['دورات معتمدة', 'تطوير مهارات', 'شهادات احترافية', 'مدربون خبراء'] },
  'fitness': { name: 'نوادي ورياضة ولياقة', keywords: ['اشتراك شهري', 'مدرب شخصي', 'لياقة وبناء جسم', 'حياة صحية'] },
  'veterinary': { name: 'عيادات ورعاية بيطرية', keywords: ['فحص أليفك', 'تطعيمات', 'عناية كاملة', 'رعاية فائقة'] },
  'restaurant': { name: 'مطاعم ومأكولات', keywords: ['طعم أصيل', 'جلسات عائلية', 'وجبات شهية', 'أسرع توصيل'] },
  'consulting': { name: 'استشارات مهنية وقانونية وإدارية', keywords: ['استشارة متخصصة', 'دراسات جدوى', 'حلول قانونية', 'تخطيط مالي'] },
  'photography': { name: 'تصوير وتوثيق مناسبات', keywords: ['جلسة تصوير', 'توثيق احترافي', 'استوديو مجهز', 'لقطات لا تنسى'] },
  'tutoring': { name: 'دروس خصوصية وتدريس', keywords: ['متابعة دراسية', 'تقوية مهارات', 'معلمون متميزون', 'تفوق دراسي'] },
  'hotels': { name: 'فنادق وضيافة وشقق فندقية', keywords: ['إقامة فاخرة', 'حجز إطلالة', 'خدمات ضيافة', 'عطلة مميزة'] },
  'travel': { name: 'سفر وسياحة وباقات', keywords: ['رحلات سياحية', 'تذاكر وبرامج', 'وجهات مميزة', 'عروض سفر'] },
  'events': { name: 'تنظيم مناسبات واحتفالات', keywords: ['تنسيق حفلات', 'إشراف كامل', 'تجهيز صالات', 'ليلة لا تنسى'] },
  'commerce': { name: 'متاجر تجزئة وتسوق', keywords: ['تسوق الآن', 'منتجات أصلية', 'توصيل سريع', 'عروض وتخفيضات'] }
};

// Dialect instructions
const DIALECT_PROMPTS = {
  najdi: 'اللهجة السعودية النجدية (لهجة بيضاء محببة مثل: يا هلا، أبشر، حيّاك، لا يفوتك، خصم يبرد الخاطر)',
  hijazi: 'اللهجة السعودية الحجازية (لهجة عفوية ولطيفة مثل: يا سيدي، من عيوني، عشانك، ولا أروع، نورنا)',
  eastern: 'اللهجة الشرقاوية/الخليجية (يا بعد راسي، حيّاك الله، تدلل، ما يردك إلا لسانك)',
  modern_standard: 'اللغة العربية الفصحى المعاصرة (واضحة، راقية، مختصرة، مباشرة ومهنية تناسب المؤسسات والعيادات)'
};

// SVG Ad Creative Generator
function generateAdBannerSvg(spec) {
  const width = spec.width || 1080;
  const height = spec.height || 1080;
  const bgGradStart = spec.primaryColor || '#0f766e';
  const bgGradEnd = spec.secondaryColor || '#042f2e';
  const accentColor = spec.accentColor || '#f59e0b';
  const brandName = escapeXml(spec.brandName || 'مكِّن');
  const badgeText = escapeXml(spec.badgeText || 'عرض حصري لفترة محدودة');
  const mainHeading = escapeXml(spec.mainHeading || 'عروض استثنائية لعملائنا');
  const subHeading = escapeXml(spec.subHeading || 'احصل على أفضل الخدمات بأعلى معايير الجودة');
  const ctaText = escapeXml(spec.ctaText || 'احجز موعدك الآن');
  const contactText = escapeXml(spec.contactText || 'طلب فوري عبر الواتساب');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradStart}" />
      <stop offset="100%" stop-color="${bgGradEnd}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
    </linearGradient>
    <!-- Filters -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35" />
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <style>
    .brand-title { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 38px; font-weight: 800; fill: #ffffff; text-anchor: end; }
    .badge-label { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 26px; font-weight: 700; fill: #1e293b; text-anchor: middle; }
    .main-title { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 64px; font-weight: 900; fill: #ffffff; text-anchor: middle; }
    .sub-title { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 32px; font-weight: 500; fill: #e2e8f0; text-anchor: middle; }
    .cta-btn-text { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 32px; font-weight: 800; fill: #0f172a; text-anchor: middle; }
    .footer-text { font-family: 'Tajawal', 'Cairo', 'Segoe UI', sans-serif; font-size: 24px; font-weight: 600; fill: #94a3b8; text-anchor: middle; }
  </style>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- Decorative Modern Vector Circles -->
  <circle cx="150" cy="150" r="320" fill="${accentColor}" opacity="0.12" filter="url(#glow)" />
  <circle cx="${width - 100}" cy="${height - 150}" r="400" fill="${bgGradStart}" opacity="0.3" filter="url(#glow)" />
  <circle cx="${width / 2}" cy="${height / 2}" r="460" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.08" stroke-dasharray="16 16" />

  <!-- Glassmorphism Main Content Card -->
  <rect x="80" y="80" width="${width - 160}" height="${height - 160}" rx="32" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" filter="url(#shadow)" />

  <!-- Brand Header -->
  <g transform="translate(${width - 150}, 160)">
    <circle cx="20" cy="-12" r="16" fill="url(#accentGrad)" />
    <text x="-15" y="0" class="brand-title">${brandName}</text>
  </g>

  <!-- Offer Badge Pill -->
  <g transform="translate(${width / 2}, 300)">
    <rect x="-240" y="-36" width="480" height="72" rx="36" fill="url(#accentGrad)" filter="url(#shadow)" />
    <text x="0" y="10" class="badge-label">⚡ ${badgeText}</text>
  </g>

  <!-- Main Campaign Headline -->
  <text x="${width / 2}" y="480" class="main-title">${mainHeading}</text>

  <!-- Subheading & Offer Details -->
  <text x="${width / 2}" y="570" class="sub-title">${subHeading}</text>

  <!-- Call To Action Button (Pill Button) -->
  <g transform="translate(${width / 2}, 740)" filter="url(#shadow)" cursor="pointer">
    <rect x="-260" y="-45" width="520" height="90" rx="45" fill="#ffffff" />
    <text x="0" y="12" class="cta-btn-text">${ctaText} 👈</text>
  </g>

  <!-- Footer Notice -->
  <g transform="translate(${width / 2}, 920)">
    <text x="0" y="0" class="footer-text">📲 ${contactText} • مدعوم عبر منصة مكِّن الذكية</text>
  </g>
</svg>`;
}

// Model Fallback Candidates for Gemini
function getModelCandidates() {
  const override = (process.env.GEMINI_MODEL || '').trim();
  const list = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash-latest',
    'gemini-flash-latest'
  ];
  return override ? [override].concat(list) : list;
}

// Offline / Fallback Intelligent Marketing Generator
function generateFallbackMarketingContent({ brandName, activityName, campaignType, dialect, offerDetails, primaryColor, accentColor }) {
  const offer = offerDetails || 'خصومات حصرية تبدأ من 20% على باقات مختارة';
  let badge = 'عرض لفترة محدودة ⏳';
  let headline = `أقوى عروض ${brandName} الحصرية! ✨`;
  let cta = 'احجز الآن واستفد من العرض';

  if (campaignType === 'abandoned_recovery') {
    badge = 'رجعنا لك بعرض خاص! 🎁';
    headline = `سلتك في ${brandName} بانتظارك`;
    cta = 'أكمل حجزك / طلبك بخصم فوري';
  } else if (campaignType === 'seasonal_event') {
    badge = 'عروض الموسم والاحتفال 🇸🇦';
    headline = `احتفل معنا بأجمل عروض ${brandName}`;
    cta = 'اكتشف عروض الموسم الآن';
  } else if (campaignType === 'new_service') {
    badge = 'جديدنا وصل! 🚀';
    headline = `خدمات مميزة وجديدة في ${brandName}`;
    cta = 'جرّب الخدمة الجديدة اليوم';
  }

  const waCopy = `يا هلا والله {customerName} 👋\n\nيسعدنا في *${brandName}* لـ ${activityName} نقدّم لك عرضنا المميز:\n🌟 *${headline}*\n\n📌 *تفاصيل العرض:* ${offer}\n\nسارع بالاستفادة قبل انتهاء المقاعد:\n🔗 {offerLink}\n\nحيّاك الله بأي وقت، فريقنا بالخدمة دائماً! 🌹`;

  const socialCaption = `✨ لا تفوتك الفرصة مع ${brandName}!\n${offer}\n\n📍 احجز موعدك أو اطلب الآن عبر الرابط في البايو\n\n#${brandName.replace(/\s+/g, '_')} #عروض #السعودية #تخفيضات #خدمات_${activityName.replace(/\s+/g, '_')}`;

  const bannerSvg = generateAdBannerSvg({
    brandName,
    badgeText: badge,
    mainHeading: headline,
    subHeading: offer,
    ctaText: cta,
    contactText: 'تواصل فوري عبر الواتساب',
    primaryColor: primaryColor || '#0f766e',
    accentColor: accentColor || '#f59e0b'
  });

  return {
    campaignTitle: `${badge} - ${brandName}`,
    headline: headline,
    whatsappCopy: waCopy,
    socialCaption: socialCaption,
    callToAction: cta,
    bannerSpec: {
      badgeText: badge,
      mainHeading: headline,
      subHeading: offer,
      ctaButtonText: cta,
      primaryColor: primaryColor || '#0f766e',
      accentColor: accentColor || '#f59e0b'
    },
    bannerSvg: bannerSvg,
    fallback_used: true
  };
}

module.exports = async function handler(req, res) {
  if (await handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown';
  const rl = isRateLimited(clientIp, 30, 60000);
  if (rl.limited) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const {
      tenantSlug,
      activityId = 'barber-salon',
      campaignType = 'discount_offer',
      dialect = 'najdi',
      offerDetails = '',
      targetAudience = 'all',
      brandColors = {}
    } = req.body || {};

    let brandName = 'منشأة مكِّن';
    let primaryColor = brandColors.primary || '#0f766e';
    let accentColor = brandColors.accent || '#f59e0b';
    let activityName = (ACTIVITY_PROFILES[activityId] && ACTIVITY_PROFILES[activityId].name) || 'الخدمات العامة';

    if (tenantSlug) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const sbUrl = sbEnv.getSupabaseUrl();
        const sbKey = sbEnv.getSupabaseServiceKey() || sbEnv.getSupabaseAnonKey();
        if (sbUrl && sbKey) {
          const supabase = createClient(sbUrl, sbKey);
          const { data: tenantRow } = await supabase
            .from('mken_saas_clients')
            .select('business_name, config_data')
            .eq('tenant_slug', tenantSlug)
            .maybeSingle();

          if (tenantRow) {
            brandName = tenantRow.business_name || brandName;
            const cfg = tenantRow.config_data || {};
            if (cfg.brand) {
              brandName = cfg.brand.name || brandName;
              primaryColor = cfg.brand.primaryColor || primaryColor;
              accentColor = cfg.brand.accentColor || accentColor;
            }
          }
        }
      } catch (err) {
        console.warn('[AI Marketing] Supabase tenant lookup warn:', err.message);
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackResult = generateFallbackMarketingContent({
        brandName,
        activityName,
        campaignType,
        dialect,
        offerDetails,
        primaryColor,
        accentColor
      });
      return res.status(200).json({ success: true, ...fallbackResult, notice: 'Generated with high-fidelity local engine (GEMINI_API_KEY optional).' });
    }

    const dialectInstruction = DIALECT_PROMPTS[dialect] || DIALECT_PROMPTS['najdi'];
    const sectorKeywords = (ACTIVITY_PROFILES[activityId] && ACTIVITY_PROFILES[activityId].keywords.join('، ')) || 'جودة، سرعة، احترافية';

    const systemPrompt = `أنت خبير تسويق رقمي وإعلاني محترف لمنصة مكّن (Mken SaaS) في المملكة العربية السعودية.
مهمتك توليد حملة تسويقية متكاملة وجذابة لمتجر/منشأة محلية بالمعايير التالية:
- اسم المنشأة: ${brandName}
- نوع النشاط: ${activityName} (كلمات مفتاحية: ${sectorKeywords})
- هدف الحملة: ${campaignType} (تفاصيل العرض: ${offerDetails || 'عروض وخصومات مميزة على أفضل الخدمات/المنتجات'})
- اللهجة المطلوبة: ${dialectInstruction}
- الجمهور المستهدف: ${targetAudience}

يجب أن ترجع المخرجات حصراً بصيغة JSON فقط، بدون كتل برمجية markdown أو شروحات إضافية، بالهيكل التالي:
{
  "campaignTitle": "عنوان مختصر للحملة",
  "headline": "مانشيت إعلاني جذاب جداً وقصير",
  "whatsappCopy": "نص رسالة واتساب متكامل مع إيموجيز مناسبة والمتغيرات {customerName} و {brandName} و {offerLink}",
  "socialCaption": "كابشن إنستقرام ومنصة إكس مع هاشتاقات ذكية",
  "callToAction": "نص زر الدعوة لاتخاذ الإجراء (CTA)",
  "badgeText": "نص الشارة العلوية للبنر (مثل: خصم 30% حصري، أو عرض الأسبوع)",
  "subHeading": "شرح توضيحي ومختصر جداً في سطر واحد للبنر",
  "imagenPrompt": "وصف إنجليزي فوتوغرافي فائق الدقة يصلح لـ Imagen 3 لإنشاء خلفية إعلانية فخمة"
}`;

    const userMessage = `أنشئ حملة تسويقية متكاملة الآن لـ ${brandName} بنشاط ${activityName} وعرض: ${offerDetails || 'عروض استثنائية'}`;

    const requestBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.75,
        topP: 0.95,
        response_mime_type: 'application/json',
        maxOutputTokens: 1200
      }
    };

    const models = getModelCandidates();
    let geminiResponseText = null;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content && resJson.candidates[0].content.parts) {
            geminiResponseText = resJson.candidates[0].content.parts[0].text;
            break;
          }
        }
      } catch (err) {
        console.warn(`[AI Marketing] Model ${model} failed:`, err.message);
      }
    }

    if (!geminiResponseText) {
      const fallbackResult = generateFallbackMarketingContent({
        brandName,
        activityName,
        campaignType,
        dialect,
        offerDetails,
        primaryColor,
        accentColor
      });
      return res.status(200).json({ success: true, ...fallbackResult, notice: 'Fallback generated due to AI model unavailability.' });
    }

    let parsedData = {};
    try {
      const cleaned = geminiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    } catch (e) {
      const fallbackResult = generateFallbackMarketingContent({
        brandName,
        activityName,
        campaignType,
        dialect,
        offerDetails,
        primaryColor,
        accentColor
      });
      return res.status(200).json({ success: true, ...fallbackResult });
    }

    const bannerSvg = generateAdBannerSvg({
      brandName,
      badgeText: parsedData.badgeText || '⚡ عرض خاص لفترة محدودة',
      mainHeading: parsedData.headline || parsedData.campaignTitle || 'عرض استثنائي',
      subHeading: parsedData.subHeading || offerDetails || 'أفضل الخدمات بأعلى جودة وضمان',
      ctaText: parsedData.callToAction || 'احجز موعدك الآن',
      contactText: 'تواصل فوري عبر الواتساب',
      primaryColor: primaryColor,
      accentColor: accentColor
    });

    return res.status(200).json({
      success: true,
      campaignTitle: parsedData.campaignTitle || 'حملة تسويقية ذكية',
      headline: parsedData.headline || 'عروض حصرية',
      whatsappCopy: parsedData.whatsappCopy || '',
      socialCaption: parsedData.socialCaption || '',
      callToAction: parsedData.callToAction || 'احجز الآن',
      bannerSpec: {
        badgeText: parsedData.badgeText,
        mainHeading: parsedData.headline,
        subHeading: parsedData.subHeading,
        ctaButtonText: parsedData.callToAction,
        primaryColor: primaryColor,
        accentColor: accentColor,
        imagenPrompt: parsedData.imagenPrompt || ''
      },
      bannerSvg: bannerSvg,
      fallback_used: false
    });

  } catch (err) {
    console.error('[AI Marketing Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
