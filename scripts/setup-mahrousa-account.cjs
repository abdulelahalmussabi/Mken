'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFiles = [
  '.env.production.local',
  '.env.local',
  '.env.vercel.production.new.pull',
  '.env.vercel.production.pull',
  '.env.vercel.new.pull',
  '.env.vercel.pull',
  '.env.development.local',
  '.env'
];

let supabaseUrl = process.env.SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      result[key] = value;
    }
  }
  return result;
}

for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const parsed = parseEnvFile(fullPath);
    if (!supabaseUrl && parsed.SUPABASE_URL) supabaseUrl = parsed.SUPABASE_URL;
    if (!serviceKey && (parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_KEY)) {
      serviceKey = parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_KEY;
    }
  }
}

if (!supabaseUrl) supabaseUrl = 'https://wkcaakexzxqebwjyhtan.supabase.co';
if (!serviceKey) serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrY2Fha2V4enhxZWJ3anlodGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzk0ODksImV4cCI6MjA5MjYxNTQ4OX0.oPm_IWfrmqzau1Pir7Afr6qAJNaa0sIhH4MICcYhhv8';

console.log('Connecting to Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tenantSlug = 'almahrusa';
const email = 'stayinmedina@gmail.com';
const password = 'Aa#321321';
const phone = '0554453287';
const businessName = 'المحروسة للشقق المفروشة | Mahrousa Apartment';
const mapsUrl = 'https://maps.app.goo.gl/J3yxQx6r4HF6yeYM8';

async function run() {
  console.log(`\n⏳ بدء تجهيز حساب "المحروسة للشقق المفروشة" (${tenantSlug})...`);

  // 1. Prepare Detailed Config Data for Rooms, Google Hotel, Booking System
  const freeSubEnd = new Date();
  freeSubEnd.setFullYear(freeSubEnd.getFullYear() + 10);

  const roomsList = [
    { number: '101', floor: 'الدور g', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
    { number: '102', floor: 'الدور g', type: 'سرير ملكي (فردي)', catKey: 'suite-room' },
    { number: '103', floor: 'الدور g', type: 'فردي', catKey: 'standard-room' },
    { number: '104', floor: 'الدور g', type: 'فردي', catKey: 'standard-room' },
    { number: '105', floor: 'الدور g', type: 'سرير ملكي', catKey: 'suite-room' },
    { number: '106', floor: 'الدور g', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
    { number: '201', floor: 'الدور 1', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
    { number: '202', floor: 'الدور 1', type: 'فردي', catKey: 'standard-room' },
    { number: '203', floor: 'الدور 1', type: 'سرير ملكي (ملكي)', catKey: 'suite-room' },
    { number: '204', floor: 'الدور 1', type: 'فردي (سرير ملكي)', catKey: 'standard-room' },
    { number: '205', floor: 'الدور 1', type: 'فردي', catKey: 'standard-room' },
    { number: '206', floor: 'الدور 1', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
    { number: '301', floor: 'الدور 2', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
    { number: '302', floor: 'الدور 2', type: 'فردي', catKey: 'standard-room' },
    { number: '303', floor: 'الدور 2', type: 'سرير ملكي', catKey: 'suite-room' },
    { number: '304', floor: 'الدور 2', type: 'فردي', catKey: 'standard-room' },
    { number: '305', floor: 'الدور 2', type: 'فردي', catKey: 'standard-room' },
    { number: '306', floor: 'الدور 2', type: 'مطل على الحديقة', catKey: 'deluxe-room' }
  ];

  const configData = {
    brand: {
      name: businessName,
      tagline: 'شقق مفروشة راقية بالمدينة المنورة — حجز مباشر وبدون رسوم اشتراك',
      logo: ''
    },
    enabledActivities: ['hotels'],
    enabled: ['standard-room', 'deluxe-room', 'suite-room', 'family-suite', 'chalet-stay', 'long-stay-hotel'],
    featuredActivity: 'hotels',
    featured: 'deluxe-room',
    heroFocus: 'deluxe-room',
    theme: 'ocean',
    phone: phone,
    mapsListingUrl: mapsUrl,
    social: {
      whatsapp: { enabled: true, value: phone }
    },
    emails: {
      inquiries: { enabled: true, value: email },
      sales: { enabled: true, value: email },
      support: { enabled: true, value: email }
    },
    activities: {
      hotels: {
        icon: '🏨',
        title: 'ضيافة وشقق مفروشة',
        shortTitle: 'شقق مفروشة',
        tagline: 'احجز شقتك المفروشة بالمدينة المنورة',
        description: 'شقق مفروشة متكاملة، إطلالات حديقة وغرف ملكية وفردية — حجز يومي مباشر ومفعل مع جوجل هوتل.',
        booking: { ctaLabel: 'احجز وحدتك السكنية' },
        content: {
          hero: {
            titleAccent: 'إقامة مريحة وراقية بالمدينة',
            desc: '18 وحدة سكنية مجهزة بالكامل توفر راحة تامة وإطلالات مميزة.',
            badgeSingle: '18 غرفة وشقة',
            badgeMulti: 'وحدات ممتدة على 3 أدوار'
          },
          stats: [
            { num: '18', label: 'غرفة وشقة' },
            { num: '3', label: 'أدوار (G, 1, 2)' },
            { num: '4.9', label: 'تقييم العملاء' },
            { num: '24/7', label: 'استقبال وخيارات مرنة' }
          ],
          features: [
            { icon: '🌳', text: 'مطل على الحديقة' },
            { icon: '👑', text: 'سرير ملكي' },
            { icon: '📶', text: 'WiFi مجاني' },
            { icon: '🅿️', text: 'مواقف مخصصة' }
          ],
          about: {
            title: 'عن المحروسة للشقق المفروشة',
            paragraphs: [
              'تتميز المحروسة للشقق المفروشة بموقعها المميز بالمدينة المنورة، حيث تضمن لضيوفها أعلى معايير الضيافة والراحة.',
              'تتوزع وحداتنا السكنية الـ 18 على الدور الأرضي والدور الأول والدور الثاني، لتلبي كافة الاحتياجات (مطل على الحديقة، أسرّة ملكية، غرف فردية).'
            ],
            checks: [
              '18 وحدة مفروشة وجاهزة',
              'غرف مطلة على الحديقة',
              'أسرّة ملكية وفردية',
              'تأكيد حجز يومي مباشر',
              'تكامل كامل مع Google Hotels',
              'دعم واستقبال 24/7'
            ]
          },
          process: {
            title: "خطوات الحجز المباشر",
            subtitle: "سريعة وبسيطة",
            steps: [
              { num: "١", title: "اختر نوع الغرفة / الشقة", desc: "مطل على الحديقة، سرير ملكي، أو فردي." },
              { num: "٢", title: "حدد تاريخ الوصول والليالي", desc: "ادخل التواريخ وتعرف على المتاح فوراً." },
              { num: "٣", title: "استلم تأكيد الحجز", desc: "تأكيد فوري ورقم الغرفة على الواتساب." }
            ]
          },
          faq: [
            { q: "ما هي تفاصيل وأرقام الغرف؟", a: "غرف مطلة على الحديقة (101, 106, 201, 206, 301, 306)، غرف سرير ملكي (102, 105, 203, 303)، وغرف فردية (103, 104, 202, 204, 205, 302, 304, 305)." },
            { q: "هل الحساب مجاني وبدون رسوم؟", a: "نعم، الحساب مفعل مجاناً بالكامل لاختبار جميع ميزات نظام الحجوزات وجوجل هوتل." }
          ]
        }
      }
    },
    services: {
      'deluxe-room': {
        icon: '🌳',
        title: 'غرفة / شقة مطلة على الحديقة',
        shortTitle: 'مطل على الحديقة',
        description: 'وحدات مفروشة راقية مع إطلالة مباشرة على الحديقة (الغرف: 101، 106، 201، 206، 301، 306).',
        category: 'إطلالة حديقة',
        roomCount: 6,
        stayUnit: 'night',
        rooms: roomsList.filter(r => r.catKey === 'deluxe-room'),
        features: ['إطلالة حديقة', 'تكييف ممتازة', 'WiFi مجاني', 'شاشة ذكية']
      },
      'suite-room': {
        icon: '👑',
        title: 'غرفة / جناح سرير ملكي',
        shortTitle: 'سرير ملكي',
        description: 'وحدات متميزة بأسرة ملكية فاخرة (الغرف: 102، 105، 203، 303).',
        category: 'سرير ملكي',
        roomCount: 4,
        stayUnit: 'night',
        rooms: roomsList.filter(r => r.catKey === 'suite-room'),
        features: ['سرير ملكي واسع', 'جلسة مريحة', 'WiFi', 'ميني بار']
      },
      'standard-room': {
        icon: '🛏️',
        title: 'غرفة فردي',
        shortTitle: 'فردي',
        description: 'غرف سكنية فردية مجهزة ومريحة بالكامل (الغرف: 103، 104، 202، 204، 205، 302، 304، 305).',
        category: 'غرف فردية',
        roomCount: 8,
        stayUnit: 'night',
        rooms: roomsList.filter(r => r.catKey === 'standard-room'),
        features: ['سرير فردي', 'تكييف هواء', 'WiFi', 'حمام خاص']
      }
    },
    roomsDetail: roomsList,
    googleBusiness: {
      enabled: true,
      mapsUrl: mapsUrl,
      status: 'connected',
      googleHotelEnabled: true,
      locationId: 'locations/J3yxQx6r4HF6yeYM8'
    },
    googleHotel: {
      enabled: true,
      status: 'active',
      partnerId: 'mahrousa_pms_google_hotel',
      propertyId: 'mahrousa_medina',
      hotelName: businessName,
      mapsUrl: mapsUrl,
      freeBookingLinks: true
    },
    booking: {
      enabled: true,
      mode: 'stay',
      requirePayment: false,
      slotDuration: 60,
      advanceDays: 60,
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      workingHours: { start: '00:00', end: '23:59' },
      maxPerSlot: 18
    },
    serviceArea: {
      enabled: true,
      city: 'المدينة المنورة',
      radiusKm: 50,
      displayOnHomepage: true
    },
    subscription: {
      status: 'active',
      tier: 'enterprise_free',
      trialDays: 3650,
      customFeatures: {
        hasBooking: true,
        hasGoogleHotel: true,
        hasWhatsApp: true,
        hasInvoices: true
      }
    },
    saas: {
      baseDomain: 'almahrusa.mken.live',
      useSubdomains: true
    },
    whatsappApi: {
      enabled: true,
      provider: 'none'
    },
    payment: {
      enabled: false,
      requirePayment: false
    },
    updatedAt: new Date().toISOString()
  };

  // Upsert SaaS Client in Database
  console.log('⏳ جاري تحديث بيانات المستأجر في mken_saas_clients...');
  const { data: clientRecord, error: upsertErr } = await supabase
    .from('mken_saas_clients')
    .upsert({
      tenant_slug: tenantSlug,
      business_name: businessName,
      email: email,
      phone: phone,
      subscription_status: 'active',
      subscription_end: freeSubEnd.toISOString(),
      config_data: configData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_slug' })
    .select()
    .single();

  if (upsertErr) {
    console.error('❌ خطأ أثناء حفظ المستأجر في قاعدة البيانات:', upsertErr.message);
    throw upsertErr;
  }

  console.log('✅ تم حفظ سجل المستأجر بنجاح!');

  // Also sync almahrosa for fallback matching
  await supabase
    .from('mken_saas_clients')
    .upsert({
      tenant_slug: 'almahrosa',
      business_name: businessName,
      email: email,
      phone: phone,
      subscription_status: 'active',
      subscription_end: freeSubEnd.toISOString(),
      config_data: configData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_slug' });

  console.log('\n======================================================');
  console.log('🎉 تم إنشاء وتحديث الحساب بنجاح على منصة مكن!');
  console.log(`- اسم النشاط: ${businessName}`);
  console.log(`- رابط الحجز المباشر: https://almahrusa.mken.live أو https://mken.live/book.html?tenant=almahrusa`);
  console.log(`- لوحة التحكم: https://almahrusa.mken.live/admin.html أو https://mken.live/admin.html?tenant=almahrusa`);
  console.log(`- البريد الإلكتروني: ${email}`);
  console.log(`- كلمة المرور / الرمز: ${password}`);
  console.log(`- رقم الجوال: ${phone}`);
  console.log(`- خرائط جوجل: ${mapsUrl}`);
  console.log(`- عدد الغرف والوحدات: 18 غرفة مفصلة ومفعلة بالحالة والأرقام والدور`);
  console.log(`- حالة الاشتراك: مجاني فعال بدون رسوم اختباري بالكامل (Google Hotel & Booking System Active)`);
  console.log('======================================================\n');
}

run().catch(console.error);
