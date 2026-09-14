export const TRIAL_DAYS = 14;

export const ACTIVITY_PRESETS: Record<string, { activities: string[]; services: string[] }> = {
  "barber-salon": {
    activities: ["barber-salon"],
    services: ["mens-haircut", "beard-grooming", "kids-haircut"],
  },
  commerce: {
    activities: ["commerce"],
    services: ["ecommerce", "monthly-subscription"],
  },
  "tech-digital": {
    activities: ["tech-digital"],
    services: ["web-design", "whatsapp-crm", "seo"],
  },
  healthcare: {
    activities: ["healthcare"],
    services: ["gp-consultation", "home-nursing", "home-lab"],
  },
  restaurant: {
    activities: ["restaurant"],
    services: ["table-booking", "private-dining", "buffet-reservation"],
  },
  consulting: {
    activities: ["consulting"],
    services: ["business-consult", "accounting-consult", "hr-consult"],
  },
  "car-care": {
    activities: ["car-care"],
    services: ["quick-wash", "full-wash", "interior-detailing"],
  },
  cleaning: {
    activities: ["cleaning"],
    services: ["cleaning", "office-cleaning", "disinfection"],
  },
  maintenance: {
    activities: ["maintenance"],
    services: ["ac", "plumbing", "electrical"],
  },
};

export const RESERVED_SLUGS = [
  "default",
  "demo",
  "admin",
  "api",
  "www",
  "license",
  "licenses",
  "mken",
];

export function trialEndDate(from?: Date): Date {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

export function getActivityPreset(activityId?: string) {
  return ACTIVITY_PRESETS[activityId || ""] || ACTIVITY_PRESETS["tech-digital"];
}

export function buildTrialTenantConfig(opts: {
  businessName?: string;
  phone?: string;
  activityId?: string;
}) {
  const preset = getActivityPreset(opts.activityId);
  const activities = preset.activities;
  const services = preset.services;

  return {
    enabledActivities: activities,
    enabled: services,
    featuredActivity: activities[0],
    featured: services[0],
    heroFocus: services[0],
    theme: "slate",
    phone: opts.phone || "966500000000",
    brand: {
      name: opts.businessName || "منشأتي",
      tagline: "مرحباً بك — موقعك جاهز للانطلاق",
      logo: "",
    },
    activities: {},
    services: {},
    booking: { enabled: true, mode: "form", requirePayment: false },
    serviceArea: { enabled: false, city: "الرياض", radiusKm: 15 },
    push: { enabled: false },
    supabase: { enabled: false },
    saas: { baseDomain: "mken.live", useSubdomains: true },
    whatsappApi: { enabled: true },
    payment: { enabled: false },
    subscription: {
      tier: "growth",
      status: "trial",
      trialDays: TRIAL_DAYS,
      customFeatures: {
        hasBooking: true,
        hasCommerce: activities.includes("commerce"),
        hasWhatsApp: true,
        hasInvoices: true,
      },
    },
    onboarding: {
      catalogVersion: 1,
      activityId: opts.activityId || "tech-digital",
      completedSteps: ["signed_up"],
    },
  };
}
