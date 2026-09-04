import activitiesJson from "@/data/catalog/activities.json";
import servicesJson from "@/data/catalog/services.json";
import { DEFAULT_CLIENTS, storefrontClient } from "@/data/default-clients";
import { appearanceFromConfig, type AppearancePublic } from "@/lib/mken/appearance";
import { isAdLive, liveAds } from "@/lib/mken/ad-schedule";
import {
  pagesFromConfig,
  publicContactFromConfig,
  type StorefrontContactPublic,
  type StorefrontPagesPublic,
} from "@/lib/mken/pages";
import {
  applyAlmahrusaDefaults,
  ALMAHRUSA_LOCATION,
  ALMAHRUSA_MAP_CENTER,
  ALMAHRUSA_MAPS_URL,
  ALMAHRUSA_PHONE,
  ALMAHRUSA_WHATSAPP,
  almahrusaStorefrontMap,
  hasAlmahrusaIdentityTheme,
} from "@/lib/mken/almahrusa-content";
import {
  applyRewaqDefaults,
  REWAQ_LOCATION,
  REWAQ_MAP_CENTER,
  REWAQ_MAPS_URL,
  REWAQ_PHONE,
  REWAQ_WHATSAPP,
  rewaqStorefrontMap,
  hasRewaqIdentityTheme,
} from "@/lib/mken/rewaq-content";
import {
  applyRewaDefaults,
  hasRewaIdentityTheme,
  REWA_ACTIVITY_IDS,
  REWA_CUSTOM_SERVICES,
  REWA_LOCATION,
  REWA_MAP_CENTER,
  REWA_MAP_CITY,
  REWA_MAPS_URL,
  REWA_PHONE,
  REWA_PROMO_ADS,
  REWA_WHATSAPP,
  rewaStorefrontMap,
} from "@/lib/mken/rewa-content";
import { isStaleSeedLogo, publicBrandSrc, publicMediaSrc } from "@/lib/mken/logo-crop";
import {
  ensureTenantRow,
  fetchTenantRow,
  isPlatformSlug,
  toClientRecord,
  writeTenantConfig,
  type MkenConfig,
} from "@/lib/mken/tenant";
import type {
  StorefrontCatalog,
  StorefrontCatalogActivity,
  StorefrontCatalogService,
  StorefrontClient,
  StorefrontKind,
} from "@/types/database";

/**
 * The service catalog is global (exported from js/*-catalog.js via
 * scripts/export-catalogs.cjs); each tenant only stores which entries are
 * enabled plus per-entry overrides inside `config_data`:
 *   enabledActivities: string[]        activities: { [id]: overrides }
 *   enabled:           string[]        services:   { [id]: overrides }
 * The legacy site reads the exact same keys, so both admins stay in sync.
 */

export interface CatalogActivity {
  id: string;
  icon?: string;
  title: string;
  shortTitle?: string;
  tagline?: string;
  description?: string;
  uiProfile?: string;
  defaultTheme?: string;
  serviceIds?: string[];
}

export interface CatalogService {
  id: string;
  activityId: string;
  icon?: string;
  title: string;
  shortTitle?: string;
  description?: string;
  features?: string[];
  category?: string;
  featured?: boolean;
  price?: string;
  priceLabel?: string;
  stayUnit?: string;
}

export const ACTIVITIES = activitiesJson as CatalogActivity[];
export const SERVICES = servicesJson as CatalogService[];

export const ACTIVITY_OVERRIDE_FIELDS = [
  "icon",
  "title",
  "shortTitle",
  "tagline",
  "description",
  "heroImage",
  "theme",
] as const;

export const SERVICE_OVERRIDE_FIELDS = [
  "icon",
  "title",
  "shortTitle",
  "description",
  "category",
  "price",
  "stayUnit",
  "heroImage",
] as const;

export type ActivityOverrides = Partial<Record<(typeof ACTIVITY_OVERRIDE_FIELDS)[number], string>>;
export type ServiceOverrides = Partial<Record<(typeof SERVICE_OVERRIDE_FIELDS)[number], string>> & {
  roomCount?: number;
  features?: string[];
};

