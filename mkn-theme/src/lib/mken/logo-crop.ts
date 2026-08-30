/**
 * Crop empty padding around a logo (transparent Gemini PNGs, white JPEG boards).
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

function isBackgroundPixel(pixel: Rgba, background: Rgba, alphaThreshold: number): boolean {
  if (pixel.a < alphaThreshold) return true;
  if (background.a < alphaThreshold) return false;
  return colorDistance(pixel, background) < 36 && pixel.a > 200;
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

/** Always served from the apex so tenant hosts do not 404 cached static paths. */
export function publicBrandSrc(filename: string): string {
  const file = filename.replace(/^\/+/, "").replace(/^brand\//, "");
  return `https://www.mken.live/brand/${file}`;
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
