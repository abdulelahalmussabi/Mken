import {
  ensureTenantRow,
  mergeIntoConfig,
  writeTenantConfig,
  type MkenConfig,
} from "@/lib/mken/tenant";
import { DEFAULT_CLIENTS } from "@/data/default-clients";
import { logoValidationError } from "@/lib/mken/logo-crop";
import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";

/**
 * Tenant identity settings stored in `config_data`: brand, phone, social
 * handles, contact emails and the service area. Field names, normalisation and
 * link building mirror js/services-store.js + js/social-catalog.js so the
 * legacy site renders the values written here without any adaptation.
 */

export interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  hint: string;
  inputMode?: "tel" | "text";
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: "whatsapp", name: "واتساب", icon: "💬", placeholder: "966543530333", hint: "رقم الجوال بصيغة دولية بدون + أو صفر", inputMode: "tel" },
  { id: "instagram", name: "إنستغرام", icon: "📷", placeholder: "mkenalkhayal", hint: "اسم المستخدم فقط أو الرابط الكامل" },
  { id: "twitter", name: "إكس (تويتر)", icon: "𝕏", placeholder: "mkenalkhayal", hint: "اسم المستخدم فقط أو الرابط الكامل" },
  { id: "facebook", name: "فيسبوك", icon: "👤", placeholder: "mkenalkhayal", hint: "اسم الصفحة أو الرابط الكامل" },
  { id: "tiktok", name: "تيك توك", icon: "🎵", placeholder: "mkenalkhayal", hint: "اسم المستخدم مع أو بدون @" },
  { id: "snapchat", name: "سناب شات", icon: "👻", placeholder: "mkenalkhayal", hint: "اسم المستخدم فقط" },
  { id: "telegram", name: "تيليجرام", icon: "✈️", placeholder: "mkenalkhayal", hint: "اسم المستخدم مع أو بدون @" },
  { id: "youtube", name: "يوتيوب", icon: "▶️", placeholder: "@mkenalkhayal", hint: "اسم القناة أو الرابط الكامل" },
  { id: "linkedin", name: "لينكدإن", icon: "💼", placeholder: "company/mkenalkhayal", hint: "in/username أو company/name أو الرابط الكامل" },
];

export interface EmailType {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  hint: string;
}

export const EMAIL_TYPES: EmailType[] = [
  { id: "inquiries", name: "الاستفسارات", icon: "✉️", placeholder: "info@mken.live", hint: "استفسارات عامة وطلبات معلومات" },
  { id: "sales", name: "المبيعات", icon: "🛒", placeholder: "sales@mken.live", hint: "عروض الأسعار والخدمات التجارية" },
  { id: "support", name: "خدمة العملاء", icon: "🎧", placeholder: "CS@mken.live", hint: "متابعة الطلبات والدعم الفني" },
];

export interface Toggle {
  enabled: boolean;
  value: string;
}

export interface ServiceArea {
  enabled: boolean;
  displayOnHomepage: boolean;
  city: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  coverageNote: string;
  showAsFullCity: boolean;
}

export interface TenantSettings {
  brand: { name: string; tagline: string; logo: string };
  phone: string;
  heroImage: string;
  social: Record<string, Toggle>;
  emails: Record<string, Toggle>;
  serviceArea: ServiceArea;
  updatedAt: string;
}