export interface ResolvedActivity extends CatalogActivity {
  enabled: boolean;
  featured: boolean;
  locked?: boolean;
  overrides: ActivityOverrides;
  serviceCount: number;
  enabledServiceCount: number;
}

export interface ResolvedService extends CatalogService {
  enabled: boolean;
  featured: boolean;
  available: boolean;
  overrides: ServiceOverrides;
}

export interface TenantCatalog {
  activities: ResolvedActivity[];
  services: ResolvedService[];
  featuredActivity: string;
  featuredService: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asOverrideMap(value: unknown): Record<string, Record<string, unknown>> {
  return value && typeof value === "object" ? (value as Record<string, Record<string, unknown>>) : {};
}

function customServicesFromConfig(config: MkenConfig): CatalogService[] {
  const raw = config.customServices;
  if (!Array.isArray(raw)) return [];
  const seen = new Set(SERVICES.map((s) => s.id));
  const out: CatalogService[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const activityId = typeof row.activityId === "string" ? row.activityId.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!id || !activityId || !title) continue;
    if (!/^[a-z0-9-]{3,80}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const heroImage = typeof row.heroImage === "string" ? row.heroImage.trim() : "";
    const service: CatalogService & { heroImage?: string } = {
      id,
      activityId,
      icon: typeof row.icon === "string" ? row.icon : "",
      title,
      shortTitle: typeof row.shortTitle === "string" ? row.shortTitle : title,
      description: typeof row.description === "string" ? row.description : "",
      features: asStringArray(row.features),
      category: typeof row.category === "string" ? row.category : "",
      price: typeof row.price === "string" ? row.price : "",
    };
    if (heroImage) service.heroImage = heroImage;
    out.push(service);
  }
  return out;
}

function catalogServiceList(config: MkenConfig): CatalogService[] {
  return [...SERVICES, ...customServicesFromConfig(config)];
}

function pickOverrides<T extends readonly string[]>(
  raw: Record<string, unknown>,
  fields: T
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = raw[field];
    if (typeof value === "string" && value !== "") out[field] = value;
  }
  return out;
}

export function resolveCatalog(config: MkenConfig): TenantCatalog {
  const enabledActivities = new Set(asStringArray(config.enabledActivities));
  const enabledServices = new Set(asStringArray(config.enabled));
  const activityOverrides = asOverrideMap(config.activities);
  const serviceOverrides = asOverrideMap(config.services);
  const featuredActivity = typeof config.featuredActivity === "string" ? config.featuredActivity : "";
  const featuredService = typeof config.featured === "string" ? config.featured : "";

  const catalogList = catalogServiceList(config);
  const services: ResolvedService[] = catalogList.map((service) => {
    const raw = serviceOverrides[service.id] || {};
    const overrides: ServiceOverrides = pickOverrides(raw, SERVICE_OVERRIDE_FIELDS);
    if (typeof raw.roomCount === "number" && raw.roomCount >= 1) overrides.roomCount = raw.roomCount;
    if (Array.isArray(raw.features)) overrides.features = asStringArray(raw.features);
    const definedHero = (service as CatalogService & { heroImage?: string }).heroImage;
    if (!overrides.heroImage && typeof definedHero === "string" && definedHero.trim()) {
      overrides.heroImage = definedHero.trim();
    }

    return {
      ...service,
      overrides,
      enabled: enabledServices.has(service.id),
      featured: featuredService === service.id,
      available: enabledActivities.has(service.activityId),
    };
  });

  const activities: ResolvedActivity[] = ACTIVITIES.map((activity) => {
    const own = services.filter((s) => s.activityId === activity.id);
    return {
      ...activity,
      overrides: pickOverrides(activityOverrides[activity.id] || {}, ACTIVITY_OVERRIDE_FIELDS),
      enabled: enabledActivities.has(activity.id),
      featured: featuredActivity === activity.id,
      serviceCount: own.length,
      enabledServiceCount: own.filter((s) => s.enabled).length,
    };
  });

  return { activities, services, featuredActivity, featuredService };
}

export async function fetchTenantCatalog(
  slug: string
): Promise<{ catalog?: TenantCatalog; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) {
    return { error: ensured.error || "المنشأة غير موجودة أو قاعدة البيانات غير مهيأة" };
  }
  return { catalog: resolveCatalog(mergeSeedConfig(slug, ensured.row.config_data || {})) };
}

