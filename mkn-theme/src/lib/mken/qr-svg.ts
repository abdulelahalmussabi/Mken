/**
 * mkn-theme/src/lib/mken/qr-svg.ts
 * مولّد رموز الاستجابة السريعة (QR Code SVG) الخفيف والمستقل تماماً (Zero-Dependency)
 * متطابق مع مواصفة ISO/IEC 18004 (Model 2, Versions 1-5, ECC Level M)
 * مصمم لتوليد رموز التقييم المباشرة والطباعة في لوحة تحكم التاجر والفواتير
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[(GF_LOG[x] + GF_LOG[y]) % 255];
}

function polyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const result = new Uint8Array(p1.length + p2.length - 1) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function rsGenPoly(n: number): Uint8Array {
  let g: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    g = polyMul(g, new Uint8Array([1, GF_EXP[i]]));
  }
  return g;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

interface VersionConfig {
  v: number;
  mod: number;
  dataCap: number;
  totalData: number;
  ecLen: number;
  align: number[];
}

const VERSION_TABLE: Array<VersionConfig | null> = [
  null,
  { v: 1, mod: 21, dataCap: 14, totalData: 16, ecLen: 10, align: [] },
  { v: 2, mod: 25, dataCap: 26, totalData: 28, ecLen: 16, align: [6, 18] },
  { v: 3, mod: 29, dataCap: 42, totalData: 44, ecLen: 26, align: [6, 22] },
  { v: 4, mod: 33, dataCap: 62, totalData: 64, ecLen: 36, align: [6, 26] },
  { v: 5, mod: 37, dataCap: 84, totalData: 86, ecLen: 48, align: [6, 30] },
];

export function generateQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const utf8 = encoder.encode(text);
  let ver = VERSION_TABLE.find((cfg) => cfg !== null && cfg.dataCap >= utf8.length);
  if (!ver) ver = VERSION_TABLE[VERSION_TABLE.length - 1] as VersionConfig;

  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  }

  // 1. Bitstream encoding: Byte mode (0100) + character count + payload
  pushBits(0b0100, 4);
  pushBits(utf8.length, 8);
  for (let i = 0; i < utf8.length; i++) pushBits(utf8[i], 8);

  // Terminator
  const padBitsNeeded = ver.totalData * 8 - bits.length;
  pushBits(0, Math.min(4, Math.max(0, padBitsNeeded)));

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Alternating pad bytes 0xEC, 0x11
  const PAD_BYTES = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < ver.totalData * 8) {
    pushBits(PAD_BYTES[padIdx % 2], 8);
    padIdx++;
  }

  // Convert to data bytes
  const dataBytes = new Uint8Array(ver.totalData);
  for (let i = 0; i < ver.totalData; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }

  // 2. Reed-Solomon Error Correction (Level M)
  let finalCodewords: Uint8Array;
  if (ver.v <= 4) {
    const ec = rsEncode(dataBytes, ver.ecLen);
    finalCodewords = new Uint8Array(ver.totalData + ver.ecLen);
    finalCodewords.set(dataBytes);
    finalCodewords.set(ec, ver.totalData);
  } else {
    // V5 Level M: 2 blocks of 43 data, 24 EC
    const b1Data = dataBytes.slice(0, 43);
    const b2Data = dataBytes.slice(43);
    const b1Ec = rsEncode(b1Data, 24);
    const b2Ec = rsEncode(b2Data, 24);
    finalCodewords = new Uint8Array(86 + 48);
    let idx = 0;
    for (let i = 0; i < 43; i++) {
      finalCodewords[idx++] = b1Data[i];
      finalCodewords[idx++] = b2Data[i];
    }
    for (let i = 0; i < 24; i++) {
      finalCodewords[idx++] = b1Ec[i];
      finalCodewords[idx++] = b2Ec[i];
    }
  }

  // 3. Grid Construction
  const N = ver.mod;
  const matrix: Array<Array<number | null>> = Array.from({ length: N }, () => Array(N).fill(null));
  const isFunction: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  function setFunc(r: number, c: number, val: number) {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      matrix[r][c] = val;
      isFunction[r][c] = true;
    }
  }

  // Finder patterns (top-left, top-right, bottom-left)
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inBox =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFunc(row + r, col + c, inBox ? 1 : 0);
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    setFunc(6, i, i % 2 === 0 ? 1 : 0);
    setFunc(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment pattern
  if (ver.align.length >= 2) {
    const ar = ver.align[1],
      ac = ver.align[1];
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const val = Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
        setFunc(ar + r, ac + c, val);
      }
    }
  }

  // Dark module
  setFunc(4 * ver.v + 9, 8, 1);

  // Format info area reserve
  for (let i = 0; i < 9; i++) {
    setFunc(8, i, 0);
    setFunc(i, 8, 0);
    setFunc(8, N - 1 - i, 0);
    setFunc(N - 1 - i, 8, 0);
  }

  // 4. Place Data Bits
  const allBits: number[] = [];
  for (let i = 0; i < finalCodewords.length; i++) {
    for (let j = 7; j >= 0; j--) allBits.push((finalCodewords[i] >> j) & 1);
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = N - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing strip
    for (let vert = 0; vert < N; vert++) {
      const r = upwards ? N - 1 - vert : vert;
      for (let c = right; c > right - 2; c--) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply Standard Mask 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? bit ^ 1 : bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 5. Format Information bits for Mask 0, ECC Level M: 101010000010010
  const FORMAT_BITS = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = FORMAT_BITS[i];
  matrix[8][7] = FORMAT_BITS[6];
  matrix[8][8] = FORMAT_BITS[7];
  matrix[7][8] = FORMAT_BITS[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = FORMAT_BITS[i];

  for (let i = 0; i < 7; i++) matrix[N - 1 - i][8] = FORMAT_BITS[i];
  for (let i = 7; i < 15; i++) matrix[8][N - 15 + i] = FORMAT_BITS[i];

  return matrix.map((row) => row.map((cell) => cell === 1));
}

export interface QrSvgOptions {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  /** Alias for darkColor (admin QR callers). */
  foreground?: string;
  /** Alias for lightColor (admin QR callers). */
  background?: string;
  title?: string;
}

export function generateQrSvg(text: string, options: QrSvgOptions = {}): string {
  const matrix = generateQrMatrix(text);
  const N = matrix.length;
  const margin = options.margin ?? 3;
  const totalDim = N + margin * 2;
  const size = options.size ?? 250;
  const dark = options.darkColor || options.foreground || "#0f172a";
  const light = options.lightColor || options.background || "#ffffff";

  let rects = "";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${dark}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${light}"/>
  ${rects}
</svg>`;
}

export function generateQrDataUrl(text: string, options: QrSvgOptions = {}): string {
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
