export type NapStatus =
  | "match"
  | "mismatch"
  | "missing_site"
  | "missing_gbp"
  | "missing_both"
  | "info";

export interface NapSiteSnapshot {
  name: string;
  phone: string;
  website: string;
  city: string;
  hoursStart: string;
  hoursEnd: string;
}

export interface NapItem {
  id: string;
  label: string;
  siteValue: string;
  gbpValue: string;
  status: NapStatus;
  hint: string;
}

export interface NapReport {
  items: NapItem[];
  summary: {
    total: number;
    matched: number;
    mismatches: number;
    missing: number;
    scorePercent: number;
    overall: "excellent" | "good" | "fair" | "poor";
  };
  gbpAddressFull: string;
}

export interface NapSyncPlan {
  report: NapReport;
  patchBody: Record<string, unknown>;
  updateMask: string;
  updated: { field: string; label: string; value: string }[];
  skipped: { field: string; label: string; reason: string }[];
}

export interface GbpLocationDetail {
  title?: string;
  websiteUri?: string;
  phoneNumbers?: { primaryPhone?: string; primary_phone?: string };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  regularHours?: {
    periods?: Array<{
      openDay?: number | string;
      openTime?: { hours?: number; minutes?: number };
      closeTime?: { hours?: number; minutes?: number };
    }>;
  };
  primaryCategory?: { displayName?: string; name?: string };
}

function normalizePhoneDigits(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.length === 9) return `966${digits}`;
  return digits;
}

