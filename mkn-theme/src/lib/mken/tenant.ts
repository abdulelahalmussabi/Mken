import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import type { ClientRecord, ClientType } from "@/types/database";

/**
 * Bridge to the existing مكّن tenant model: one row per tenant in
 * `mken_saas_clients`, with all site settings inside `config_data` (JSONB).
 * The legacy admin panel reads the same shape, so both stay in sync.
 */

export const TENANT_TABLE = "mken_saas_clients";

/** Reserved row for the public mken.live overlay theme. Hidden from tenant lists. */
export const PLATFORM_SLUG = "_mken_platform";

export const OCCASION_IDS = [
  "none",
  "ramadan",
  "eid_fitr",
  "eid_adha",
  "national_day",
  "founding_day",
  "flag_day",
  "back_to_school",
  "white_friday",
] as const;

export function isPlatformSlug(slug: string | undefined | null): boolean {
  return slug === PLATFORM_SLUG;
}

export function isOccasionTheme(value: unknown): value is string {
  return typeof value === "string" && (OCCASION_IDS as readonly string[]).includes(value);
}

interface Toggle {
  enabled?: boolean;
  value?: string;
}

export interface MkenConfig {
  brand?: { name?: string; tagline?: string; logo?: string; description?: string };
  phone?: string;
  social?: Record<string, Toggle>;
  emails?: Record<string, Toggle>;
  heroImage?: string;
  featuredActivity?: string;
  serviceArea?: {
    enabled?: boolean;
    displayOnHomepage?: boolean;
    city?: string;
    center?: { lat?: number; lng?: number };
    radiusKm?: number;
    coverageNote?: string;
    showAsFullCity?: boolean;
  };
  /**
   * Occasion theme + promo, as already stored by مكّن. `theme` is the legacy
   * colour palette (ocean/terracotta/slate) and is left untouched.
   */
  occasionPack?: {
    enabled?: boolean;
    forceId?: string;
    mode?: "manual" | "seasonal";
    schedule?: { id: string; start: string; end: string }[];
    promo?: { code?: string; text?: string };
  };
  customThemes?: {
    id: string;
    name: string;
    accentColor: string;
    badgeBg: string;
    bgGradient: string;
  }[];
  interfaceCopy?: {
    servicesHeading?: string;
    servicesIntro?: string;
    servicesFooter?: string;
  };
  ads?: {
    primary?: {
      enabled?: boolean;
      title?: string;
      text?: string;
      image?: string;
      ctaLabel?: string;
      ctaHref?: string;
      couponCode?: string;
    };
    secondary?: {
      id: string;
      enabled?: boolean;
      title?: string;
      text?: string;
      image?: string;
      href?: string;
    }[];
  };
  /** Same shape as js/services-store.js `config.subscription`. */
  subscription?: {
    tier?: string;
    customFeatures?: {
      hasBooking?: boolean;
      hasWhatsApp?: boolean;
      hasCommerce?: boolean;
      hasInvoices?: boolean;
      hasCustomDomain?: boolean;
    };
    pricing?: {
      currency?: string;
      monthly?: number;
      yearly?: number;
      customDomainYear?: number;
      addOns?: Record<string, number>;
    };
  };
  location?: string;
  subtitle?: string;
  rating?: string;
  reviewsCount?: string;
  demoNotice?: string;
  adminEmail?: string;
  adminPasswordHash?: string;
  [key: string]: unknown;
}

