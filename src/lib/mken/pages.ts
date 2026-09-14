import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";
import { isPlatformHostname } from "@/lib/mken/tenant-host";
import {
  EMAIL_TYPES,
  SOCIAL_PLATFORMS,
  buildSocialUrl,
  resolveSettings,
} from "@/lib/mken/settings";
import {
  ensureTenantRow,
  writeTenantConfig,
  type MkenConfig,
} from "@/lib/mken/tenant";

export const STOREFRONT_PAGE_IDS = ["home", "about", "services", "work", "contact"] as const;
export type StorefrontPageId = (typeof STOREFRONT_PAGE_IDS)[number];

export const TOGGLEABLE_PAGE_IDS = ["about", "services", "work", "contact"] as const;
export type ToggleablePageId = (typeof TOGGLEABLE_PAGE_IDS)[number];

export const STOREFRONT_PAGE_META: Record<
  StorefrontPageId,
  { label: string; path: string; locked: boolean; description: string }
> = {
  home: {
    label: "الرئيسية",
    path: "",
    locked: true,
    description: "واجهة البداية: العنوان، الخدمات المميزة، عوامل الثقة، ودعوة الإجراء.",
  },
  about: {
    label: "من نحن",
    path: "about",
    locked: false,
    description: "قصة النشاط، الرؤية والرسالة، القيم، الفريق والاعتمادات.",
  },
  services: {
    label: "الخدمات",
    path: "services",
    locked: false,
    description: "تفصيل العروض، آلية العمل، والباقات أو الأسعار.",
  },
  work: {
    label: "أعمالنا",
    path: "work",
    locked: false,
    description: "معرض الأعمال، دراسات الحالة، وآراء العملاء.",
  },
  contact: {
    label: "اتصل بنا",
    path: "contact",
    locked: false,
    description: "نموذج التواصل، بيانات الاتصال، الخريطة، وساعات العمل.",
  },
};

export interface ContentStat {
  label: string;
  value: string;
}

export interface ContentPartner {
  name: string;
  image: string;
}

export interface ContentValue {
  title: string;
  text: string;
}

export interface ContentPerson {
  name: string;
  role: string;
  image: string;
}

export interface ContentCredential {
  title: string;
  text: string;
}

export interface ContentStep {
  title: string;
  text: string;
}

export interface ContentGalleryItem {
  image: string;
  caption: string;
}

export interface ContentCase {
  title: string;
  challenge: string;
  solution: string;
  result: string;
}

export interface ContentTestimonial {
  name: string;
  text: string;
  rating: string;
}

export interface StorefrontPagesPublic {
  enabled: Record<StorefrontPageId, boolean>;
  /** Custom nav labels. Empty string means the default title for that page. */
  labels: Record<StorefrontPageId, string>;
  home: {
    heroVideoUrl: string;
    ctaLabel: string;
    ctaHref: string;
    featuredServiceIds: string[];
    stats: ContentStat[];
    partners: ContentPartner[];
  };
  about: {
    story: string;
    vision: string;
    mission: string;
    values: ContentValue[];
    team: ContentPerson[];
    credentials: ContentCredential[];
  };
  services: {
    processSteps: ContentStep[];
    showPrices: boolean;
  };
  work: {
    gallery: ContentGalleryItem[];
    cases: ContentCase[];
    testimonials: ContentTestimonial[];
  };
  contact: {
    formEnabled: boolean;
    mapEnabled: boolean;
    hoursNote: string;
  };
}

export interface StorefrontContactPublic {
  emails: { id: string; name: string; value: string }[];
  social: { id: string; name: string; url: string; label: string; icon?: string }[];
  hoursStart: string;
  hoursEnd: string;
  map: { lat: number; lng: number; city: string; mapsUrl?: string } | null;
}

export type PagesUpdate = {
  enabled?: Partial<Record<ToggleablePageId, boolean>>;
  labels?: Partial<Record<StorefrontPageId, string>>;
  home?: Partial<StorefrontPagesPublic["home"]>;
  about?: Partial<StorefrontPagesPublic["about"]>;
  services?: Partial<StorefrontPagesPublic["services"]>;
  work?: Partial<StorefrontPagesPublic["work"]>;
  contact?: Partial<StorefrontPagesPublic["contact"]>;
};

const EMPTY_LABELS: Record<StorefrontPageId, string> = {
  home: "",
  about: "",
  services: "",
  work: "",
  contact: "",
};