export interface CatalogUpdate {
  enabledActivities?: string[];
  enabled?: string[];
  featuredActivity?: string;
  featured?: string;
  activityOverrides?: Record<string, ActivityOverrides>;
  serviceOverrides?: Record<string, ServiceOverrides>;
}

/**
 * Drops services whose activity is disabled, mirroring the legacy
 * `pruneEnabledServices` so the public site never renders orphan services.
 */
function pruneServices(
  enabledActivities: string[],
  enabled: string[],
  extras: CatalogService[] = []
): string[] {
  const allowed = new Set(enabledActivities);
  const known = new Map<string, CatalogService>();
  for (const service of SERVICES) known.set(service.id, service);
  for (const service of extras) known.set(service.id, service);
  return enabled.filter((id) => {
    const service = known.get(id);
    return service ? allowed.has(service.activityId) : false;
  });
}

export async function updateTenantCatalog(
  slug: string,
  update: CatalogUpdate
): Promise<{ catalog?: TenantCatalog; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) return { error: ensured.error || "المنشأة غير موجودة" };
  const row = ensured.row;

  const config: MkenConfig = { ...(row.config_data || {}) };
  const extras = [
    ...customServicesFromConfig(config),
    ...(slug === "rewa" ? REWA_CUSTOM_SERVICES : []),
  ];
  const extraById = new Map(extras.map((service) => [service.id, service]));

  const activityIds = new Set(ACTIVITIES.map((a) => a.id));
  const serviceIds = new Set([...SERVICES.map((s) => s.id), ...extraById.keys()]);

  const nextActivities =
    update.enabledActivities !== undefined
      ? update.enabledActivities.filter((id) => activityIds.has(id))
      : asStringArray(config.enabledActivities);

  const requestedServices =
    update.enabled !== undefined
      ? update.enabled.filter((id) => serviceIds.has(id))
      : asStringArray(config.enabled);

  const nextEnabled = pruneServices(nextActivities, requestedServices, [...extraById.values()]);
  config.enabledActivities = nextActivities;
  config.enabled = nextEnabled;

  if (update.featuredActivity !== undefined) {
    config.featuredActivity = nextActivities.includes(update.featuredActivity)
      ? update.featuredActivity
      : nextActivities[0] || "";
  } else if (typeof config.featuredActivity === "string" && !nextActivities.includes(config.featuredActivity)) {
    config.featuredActivity = nextActivities[0] || "";
  }

  if (update.featured !== undefined) {
    config.featured = nextEnabled.includes(update.featured) ? update.featured : nextEnabled[0] || "";
  } else if (typeof config.featured === "string" && !nextEnabled.includes(config.featured)) {
    config.featured = nextEnabled[0] || "";
  }

  if (update.activityOverrides) {
    const map = asOverrideMap(config.activities);
    for (const [id, overrides] of Object.entries(update.activityOverrides)) {
      if (!activityIds.has(id)) continue;
      const merged = { ...(map[id] || {}), ...pickOverrides(overrides, ACTIVITY_OVERRIDE_FIELDS) };
      for (const field of ACTIVITY_OVERRIDE_FIELDS) {
        if (overrides[field] === "") delete merged[field];
      }
      if (Object.keys(merged).length) map[id] = merged;
      else delete map[id];
    }
    config.activities = map;
  }

  if (update.serviceOverrides) {
    const map = asOverrideMap(config.services);
    for (const [id, overrides] of Object.entries(update.serviceOverrides)) {
      if (!serviceIds.has(id)) continue;
      const merged: Record<string, unknown> = {
        ...(map[id] || {}),
        ...pickOverrides(overrides, SERVICE_OVERRIDE_FIELDS),
      };
      for (const field of SERVICE_OVERRIDE_FIELDS) {
        if (overrides[field] === "") delete merged[field];
      }
      if (typeof overrides.roomCount === "number" && overrides.roomCount >= 1) {
        merged.roomCount = overrides.roomCount;
      }
      if (Array.isArray(overrides.features)) {
        const features = overrides.features.filter((f) => typeof f === "string" && f.trim());
        if (features.length) merged.features = features;
        else delete merged.features;
      }
      if (Object.keys(merged).length) map[id] = merged;
      else delete map[id];
    }
    config.services = map;
  }

  config.updatedAt = new Date().toISOString();

  const toWrite =
    slug === "rewa"
      ? applyRewaDefaults(stripRewaSpa(config))
      : slug === "almahrusa"
        ? applyAlmahrusaDefaults(config)
        : slug === "rewaq"
          ? applyRewaqDefaults(config)
          : config;
  const written = await writeTenantConfig(slug, toWrite);
  if (written.error || !written.row) {
    return { error: written.error || "تعذّر الحفظ: لا توجد صلاحية كتابة على بيانات المنشأة" };
  }

  return { catalog: resolveCatalog(mergeSeedConfig(slug, written.row.config_data || {})) };
}

