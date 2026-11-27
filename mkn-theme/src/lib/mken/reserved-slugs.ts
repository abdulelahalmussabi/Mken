/**
 * مكّن - سجل المسارات المحجوزة والأسماء السيادية المحمية نظامياً
 * متوافق مع ضوابط هيئة الاتصالات والفضاء والتقنية والهيئة الوطنية للأمن السيبراني
 */

// 1. مسارات المنصة الأساسية والتطبيقية
export const PLATFORM_SYSTEM_SLUGS = new Set([
  "admin",
  "staff",
  "api",
  "auth",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "dashboard",
  "book",
  "store",
  "orders",
  "license",
  "licenses",
  "preview",
  "privacy",
  "terms",
  "track",
  "queue",
  "queue-display",
  "display",
  "pricing",
  "themes",
  "marketing",
  "developer",
  "checkout",
  "r",
  "subscriber",
  "_next",
  "assets",
  "css",
  "js",
  "data",
  "fonts",
  "public",
  "brand",
  "favicon",
  "sw.js",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
]);

// 2. الأسماء السيادية والمؤسسات الحكومية المحظورة قطيعاً (Saudi Sovereign Names)
export const SAUDI_SOVEREIGN_SLUGS = new Set([
  "saudi",
  "ksa",
  "gov",
  "arabia",
  "absher",
  "zatca",
  "sama",
  "sadaia",
  "sdaia",
  "nca",
  "cst",
  "moci",
  "commerce",
  "balady",
  "najiz",
  "mof",
  "moi",
  "mofa",
  "moh",
  "mod",
  "hrsd",
  "qiwa",
  "monshaat",
  "zakat",
  "tax",
  "customs",
  "passport",
  "police",
  "royalcourt",
  "aramco",
  "neom",
  "redsea",
]);

/** فحص هل المعرف مدخل محجوز أو سيادي */
export function isReservedSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return PLATFORM_SYSTEM_SLUGS.has(normalized) || SAUDI_SOVEREIGN_SLUGS.has(normalized);
}

/** التحقق من صحة نسق اسم المستأجر */
export function isValidTenantSlugPattern(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 50) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
