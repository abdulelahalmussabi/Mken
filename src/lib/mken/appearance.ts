import {
  ensureTenantRow,
  isOccasionTheme,
  writeTenantConfig,
  type MkenConfig,
} from "@/lib/mken/tenant";
import { isolateTenantHref } from "@/lib/mken/tenant-host";
import { applyAlmahrusaDefaults } from "@/lib/mken/almahrusa-content";
import { applyRewaqDefaults } from "@/lib/mken/rewaq-content";
import { applyRewaDefaults } from "@/lib/mken/rewa-content";
import { isAdLive, liveAds, riyadhTodayYmd } from "@/lib/mken/ad-schedule";

export { isAdLive, liveAds, riyadhTodayYmd };

export type ThemeMode = "manual" | "seasonal";
export type ThemeKind = "occasion" | "custom" | "none";

export interface ThemeScheduleItem {
  id: string;
  start: string;
  end: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  accentColor: string;
  badgeBg: string;
  bgGradient: string;
}

export interface InterfaceCopy {
  servicesHeading: string;
  servicesIntro: string;
  servicesFooter: string;
}

export interface PrimaryAd {
  enabled: boolean;
  title: string;
  text: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
  couponCode: string;
  /** YYYY-MM-DD in Asia/Riyadh. Empty = no start bound. */
  startDate: string;
  /** YYYY-MM-DD in Asia/Riyadh. Empty = does not expire. */
  endDate: string;
}

export interface SecondaryAd {
  id: string;
  enabled: boolean;
  title: string;
  text: string;
  image: string;
  href: string;
  features: string[];
  badge: string;
  price: string;
  ctaLabel: string;
  startDate: string;
  endDate: string;
}

export interface AppearancePublic {
  mode: ThemeMode;
  forceId: string;
  resolvedTheme: string;
  themeKind: ThemeKind;
  schedule: ThemeScheduleItem[];
  customThemes: CustomTheme[];
  customTheme: CustomTheme | null;
  darkModeEnabled: boolean;
  interfaceCopy: InterfaceCopy;
  ads: {
    primary: PrimaryAd;
    secondary: SecondaryAd[];
  };
}

export interface AppearanceUpdate {
  mode?: ThemeMode;
  forceId?: string;
  schedule?: ThemeScheduleItem[];
  customThemes?: CustomTheme[];
  darkModeEnabled?: boolean;
  interfaceCopy?: Partial<InterfaceCopy>;
  ads?: {
    primary?: Partial<PrimaryAd>;
    secondary?: SecondaryAd[];
  };
}

const EMPTY_COPY: InterfaceCopy = {
  servicesHeading: "",
  servicesIntro: "",
  servicesFooter: "",
};

const EMPTY_PRIMARY: PrimaryAd = {
  enabled: false,
  title: "",
  text: "",
  image: "",
  ctaLabel: "",
  ctaHref: "",
  couponCode: "",
  startDate: "",
  endDate: "",
};

const DEFAULT_AD_CTA = "احجز هذه الخدمة الآن";

function optionalYmd(value: unknown): string {
  const raw = str(value).trim();
  if (!raw) return "";
  return isYmd(raw) ? raw : "";
}

function readFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item).trim())
    .filter(Boolean)
    .slice(0, 8);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function isCustomThemeId(id: string): boolean {
  return id.startsWith("custom-");
}

export function classifyThemeId(
  id: string | undefined | null,
  customThemes: CustomTheme[]
): { id: string; kind: ThemeKind } {
  const value = (id || "none").trim() || "none";
  if (value === "none") return { id: "none", kind: "none" };
  if (isOccasionTheme(value)) return { id: value, kind: "occasion" };
  if (customThemes.some((theme) => theme.id === value) || isCustomThemeId(value)) {
    return { id: value, kind: "custom" };
  }
  return { id: "none", kind: "none" };
}

function todayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resolveActiveTheme(
  config: MkenConfig,
  now = new Date()
): { id: string; kind: ThemeKind } {
  const customThemes = readCustomThemes(config);
  const pack = config.occasionPack || {};
  const forceId = str(pack.forceId, "none");
  const mode: ThemeMode = pack.mode === "seasonal" ? "seasonal" : "manual";

  if (mode === "seasonal") {
    const covering = readSchedule(config)
      .filter((item) => item.start <= todayYmd(now) && item.end >= todayYmd(now))
      .sort((a, b) => b.start.localeCompare(a.start));
    if (covering[0]) return classifyThemeId(covering[0].id, customThemes);
  }

  return classifyThemeId(forceId, customThemes);
}

