'use strict';

/** إعدادات التجربة المجانية — 14 يوم، باقة نمو */
const TRIAL_DAYS = 14;

const ACTIVITY_PRESETS = {
  'barber-salon': {
    activities: ['barber-salon'],
    services: ['mens-haircut', 'beard-grooming', 'kids-haircut'],
  },
  commerce: {
    activities: ['commerce'],
    services: ['ecommerce', 'monthly-subscription'],
  },
  'tech-digital': {
    activities: ['tech-digital'],
    services: ['web-design', 'whatsapp-crm', 'seo'],
  },
  healthcare: {
    activities: ['healthcare'],
    services: ['gp-consultation', 'home-nursing', 'home-lab'],
  },
  restaurant: {
    activities: ['restaurant'],
    services: ['table-booking', 'private-dining', 'buffet-reservation'],
  },
  consulting: {
    activities: ['consulting'],
    services: ['business-consult', 'accounting-consult', 'hr-consult'],
  },
  'car-care': {
    activities: ['car-care'],
    services: ['quick-wash', 'full-wash', 'interior-detailing'],
  },
  cleaning: {
    activities: ['cleaning'],
    services: ['cleaning', 'office-cleaning', 'disinfection'],
  },
  'canopies-steel': {
    activities: ['canopies-steel'],
    services: [
      'canopies',
      'fences-screens',
      'hangars',
      'pergolas',
      'tents-shades',
      'roof-tiles',
      'annex-build',
      'metalworks',
    ],
  },
  renovation: {
    activities: ['renovation'],
    services: ['painting', 'carpentry', 'tiling', 'wallpaper', 'kitchen-cabinets'],
  },
  maintenance: {
    activities: ['maintenance'],
    services: ['ac', 'plumbing', 'electrical', 'general'],
  },
};

function trialEndDate(from) {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

function getActivityPreset(activityId) {
  return ACTIVITY_PRESETS[activityId] || ACTIVITY_PRESETS['tech-digital'];
}

function buildTrialTenantConfig(opts) {
  opts = opts || {};
  const preset = getActivityPreset(opts.activityId);
  const activities = preset.activities;
  const services = preset.services;
  const featuredActivity = activities[0];
  const featured = services[0];
  const isFieldQuote = opts.activityId === 'canopies-steel' || opts.activityId === 'renovation' || opts.activityId === 'maintenance';

  return {
    enabledActivities: activities,
    enabled: services,
    featuredActivity: featuredActivity,
    featured: featured,
    heroFocus: featured,
    theme: isFieldQuote ? 'slate' : 'slate',
    phone: opts.phone || '966500000000',
    brand: {
      name: opts.businessName || 'منشأتي',
      tagline: opts.activityId === 'canopies-steel'
        ? 'مظلات وسواتر وهناجر — معاينة وعرض سعر'
        : 'مرحباً بك — موقعك جاهز للانطلاق',
      logo: '',
    },
    activities: {},
    services: {},
    booking: { enabled: true, mode: 'form', requirePayment: false },
    serviceArea: {
      enabled: isFieldQuote,
      displayOnHomepage: isFieldQuote,
      city: 'جدة',
      center: { lat: 21.485811, lng: 39.192505 },
      radiusKm: isFieldQuote ? 80 : 15,
      coverageNote: isFieldQuote ? 'جدة والمناطق المجاورة' : '',
      showAsFullCity: true,
    },
    push: { enabled: false },
    supabase: { enabled: false },
    saas: { baseDomain: 'mken.live', useSubdomains: true },
    whatsappApi: { enabled: true },
    payment: { enabled: false },
    subscription: {
      tier: 'growth',
      status: 'trial',
      trialDays: TRIAL_DAYS,
      customFeatures: {
        hasBooking: true,
        hasCommerce: activities.indexOf('commerce') !== -1,
        hasWhatsApp: true,
        hasInvoices: true,
      },
    },
    onboarding: {
      catalogVersion: 1,
      activityId: opts.activityId || 'tech-digital',
      completedSteps: ['signed_up'],
    },
  };
}

module.exports = {
  TRIAL_DAYS,
  ACTIVITY_PRESETS,
  trialEndDate,
  getActivityPreset,
  buildTrialTenantConfig,
};
