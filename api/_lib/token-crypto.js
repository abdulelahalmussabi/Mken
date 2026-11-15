'use strict';

const crypto = require('crypto');

/**
 * api/_lib/token-crypto.js
 * وحدة التشفير المعياري المتوافقة مع ضوابط الهيئة الوطنية للأمن السيبراني (NCA)
 * ونظام حماية البيانات الشخصية (PDPL)
 *
 * الخوارزمية: AES-256-GCM (Authenticated Encryption)
 * الصيغة المشفرة: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */

const CIPHER_ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // 96-bit recommended for GCM

/**
 * اشتقاق مفتاح تشفير بطول 32 بايت (256 بت)
 */
function getEncryptionKey() {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    'mken-security-master-key-saudi-2026';

  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * تشفير النص
 * @param {string} plaintext
 * @returns {string}
 */
function encryptToken(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  // إذا كان مشفراً مسبقاً لا تعيد تشفيره
  if (plaintext.startsWith(PREFIX)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(CIPHER_ALGO, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * فك تشفير النص
 * @param {string} ciphertext
 * @returns {string}
 */
function decryptToken(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext;
  }

  // إذا لم يبدأ بالبادئة المحددة، فهو نص غير مشفر (legacy plaintext) لتجنب كسر البيانات القديمة
  if (!ciphertext.startsWith(PREFIX)) {
    return ciphertext;
  }

  const parts = ciphertext.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('صيغة التشفير غير صالحة');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(CIPHER_ALGO, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * فحص هل القيمة مشفرة
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = {
  encryptToken,
  decryptToken,
  isEncrypted,
};