const DEFAULT_SERVICE_AREA: ServiceArea = {
  enabled: true,
  displayOnHomepage: true,
  city: "جدة",
  center: { lat: 21.485811, lng: 39.192505 },
  radiusKm: 25,
  coverageNote: "نصل إلى جميع أحياء جدة خلال ساعتين",
  showAsFullCity: true,
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function toggleMap(raw: unknown, ids: string[]): Record<string, Toggle> {
  const incoming = (raw || {}) as Record<string, unknown>;
  const out: Record<string, Toggle> = {};
  for (const id of ids) {
    const rawEntry = incoming[id];
    if (typeof rawEntry === "string") {
      const value = str(rawEntry);
      out[id] = { enabled: Boolean(value), value };
      continue;
    }
    const entry = (rawEntry || {}) as { enabled?: unknown; value?: unknown };
    const on =
      entry.enabled === true ||
      entry.enabled === "true" ||
      entry.enabled === 1;
    out[id] = { enabled: on, value: str(entry.value) };
  }
  return out;
}

export function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function stripAt(value: string): string {
  return (value || "").trim().replace(/^@+/, "");
}

/** Mirrors MkenSocialCatalog.buildUrl so previews match the public site. */
export function buildSocialUrl(platformId: string, rawValue: string): string {
  const value = (rawValue || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  switch (platformId) {
    case "whatsapp": {
      const digits = digitsOnly(value);
      return digits ? `https://wa.me/${digits}` : "";
    }
    case "instagram":
      return `https://instagram.com/${encodeURIComponent(stripAt(value))}`;
    case "twitter":
      return `https://x.com/${encodeURIComponent(stripAt(value))}`;
    case "facebook":
      return `https://facebook.com/${encodeURIComponent(stripAt(value))}`;
    case "tiktok":
      return `https://www.tiktok.com/@${encodeURIComponent(stripAt(value))}`;
    case "snapchat":
      return `https://www.snapchat.com/add/${encodeURIComponent(stripAt(value))}`;
    case "telegram":
      return `https://t.me/${encodeURIComponent(stripAt(value))}`;
    case "youtube": {
      const handle = stripAt(value);
      if (/^(channel|c|user)\//i.test(handle)) return `https://www.youtube.com/${handle}`;
      return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    }
    case "linkedin": {
      if (/^(in|company)\//i.test(value)) {
        return `https://www.linkedin.com/${value.replace(/^\/+/, "")}`;
      }
      return `https://www.linkedin.com/in/${encodeURIComponent(stripAt(value))}`;
    }
    default:
      return "";
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || "").trim());
}

function normalizeServiceArea(raw: unknown): ServiceArea {
  const incoming = (raw || {}) as Record<string, unknown>;
  const center = (incoming.center || {}) as { lat?: unknown; lng?: unknown };
  const lat = Number(center.lat);
  const lng = Number(center.lng);
  const radius = Number(incoming.radiusKm);

  return {
    enabled: incoming.enabled !== false,
    displayOnHomepage: incoming.displayOnHomepage !== false,
    city: str(incoming.city, DEFAULT_SERVICE_AREA.city) || DEFAULT_SERVICE_AREA.city,
    center: {
      lat: Number.isFinite(lat) ? lat : DEFAULT_SERVICE_AREA.center.lat,
      lng: Number.isFinite(lng) ? lng : DEFAULT_SERVICE_AREA.center.lng,
    },
    radiusKm: Number.isFinite(radius) && radius > 0 ? Math.min(500, radius) : DEFAULT_SERVICE_AREA.radiusKm,
    coverageNote: str(incoming.coverageNote),
    showAsFullCity: incoming.showAsFullCity !== false,
  };
}

export function resolveSettings(config: MkenConfig): TenantSettings {
  const brand = (config.brand || {}) as Record<string, unknown>;

  return {
    brand: {
      name: str(brand.name),
      tagline: str(brand.tagline),
      logo: str(brand.logo),
    },
    phone: str(config.phone),
    heroImage: str(config.heroImage),
    social: toggleMap(config.social, SOCIAL_PLATFORMS.map((p) => p.id)),
    emails: toggleMap(config.emails, EMAIL_TYPES.map((t) => t.id)),
    serviceArea: normalizeServiceArea(config.serviceArea),
    updatedAt: str(config.updatedAt),
  };
}

export async function fetchTenantSettings(
  slug: string
): Promise<{ settings?: TenantSettings; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) {
    const seed = DEFAULT_CLIENTS.find((c) => c.slug === slug);
    if (seed) return { settings: resolveSettings(mergeIntoConfig({}, seed)) };
    return { error: ensured.error || "المنشأة غير موجودة" };
  }
  const config =
    slug === "rewa"
      ? applyRewaDefaults(ensured.row.config_data || {})
      : slug === "almahrusa"
        ? applyAlmahrusaDefaults(ensured.row.config_data || {})
        : slug === "rewaq"
          ? applyRewaqDefaults(ensured.row.config_data || {})
          : ensured.row.config_data || {};
  return { settings: resolveSettings(config) };
}

export interface SettingsUpdate {
  brand?: { name?: string; tagline?: string; logo?: string };
  phone?: string;
  heroImage?: string;
  social?: Record<string, Partial<Toggle>>;
  emails?: Record<string, Partial<Toggle>>;
  serviceArea?: Partial<Omit<ServiceArea, "center">> & {
    center?: { lat?: number; lng?: number };
  };
}

export function validateSettings(update: SettingsUpdate): string | null {
  if (update.brand?.name !== undefined && !update.brand.name.trim()) {
    return "اسم المنشأة مطلوب";
  }

  const logoError = logoValidationError(update.brand?.logo);
  if (logoError) return logoError;

  if (update.phone !== undefined && update.phone.trim()) {
    const digits = digitsOnly(update.phone);
    if (digits.length < 9 || digits.length > 15) return "رقم الجوال غير صحيح";
  }

  for (const [id, entry] of Object.entries(update.emails || {})) {
    const value = str(entry.value);
    if (entry.enabled && !value) return `البريد (${id}) مطلوب عند تمكينه`;
    if (value && !isValidEmail(value)) return `البريد (${id}) غير صحيح`;
  }

  for (const [id, entry] of Object.entries(update.social || {})) {
    if (entry.enabled && !str(entry.value)) return `حساب (${id}) مطلوب عند تمكينه`;
  }

  const area = update.serviceArea;
  if (area) {
    if (area.radiusKm !== undefined && (!Number.isFinite(area.radiusKm) || area.radiusKm <= 0)) {
      return "نطاق التغطية يجب أن يكون رقمًا أكبر من صفر";
    }
    const lat = area.center?.lat;
    const lng = area.center?.lng;
    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      return "خط العرض غير صحيح";
    }
    if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      return "خط الطول غير صحيح";
    }
  }

  return null;
}