function formatPhoneDisplay(digits: string): string {
  const d = normalizePhoneDigits(digits);
  if (!d) return "";
  if (d.startsWith("966") && d.length >= 12) {
    const local = d.slice(3);
    return `+966 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }
  return `+${d}`;
}

function formatPhoneForGbp(phone: string): string {
  const d = normalizePhoneDigits(phone);
  return d ? `+${d}` : "";
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  let u = String(url).trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function normalizeText(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function formatGbpAddress(storefrontAddress: GbpLocationDetail["storefrontAddress"]): string {
  if (!storefrontAddress) return "";
  const parts: string[] = [];
  if (Array.isArray(storefrontAddress.addressLines) && storefrontAddress.addressLines.length) {
    parts.push(storefrontAddress.addressLines.join("، "));
  }
  if (storefrontAddress.locality) parts.push(storefrontAddress.locality);
  if (storefrontAddress.administrativeArea) parts.push(storefrontAddress.administrativeArea);
  if (storefrontAddress.postalCode) parts.push(storefrontAddress.postalCode);
  return parts.join(" — ");
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_LABELS: Record<string, string> = {
  SUNDAY: "الأحد",
  MONDAY: "الإثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
  SATURDAY: "السبت",
};
const SAUDI_CITIES = [
  "المدينة المنورة",
  "مكة المكرمة",
  "جدة",
  "الرياض",
  "الدمام",
  "الخبر",
  "الظهران",
  "الطائف",
  "أبها",
  "تبوك",
  "بريدة",
  "حائل",
  "نجران",
  "جازان",
  "ينبع",
  "الجبيل",
];

function dayLabel(openDay?: number | string): string {
  if (typeof openDay === "number" && openDay >= 0 && openDay < DAY_NAMES.length) {
    return DAY_NAMES[openDay];
  }
  const key = String(openDay || "").toUpperCase();
  return DAY_LABELS[key] || (openDay != null ? String(openDay) : "");
}

export function cityFromGbpAddress(
  storefrontAddress: GbpLocationDetail["storefrontAddress"],
  fallbackText = ""
): string {
  const locality = String(storefrontAddress?.locality || "").trim();
  if (locality) return locality;
  const blob = `${formatGbpAddress(storefrontAddress)} ${fallbackText}`;
  const normalized = normalizeText(blob);
  for (const city of SAUDI_CITIES) {
    if (normalized.includes(normalizeText(city))) return city;
  }
  return "";
}

export function parseClockMinutes(value: string): number | null {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function periodMinutes(time?: { hours?: number; minutes?: number }): number | null {
  if (!time || time.hours == null || !Number.isFinite(time.hours)) return null;
  const hours = Math.max(0, Math.min(23, time.hours));
  const minutes = Math.max(0, Math.min(59, time.minutes || 0));
  return hours * 60 + minutes;
}

function mkenCoversGbpRange(windowStart: number, windowEnd: number, open: number, close: number): boolean {
  const tol = 15;
  const mkenWrap = windowEnd <= windowStart;
  const gbpWrap = close <= open;

  if (!mkenWrap && !gbpWrap) {
    return open + tol >= windowStart && close - tol <= windowEnd;
  }
  if (!mkenWrap && gbpWrap) return false;
  if (mkenWrap && gbpWrap) {
    return open + tol >= windowStart && close - tol <= windowEnd;
  }
  return open + tol >= windowStart || close - tol <= windowEnd;
}

export function checkHoursMatch(
  site: NapSiteSnapshot,
  regularHours: GbpLocationDetail["regularHours"]
): boolean {
  const start = parseClockMinutes(site.hoursStart);
  const end = parseClockMinutes(site.hoursEnd);
  const periods = regularHours?.periods || [];
  if (start == null || end == null || !periods.length) return false;

  return periods.every((period) => {
    const open = periodMinutes(period.openTime);
    const close = periodMinutes(period.closeTime);
    if (open == null || close == null) return false;
    return mkenCoversGbpRange(start, end, open, close);
  });
}

function formatTimeOfDay(timeObj?: { hours?: number; minutes?: number }): string {
  if (!timeObj) return "";
  const h = String(timeObj.hours != null ? timeObj.hours : 0).padStart(2, "0");
  const m = String(timeObj.minutes != null ? timeObj.minutes : 0).padStart(2, "0");
  return `${h}:${m}`;
}

function formatGbpHours(regularHours: GbpLocationDetail["regularHours"]): string {
  if (!regularHours?.periods?.length) return "";
  const summaries = regularHours.periods.slice(0, 3).map((period) => {
    const day = dayLabel(period.openDay) || "يوم";
    return `${day} ${formatTimeOfDay(period.openTime)}–${formatTimeOfDay(period.closeTime)}`;
  });
  let text = summaries.join(" | ");
  if (regularHours.periods.length > 3) {
    text += ` …(+${regularHours.periods.length - 3} فترات)`;
  }
  return text;
}

function formatSiteHours(site: NapSiteSnapshot): string {
  const start = site.hoursStart || "";
  const end = site.hoursEnd || "";
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end} (حسب إعدادات الحجز)`;
  return start || end;
}

function compareField(
  id: string,
  label: string,
  siteRaw: string,
  gbpRaw: string,
  compareFn: (a: string, b: string) => boolean,
  hint: string
): NapItem {
  const siteValue = siteRaw != null ? String(siteRaw).trim() : "";
  const gbpValue = gbpRaw != null ? String(gbpRaw).trim() : "";

  let status: NapStatus;
  if (!siteValue && !gbpValue) status = "missing_both";
  else if (!siteValue) status = "missing_site";
  else if (!gbpValue) status = "missing_gbp";
  else if (compareFn(siteValue, gbpValue)) status = "match";
  else status = "mismatch";

  return {
    id,
    label,
    siteValue: siteValue || "—",
    gbpValue: gbpValue || "—",
    status,
    hint,
  };
}

export function buildNapAuditReport(site: NapSiteSnapshot, gbpLocation: GbpLocationDetail | null): NapReport {
  const gbp = gbpLocation || {};
  const gbpAddress = formatGbpAddress(gbp.storefrontAddress);
  const gbpCity = cityFromGbpAddress(gbp.storefrontAddress, gbpAddress);
  const gbpCategory = gbp.primaryCategory?.displayName || gbp.primaryCategory?.name || "";
  const hoursSite = formatSiteHours(site);
  const hoursGbp = formatGbpHours(gbp.regularHours);
  let hoursStatus: NapStatus;
  if (!hoursSite && !hoursGbp) hoursStatus = "missing_both";
  else if (!hoursSite) hoursStatus = "missing_site";
  else if (!hoursGbp) hoursStatus = "missing_gbp";
  else if (checkHoursMatch(site, gbp.regularHours)) hoursStatus = "match";
  else hoursStatus = "mismatch";

  const items: NapItem[] = [
    compareField(
      "name",
      "اسم المنشأة (Name)",
      site.name || "",
      gbp.title || "",
      (a, b) => normalizeText(a) === normalizeText(b),
      "مزامنة الاسم غير مفعّلة افتراضياً: تغييره على جوجل قد يعرّض الصفحة للتعليق."
    ),
    compareField(
      "phone",
      "الهاتف (Phone)",
      formatPhoneDisplay(site.phone || ""),
      formatPhoneDisplay(gbp.phoneNumbers?.primaryPhone || gbp.phoneNumbers?.primary_phone || ""),
      (a, b) => normalizePhoneDigits(a) === normalizePhoneDigits(b),
      "حدّث رقم الجوال في إعدادات المنشأة أو على جوجل بيزنس."
    ),
    compareField(
      "website",
      "الموقع الإلكتروني (Website)",
      site.website || "",
      gbp.websiteUri || "",
      (a, b) => normalizeUrl(a) === normalizeUrl(b),
      "استخدم زر مزامنة رابط الموقع لمطابقة نطاق mken."
    ),
    compareField(
      "city",
      "المدينة / العنوان (Address)",
      site.city || "",
      gbpCity || gbpAddress,
      (a, b) => {
        const na = normalizeText(a);
        const nb = normalizeText(b);
        return na === nb || Boolean(na && nb.includes(na)) || Boolean(nb && na.includes(nb));
      },
      gbpAddress && gbpCity && gbpAddress !== gbpCity
        ? `المدينة للمقارنة: ${gbpCity}. العنوان الكامل على جوجل يُراجع يدوياً.`
        : "راجع المدينة في نطاق الخدمة ومطابقة العنوان على GBP."
    ),
    {
      id: "hours",
      label: "ساعات العمل (Hours)",
      siteValue: hoursSite || "—",
      gbpValue: hoursGbp || "—",
      status: hoursStatus,
      hint:
        hoursStatus === "match"
          ? "ساعات الحجز في مكّن تغطي فترات الدوام على جوجل."
          : "تطابق إذا غطّت ساعات الحجز في مكّن فترات جوجل (اختلاف شكل الجدول لا يُعد خطأ).",
    },
  ];

  if (gbpCategory) {
    items.push({
      id: "category",
      label: "التصنيف الأساسي (Category)",
      siteValue: "—",
      gbpValue: gbpCategory,
      status: "info",
      hint: "للمراجعة فقط — لا يُقارن مع مكّن.",
    });
  }

  const scored = items.filter((item) => item.status !== "info" && item.status !== "missing_both");
  const matched = scored.filter((item) => item.status === "match").length;
  const mismatches = scored.filter((item) => item.status === "mismatch").length;
  const missing = scored.filter((item) => item.status === "missing_site" || item.status === "missing_gbp").length;

  return {
    items,
    summary: {
      total: scored.length,
      matched,
      mismatches,
      missing,
      scorePercent: scored.length ? Math.round((matched / scored.length) * 100) : 0,
      overall:
        mismatches === 0 && missing === 0 && matched === scored.length
          ? "excellent"
          : mismatches === 0
            ? "good"
            : mismatches <= 1
              ? "fair"
              : "poor",
    },
    gbpAddressFull: gbpAddress,
  };
}

export interface NapSyncOptions {
  includeName?: boolean;
}

export function napSkipReasonLabel(reason: string): string {
  if (reason === "name_protected") return "محمي — لا يُزامَن الاسم إلا بتأكيد صريح";
  if (reason === "already_match") return "متطابق مسبقاً";
  if (reason === "missing_on_site") return "ناقص في مكّن";
  if (reason === "missing_on_gbp") return "ناقص في جوجل";
  if (reason === "not_selected") return "غير محدّد في هذه المزامنة";
  if (reason === "manual_only") return "يتطلب تعديلاً يدوياً على جوجل";
  return reason;
}

export function planNapSync(
  site: NapSiteSnapshot,
  gbpLocation: GbpLocationDetail | null,
  options?: NapSyncOptions
): NapSyncPlan {
  const report = buildNapAuditReport(site, gbpLocation);
  const patchBody: Record<string, unknown> = {};
  const updated: NapSyncPlan["updated"] = [];
  const skipped: NapSyncPlan["skipped"] = [];
  const fieldLabels: Record<string, string> = {
    website: "الموقع الإلكتروني",
    phone: "الهاتف",
    name: "اسم المنشأة",
    city: "المدينة / العنوان",
    hours: "ساعات العمل",
  };

  const itemById = (id: string) => report.items.find((item) => item.id === id);

  const trySync = (id: string, applyFn: () => void) => {
    const item = itemById(id);
    if (!item) return;
    if (item.status === "match") {
      skipped.push({ field: id, label: fieldLabels[id], reason: "already_match" });
      return;
    }
    if (item.status === "missing_site") {
      skipped.push({ field: id, label: fieldLabels[id], reason: "missing_on_site" });
      return;
    }
    applyFn();
  };

  trySync("website", () => {
    if (!site.website) return;
    patchBody.websiteUri = String(site.website).trim();
    updated.push({ field: "website", label: fieldLabels.website, value: String(patchBody.websiteUri) });
  });

  trySync("phone", () => {
    const formatted = formatPhoneForGbp(site.phone);
    if (!formatted) return;
    patchBody.phoneNumbers = { primaryPhone: formatted };
    updated.push({ field: "phone", label: fieldLabels.phone, value: formatPhoneDisplay(site.phone) });
  });

  trySync("name", () => {
    if (!options?.includeName) {
      skipped.push({ field: "name", label: fieldLabels.name, reason: "name_protected" });
      return;
    }
    if (!site.name) return;
    patchBody.title = String(site.name).trim();
    updated.push({ field: "name", label: fieldLabels.name, value: String(patchBody.title) });
  });

  for (const id of ["city", "hours"]) {
    const item = itemById(id);
    if (item && item.status !== "match" && item.status !== "missing_both") {
      skipped.push({ field: id, label: fieldLabels[id], reason: "manual_only" });
    }
  }

  return {
    report,
    patchBody,
    updateMask: Object.keys(patchBody).join(","),
    updated,
    skipped,
  };
}

export type ReverseNapField = "phone" | "city" | "name";

export interface ReverseNapPlan {
  report: NapReport;
  updates: { field: ReverseNapField; label: string; value: string }[];
  skipped: { field: string; label: string; reason: string }[];
  configPatch: { phone?: string; city?: string; brandName?: string };
}

export function planReverseNapSync(
  site: NapSiteSnapshot,
  gbpLocation: GbpLocationDetail | null,
  selectedFields: ReverseNapField[]
): ReverseNapPlan {
  const report = buildNapAuditReport(site, gbpLocation);
  const selected = new Set(selectedFields);
  const updates: ReverseNapPlan["updates"] = [];
  const skipped: ReverseNapPlan["skipped"] = [];
  const configPatch: ReverseNapPlan["configPatch"] = {};
  const gbp = gbpLocation || {};
  const labels: Record<ReverseNapField, string> = {
    phone: "الهاتف",
    city: "المدينة",
    name: "اسم العلامة",
  };

  const consider = (field: ReverseNapField, gbpRaw: string, apply: (value: string) => void) => {
    const value = gbpRaw.trim();
    const item = report.items.find((entry) => entry.id === field);
    if (!selected.has(field)) {
      skipped.push({ field, label: labels[field], reason: "not_selected" });
      return;
    }
    if (!value) {
      skipped.push({ field, label: labels[field], reason: "missing_on_gbp" });
      return;
    }
    if (item?.status === "match") {
      skipped.push({ field, label: labels[field], reason: "already_match" });
      return;
    }
    apply(value);
    updates.push({ field, label: labels[field], value });
  };

  consider("phone", gbp.phoneNumbers?.primaryPhone || gbp.phoneNumbers?.primary_phone || "", (value) => {
    configPatch.phone = formatPhoneForGbp(value) || value;
  });
  consider("city", cityFromGbpAddress(gbp.storefrontAddress, formatGbpAddress(gbp.storefrontAddress)), (value) => {
    configPatch.city = value;
  });
  consider("name", gbp.title || "", (value) => {
    configPatch.brandName = value;
  });

  return { report, updates, skipped, configPatch };
}
