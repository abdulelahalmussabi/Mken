'use strict';

const siteUrl = 'https://mken.live';
const pin = 'mken2026';

const tenantSlug = 'almahrusa';
const email = 'stayinmedina@gmail.com';
const password = 'Aa#321321';
const phone = '0554453287';
const businessName = 'المحروسة للشقق المفروشة | Mahrousa Apartment';
const mapsUrl = 'https://maps.app.goo.gl/J3yxQx6r4HF6yeYM8';

const roomsList = [
  { number: '101', floor: 'الدور g', type: 'مطل على الحديقة', catKey: 'deluxe-room' },
  { number: '102', floor: 'الدور g', type: 'سرير ملكي (فردي-102)', catKey: 'suite-room' },
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
          titleAccent: 'إقامة مريحة وراقية بالمدينة المنورة',
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
    center: {
      lat: 24.3512531,
      lng: 39.5107113
    },
    radiusKm: 30,
    coverageNote: 'المدينة المنورة — قريبة من الحرم الشريف وكافة الخدمات',
    displayOnHomepage: true,
    showAsFullCity: true,
    googleMapsUrl: mapsUrl
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

async function main() {
  console.log('Sending save-config request for tenant: almahrusa with Madinah coordinates...');

  const response = await fetch(`${siteUrl}/api/v1/auth?type=admin-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Pin': pin
    },
    body: JSON.stringify({
      pin: pin,
      action: 'save-config',
      tenantSlug: tenantSlug,
      configData: configData
    })
  });

  const resData = await response.json();
  console.log('Response status:', response.status);
  console.log('Response body:', resData);

  console.log('Sending save-config request for tenant: almahrosa with Madinah coordinates...');
  const response2 = await fetch(`${siteUrl}/api/v1/auth?type=admin-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Pin': pin
    },
    body: JSON.stringify({
      pin: pin,
      action: 'save-config',
      tenantSlug: 'almahrosa',
      configData: configData
    })
  });
  console.log('Response2 status:', response2.status);
  console.log('Response2 body:', await response2.json());
}

main().catch(console.error);