export async function updateTenantSettings(
  slug: string,
  update: SettingsUpdate
): Promise<{ settings?: TenantSettings; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  const base = ensured.row?.config_data || {};
  const config: MkenConfig = {
    ...(slug === "rewa"
      ? applyRewaDefaults(base)
      : slug === "almahrusa"
        ? applyAlmahrusaDefaults(base)
        : slug === "rewaq"
          ? applyRewaqDefaults(base)
          : base),
  };
  const current = resolveSettings(config);

  if (update.brand) {
    config.brand = {
      ...(config.brand || {}),
      name: update.brand.name !== undefined ? update.brand.name.trim() : current.brand.name,
      tagline: update.brand.tagline !== undefined ? update.brand.tagline.trim() : current.brand.tagline,
      logo: update.brand.logo !== undefined ? update.brand.logo.trim() : current.brand.logo,
    };
  }

  if (update.phone !== undefined) config.phone = update.phone.trim();
  if (update.heroImage !== undefined) config.heroImage = update.heroImage.trim();

  if (update.social) {
    const next = { ...current.social };
    for (const platform of SOCIAL_PLATFORMS) {
      const incoming = update.social[platform.id];
      if (!incoming) continue;
      const value = incoming.value !== undefined ? str(incoming.value) : next[platform.id].value;
      const enabled =
        incoming.enabled !== undefined
          ? incoming.enabled
          : Boolean(value) || next[platform.id].enabled;
      next[platform.id] = { enabled, value };
    }
    // The legacy site falls back to config.phone when WhatsApp has no number.
    if (next.whatsapp.enabled && !next.whatsapp.value) {
      next.whatsapp.value = digitsOnly(str(config.phone));
    }
    config.social = next;
  }

  if (update.emails) {
    const next = { ...current.emails };
    for (const type of EMAIL_TYPES) {
      const incoming = update.emails[type.id];
      if (!incoming) continue;
      next[type.id] = {
        enabled: incoming.enabled ?? next[type.id].enabled,
        value: incoming.value !== undefined ? str(incoming.value) : next[type.id].value,
      };
    }
    config.emails = next;
  }

  if (update.serviceArea) {
    const area = update.serviceArea;
    config.serviceArea = {
      ...current.serviceArea,
      ...(area.enabled !== undefined && { enabled: area.enabled }),
      ...(area.displayOnHomepage !== undefined && { displayOnHomepage: area.displayOnHomepage }),
      ...(area.city !== undefined && { city: area.city.trim() }),
      ...(area.radiusKm !== undefined && { radiusKm: area.radiusKm }),
      ...(area.coverageNote !== undefined && { coverageNote: area.coverageNote.trim() }),
      ...(area.showAsFullCity !== undefined && { showAsFullCity: area.showAsFullCity }),
      center: {
        lat: area.center?.lat ?? current.serviceArea.center.lat,
        lng: area.center?.lng ?? current.serviceArea.center.lng,
      },
    };
  }

  config.updatedAt = new Date().toISOString();

  const written = await writeTenantConfig(slug, config);
  const updatedRow = written.row || { tenant_slug: slug, config_data: config };
  return { settings: resolveSettings(updatedRow.config_data || config) };
}
