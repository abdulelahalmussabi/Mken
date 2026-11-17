'use strict';

/**
 * مكن — توقيع التراخيص رقمياً (ECDSA P-256 / ES256)
 *
 * يُنتج توكن ترخيص موقّعاً بصيغة مدمجة:  base64url(header).base64url(payload).base64url(signature)
 * التوقيع بصيغة IEEE P-1363 (r||s) ليكون متوافقاً مع Web Crypto في العميل (المتصفح/Electron)،
 * فيتحقق Mken Lite من التوقيع محلياً بالمفتاح العام دون إنترنت، ما يمنع تزوير المفاتيح.
 *
 * المتغيرات البيئية:
 *   LICENSE_PRIVATE_KEY  مفتاح PKCS8 PEM (سري — على الخادم فقط)
 *   LICENSE_PUBLIC_KEY   مفتاح SPKI PEM (عام — يمكن نشره وتضمينه في العميل)
 *   (الأسطر داخل PEM يمكن تمريرها بـ \n مهرّبة في متغير البيئة)
 */

const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function b64urlJson(obj) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'));
}

function normalizePem(pem) {
  if (!pem) return '';
  return String(pem).replace(/\\n/g, '\n').trim();
}

function getPrivateKey() {
  const pem = normalizePem(process.env.LICENSE_PRIVATE_KEY);
  if (!pem) throw new Error('LICENSE_PRIVATE_KEY غير مهيّأ في البيئة');
  return pem;
}

function getPublicKey() {
  return normalizePem(process.env.LICENSE_PUBLIC_KEY);
}

/**
 * توقيع حمولة الترخيص وإرجاع التوكن المدمج.
 * @param {Object} payload بيانات الترخيص (key, plan, mid, exp, iat, max, cust)
 */
function signToken(payload) {
  const header = { alg: 'ES256', typ: 'MKEN-LIC', v: 1 };
  const signingInput = b64urlJson(header) + '.' + b64urlJson(payload);
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: getPrivateKey(),
    dsaEncoding: 'ieee-p1363'
  });
  return signingInput + '.' + b64url(signature);
}

/**
 * التحقق من توكن ترخيص. يعيد الحمولة عند الصحة أو null عند الفشل.
 * @param {String} token
 * @param {String} [publicKeyPem] افتراضياً من البيئة
 */
function verifyToken(token, publicKeyPem) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const signingInput = parts[0] + '.' + parts[1];
    const signature = b64urlToBuf(parts[2]);
    const ok = crypto.verify('sha256', Buffer.from(signingInput), {
      key: publicKeyPem ? normalizePem(publicKeyPem) : getPublicKey(),
      dsaEncoding: 'ieee-p1363'
    }, signature);
    if (!ok) return null;
    return JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  } catch (e) {
    return null;
  }
}

/** توليد زوج مفاتيح ECDSA P-256 (للاستخدام لمرة واحدة عند الإعداد) */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' })
  };
}

/** توليد مفتاح ترخيص بشري الشكل: MKEN-XXXX-XXXX-XXXX-XXXX */
function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا أحرف ملتبسة
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if ((i + 1) % 4 === 0 && i !== 15) out += '-';
  }
  return 'MKEN-' + out;
}

module.exports = {
  b64url, b64urlToBuf, b64urlJson,
  signToken, verifyToken,
  generateKeyPair, generateLicenseKey,
  getPublicKey
};
