/**
 * Crop empty padding and knock out flat boards around a logo
 * (transparent PNGs, Gemini cutouts, black/white JPEG boards).
 * Pure pixel math — no DOM. The client uploader draws to a canvas then calls this.
 */

export const MAX_LOGO_DATA_CHARS = 700_000;
export const MAX_LOGO_EDGE = 512;
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export type PixelBuffer = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

export type CropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Rgba = { r: number; g: number; b: number; a: number };

function pixelAt(image: PixelBuffer, x: number, y: number): Rgba {
  const i = (y * image.width + x) * 4;
  return {
    r: image.data[i],
    g: image.data[i + 1],
    b: image.data[i + 2],
    a: image.data[i + 3],
  };
}

function colorDistance(a: Rgba, b: Rgba): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function cornerSample(image: PixelBuffer): Rgba {
  const points = [
    [2, 2],
    [image.width - 3, 2],
    [2, image.height - 3],
    [image.width - 3, image.height - 3],
  ] as const;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
    const p = pixelAt(image, x, y);
    r += p.r;
    g += p.g;
    b += p.b;
    a += p.a;
    n += 1;
  }
  if (!n) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
    a: Math.round(a / n),
  };
}

const HARD_KEY_DISTANCE = 36;
const SOFT_KEY_DISTANCE = 72;

function isBackgroundPixel(pixel: Rgba, background: Rgba, alphaThreshold: number): boolean {
  if (pixel.a < alphaThreshold) return true;
  if (background.a < alphaThreshold) return false;
  return colorDistance(pixel, background) < HARD_KEY_DISTANCE && pixel.a > 200;
}

/** Black / white / gray studio boards — not a saturated brand-color fill. */
function isKnockoutBoard(background: Rgba): boolean {
  if (background.a < 16) return false;
  const lum = (background.r + background.g + background.b) / 3;
  const sat =
    Math.max(background.r, background.g, background.b) -
    Math.min(background.r, background.g, background.b);
  return lum <= 28 || lum >= 227 || sat <= 18;
}

/**
 * Punch a flat corner-sampled board to true alpha so the cutout sits on any theme.
 * Returns true when pixels were changed. Skips saturated fills and empty frames.
 */
export function knockoutBackground(image: PixelBuffer, alphaThreshold = 16): boolean {
  const background = cornerSample(image);
  if (!isKnockoutBoard(background)) return false;

  const data = image.data;
  const backup = new Uint8ClampedArray(data);
  let changed = false;

  for (let i = 0; i < data.length; i += 4) {
    const pixel = {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    };
    if (pixel.a < alphaThreshold) continue;
    const distance = colorDistance(pixel, background);
    if (distance < HARD_KEY_DISTANCE) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      changed = true;
    } else if (distance < SOFT_KEY_DISTANCE) {
      const t = (distance - HARD_KEY_DISTANCE) / (SOFT_KEY_DISTANCE - HARD_KEY_DISTANCE);
      data[i + 3] = Math.round(pixel.a * t);
      changed = true;
    }
  }

  if (!changed || !findContentBounds(image, alphaThreshold)) {
    data.set(backup);
    return false;
  }
  return true;
}

/** Tight bounding box of non-padding pixels, or null if the canvas is empty. */
export function findContentBounds(
  image: PixelBuffer,
  alphaThreshold = 16
): CropRect | null {
  const background = cornerSample(image);
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (isBackgroundPixel(pixelAt(image, x, y), background, alphaThreshold)) continue;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    }
  }

  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Expand the crop slightly so logos are not flush against the box edge. */
export function padCropRect(rect: CropRect, image: PixelBuffer, ratio = 0.04): CropRect {
  const pad = Math.max(2, Math.round(Math.min(rect.width, rect.height) * ratio));
  const left = Math.max(0, rect.left - pad);
  const top = Math.max(0, rect.top - pad);
  const right = Math.min(image.width, rect.left + rect.width + pad);
  const bottom = Math.min(image.height, rect.top + rect.height + pad);
  return { left, top, width: right - left, height: bottom - top };
}

export function cropWorthApplying(image: PixelBuffer, rect: CropRect): boolean {
  const area = image.width * image.height;
  if (area <= 0) return false;
  const kept = rect.width * rect.height;
  return kept / area < 0.92;
}

export function isBlockedLogoUrl(value: string): boolean {
  return /share\.gemini\.google|gemini\.google\.com\/share/i.test(value.trim());
}

export function isUsableLogoSrc(value: string | undefined | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || isBlockedLogoUrl(trimmed)) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("assets/")) return true;
  return /^https?:\/\//i.test(trimmed);
}

/** Bump when seed PNGs change so CDN/browser caches drop old opaque boards. */
export const BRAND_CUTOUT_VERSION = "2";

/** Same-origin in dev; apex in production so tenant hosts do not 404 static brand files. */
export function publicBrandSrc(filename: string): string {
  const file = filename.replace(/^\/+/, "").replace(/^brand\//, "");
  const path =
    process.env.NODE_ENV === "development" ? `/brand/${file}` : `https://www.mken.live/brand/${file}`;
  return `${path}?v=${BRAND_CUTOUT_VERSION}`;
}

/** JPEG boards or unversioned seed PNGs that still show a black/white plate. */
export function isStaleSeedLogo(value: string): boolean {
  if (!/\/brand\/(rewa|almahrusa|mken)\.(png|jpe?g)(\?|$)/i.test(value)) return false;
  if (/\.jpe?g(\?|$)/i.test(value)) return true;
  return !value.includes(`v=${BRAND_CUTOUT_VERSION}`);
}

export function logoValidationError(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isBlockedLogoUrl(trimmed)) {
    return "رابط مشاركة Gemini ليس ملف صورة. نزّل الشعار من Gemini ثم ارفعه كملف PNG.";
  }
  if (trimmed.length > MAX_LOGO_DATA_CHARS) {
    return "الشعار كبير جداً بعد المعالجة. استخدم PNG بخلفية شفافة.";
  }
  return null;
}