const IMAGE_POOLS: Record<string, string[]> = {
  hotels: [
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
  ],
  commerce: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1472851298512-d2450f78581?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1553413076-8df362623f72?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=80",
  ],
  "barber-salon": [
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
  ],
  healthcare: [
    "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
  ],
  fitness: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80",
  ],
  events: [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
  ],
};

const SEED_CONFIG: Record<string, MkenConfig> = {
  almahrusa: {
    enabledActivities: ["hotels"],
    enabled: ["deluxe-room", "suite-room", "standard-room", "family-suite"],
    featuredActivity: "hotels",
    featured: "deluxe-room",
  },
  rewaq: {
    enabledActivities: ["hotels"],
    enabled: ["deluxe-room", "suite-room", "standard-room", "family-suite"],
    featuredActivity: "hotels",
    featured: "deluxe-room",
  },
  almasabi: {
    enabledActivities: ["commerce"],
    enabled: [
      "general-product",
      "electronics-item",
      "grocery-box",
      "custom-gift",
      "wholesale-order",
      "monthly-subscription",
    ],
    featuredActivity: "commerce",
    featured: "general-product",
  },
  demo: {
    enabledActivities: ["barber-salon"],
    enabled: ["mens-haircut", "beard-grooming", "kids-haircut", "hair-dye"],
    featuredActivity: "barber-salon",
    featured: "mens-haircut",
  },
  rewa: {
    enabledActivities: [...REWA_ACTIVITY_IDS],
    enabled: REWA_CUSTOM_SERVICES.map((service) => service.id),
    featuredActivity: "healthcare",
    featured: "rewa-hijama",
    customServices: REWA_CUSTOM_SERVICES,
    ads: { secondary: [...REWA_PROMO_ADS] },
    social: {
      whatsapp: { enabled: true, value: "966549462524" },
      instagram: { enabled: true, value: "rewa.100000" },
      tiktok: { enabled: true, value: "rewa.1000" },
      snapchat: { enabled: true, value: "rewa.1000" },
    },
  },
};

export function storefrontKind(activityId: string): StorefrontKind {
  if (activityId === "hotels") return "hotel";
  if (activityId === "barber-salon" || activityId === "salon") return "salon";
  if (activityId === "commerce") return "commerce";
  return "generic";
}

function serviceImage(activityId: string, index: number, override?: string): string {
  if (override && override.trim()) return override.trim();
  const pool = IMAGE_POOLS[activityId] || IMAGE_POOLS.commerce;
  return pool[index % pool.length];
}

function servicePrice(service: ResolvedService): string {
  const fromOverride = service.overrides.price;
  if (fromOverride) return fromOverride;
  if (service.price) return service.price;
  if (service.priceLabel) return service.priceLabel;
  return "";
}

function serviceDuration(service: ResolvedService, kind: StorefrontKind): string {
  if (kind === "hotel" || service.stayUnit === "night") return "حجز ليلة";
  if (kind === "commerce") return "طلب وتوصيل";
  const slot = (service as CatalogService & { slotDuration?: number }).slotDuration;
  if (typeof slot === "number" && slot > 0) return `${slot} دقيقة`;
  return "موعد";
}