function readSchedule(config: MkenConfig): ThemeScheduleItem[] {
  const raw = config.occasionPack?.schedule;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as ThemeScheduleItem;
      if (!row || typeof row !== "object") return null;
      const id = str(row.id);
      if (!id || !isYmd(row.start) || !isYmd(row.end)) return null;
      return { id, start: row.start, end: row.end };
    })
    .filter((item): item is ThemeScheduleItem => Boolean(item));
}

function readCustomThemes(config: MkenConfig): CustomTheme[] {
  const raw = config.customThemes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as CustomTheme;
      if (!row || typeof row !== "object") return null;
      const id = str(row.id);
      const name = str(row.name).trim();
      const accentColor = str(row.accentColor, "#f97316");
      if (!id || !name || !isHexColor(accentColor)) return null;
      const badgeRaw = str(row.badgeBg);
      const bgRaw = str(row.bgGradient);
      return {
        id,
        name,
        accentColor,
        badgeBg: isHexColor(badgeRaw) ? badgeRaw : accentColor,
        bgGradient: isHexColor(bgRaw) ? bgRaw : "#020617",
      };
    })
    .filter((item): item is CustomTheme => Boolean(item));
}

function readInterfaceCopy(config: MkenConfig): InterfaceCopy {
  const raw = (config.interfaceCopy || {}) as Partial<InterfaceCopy>;
  return {
    servicesHeading: str(raw.servicesHeading),
    servicesIntro: str(raw.servicesIntro),
    servicesFooter: str(raw.servicesFooter),
  };
}

function readPrimaryAd(config: MkenConfig): PrimaryAd {
  const ads = (config.ads || {}) as { primary?: Partial<PrimaryAd> };
  const pack = config.occasionPack || {};
  const primary = ads.primary || {};
  return {
    enabled: typeof primary.enabled === "boolean" ? primary.enabled : Boolean(pack.enabled),
    title: str(primary.title),
    text: str(primary.text, str(pack.promo?.text)),
    image: str(primary.image, str(config.heroImage)),
    ctaLabel: str(primary.ctaLabel),
    ctaHref: str(primary.ctaHref),
    couponCode: str(primary.couponCode, str(pack.promo?.code)),
    startDate: optionalYmd(primary.startDate),
    endDate: optionalYmd(primary.endDate),
  };
}

function readSecondaryAds(config: MkenConfig): SecondaryAd[] {
  const ads = (config.ads || {}) as { secondary?: Partial<SecondaryAd>[] };
  if (!Array.isArray(ads.secondary)) return [];
  return ads.secondary
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = str(item.id);
      const title = str(item.title).trim();
      if (!id || !title) return null;
      return {
        id,
        enabled: Boolean(item.enabled),
        title,
        text: str(item.text),
        image: str(item.image),
        href: str(item.href),
        features: readFeatures(item.features),
        badge: str(item.badge),
        price: str(item.price),
        ctaLabel: str(item.ctaLabel, DEFAULT_AD_CTA),
        startDate: optionalYmd(item.startDate),
        endDate: optionalYmd(item.endDate),
      };
    })
    .filter((item): item is SecondaryAd => Boolean(item));
}

export function appearanceFromConfig(config: MkenConfig): AppearancePublic {
  const customThemes = readCustomThemes(config);
  const resolved = resolveActiveTheme(config);
  const customTheme = resolved.kind === "custom" ? customThemes.find((t) => t.id === resolved.id) || null : null;
  const pack = config.occasionPack || {};

  return {
    mode: pack.mode === "seasonal" ? "seasonal" : "manual",
    forceId: str(pack.forceId, "none"),
    resolvedTheme: resolved.id,
    themeKind: resolved.kind,
    schedule: readSchedule(config),
    customThemes,
    customTheme,
    darkModeEnabled: config.colorScheme?.darkEnabled !== false,
    interfaceCopy: readInterfaceCopy(config),
    ads: {
      primary: readPrimaryAd(config),
      secondary: readSecondaryAds(config),
    },
  };
}

function normalizeSchedule(items: ThemeScheduleItem[]): ThemeScheduleItem[] | string {
  const next: ThemeScheduleItem[] = [];
  for (const item of items) {
    const id = str(item?.id).trim();
    if (!id) return "معرّف الثيم في الجدول مطلوب";
    if (!isOccasionTheme(id) && !isCustomThemeId(id) && id !== "none") {
      return "ثيم الجدول غير صالح";
    }
    if (!isYmd(item.start) || !isYmd(item.end)) return "تواريخ الجدول يجب أن تكون بصيغة YYYY-MM-DD";
    if (item.end < item.start) return "تاريخ نهاية الموسم أقدم من بدايته";
    next.push({ id, start: item.start, end: item.end });
  }
  return next;
}