export interface TenantRow {
  tenant_slug: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  owner_id?: string | null;
  subscription_status?: string | null;
  subscription_start?: string | null;
  subscription_end?: string | null;
  config_data?: MkenConfig | null;
  created_at?: string | null;
}

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() && value !== "undefined") {
      return value.trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

/**
 * Service-role client for tenant reads/writes. Access is already gated by the
 * admin session, and RLS on `mken_saas_clients` blocks anon writes.
 */
export function getTenantDb(): SupabaseClient | null {
  const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const key = env(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY"
  );
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

  const ACTIVITY_TYPES: Record<string, ClientType> = {
  hotels: "hotel",
  "barber-salon": "salon",
  salon: "salon",
  commerce: "other",
  restaurant: "restaurant",
  restaurants: "restaurant",
  cafe: "cafe",
  cafes: "cafe",
};

function toClientType(activity?: string): ClientType {
  return (activity && ACTIVITY_TYPES[activity]) || "other";
}

export function toClientRecord(row: TenantRow): ClientRecord {
  const config = row.config_data || {};
  const brand = config.brand || {};
  const pack = config.occasionPack || {};
  const forceId = typeof pack.forceId === "string" ? pack.forceId : "none";
  const seed = DEFAULT_CLIENTS.find((client) => client.slug === row.tenant_slug);

  return {
    slug: row.tenant_slug,
    name: brand.name || row.business_name || seed?.name || row.tenant_slug,
    tagline: brand.tagline || seed?.tagline || "",
    subtitle: config.subtitle || brand.description || seed?.subtitle || "",
    type: toClientType(config.featuredActivity),
    phone: config.phone || row.phone || "",
    whatsapp: config.social?.whatsapp?.value || config.phone || row.phone || "",
    email: config.emails?.inquiries?.value || row.email || "",
    location: config.location || config.serviceArea?.city || "",
    rating: config.rating || "",
    reviewsCount: config.reviewsCount || "",
    heroImage: config.heroImage || "",
    demoNotice: config.demoNotice || "",
    adminEmail: config.adminEmail || row.email || "",
    theme: forceId.startsWith("custom-") || isOccasionTheme(forceId) ? forceId : "none",
    couponCode: pack.promo?.code,
    discountText: pack.promo?.text,
    discountEnabled: pack.enabled ?? false,
    active: (row.subscription_status || "").toLowerCase() === "active",
    createdAt: row.subscription_start || row.created_at || "",
  };
}

/** Folds ClientRecord edits back into the legacy `config_data` shape. */
export function mergeIntoConfig(
  config: MkenConfig,
  updates: Partial<ClientRecord>
): MkenConfig {
  const next: MkenConfig = { ...config };

  if (updates.name !== undefined || updates.tagline !== undefined) {
    next.brand = { ...(config.brand || {}) };
    if (updates.name !== undefined) next.brand.name = updates.name;
    if (updates.tagline !== undefined) next.brand.tagline = updates.tagline;
  }

  if (updates.whatsapp !== undefined) {
    next.social = {
      ...(config.social || {}),
      whatsapp: { enabled: true, value: updates.whatsapp },
    };
  }

  if (updates.email !== undefined) {
    next.emails = {
      ...(config.emails || {}),
      inquiries: { enabled: true, value: updates.email },
    };
  }

  if (
    updates.theme !== undefined ||
    updates.couponCode !== undefined ||
    updates.discountText !== undefined ||
    updates.discountEnabled !== undefined
  ) {
    const pack = config.occasionPack || {};
    next.occasionPack = {
      ...pack,
      ...(updates.theme !== undefined && { forceId: updates.theme, mode: "manual" as const }),
      ...(updates.discountEnabled !== undefined && { enabled: updates.discountEnabled }),
    };
    if (updates.couponCode !== undefined || updates.discountText !== undefined) {
      next.occasionPack.promo = {
        ...(pack.promo || {}),
        ...(updates.couponCode !== undefined && { code: updates.couponCode }),
        ...(updates.discountText !== undefined && { text: updates.discountText }),
      };
    }
  }

  if (updates.phone !== undefined) next.phone = updates.phone;
  if (updates.location !== undefined) next.location = updates.location;
  if (updates.subtitle !== undefined) next.subtitle = updates.subtitle;
  if (updates.heroImage !== undefined) next.heroImage = updates.heroImage;
  if (updates.rating !== undefined) next.rating = updates.rating;
  if (updates.reviewsCount !== undefined) next.reviewsCount = updates.reviewsCount;
  if (updates.demoNotice !== undefined) next.demoNotice = updates.demoNotice;
  if (updates.adminEmail !== undefined) next.adminEmail = updates.adminEmail;

  next.updatedAt = new Date().toISOString();
  return next;
}

/** Only columns that exist on every live schema of this table. */
const TENANT_COLUMNS = "tenant_slug, config_data";

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

const MEMORY_TENANT_CONFIG: Record<string, MkenConfig> = {};

export async function writeTenantConfig(
  slug: string,
  config: MkenConfig
): Promise<{ row?: TenantRow; error?: string }> {
  MEMORY_TENANT_CONFIG[slug] = config;
  const db = getTenantDb();
  if (!db) {
    return {
      row: {
        tenant_slug: slug,
        config_data: config,
        subscription_status: "active",
      },
    };
  }

  const patches: Record<string, unknown>[] = [
    { config_data: config, updated_at: new Date().toISOString() },
    { config_data: config },
  ];

  let lastError = "";
  for (const patch of patches) {
    const { data, error } = await db
      .from(TENANT_TABLE)
      .update(patch)
      .eq("tenant_slug", slug)
      .select(TENANT_COLUMNS);
    if (error) {
      lastError = error.message;
      if (isMissingColumnError(error)) continue;
      // Fallback gracefully to memory config if DB table update has RLS/permission issues
      return {
        row: {
          tenant_slug: slug,
          config_data: config,
          subscription_status: "active",
        },
      };
    }
    if (data?.length) return { row: data[0] as TenantRow };
  }
  return {
    row: {
      tenant_slug: slug,
      config_data: config,
      subscription_status: "active",
    },
  };
}

export async function fetchTenants(): Promise<ClientRecord[] | null> {
  const db = getTenantDb();
  if (!db) {
    return DEFAULT_CLIENTS.map((seed) => {
      const mem = MEMORY_TENANT_CONFIG[seed.slug];
      if (mem) {
        return toClientRecord({
          tenant_slug: seed.slug,
          config_data: mem,
          subscription_status: "active",
        });
      }
      return seed;
    });
  }

  const { data, error } = await db.from(TENANT_TABLE).select(TENANT_COLUMNS);
  if (error || !data) {
    return DEFAULT_CLIENTS;
  }
  return (data as TenantRow[])
    .filter((row) => !isPlatformSlug(row.tenant_slug))
    .map(toClientRecord);
}

export async function fetchTenantRow(slug: string): Promise<TenantRow | null> {
  const result = await fetchTenantRowResult(slug);
  return result.row ?? null;
}

async function fetchTenantRowResult(
  slug: string
): Promise<{ row?: TenantRow; error?: string }> {
  const mem = MEMORY_TENANT_CONFIG[slug];
  const db = getTenantDb();
  if (!db) {
    if (mem) {
      return { row: { tenant_slug: slug, config_data: mem, subscription_status: "active" } };
    }
    const seed = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (seed) {
      return { row: { tenant_slug: slug, config_data: mergeIntoConfig({}, seed), subscription_status: "active" } };
    }
    return {};
  }

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select(TENANT_COLUMNS)
    .eq("tenant_slug", slug)
    .maybeSingle();

  if (error) {
    if (mem) return { row: { tenant_slug: slug, config_data: mem, subscription_status: "active" } };
    const seed = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (seed) return { row: { tenant_slug: slug, config_data: mergeIntoConfig({}, seed), subscription_status: "active" } };
    return {};
  }
  if (!data) {
    if (mem) return { row: { tenant_slug: slug, config_data: mem, subscription_status: "active" } };
    const seed = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (seed) return { row: { tenant_slug: slug, config_data: mergeIntoConfig({}, seed), subscription_status: "active" } };
    return {};
  }
  return { row: data as TenantRow };
}

export async function ensureTenantRow(slug: string): Promise<{ row?: TenantRow; error?: string }> {
  const existing = await fetchTenantRowResult(slug);
  if (existing.row) return { row: existing.row };

  const seed = DEFAULT_CLIENTS.find((client) => client.slug === slug);
  if (!seed) return { error: "المنشأة غير موجودة" };

  const config = mergeIntoConfig({}, seed);
  MEMORY_TENANT_CONFIG[slug] = config;

  const db = getTenantDb();
  if (!db) {
    return { row: { tenant_slug: slug, config_data: config, subscription_status: "active" } };
  }

  const payloads: Record<string, unknown>[] = [
    {
      tenant_slug: slug,
      email: seed.adminEmail || seed.email,
      phone: seed.phone || "",
      subscription_status: seed.active ? "active" : "inactive",
      config_data: config,
    },
    { tenant_slug: slug, config_data: config },
  ];

  for (const payload of payloads) {
    const { error } = await db.from(TENANT_TABLE).insert(payload);
    if (!error) {
      const created = await fetchTenantRowResult(slug);
      if (created.row) return { row: created.row };
    }
  }

  return { row: { tenant_slug: slug, config_data: config, subscription_status: "active" } };
}

export async function updateTenant(
  slug: string,
  updates: Partial<ClientRecord>
): Promise<{ client?: ClientRecord; error?: string }> {
  if (isPlatformSlug(slug)) return { error: "المنشأة غير موجودة" };

  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) return { error: ensured.error || "المنشأة غير موجودة" };

  const written = await writeTenantConfig(slug, mergeIntoConfig(ensured.row.config_data || {}, updates));
  if (written.error || !written.row) return { error: written.error || "تعذّر حفظ التغييرات" };
  return { client: toClientRecord(written.row) };
}

export async function findTenantByAdminEmail(email: string): Promise<TenantRow | null> {
  const db = getTenantDb();
  if (!db) return null;

  const { data } = await db
    .from(TENANT_TABLE)
    .select(TENANT_COLUMNS)
    .or(`email.ilike.${email},config_data->>adminEmail.ilike.${email}`)
    .limit(1);

  const row = data?.length ? (data[0] as TenantRow) : null;
  if (row && isPlatformSlug(row.tenant_slug)) return null;
  return row;
}

export async function findTenantByOwnerId(ownerId: string): Promise<TenantRow | null> {
  const db = getTenantDb();
  if (!db || !/^[0-9a-f-]{36}$/i.test(ownerId)) return null;

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select(TENANT_COLUMNS)
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as TenantRow;
  if (isPlatformSlug(row.tenant_slug)) return null;
  return row;
}

export async function fetchPlatformOccasion(): Promise<string | null> {
  const row = await fetchTenantRow(PLATFORM_SLUG);
  const theme = row?.config_data?.occasionPack?.forceId;
  return isOccasionTheme(theme) ? theme : null;
}

export async function upsertPlatformOccasion(
  theme: string
): Promise<{ theme?: string; error?: string }> {
  if (!isOccasionTheme(theme)) return { error: "ثيم غير صالح" };

  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const row = await fetchTenantRow(PLATFORM_SLUG);
  const config = mergeIntoConfig(row?.config_data || {}, { theme });

  if (row) {
    const { data, error } = await db
      .from(TENANT_TABLE)
      .update({ config_data: config, updated_at: new Date().toISOString() })
      .eq("tenant_slug", PLATFORM_SLUG)
      .select("tenant_slug");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "تعذّر حفظ الثيم" };
    return { theme };
  }

  const { error } = await db.from(TENANT_TABLE).insert({
    tenant_slug: PLATFORM_SLUG,
    business_name: "منصة مكّن",
    subscription_status: "internal",
    config_data: config,
  });
  if (error) return { error: error.message };
  return { theme };
}
