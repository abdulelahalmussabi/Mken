'use strict';

/** إعدادات التجربة المجانية — 14 يوم بعد المطالبة؛ المعاينة غير المُطالب بها 7 أيام */
const TRIAL_DAYS = 14;
const PREVIEW_TTL_DAYS = 7;

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
};

function trialEndDate(from) {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

function previewExpiryDate(from) {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + PREVIEW_TTL_DAYS);
  return d;
}

function isUnclaimedPreviewConfig(config) {
  return config && config.preview && config.preview.claimStatus === 'unclaimed';
}

/**
 * يحذف معاينات Magic Preview غير المُطالب بها بعد 7 أيام.
 * لا يحذف تجارب المطالبة (trial) ولا المستأجرين المدفوعين.
 */
async function purgeExpiredUnclaimedPreviews(supabase) {
  if (!supabase) return { deleted: 0 };
  const now = new Date().toISOString();
  const indexed = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug')
    .eq('claim_status', 'unclaimed')
    .lt('preview_expires_at', now);
  if (!indexed.error) {
    const rows = indexed.data || [];
    let deleted = 0;
    for (let i = 0; i < rows.length; i++) {
      const del = await supabase.from('mken_saas_clients').delete().eq('tenant_slug', rows[i].tenant_slug);
      if (!del.error) deleted += 1;
    }
    return { deleted };
  }
  const { data, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, config_data');
  if (error || !data) return { deleted: 0, error: error && error.message };
  let deleted = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!isUnclaimedPreviewConfig(row.config_data)) continue;
    const expires = row.config_data && row.config_data.preview && row.config_data.preview.expiresAt;
    if (!expires || expires >= now) continue;
    const del = await supabase.from('mken_saas_clients').delete().eq('tenant_slug', row.tenant_slug);
    if (!del.error) deleted += 1;
  }
  return { deleted };
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

  return {
    enabledActivities: activities,
    enabled: services,
    featuredActivity: featuredActivity,
    featured: featured,
    heroFocus: featured,
    theme: 'slate',
    phone: opts.phone || '966500000000',
    brand: {
      name: opts.businessName || 'منشأتي',
      tagline: 'مرحباً بك — موقعك جاهز للانطلاق',
      logo: '',
    },
    activities: {},
    services: {},
    booking: { enabled: true, mode: 'form', requirePayment: false },
    serviceArea: { enabled: false, city: 'الرياض', radiusKm: 15 },
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
  PREVIEW_TTL_DAYS,
  ACTIVITY_PRESETS,
  trialEndDate,
  previewExpiryDate,
  getActivityPreset,
  buildTrialTenantConfig,
  isUnclaimedPreviewConfig,
  purgeExpiredUnclaimedPreviews,
};
