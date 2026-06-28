#!/usr/bin/env node
'use strict';

/**
 * مكن — توليد زوج مفاتيح توقيع التراخيص (ECDSA P-256).
 * شغّله مرة واحدة عند الإعداد:
 *   node scripts/generate-license-keys.cjs
 *
 * ثم:
 *  - ضع LICENSE_PRIVATE_KEY و LICENSE_PUBLIC_KEY في متغيرات بيئة Vercel (سرّية).
 *  - انسخ المفتاح العام (SPKI) إلى عميل Mken Lite في js/license-config.js
 *    (الحقل LICENSE_PUBLIC_KEY) ليتم التحقق أوف لاين.
 */

const { generateKeyPair } = require('../api/_lib/license-sign');

const { privateKeyPem, publicKeyPem } = generateKeyPair();

function toEnvLine(name, pem) {
  // تحويل أسطر PEM إلى \n مهرّبة لتناسب متغيرات البيئة
  return name + '=' + JSON.stringify(pem.trim().replace(/\n/g, '\\n'));
}

console.log('\n===== المفتاح الخاص (سرّي — خادم فقط) =====\n');
console.log(privateKeyPem.trim());
console.log('\n===== المفتاح العام (يُضمَّن في عميل Mken Lite) =====\n');
console.log(publicKeyPem.trim());

console.log('\n===== أسطر متغيرات البيئة (Vercel) =====\n');
console.log(toEnvLine('LICENSE_PRIVATE_KEY', privateKeyPem));
console.log(toEnvLine('LICENSE_PUBLIC_KEY', publicKeyPem));

console.log('\n===== للصق في js/license-config.js بعميل Mken Lite =====\n');
console.log('LICENSE_PUBLIC_KEY: `' + publicKeyPem.trim() + '`');
console.log('\nتم. احفظ المفتاح الخاص في مكان آمن ولا تشاركه إطلاقاً.\n');