export function toPublicCatalog(catalog: TenantCatalog): StorefrontCatalog {
  const activities: StorefrontCatalogActivity[] = catalog.activities
    .filter((activity) => activity.enabled)
    .map((activity) => ({
      id: activity.id,
      title: activity.overrides.title || activity.title,
      shortTitle: activity.overrides.shortTitle || activity.shortTitle || activity.title,
      icon: activity.overrides.icon || activity.icon || "",
      tagline: activity.overrides.tagline || activity.tagline || "",
    }));

  const featuredActivity =
    catalog.featuredActivity && activities.some((a) => a.id === catalog.featuredActivity)
      ? catalog.featuredActivity
      : activities[0]?.id || "";

  const kind = storefrontKind(featuredActivity);
  const services: StorefrontCatalogService[] = catalog.services
    .filter((service) => service.enabled && service.available)
    .map((service, index) => {
      const name = service.overrides.title || service.title;
      const features = service.overrides.features?.length
        ? service.overrides.features
        : service.features || [];
      return {
        id: service.id,
        activityId: service.activityId,
        name,
        badge: `${service.overrides.shortTitle || service.shortTitle || name} ${service.overrides.icon || service.icon || ""}`.trim(),
        price: servicePrice(service),
        features,
        description: service.overrides.description || service.description || "",
        image: serviceImage(service.activityId, index, service.overrides.heroImage),
        popular: service.featured,
        duration: serviceDuration(service, storefrontKind(service.activityId)),
        category: service.overrides.category || service.category || "",
      };
    });

  return { kind, featuredActivity, activities, services };
}

function isSpaService(id: string): boolean {
  if (/spa|massage/i.test(id)) return true;
  const service = SERVICES.find((item) => item.id === id);
  return service?.activityId === "spa-wellness";
}

function isSpaCopy(text: string): boolean {
  return /السبا|والسبا|مساج|massage|\bspa\b/i.test(text);
}

function scrubSpaCopy(text: string): string {
  return text
    .replace(/النادي الصحي والسبا[،,]?\s*/g, "")
    .replace(/السبا ومسار الأحجار[^،.]*/g, "")
    .replace(/جلسات(?:\s+ال)?سبا[وال\s]*/g, "")
    .replace(/والمساج[وال\s]*/g, "")
    .replace(/المساج[وال\s]*/g, "")
    .replace(/مساج[^.،]*/g, "")
    .replace(/السبا[،,]?\s*/g, "")
    .replace(/والسبا[،,]?\s*/g, "")
    .replace(/\bspa\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/،\s*،/g, "،")
    .replace(/^،\s*/g, "")
    .trim();
}

const REWA_CLINIC_HERO =
  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80";

function stripRewaSpa(config: MkenConfig): MkenConfig {
  const seed = SEED_CONFIG.rewa;
  const seedActivities = asStringArray(seed.enabledActivities);
  const seedEnabled = asStringArray(seed.enabled);
  const seedFeaturedActivity =
    typeof seed.featuredActivity === "string" ? seed.featuredActivity : seedActivities[0] || "";
  const seedFeatured = typeof seed.featured === "string" ? seed.featured : seedEnabled[0] || "";

  const activities = asStringArray(config.enabledActivities).filter((id) => id !== "spa-wellness");
  const enabled = asStringArray(config.enabled).filter((id) => !isSpaService(id));
  const nextActivities = activities.length ? activities : seedActivities;
  const nextEnabled = enabled.length ? enabled : seedEnabled;

  const next: MkenConfig = {
    ...config,
    enabledActivities: nextActivities,
    enabled: nextEnabled,
  };

  if (!nextActivities.includes(String(next.featuredActivity || "")) || next.featuredActivity === "spa-wellness") {
    next.featuredActivity = nextActivities[0] || seedFeaturedActivity;
  }
  if (!nextEnabled.includes(String(next.featured || "")) || isSpaService(String(next.featured || ""))) {
    next.featured = nextEnabled[0] || seedFeatured;
  }
  if (typeof next.subtitle === "string") next.subtitle = scrubSpaCopy(next.subtitle);
  if (next.brand?.description) next.brand = { ...next.brand, description: scrubSpaCopy(next.brand.description) };
  if (next.brand?.tagline && isSpaCopy(next.brand.tagline)) {
    next.brand = { ...next.brand, tagline: scrubSpaCopy(next.brand.tagline) };
  }
  if (typeof next.heroImage === "string" && /1540555700478|spa|massage/i.test(next.heroImage)) {
    next.heroImage = REWA_CLINIC_HERO;
  }
  if (next.ads?.secondary) {
    next.ads = {
      ...next.ads,
      secondary: next.ads.secondary.filter(
        (ad) => !isSpaCopy(`${ad.title || ""} ${ad.text || ""} ${ad.image || ""}`)
      ),
    };
  }
  if (
    next.ads?.primary &&
    isSpaCopy(`${next.ads.primary.title || ""} ${next.ads.primary.text || ""} ${next.ads.primary.image || ""}`)
  ) {
    next.ads = { ...next.ads, primary: { ...next.ads.primary, enabled: false } };
  }
  next.phone = REWA_PHONE;
  const social = (next.social || {}) as Record<string, { enabled?: boolean; value?: string }>;
  const savedWhatsapp = typeof social.whatsapp?.value === "string" ? social.whatsapp.value.trim() : "";
  next.social = {
    ...social,
    whatsapp: {
      enabled: social.whatsapp?.enabled !== false,
      value: savedWhatsapp || REWA_WHATSAPP,
    },
  };
  return next;
}

