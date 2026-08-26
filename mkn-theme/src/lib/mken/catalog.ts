import activitiesJson from "@/data/catalog/activities.json";
import servicesJson from "@/data/catalog/services.json";
import { DEFAULT_CLIENTS, storefrontClient } from "@/data/default-clients";
import { appearanceFromConfig, type AppearancePublic } from "@/lib/mken/appearance";
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

  const services: ResolvedService[] = SERVICES.map((service) => {
    const raw = serviceOverrides[service.id] || {};
    const overrides: ServiceOverrides = pickOverrides(raw, SERVICE_OVERRIDE_FIELDS);
    if (typeof raw.roomCount === "number" && raw.roomCount >= 1) overrides.roomCount = raw.roomCount;
    if (Array.isArray(raw.features)) overrides.features = asStringArray(raw.features);

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
function pruneServices(enabledActivities: string[], enabled: string[]): string[] {
  const allowed = new Set(enabledActivities);
  return enabled.filter((id) => {
    const service = SERVICES.find((s) => s.id === id);
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

  const activityIds = new Set(ACTIVITIES.map((a) => a.id));
  const serviceIds = new Set(SERVICES.map((s) => s.id));

  const nextActivities =
    update.enabledActivities !== undefined
      ? update.enabledActivities.filter((id) => activityIds.has(id))
      : asStringArray(config.enabledActivities);

  const requestedServices =
    update.enabled !== undefined
      ? update.enabled.filter((id) => serviceIds.has(id))
      : asStringArray(config.enabled);

  const nextEnabled = pruneServices(nextActivities, requestedServices);
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

  const written = await writeTenantConfig(slug, config);
  if (written.error || !written.row) {
    return { error: written.error || "تعذّر الحفظ: لا توجد صلاحية كتابة على بيانات المنشأة" };
  }

  return { catalog: resolveCatalog(written.row.config_data || {}) };
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
};

const SEED_CONFIG: Record<string, MkenConfig> = {
  almahrusa: {
    enabledActivities: ["hotels"],
    enabled: ["standard-room", "deluxe-room", "suite-room", "family-suite"],
    featuredActivity: "hotels",
    featured: "standard-room",
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
    enabledActivities: ["healthcare", "fitness", "events"],
    enabled: [
      "dental-checkup",
      "gp-consultation",
      "nutrition-consult",
      "personal-training",
      "event-planning",
    ],
    featuredActivity: "healthcare",
    featured: "dental-checkup",
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
      };
    });

  return { kind, featuredActivity, activities, services };
}

function isSpaService(id: string): boolean {
  if (/spa|massage/i.test(id)) return true;
  const service = SERVICES.find((item) => item.id === id);
  return service?.activityId === "spa-wellness";
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
    .replace(/spa/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/،\s*،/g, "،")
    .replace(/^،\s*/g, "")
    .trim();
}

function stripRewaSpa(config: MkenConfig): MkenConfig {
  const seed = SEED_CONFIG.rewa;
  const activities = (Array.isArray(config.enabledActivities) ? config.enabledActivities : []).filter(
    (id) => id !== "spa-wellness"
  );
  const enabled = (Array.isArray(config.enabled) ? config.enabled : []).filter((id) => !isSpaService(id));
  const next: MkenConfig = {
    ...config,
    enabledActivities: activities.length ? activities : seed.enabledActivities,
    enabled: enabled.length ? enabled : seed.enabled,
  };
  const actList = Array.isArray(next.enabledActivities) ? (next.enabledActivities as string[]) : [];
  const enList = Array.isArray(next.enabled) ? (next.enabled as string[]) : [];

  if (!actList.includes(String(next.featuredActivity)) || next.featuredActivity === "spa-wellness") {
    next.featuredActivity = actList[0] || seed.featuredActivity;
  }
  if (!enList.includes(String(next.featured)) || isSpaService(String(next.featured || ""))) {
    next.featured = enList[0] || seed.featured;
  }
  if (typeof next.subtitle === "string") next.subtitle = scrubSpaCopy(next.subtitle);
  if (next.brand?.description) next.brand = { ...next.brand, description: scrubSpaCopy(next.brand.description) };
  if (next.brand?.tagline && /سبا|مساج|spa|massage/i.test(next.brand.tagline)) {
    next.brand = { ...next.brand, tagline: scrubSpaCopy(next.brand.tagline) };
  }
  if (next.ads?.secondary) {
    next.ads = {
      ...next.ads,
      secondary: next.ads.secondary.filter(
        (ad) => !/سبا|مساج|spa|massage/i.test(`${ad.title || ""} ${ad.text || ""}`)
      ),
    };
  }
  if (next.ads?.primary && /سبا|مساج|spa|massage/i.test(`${next.ads.primary.title || ""} ${next.ads.primary.text || ""}`)) {
    next.ads = { ...next.ads, primary: { ...next.ads.primary, enabled: false } };
  }
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
  return slug === "rewa" ? stripRewaSpa(merged) : merged;
}

export interface PublicStorefront {
  client: StorefrontClient;
  catalog: StorefrontCatalog;
  appearance: AppearancePublic;
  source: "database" | "default";
}

export async function loadPublicStorefront(slug: string): Promise<PublicStorefront | null> {
  const key = slug.trim().toLowerCase();
  if (!key || isPlatformSlug(key)) return null;

  const row = await fetchTenantRow(key);
  const fallback = DEFAULT_CLIENTS.find((client) => client.slug === key);
  if (!row && !fallback) return null;

  const merged = mergeSeedConfig(key, row?.config_data || {});
  const catalog = toPublicCatalog(resolveCatalog(merged));
  const client = row
    ? storefrontClient(toClientRecord({ ...row, config_data: merged }))
    : storefrontClient(fallback!);
  if (key === "rewa") {
    client.subtitle = merged.subtitle || client.subtitle;
  }
  const appearance = appearanceFromConfig(merged);
  if (appearance.themeKind === "occasion" || appearance.themeKind === "custom") {
    client.theme = appearance.resolvedTheme;
  }

  return {
    client,
    catalog,
    appearance,
    source: row ? "database" : "default",
  };
}