const EMPTY_PAGES: StorefrontPagesPublic = {
  enabled: {
    home: true,
    about: true,
    services: true,
    work: true,
    contact: true,
  },
  labels: { ...EMPTY_LABELS },
  home: {
    heroVideoUrl: "",
    ctaLabel: "",
    ctaHref: "",
    featuredServiceIds: [],
    stats: [],
    partners: [],
  },
  about: {
    story: "",
    vision: "",
    mission: "",
    values: [],
    team: [],
    credentials: [],
  },
  services: {
    processSteps: [],
    showPrices: true,
  },
  work: {
    gallery: [],
    cases: [],
    testimonials: [],
  },
  contact: {
    formEnabled: true,
    mapEnabled: true,
    hoursNote: "",
  },
};

const LIMITS = {
  stats: 6,
  partners: 12,
  featured: 4,
  values: 12,
  team: 12,
  credentials: 8,
  steps: 8,
  gallery: 24,
  cases: 12,
  testimonials: 12,
  text: 4000,
  short: 200,
  label: 40,
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function clip(value: unknown, max: number): string {
  return str(value).trim().slice(0, max);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function asArray<T>(value: unknown, map: (item: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const mapped = map(item);
    if (mapped) out.push(mapped);
    if (out.length >= max) break;
  }
  return out;
}

export function isStorefrontPageId(value: string): value is StorefrontPageId {
  return (STOREFRONT_PAGE_IDS as readonly string[]).includes(value);
}

export function isToggleablePageId(value: string): value is ToggleablePageId {
  return (TOGGLEABLE_PAGE_IDS as readonly string[]).includes(value);
}

export function defaultPageLabel(id: StorefrontPageId): string {
  return STOREFRONT_PAGE_META[id].label;
}

export function resolvePageLabel(
  pages: Pick<StorefrontPagesPublic, "labels"> | null | undefined,
  id: StorefrontPageId,
  fallback?: string
): string {
  const custom = pages?.labels?.[id]?.trim();
  if (custom) return custom;
  const kindFallback = fallback?.trim();
  if (kindFallback) return kindFallback;
  return defaultPageLabel(id);
}

function readLabels(raw: unknown): Record<StorefrontPageId, string> {
  const source = raw && typeof raw === "object" ? (raw as Partial<Record<StorefrontPageId, string>>) : {};
  const labels = { ...EMPTY_LABELS };
  for (const id of STOREFRONT_PAGE_IDS) {
    labels[id] = clip(source[id], LIMITS.label);
  }
  return labels;
}

export function defaultProcessSteps(): ContentStep[] {
  return [
    { title: "اطلب الخدمة", text: "تواصل معنا أو احجز موعدك أونلاين." },
    { title: "نؤكد التفاصيل", text: "نتفق على الموعد والمتطلبات قبل التنفيذ." },
    { title: "ننفذ ونسلّم", text: "تحصل على الخدمة وفق ما تم الاتفاق عليه." },
  ];
}

export function pagesFromConfig(config: MkenConfig): StorefrontPagesPublic {
  const raw = (config.pages || {}) as Partial<StorefrontPagesPublic> & {
    enabled?: Partial<Record<StorefrontPageId, boolean>>;
  };
  const enabledRaw: Partial<Record<StorefrontPageId, boolean>> = raw.enabled || {};
  const home = (raw.home || {}) as Partial<StorefrontPagesPublic["home"]>;
  const about = (raw.about || {}) as Partial<StorefrontPagesPublic["about"]>;
  const services = (raw.services || {}) as Partial<StorefrontPagesPublic["services"]>;
  const work = (raw.work || {}) as Partial<StorefrontPagesPublic["work"]>;
  const contact = (raw.contact || {}) as Partial<StorefrontPagesPublic["contact"]>;

  return {
    enabled: {
      home: true,
      about: enabledRaw.about !== false,
      services: enabledRaw.services !== false,
      work: enabledRaw.work !== false,
      contact: enabledRaw.contact !== false,
    },
    labels: readLabels(raw.labels),
    home: {
      heroVideoUrl: clip(home.heroVideoUrl, 500),
      ctaLabel: clip(home.ctaLabel, LIMITS.short),
      ctaHref: clip(home.ctaHref, 500),
      featuredServiceIds: asArray(home.featuredServiceIds, (id) => clip(id, 80) || null, LIMITS.featured),
      stats: asArray(
        home.stats,
        (item) => {
          const row = (item || {}) as ContentStat;
          const label = clip(row.label, LIMITS.short);
          const value = clip(row.value, LIMITS.short);
          return label && value ? { label, value } : null;
        },
        LIMITS.stats
      ),
      partners: asArray(
        home.partners,
        (item) => {
          const row = (item || {}) as ContentPartner;
          const name = clip(row.name, LIMITS.short);
          return name ? { name, image: clip(row.image, 500) } : null;
        },
        LIMITS.partners
      ),
    },
    about: {
      story: clip(about.story, LIMITS.text),
      vision: clip(about.vision, LIMITS.text),
      mission: clip(about.mission, LIMITS.text),
      values: asArray(
        about.values,
        (item) => {
          const row = (item || {}) as ContentValue;
          const title = clip(row.title, LIMITS.short);
          return title ? { title, text: clip(row.text, LIMITS.text) } : null;
        },
        LIMITS.values
      ),
      team: asArray(
        about.team,
        (item) => {
          const row = (item || {}) as ContentPerson;
          const name = clip(row.name, LIMITS.short);
          return name ? { name, role: clip(row.role, LIMITS.short), image: clip(row.image, 500) } : null;
        },
        LIMITS.team
      ),
      credentials: asArray(
        about.credentials,
        (item) => {
          const row = (item || {}) as ContentCredential;
          const title = clip(row.title, LIMITS.short);
          return title ? { title, text: clip(row.text, LIMITS.text) } : null;
        },
        LIMITS.credentials
      ),
    },
    services: {
      processSteps: asArray(
        services.processSteps,
        (item) => {
          const row = (item || {}) as ContentStep;
          const title = clip(row.title, LIMITS.short);
          return title ? { title, text: clip(row.text, LIMITS.text) } : null;
        },
        LIMITS.steps
      ),
      showPrices: bool(services.showPrices, true),
    },
    work: {
      gallery: asArray(
        work.gallery,
        (item) => {
          const row = (item || {}) as ContentGalleryItem;
          const image = clip(row.image, 500);
          return image && (isHttpUrl(image) || image.startsWith("/"))
            ? { image, caption: clip(row.caption, LIMITS.short) }
            : null;
        },
        LIMITS.gallery
      ),
      cases: asArray(
        work.cases,
        (item) => {
          const row = (item || {}) as ContentCase;
          const title = clip(row.title, LIMITS.short);
          return title
            ? {
                title,
                challenge: clip(row.challenge, LIMITS.text),
                solution: clip(row.solution, LIMITS.text),
                result: clip(row.result, LIMITS.text),
              }
            : null;
        },
        LIMITS.cases
      ),
      testimonials: asArray(
        work.testimonials,
        (item) => {
          const row = (item || {}) as ContentTestimonial;
          const text = clip(row.text, LIMITS.text);
          return text
            ? { name: clip(row.name, LIMITS.short) || "عميل", text, rating: clip(row.rating, 8) }
            : null;
        },
        LIMITS.testimonials
      ),
    },
    contact: {
      formEnabled: bool(contact.formEnabled, true),
      mapEnabled: bool(contact.mapEnabled, true),
      hoursNote: clip(contact.hoursNote, LIMITS.text),
    },
  };
}

export function publicContactFromConfig(config: MkenConfig): StorefrontContactPublic {
  const settings = resolveSettings(config);
  const booking =
    config.booking && typeof config.booking === "object"
      ? (config.booking as { workingHours?: { start?: unknown; end?: unknown } })
      : {};
  const hours = booking.workingHours || {};
  const emails = EMAIL_TYPES.map((type) => {
    const entry = settings.emails[type.id];
    if (!entry?.enabled || !entry.value) return null;
    return { id: type.id, name: type.name, value: entry.value };
  }).filter((row): row is { id: string; name: string; value: string } => Boolean(row));

  const social = SOCIAL_PLATFORMS.map((platform) => {
    const entry = settings.social[platform.id];
    if (!entry?.enabled || !entry.value) return null;
    const url = buildSocialUrl(platform.id, entry.value);
    if (!url) return null;
    return { id: platform.id, name: platform.name, url, label: platform.name, icon: platform.icon };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const area = settings.serviceArea;
  const mapsUrl = typeof config.mapsUrl === "string" ? config.mapsUrl.trim() : "";
  const rawCenter = config.serviceArea?.center;
  const pinLat = Number(rawCenter?.lat);
  const pinLng = Number(rawCenter?.lng);
  const lat = Number.isFinite(pinLat) ? pinLat : area.center.lat;
  const lng = Number.isFinite(pinLng) ? pinLng : area.center.lng;
  const map =
    area.enabled && Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          lat,
          lng,
          city: (typeof config.serviceArea?.city === "string" && config.serviceArea.city.trim()) || area.city,
          ...(mapsUrl ? { mapsUrl } : {}),
        }
      : null;

  return {
    emails,
    social,
    hoursStart: typeof hours.start === "string" ? hours.start : "",
    hoursEnd: typeof hours.end === "string" ? hours.end : "",
    map,
  };
}

function mergeEnabled(
  current: StorefrontPagesPublic["enabled"],
  update?: Partial<Record<ToggleablePageId, boolean>>
): StorefrontPagesPublic["enabled"] {
  const next = { ...current, home: true };
  if (!update) return next;
  for (const id of TOGGLEABLE_PAGE_IDS) {
    if (typeof update[id] === "boolean") next[id] = update[id] as boolean;
  }
  return next;
}

function mergeLabels(
  current: StorefrontPagesPublic["labels"],
  update?: Partial<Record<StorefrontPageId, string>>
): StorefrontPagesPublic["labels"] {
  const next = { ...current };
  if (!update) return next;
  for (const id of STOREFRONT_PAGE_IDS) {
    if (typeof update[id] === "string") next[id] = clip(update[id], LIMITS.label);
  }
  return next;
}

export function mergePages(config: MkenConfig, update: PagesUpdate): MkenConfig {
  const current = pagesFromConfig(config);
  const next: StorefrontPagesPublic = {
    enabled: mergeEnabled(current.enabled, update.enabled),
    labels: mergeLabels(current.labels, update.labels),
    home: { ...current.home, ...(update.home || {}) },
    about: { ...current.about, ...(update.about || {}) },
    services: { ...current.services, ...(update.services || {}) },
    work: { ...current.work, ...(update.work || {}) },
    contact: { ...current.contact, ...(update.contact || {}) },
  };
  return {
    ...config,
    pages: pagesFromConfig({ pages: next } as MkenConfig),
    updatedAt: new Date().toISOString(),
  };
}

export function validatePages(update: PagesUpdate): string | null {
  if (update.enabled) {
    for (const key of Object.keys(update.enabled)) {
      if (!isToggleablePageId(key) && key !== "home") return "معرّف الصفحة غير صالح";
    }
  }
  if (update.labels) {
    for (const key of Object.keys(update.labels)) {
      if (!isStorefrontPageId(key)) return "معرّف الصفحة غير صالح";
    }
  }
  const video = update.home?.heroVideoUrl;
  if (video && video.trim() && !isHttpUrl(video.trim()) && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(video)) {
    if (!isHttpUrl(clip(video, 500))) return "رابط فيديو الواجهة يجب أن يبدأ بـ http أو https";
  }
  return null;
}

export async function fetchPages(
  slug: string
): Promise<{ pages?: StorefrontPagesPublic; error?: string }> {
  const seed = await ensureTenantRow(slug);
  if (seed.row) {
    const config =
      slug === "rewa"
        ? applyRewaDefaults(seed.row.config_data || {})
        : slug === "almahrusa"
          ? applyAlmahrusaDefaults(seed.row.config_data || {})
          : slug === "rewaq"
            ? applyRewaqDefaults(seed.row.config_data || {})
            : seed.row.config_data || {};
    return { pages: pagesFromConfig(config) };
  }
  return { error: seed.error || "المنشأة غير موجودة أو قاعدة البيانات غير مهيأة" };
}

export async function updatePages(
  slug: string,
  update: PagesUpdate
): Promise<{ pages?: StorefrontPagesPublic; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) return { error: ensured.error || "المنشأة غير موجودة" };
  const nextConfig = mergePages(ensured.row.config_data || {}, update);
  const written = await writeTenantConfig(
    slug,
    slug === "rewa"
      ? applyRewaDefaults(nextConfig)
      : slug === "almahrusa"
        ? applyAlmahrusaDefaults(nextConfig)
        : slug === "rewaq"
          ? applyRewaqDefaults(nextConfig)
          : nextConfig
  );
  if (written.error || !written.row) return { error: written.error || "تعذّر الحفظ" };
  return { pages: pagesFromConfig(written.row.config_data || {}) };
}

export async function isPageEnabled(slug: string, page: ToggleablePageId): Promise<boolean> {
  const { pages } = await fetchPages(slug);
  if (!pages) return true;
  return pages.enabled[page] !== false;
}

export function storefrontPageHref(
  slug: string,
  page: StorefrontPageId,
  pathname: string,
  hostname?: string
): string {
  const suffix = STOREFRONT_PAGE_META[page].path;
  const host =
    hostname || (typeof window !== "undefined" ? window.location.hostname : "");
  if (host && !isPlatformHostname(host)) {
    return suffix ? `/${suffix}` : "/";
  }
  const path = (pathname || "/").toLowerCase();
  const onStore = /^\/store\//.test(path);
  const base = onStore ? `/store/${slug}` : `/subscriber/${slug}`;
  return suffix ? `${base}/${suffix}` : base;
}

export function emptyPages(): StorefrontPagesPublic {
  return structuredClone(EMPTY_PAGES);
}
