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
  social: { id: string; name: string; url: string; label: string }[];
  hoursStart: string;
  hoursEnd: string;
  map: { lat: number; lng: number; city: string } | null;
}

export type PagesUpdate = {
  enabled?: Partial<Record<ToggleablePageId, boolean>>;
  home?: Partial<StorefrontPagesPublic["home"]>;
  about?: Partial<StorefrontPagesPublic["about"]>;
  services?: Partial<StorefrontPagesPublic["services"]>;
  work?: Partial<StorefrontPagesPublic["work"]>;
  contact?: Partial<StorefrontPagesPublic["contact"]>;
};

const EMPTY_PAGES: StorefrontPagesPublic = {
  enabled: {
    home: true,
    about: true,
    services: true,
    work: true,
    contact: true,
  },
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
  values: 8,
  team: 12,
  credentials: 8,
  steps: 8,
  gallery: 24,
  cases: 12,
  testimonials: 12,
  text: 4000,
  short: 200,
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
          return image && isHttpUrl(image) ? { image, caption: clip(row.caption, LIMITS.short) } : null;
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
    return { id: platform.id, name: platform.name, url, label: platform.name };
  }).filter((row): row is StorefrontContactPublic["social"][number] => Boolean(row));

  const area = settings.serviceArea;
  const map =
    area.enabled && Number.isFinite(area.center.lat) && Number.isFinite(area.center.lng)
      ? { lat: area.center.lat, lng: area.center.lng, city: area.city }
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

export function mergePages(config: MkenConfig, update: PagesUpdate): MkenConfig {
  const current = pagesFromConfig(config);
  const next: StorefrontPagesPublic = {
    enabled: mergeEnabled(current.enabled, update.enabled),
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
  if (seed.row) return { pages: pagesFromConfig(seed.row.config_data || {}) };
  return { error: seed.error || "المنشأة غير موجودة أو قاعدة البيانات غير مهيأة" };
}

export async function updatePages(
  slug: string,
  update: PagesUpdate
): Promise<{ pages?: StorefrontPagesPublic; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) return { error: ensured.error || "المنشأة غير موجودة" };
  const written = await writeTenantConfig(slug, mergePages(ensured.row.config_data || {}, update));
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
