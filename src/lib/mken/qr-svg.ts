/**
 * Mken Smart QR Generator — Ultra-lightweight, zero-dependency SVG QR Code Engine
 * Optimized for high-contrast, fast camera lock, and large module scannability.
 */

// QR Code specification constants for Byte Mode (8-bit)
// Optimized for short URLs (< 60 chars) -> Versions 1-4
interface QRConfig {
  version: number;
  size: number;
  dataCapacity: number; // in bytes (EC Level M)
  ecCodewords: number;
}

const QR_TABLE: Record<number, QRConfig> = {
  1: { version: 1, size: 21, dataCapacity: 14, ecCodewords: 10 },
  2: { version: 2, size: 25, dataCapacity: 26, ecCodewords: 16 },
  3: { version: 3, size: 29, dataCapacity: 42, ecCodewords: 26 },
  4: { version: 4, size: 33, dataCapacity: 62, ecCodewords: 36 },
};

// Galois Field GF(256) tables for Reed-Solomon error correction
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // GF(256) irreducible polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function polyMultiply(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMultiply(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMultiply(g, [1, GF_EXP[i]]);
  }
  return g;
}

function calculateReedSolomon(data: number[], ecCount: number): number[] {
  const gen = getGeneratorPoly(ecCount);
  const msg = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const lead = msg[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMultiply(gen[j], lead);
      }
    }
  }
  return msg.slice(data.length);
}

/**
 * Encodes text/URL into QR bitstream
 */
function encodeData(text: string, capacity: number): number[] {
  const utf8 = new TextEncoder().encode(text);
  const bits: number[] = [];

  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // 1. Mode indicator: 0100 (Byte mode)
  pushBits(0b0100, 4);

  // 2. Character count indicator (8 bits for V1-V9)
  pushBits(utf8.length, 8);

  // 3. Data bytes
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }

  // 4. Terminator (up to 4 zeros)
  const remainingBits = capacity * 8 - bits.length;
  const termLen = Math.min(4, Math.max(0, remainingBits));
  pushBits(0, termLen);

  // 5. Pad to multiple of 8
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 6. Convert to bytes
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    bytes.push(b);
  }

  // 7. Pad bytes with 0xEC and 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bytes.length < capacity) {
    bytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  return bytes;
}

/**
 * Builds standard 2D QR Matrix with Finder Patterns, Timing Patterns, Alignment, and Format Bits.
 */
function buildQRMatrix(text: string): { matrix: boolean[][]; size: number } {
  const len = new TextEncoder().encode(text).length;
  let config: QRConfig = QR_TABLE[1];
  for (const v of [1, 2, 3, 4]) {
    if (len <= QR_TABLE[v].dataCapacity - 2) {
      config = QR_TABLE[v];
      break;
    }
  }

  const { size, dataCapacity, ecCodewords } = config;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Helper: Place square
  const fillRect = (r: number, c: number, w: number, h: number, val: boolean) => {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        matrix[r + i][c + j] = val;
      }
    }
  };

  // 1. Finder Patterns (7x7 with separator)
  const placeFinder = (r: number, c: number) => {
    fillRect(r, c, 7, 7, true);
    fillRect(r + 1, c + 1, 5, 5, false);
    fillRect(r + 2, c + 2, 3, 3, true);

    // Separators (white border)
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const row = r + i;
        const col = c + j;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          if (i === -1 || i === 7 || j === -1 || j === 7) {
            matrix[row][col] = false;
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Alignment Pattern (for Version 2+)
  if (config.version >= 2) {
    const alignPos = size - 7;
    fillRect(alignPos - 2, alignPos - 2, 5, 5, true);
    fillRect(alignPos - 1, alignPos - 1, 3, 3, false);
    matrix[alignPos][alignPos] = true;
  }

  // 3. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[4 * config.version + 9][8] = true;

  // 4. Reserve Format Info Area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 5. Compute Data + Reed-Solomon ECC
  const dataBytes = encodeData(text, dataCapacity);
  const ecBytes = calculateReedSolomon(dataBytes, ecCodewords);
  const totalCodewords = [...dataBytes, ...ecBytes];

  const bitStream: boolean[] = [];
  for (const b of totalCodewords) {
    for (let i = 7; i >= 0; i--) {
      bitStream.push(((b >> i) & 1) === 1);
    }
  }

  // 6. Place Data Modules in zig-zag
  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing pattern
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (matrix[r][c] === null) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : false;
          // Apply Standard Mask Pattern 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? !bit : bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Format Information (EC Level M + Mask 0) = 0x5412 XOR 0x5412 = 0
  // Standard BCH(15,5) format sequence for Level M Mask 0: 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatModules = formatBits.map((b) => b === 1);

  // Top-left format info
  for (let i = 0; i < 6; i++) matrix[8][i] = formatModules[i];
  matrix[8][7] = formatModules[6];
  matrix[8][8] = formatModules[7];
  matrix[7][8] = formatModules[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatModules[i];

  // Right & Bottom format info
  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = formatModules[i];
  for (let i = 8; i < 15; i++) matrix[size - 15 + i][8] = formatModules[i];

  return { matrix: matrix.map((row) => row.map((c) => Boolean(c))), size };
}

/**
 * Generates high-contrast, scalable SVG string for the QR Code.
 * Includes a mandatory 4-module quiet zone (white margin) for instant camera focus.
 */
export function generateQRCodeSVG(text: string, options?: { sizePx?: number; margin?: number }): string {
  const { matrix, size } = buildQRMatrix(text);
  const margin = options?.margin ?? 4;
  const totalModules = size + margin * 2;
  const sizePx = options?.sizePx || 320;

  let pathData = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        pathData += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
  <rect width="${totalModules}" height="${totalModules}" fill="#ffffff" />
  <path d="${pathData}" fill="#000000" />
</svg>`;
}

/**
 * Returns clean, minimal URL for the tenant queue scan
 */
export function getTenantQueueScanUrl(tenantSlug: string = "default", host?: string): string {
  // Ultra-short URL ensures minimum QR complexity (Version 1-2)
  if (host && host.includes("mken.live") && !host.startsWith("mken.live")) {
    return `https://${host}/queue/scan`;
  }
  return `/queue/scan?tenant=${encodeURIComponent(tenantSlug)}`;
}