function mergeSeedConfig(slug: string, config: MkenConfig): MkenConfig {
  const seed = SEED_CONFIG[slug];
  let merged = config;
  if (seed) {
    const enabledActivities = Array.isArray(config.enabledActivities)
      ? (config.enabledActivities as string[])
      : [];
    merged =
      enabledActivities.length > 0
        ? config
        : {
            ...seed,
            ...config,
            enabledActivities: seed.enabledActivities,
            enabled: Array.isArray(config.enabled) && (config.enabled as string[]).length
              ? config.enabled
              : seed.enabled,
            featuredActivity: (config.featuredActivity as string) || seed.featuredActivity,
            featured: (config.featured as string) || seed.featured,
          };
  }
  const seedLogo =
    slug === "rewa" ? publicBrandSrc("rewa.png") : slug === "almahrusa" ? publicBrandSrc("almahrusa.png") : "";
  const currentLogo = (merged.brand?.logo || "").trim();
  if (seedLogo && (!currentLogo || isStaleSeedLogo(currentLogo))) {
    merged = { ...merged, brand: { ...(merged.brand || {}), logo: seedLogo } };
  }
  // Rewa / المحروسة overlays live in their apply*Defaults helpers.
  if (slug === "rewa") return applyRewaDefaults(stripRewaSpa(merged));
  if (slug === "almahrusa") return applyAlmahrusaDefaults(merged);
  if (slug === "rewaq") return applyRewaqDefaults(merged);
  return merged;
}

export interface PublicStorefront {
  client: StorefrontClient;
  catalog: StorefrontCatalog;
  appearance: AppearancePublic;
  pages: StorefrontPagesPublic;
  contactExtras: StorefrontContactPublic;
  source: "database" | "default";
}

export function withPublicMedia(payload: PublicStorefront): PublicStorefront {
  const img = publicMediaSrc;
  return {
    ...payload,
    client: {
      ...payload.client,
      heroImage: img(payload.client.heroImage || ""),
      logo: img(payload.client.logo || "") || payload.client.logo,
    },
    catalog: {
      ...payload.catalog,
      services: payload.catalog.services.map((service) => ({
        ...service,
        image: img(service.image || ""),
      })),
    },
    appearance: {
      ...payload.appearance,
      ads: {
        primary: {
          ...payload.appearance.ads.primary,
          image: img(payload.appearance.ads.primary.image || ""),
        },
        secondary: payload.appearance.ads.secondary.map((ad) => ({
          ...ad,
          image: img(ad.image || ""),
        })),
      },
    },
    pages: {
      ...payload.pages,
      home: {
        ...payload.pages.home,
        partners: payload.pages.home.partners.map((partner) => ({
          ...partner,
          image: img(partner.image || ""),
        })),
      },
      about: {
        ...payload.pages.about,
        team: payload.pages.about.team.map((person) => ({
          ...person,
          image: img(person.image || ""),
        })),
      },
      work: {
        ...payload.pages.work,
        gallery: payload.pages.work.gallery.map((item) => ({
          ...item,
          image: img(item.image || ""),
        })),
      },
    },
  };
}

