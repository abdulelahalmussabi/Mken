#!/usr/bin/env node
'use strict';

/** اختبار دورة التوقيع/التحقق للتراخيص (ECDSA P-256 / IEEE P-1363). */

const sign = require('../api/_lib/license-sign');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('PASS', msg); } else { fail++; console.log('FAIL', msg); } }

const { privateKeyPem, publicKeyPem } = sign.generateKeyPair();
process.env.LICENSE_PRIVATE_KEY = privateKeyPem;
process.env.LICENSE_PUBLIC_KEY = publicKeyPem;

const key = sign.generateLicenseKey();
ok(/^MKEN-([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/.test(key), 'صيغة مفتاح الترخيص: ' + key);

const payload = { k: key, plan: 'Pro', mid: 'abc123', max: 1, cust: 'عميل', iat: Date.now(), exp: Date.now() + 1e10 };
const token = sign.signToken(payload);
ok(token.split('.').length === 3, 'التوكن مكوّن من ثلاثة أجزاء');

// طول التوقيع IEEE P-1363 لـ P-256 = 64 بايت (متوافق مع Web Crypto)
const sigBuf = sign.b64urlToBuf(token.split('.')[2]);
ok(sigBuf.length === 64, 'طول التوقيع 64 بايت (IEEE P-1363): ' + sigBuf.length);

const verified = sign.verifyToken(token, publicKeyPem);
ok(verified && verified.k === key && verified.plan === 'Pro', 'التحقق ينجح ويعيد الحمولة الصحيحة');

// العبث بالتوكن يجب أن يفشل
const tampered = token.slice(0, -3) + (token.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
ok(sign.verifyToken(tampered, publicKeyPem) === null, 'التحقق يفشل عند العبث بالتوقيع');

// مفتاح عام مختلف يجب أن يفشل
const other = sign.generateKeyPair();
ok(sign.verifyToken(token, other.publicKeyPem) === null, 'التحقق يفشل بمفتاح عام مختلف');

console.log('\nنتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل');
process.exit(fail ? 1 : 0);
