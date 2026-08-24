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
  regularHours?: { periods?: Array<{ openDay?: number; openTime?: { hours?: number; minutes?: number }; closeTime?: { hours?: number; minutes?: number } }> };
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

function formatTimeOfDay(timeObj?: { hours?: number; minutes?: number }): string {
  if (!timeObj) return "";
  const h = String(timeObj.hours != null ? timeObj.hours : 0).padStart(2, "0");
  const m = String(timeObj.minutes != null ? timeObj.minutes : 0).padStart(2, "0");
  return `${h}:${m}`;
}

function formatGbpHours(regularHours: GbpLocationDetail["regularHours"]): string {
  if (!regularHours?.periods?.length) return "";
  const summaries = regularHours.periods.slice(0, 3).map((period) => {
    const day = DAY_NAMES[period.openDay ?? -1] || `يوم ${period.openDay}`;
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
  const gbpCity = gbp.storefrontAddress?.locality || gbpAddress;
  const gbpCategory = gbp.primaryCategory?.displayName || gbp.primaryCategory?.name || "";

  const items: NapItem[] = [
    compareField(
      "name",
      "اسم المنشأة (Name)",
      site.name || "",
      gbp.title || "",
      (a, b) => normalizeText(a) === normalizeText(b),
      "تأكد أن اسم العلامة في مكّن يطابق الاسم الرسمي على جوجل."
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
      gbpCity,
      (a, b) => {
        const na = normalizeText(a);
        const nb = normalizeText(b);
        return na === nb || Boolean(na && nb.includes(na)) || Boolean(nb && na.includes(nb));
      },
      "راجع المدينة في نطاق الخدمة ومطابقة العنوان على GBP."
    ),
    compareField(
      "hours",
      "ساعات العمل (Hours)",
      formatSiteHours(site),
      formatGbpHours(gbp.regularHours),
      (a, b) => {
        if (!a || !b) return false;
        const extract = (s: string) => String(s).replace(/\D/g, "").slice(0, 8);
        return extract(a) === extract(b);
      },
      "ساعات مكّن مبسّطة للحجز — قارن يدوياً مع جدول GBP إن اختلفت."
    ),
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

export function planNapSync(site: NapSiteSnapshot, gbpLocation: GbpLocationDetail | null): NapSyncPlan {
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