function normalizeCustomThemes(items: CustomTheme[]): CustomTheme[] | string {
  const next: CustomTheme[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const name = str(item?.name).trim();
    const accentColor = str(item?.accentColor).trim();
    if (!name) return "اسم الثيم المخصص مطلوب";
    if (!isHexColor(accentColor)) return "لون التمييز يجب أن يكون بصيغة #RGB أو #RRGGBB";
    let id = str(item?.id).trim();
    if (!id) id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (!isCustomThemeId(id)) id = `custom-${id.replace(/[^a-zA-Z0-9-]/g, "") || Date.now().toString(36)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    next.push({
      id,
      name,
      accentColor,
      badgeBg: isHexColor(str(item.badgeBg)) ? item.badgeBg : accentColor,
      bgGradient: isHexColor(str(item.bgGradient)) ? item.bgGradient : "#020617",
    });
  }
  return next;
}

export function validateAppearance(update: AppearanceUpdate): string | null {
  if (update.mode && update.mode !== "manual" && update.mode !== "seasonal") {
    return "وضع التفعيل غير صالح";
  }
  if (update.forceId !== undefined) {
    const id = update.forceId.trim() || "none";
    if (id !== "none" && !isOccasionTheme(id) && !isCustomThemeId(id)) {
      return "معرّف الثيم غير صالح";
    }
  }
  if (update.schedule) {
    const schedule = normalizeSchedule(update.schedule);
    if (typeof schedule === "string") return schedule;
  }
  if (update.customThemes) {
    const themes = normalizeCustomThemes(update.customThemes);
    if (typeof themes === "string") return themes;
  }
  if (update.ads?.primary) {
    const start = str(update.ads.primary.startDate).trim();
    const end = str(update.ads.primary.endDate).trim();
    if (start && !isYmd(start)) return "تاريخ بداية الإعلان الرئيسي غير صالح";
    if (end && !isYmd(end)) return "تاريخ نهاية الإعلان الرئيسي غير صالح";
    if (start && end && end < start) return "تاريخ نهاية الإعلان الرئيسي أقدم من بدايته";
  }
  if (update.ads?.secondary) {
    for (const ad of update.ads.secondary) {
      const start = str(ad?.startDate).trim();
      const end = str(ad?.endDate).trim();
      if (start && !isYmd(start)) return "تاريخ بداية أحد الإعلانات غير صالح";
      if (end && !isYmd(end)) return "تاريخ نهاية أحد الإعلانات غير صالح";
      if (start && end && end < start) return "تاريخ نهاية أحد الإعلانات أقدم من بدايته";
    }
  }
  return null;
}

function normalizeSecondaryAd(item: SecondaryAd): SecondaryAd | null {
  const title = str(item?.title).trim();
  if (!title) return null;
  const id = str(item?.id).trim() || `ad-${Date.now().toString(36)}`;
  return {
    id,
    enabled: Boolean(item.enabled),
    title: title.slice(0, 80),
    text: str(item.text).slice(0, 500),
    image: str(item.image).slice(0, 500),
    href: str(item.href).slice(0, 300),
    features: readFeatures(item.features).map((feat) => feat.slice(0, 80)),
    badge: str(item.badge).slice(0, 40),
    price: str(item.price).slice(0, 40),
    ctaLabel: str(item.ctaLabel, DEFAULT_AD_CTA).slice(0, 40),
    startDate: optionalYmd(item.startDate),
    endDate: optionalYmd(item.endDate),
  };
}

export function mergeAppearance(config: MkenConfig, update: AppearanceUpdate): MkenConfig {
  const next: MkenConfig = { ...config };
  const pack = { ...(config.occasionPack || {}) };

  if (update.mode !== undefined) pack.mode = update.mode;
  if (update.forceId !== undefined) pack.forceId = update.forceId.trim() || "none";
  if (update.schedule) {
    const schedule = normalizeSchedule(update.schedule);
    if (typeof schedule !== "string") pack.schedule = schedule;
  }

  if (update.ads?.primary) {
    const current = readPrimaryAd(config);
    const primary = { ...current, ...update.ads.primary };
    if (typeof primary.enabled === "boolean") pack.enabled = primary.enabled;
    pack.promo = {
      ...(pack.promo || {}),
      ...(primary.couponCode !== undefined && { code: primary.couponCode }),
      ...(primary.text !== undefined && { text: primary.text }),
    };
    if (primary.image) next.heroImage = primary.image;
  }

  next.occasionPack = pack;

  if (update.customThemes) {
    const themes = normalizeCustomThemes(update.customThemes);
    if (typeof themes !== "string") next.customThemes = themes;
  }

  if (update.darkModeEnabled !== undefined) {
    next.colorScheme = { ...(config.colorScheme || {}), darkEnabled: update.darkModeEnabled };
  }

  if (update.interfaceCopy) {
    next.interfaceCopy = { ...readInterfaceCopy(config), ...update.interfaceCopy };
  }

  if (update.ads) {
    const currentAds = {
      primary: readPrimaryAd({ ...config, occasionPack: pack, heroImage: next.heroImage }),
      secondary: readSecondaryAds(config),
    };
    next.ads = {
      primary: update.ads.primary
        ? {
            ...currentAds.primary,
            ...update.ads.primary,
            startDate: optionalYmd(update.ads.primary.startDate ?? currentAds.primary.startDate),
            endDate: optionalYmd(update.ads.primary.endDate ?? currentAds.primary.endDate),
          }
        : currentAds.primary,
      secondary: update.ads.secondary
        ? update.ads.secondary
            .map(normalizeSecondaryAd)
            .filter((item): item is SecondaryAd => Boolean(item))
        : currentAds.secondary,
    };
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

function configForAppearance(slug: string, config: MkenConfig): MkenConfig {
  if (slug === "rewa") return applyRewaDefaults(config);
  if (slug === "almahrusa") return applyAlmahrusaDefaults(config);
  if (slug === "rewaq") return applyRewaqDefaults(config);
  return config;
}

export async function fetchAppearance(
  slug: string
): Promise<{ appearance?: AppearancePublic; error?: string }> {
  // Titles, phrases, and ads all persist through this tenant row.
  const seed = await ensureTenantRow(slug);
  if (!seed.row) return { error: seed.error || "المنشأة غير موجودة أو قاعدة البيانات غير مهيأة" };

  const stored = seed.row.config_data || {};
  const next = configForAppearance(slug, stored);
  const adsChanged =
    (slug === "rewa" || slug === "almahrusa" || slug === "rewaq") &&
    JSON.stringify(next.ads || null) !== JSON.stringify(stored.ads || null);
  if (
    (slug === "rewa" && (next.customThemes !== stored.customThemes || adsChanged)) ||
    (slug === "almahrusa" && (next.customThemes !== stored.customThemes || adsChanged || next.phone !== stored.phone)) ||
    (slug === "rewaq" && (next.customThemes !== stored.customThemes || adsChanged || next.phone !== stored.phone))
  ) {
    const written = await writeTenantConfig(slug, next);
    if (written.row) return { appearance: appearanceFromConfig(written.row.config_data || next) };
  }
  return { appearance: appearanceFromConfig(next) };
}

function isolateAdsUpdate(slug: string, update: AppearanceUpdate): AppearanceUpdate {
  if (!update.ads) return update;
  const ads = { ...update.ads };
  if (ads.primary?.ctaHref) {
    ads.primary = { ...ads.primary, ctaHref: isolateTenantHref(ads.primary.ctaHref, slug) };
  }
  if (ads.secondary) {
    ads.secondary = ads.secondary.map((ad) =>
      ad.href ? { ...ad, href: isolateTenantHref(ad.href, slug) } : ad
    );
  }
  return { ...update, ads };
}

export async function updateAppearance(
  slug: string,
  update: AppearanceUpdate
): Promise<{ appearance?: AppearancePublic; error?: string }> {
  const ensured = await ensureTenantRow(slug);
  if (ensured.error || !ensured.row) return { error: ensured.error || "المنشأة غير موجودة" };

  const written = await writeTenantConfig(
    slug,
    mergeAppearance(
      configForAppearance(slug, ensured.row.config_data || {}),
      isolateAdsUpdate(slug, update)
    )
  );
  if (written.error || !written.row) return { error: written.error || "تعذّر الحفظ" };
  return { appearance: appearanceFromConfig(written.row.config_data || {}) };
}

export function emptyInterfaceCopy(): InterfaceCopy {
  return { ...EMPTY_COPY };
}

export function emptyPrimaryAd(): PrimaryAd {
  return { ...EMPTY_PRIMARY };
}
