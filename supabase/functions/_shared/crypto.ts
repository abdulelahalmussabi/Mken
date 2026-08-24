/** Cryptographic helpers — SHA-256 / HMAC-SHA256 / CSPRNG (Web Crypto) */

const HEX = 16;

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(HEX).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bufToHex(sig);
}

/** 32-byte opaque token → base64url (cookie value) */
export function randomTokenBase64Url(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bufToHex(buf);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** PDPL: hash E.164 with server pepper — never store raw phone in trust tables */
export async function phoneHash(e164: string, pepper: string): Promise<string> {
  return sha256Hex(`${e164.trim()}|${pepper}`);
}

export async function ipHash(ip: string, pepper: string): Promise<string> {
  return sha256Hex(`${ip}|ip|${pepper}`);
}

export async function subnetHash(subnet: string, pepper: string): Promise<string> {
  return sha256Hex(`${subnet}|subnet|${pepper}`);
}

/**
 * Client sends device_fp_hash already = SHA-256(canonical_signals).
 * Server re-binds with pepper: SHA-256(clientHash || pepper).
 */
export async function bindFingerprintHash(
  clientFpHash: string,
  pepper: string,
): Promise<string> {
  const normalized = clientFpHash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("invalid_device_fp_hash");
  }
  return sha256Hex(`${normalized}|${pepper}`);
}

export async function deviceTokenHash(rawToken: string): Promise<string> {
  return sha256Hex(rawToken);
}

export async function buildTrustHmac(
  secret: string,
  parts: {
    deviceFpHash: string;
    deviceTokenHash: string;
    userId: string;
    expiresAtUnix: number;
  },
): Promise<string> {
  const msg =
    `${parts.deviceFpHash}:${parts.deviceTokenHash}:${parts.userId}:${parts.expiresAtUnix}`;
  return hmacSha256Hex(secret, msg);
}