export async function loadPublicStorefront(slug: string): Promise<PublicStorefront | null> {
  const key = slug.trim().toLowerCase();
  if (!key || isPlatformSlug(key)) return null;

  const row = await fetchTenantRow(key);
  const fallback = DEFAULT_CLIENTS.find((client) => client.slug === key);
  if (!row && !fallback) return null;

  let merged = mergeSeedConfig(key, row?.config_data || {});
  if (key === "rewa") {
    merged = {
      ...merged,
      mapsUrl: REWA_MAPS_URL,
      location:
        !merged.location || String(merged.location).includes("جدة")
          ? REWA_LOCATION
          : merged.location,
      serviceArea: {
        enabled: true,
        displayOnHomepage: true,
        city: REWA_MAP_CITY,
        center: { ...REWA_MAP_CENTER },
        radiusKm: 20,
        coverageNote: "منتجع رواء الاستشفاء الرقمي — المدينة المنورة",
        showAsFullCity: true,
      },
    };
    const stored = row?.config_data || {};
    const storedLat = Number(stored.serviceArea?.center?.lat);
    const pinAlreadySaved =
      stored.mapsUrl === REWA_MAPS_URL &&
      Number.isFinite(storedLat) &&
      Math.abs(storedLat - REWA_MAP_CENTER.lat) < 0.0001;
    const identitySaved = hasRewaIdentityTheme(stored);
    const social = stored.social || {};
    const socialSaved = Boolean(
      social.instagram?.value && social.tiktok?.value && social.snapchat?.value && social.whatsapp?.value
    );
    if (row && (!pinAlreadySaved || !identitySaved || !socialSaved)) {
      void writeTenantConfig(key, applyRewaDefaults({
        ...stored,
        mapsUrl: REWA_MAPS_URL,
        location: merged.location,
        serviceArea: merged.serviceArea,
      }));
    }
  }
  if (key === "almahrusa") {
    merged = applyAlmahrusaDefaults(merged);
    const stored = row?.config_data || {};
    const storedLat = Number(stored.serviceArea?.center?.lat);
    const pinAlreadySaved =
      stored.mapsUrl === ALMAHRUSA_MAPS_URL &&
      Number.isFinite(storedLat) &&
      Math.abs(storedLat - ALMAHRUSA_MAP_CENTER.lat) < 0.0001;
    const phoneSaved = Boolean(stored.phone && String(stored.phone).includes("554453287"));
    const identitySaved = hasAlmahrusaIdentityTheme(stored);
    const photosSaved =
      typeof stored.heroImage === "string" && /\/almahrusa\/.+\.web\.jpg/i.test(stored.heroImage);
    const storedPages = stored.pages && typeof stored.pages === "object" ? stored.pages : {};
    const storedWork =
      "work" in storedPages && storedPages.work && typeof storedPages.work === "object" ? storedPages.work : {};
    const storedGallery = "gallery" in storedWork ? (storedWork as { gallery?: unknown }).gallery : [];
    const gallery0 =
      Array.isArray(storedGallery) && storedGallery[0] && typeof storedGallery[0] === "object"
        ? String((storedGallery[0] as { image?: string }).image || "")
        : "";
    const gallerySaved = gallery0.includes(".web.jpg");
    const discountOff = stored.occasionPack?.enabled !== true;
    if (row && (!pinAlreadySaved || !phoneSaved || !identitySaved || !photosSaved || !gallerySaved || !discountOff)) {
      void writeTenantConfig(key, merged);
    }
  }
  if (key === "rewaq") {
    merged = applyRewaqDefaults(merged);
    const stored = row?.config_data || {};
    const storedLat = Number(stored.serviceArea?.center?.lat);
    const pinAlreadySaved =
      stored.mapsUrl === REWAQ_MAPS_URL &&
      Number.isFinite(storedLat) &&
      Math.abs(storedLat - REWAQ_MAP_CENTER.lat) < 0.0001;
    const phoneSaved = Boolean(stored.phone && String(stored.phone).includes("541303411"));
    const identitySaved = hasRewaqIdentityTheme(stored);
    const photosSaved =
      typeof stored.heroImage === "string" && /\/rewaq\/.+\.web\.jpg/i.test(stored.heroImage);
    const storedPages = stored.pages && typeof stored.pages === "object" ? stored.pages : {};
    const storedWork =
      "work" in storedPages && storedPages.work && typeof storedPages.work === "object" ? storedPages.work : {};
    const storedGallery = "gallery" in storedWork ? (storedWork as { gallery?: unknown }).gallery : [];
    const gallery0 =
      Array.isArray(storedGallery) && storedGallery[0] && typeof storedGallery[0] === "object"
        ? String((storedGallery[0] as { image?: string }).image || "")
        : "";
    const gallerySaved = gallery0.includes(".web.jpg");
    const discountOff = stored.occasionPack?.enabled !== true;
    if (row && (!pinAlreadySaved || !phoneSaved || !identitySaved || !photosSaved || !gallerySaved || !discountOff)) {
      void writeTenantConfig(key, merged);
    }
  }
  const catalog = toPublicCatalog(resolveCatalog(merged));
  const client = row
    ? storefrontClient(toClientRecord({ ...row, config_data: merged }))
    : storefrontClient(fallback!);
  if (key === "rewa") {
    client.subtitle = merged.subtitle || client.subtitle;
    client.phone = merged.phone || REWA_PHONE;
    client.whatsapp =
      (typeof merged.social?.whatsapp?.value === "string" && merged.social.whatsapp.value.trim()) ||
      client.whatsapp ||
      REWA_WHATSAPP;
    client.location = merged.location || REWA_LOCATION;
  }
  if (key === "almahrusa") {
    client.name = merged.brand?.name || client.name;
    client.tagline = merged.brand?.tagline || client.tagline;
    client.subtitle = merged.subtitle || client.subtitle;
    client.phone = merged.phone || ALMAHRUSA_PHONE;
    client.whatsapp =
      (typeof merged.social?.whatsapp?.value === "string" && merged.social.whatsapp.value.trim()) ||
      client.whatsapp ||
      ALMAHRUSA_WHATSAPP;
    client.location = merged.location || ALMAHRUSA_LOCATION;
    client.heroImage = merged.heroImage || client.heroImage;
    client.rating = merged.rating || client.rating;
    client.reviewsCount = merged.reviewsCount || client.reviewsCount;
  }
  if (key === "rewaq") {
    client.name = merged.brand?.name || client.name;
    client.tagline = merged.brand?.tagline || client.tagline;
    client.subtitle = merged.subtitle || client.subtitle;
    client.phone = merged.phone || REWAQ_PHONE;
    client.whatsapp =
      (typeof merged.social?.whatsapp?.value === "string" && merged.social.whatsapp.value.trim()) ||
      client.whatsapp ||
      REWAQ_WHATSAPP;
    client.location = merged.location || REWAQ_LOCATION;
    client.heroImage = merged.heroImage || client.heroImage;
    client.rating = merged.rating || client.rating;
    client.reviewsCount = merged.reviewsCount || client.reviewsCount;
  }
  const appearance = appearanceFromConfig(merged);
  const publicAppearance: AppearancePublic = {
    ...appearance,
    ads: {
      primary: isAdLive(appearance.ads.primary)
        ? appearance.ads.primary
        : { ...appearance.ads.primary, enabled: false },
      secondary: liveAds(appearance.ads.secondary),
    },
  };
  if (publicAppearance.themeKind === "occasion" || publicAppearance.themeKind === "custom") {
    client.theme = publicAppearance.resolvedTheme;
  }

  const contactExtras = publicContactFromConfig(merged);
  if (key === "rewa") {
    contactExtras.map = rewaStorefrontMap();
  }
  if (key === "almahrusa") {
    contactExtras.map = almahrusaStorefrontMap();
  }
  if (key === "rewaq") {
    contactExtras.map = rewaqStorefrontMap();
  }

  return withPublicMedia({
    client,
    catalog,
    appearance: publicAppearance,
    pages: pagesFromConfig(merged),
    contactExtras,
    source: row ? "database" : "default",
  });
}
