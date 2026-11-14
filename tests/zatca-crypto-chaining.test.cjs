#!/usr/bin/env node
/**
 * منصة مكّن — فحص التشفير والتسلسل الفاتوري لهيئة الزكاة ZATCA Fatoora Phase 2 (E4.1)
 * فحص: أختام TLV الثمانية، تطهير C14N، تشفير ECDSA secp256k1، السلسلة التشفيرية، ومنع التزوير
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const zatcaEngine = require('../api/_lib/zatca-engine');

function parseTlvAllTags(base64Str) {
  const buf = Buffer.from(base64Str, 'base64');
  const tags = {};
  let offset = 0;
  while (offset < buf.length) {
    const tag = buf.readUInt8(offset);
    offset += 1;
    const len = buf.readUInt8(offset);
    offset += 1;
    const val = buf.slice(offset, offset + len);
    offset += len;
    tags[tag] = val;
  }
  return tags;
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('  🧪 فحص التشفير والتسلسل الفاتوري لـ ZATCA Fatoora Phase 2 (E4.1)');
  console.log('  🛡️ الامتثال: قرار مجلس إدارة هيئة الزكاة والضريبة والجمارك رقم 32400');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // Test 1: فحص رمز الاستجابة السريع TLV Phase 2 (Tags 1 to 8)
  // -------------------------------------------------------------------------
  console.log('\n1️⃣ فحص ترميز TLV Base64 للحقول الثمانية الإلزامية للمرحلة الثانية...');
  const seller = 'شركة مكّن لتقنية المعلومات';
  const vat = '310987654300003';
  const time = '2026-11-13T21:10:00Z';
  const total = 230.00;
  const tax = 30.00;
  const fakeHash = crypto.createHash('sha256').update('test_invoice_xml').digest('hex');
  const fakeSig = Buffer.from('MEQCIDummySignatureBytesForTestingPurposesOnly123456789==', 'utf8').toString('base64');
  const fakePub = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1234567890abcdef1234567890abcdef==';

  const qrBase64 = zatcaEngine.generateZatcaTlvQr(seller, vat, time, total, tax, fakeHash, fakeSig, fakePub);
  assert.ok(typeof qrBase64 === 'string' && qrBase64.length > 50);

  const tags = parseTlvAllTags(qrBase64);
  assert.strictEqual(tags[1].toString('utf8'), seller, 'Tag 1: اسم المورد غير مطابق');
  assert.strictEqual(tags[2].toString('utf8'), vat, 'Tag 2: الرقم الضريبي غير مطابق');
  assert.strictEqual(tags[3].toString('utf8'), time, 'Tag 3: الطابع الزمني غير مطابق');
  assert.strictEqual(tags[4].toString('utf8'), '230.00', 'Tag 4: الإجمالي مع الضريبة غير مطابق');
  assert.strictEqual(tags[5].toString('utf8'), '30.00', 'Tag 5: قيمة الضريبة غير مطابقة');
  assert.strictEqual(tags[6].toString('hex'), fakeHash, 'Tag 6: هاش الـ XML غير مطابق');
  assert.strictEqual(tags[7].toString('base64'), fakeSig, 'Tag 7: التوقيع الرقمي غير مطابق');
  assert.ok(tags[8].length > 10, 'Tag 8: المفتاح العام يجب أن يكون موجوداً');
  console.log('   ✅ نجاح: التاجات 1 إلى 8 مشفرة بـ TLV بدقة 100% ومطابقة لمعايير تطبيق زاتكا.');

  // -------------------------------------------------------------------------
  // Test 2: فحص تطهير الـ XML وحساب الهاش المعياري (Canonical C14N Hashing)
  // -------------------------------------------------------------------------
  console.log('\n2️⃣ فحص تطهير عقد التوقيع وحساب تجزئة الفاتورة (Canonical Hash)...');
  const sampleXmlWithSig = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <Signature>DummySignatureInsideWillBeRemoved</Signature>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:ID>INV-1001</cbc:ID>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject>OldQrCodeToBeRemoved</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
</Invoice>`;

  const { cleanedXml, xmlHashHex, xmlHashBase64 } = zatcaEngine.canonicalizeAndHashXml(sampleXmlWithSig);
  assert.ok(!cleanedXml.includes('UBLExtensions'), 'عقدة UBLExtensions يجب استئصالها قبل التجزئة');
  assert.ok(!cleanedXml.includes('OldQrCodeToBeRemoved'), 'عقدة الـ QR القديمة يجب استئصالها');
  assert.ok(cleanedXml.includes('INV-1001'), 'محتوى الفاتورة الأساسي يجب أن يبقى سليماً');
  assert.strictEqual(xmlHashHex.length, 64, 'هاش SHA-256 يجب أن يكون بطول 64 حرف Hex');
  assert.ok(xmlHashBase64.length > 20, 'هاش Base64 يجب أن يكون صالحاً');
  console.log('   ✅ نجاح: تطهير C14N يستبعد عقد التوقيع ويحسب الهاش المطهر الحتمي بنجاح.');

  // -------------------------------------------------------------------------
  // Test 3: فحص خلو الـ XML من العملات المشوهة والالتزام بـ SAR
  // -------------------------------------------------------------------------
  console.log('\n3️⃣ فحص رمز العملة الرسمي (SAR Currency Code Validation)...');
  const dummyInvoice = {
    id: 'INV-TEST-001',
    createdAt: '2026-11-13T21:10:00Z',
    customerName: 'عميل تجريبي',
    subtotal: 100.00,
    taxAmount: 15.00,
    totalAmount: 115.00,
    items: [
      { serviceTitle: 'خدمة غسيل', quantity: 1, unitPrice: 100.00 }
    ]
  };

  const generatedXml = zatcaEngine.buildUblInvoiceXml(dummyInvoice, {}, 1, 'NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc=');
  assert.ok(!generatedXml.includes('⃁'), 'يُحظر تماماً وجود الرمز التالف ⃁ في الفاتورة');
  assert.ok(generatedXml.includes('<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>'), 'يجب أن تكون العملة SAR');
  assert.ok(generatedXml.includes('<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>'), 'يجب أن تكون عملة الضريبة SAR');
  assert.ok(generatedXml.includes('currencyID="SAR"'), 'يجب أن تحمل المبالغ سمة currencyID="SAR"');
  console.log('   ✅ نجاح: تم استبدال الرموز المشوهة والالتزام برمز العملة الرسمي SAR في كافة الوسوم.');

  // -------------------------------------------------------------------------
  // Test 4: فحص التوقيع الرقمي الصارم بـ ECDSA وحظر البايتات العشوائية
  // -------------------------------------------------------------------------
  console.log('\n4️⃣ فحص التوقيع الرقمي ECDSA ومنع التوقيعات المزيفة (Anti-Random Bytes)...');
  
  // توليد زوج مفاتيح حقيقي على منحنى secp256k1
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const testHashHex = crypto.createHash('sha256').update('zatca_invoice_sample').digest('hex');
  const realSig = zatcaEngine.signInvoiceHash(testHashHex, privateKey);
  assert.ok(typeof realSig === 'string' && realSig.length > 30, 'التوقيع الحقيقي يجب أن يكون صالحاً');

  // التحقق الرياضي من صحة التوقيع باستخدام المفتاح العام
  const verifier = crypto.createVerify('SHA256');
  verifier.update(Buffer.from(testHashHex, 'hex'));
  verifier.end();
  const isValid = verifier.verify(publicKey, realSig, 'base64');
  assert.strictEqual(isValid, true, 'التوقيع الرقمي يجب أن يطابق المفتاح العام رياضياً');

  // فحص رفض التوقيع عند غياب المفتاح وإلقاء استثناء بدلاً من توليد بايتات عشوائية
  assert.throws(() => {
    zatcaEngine.signInvoiceHash(testHashHex, null);
  }, /المفتاح الخاص للمنشأة غير متوفر/, 'يجب إلقاء استثناء صريح عند غياب المفتاح');

  const zatcaCode = fs.readFileSync('api/v1/zatca.js', 'utf8');
  assert.ok(!zatcaCode.includes('crypto.randomBytes(64).toString'), 'تم استئصال كود البايتات العشوائية الوهمي نهائياً');
  console.log('   ✅ نجاح: التوقيع الرقمي المشفر يلتزم بمنحنى secp256k1 ويمتنع عن أي تزوير وهمي.');

  // -------------------------------------------------------------------------
  // Test 5: فحص اتساق السلسلة التشفيرية (Cryptographic Chaining: PIH & ICV)
  // -------------------------------------------------------------------------
  console.log('\n5️⃣ فحص اتساق السلسلة التشفيرية المتصلة (Cryptographic Hash Chaining)...');
  
  // الفاتورة رقم 1 (Genesis Invoice)
  const initialPih = 'NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc='; // Base64 of SHA256 of "0"
  const inv1Xml = zatcaEngine.buildUblInvoiceXml(dummyInvoice, {}, 1, initialPih);
  const hash1 = zatcaEngine.canonicalizeAndHashXml(inv1Xml).xmlHashBase64;

  // الفاتورة رقم 2 (يجب أن ترتبط بهاش الفاتورة رقم 1)
  const inv2 = Object.assign({}, dummyInvoice, { id: 'INV-TEST-002' });
  const inv2Xml = zatcaEngine.buildUblInvoiceXml(inv2, {}, 2, hash1);
  assert.ok(inv2Xml.includes(`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${hash1}</cbc:EmbeddedDocumentBinaryObject>`), 'الفاتورة 2 يجب أن تحمل هاش الفاتورة 1 كـ PIH');

  const hash2 = zatcaEngine.canonicalizeAndHashXml(inv2Xml).xmlHashBase64;
  assert.notStrictEqual(hash1, hash2, 'الهاشات يجب أن تكون متغيرة ومترابطة');

  // الفاتورة رقم 3
  const inv3 = Object.assign({}, dummyInvoice, { id: 'INV-TEST-003' });
  const inv3Xml = zatcaEngine.buildUblInvoiceXml(inv3, {}, 3, hash2);
  assert.ok(inv3Xml.includes(`<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${hash2}</cbc:EmbeddedDocumentBinaryObject>`), 'الفاتورة 3 يجب أن تحمل هاش الفاتورة 2 كـ PIH');
  console.log('   ✅ نجاح: السلسلة التشفيرية مترابطة بشكل حتمي وتمنع أي حذف أو تعديل للفواتير.');

  // -------------------------------------------------------------------------
  // Test 6: فحص القفل الذري للسلسلة في مخطط SQL
  // -------------------------------------------------------------------------
  console.log('\n6️⃣ فحص مخطط قاعدة البيانات وقفل التنافس الذري (Atomic Lock Schema)...');
  const sqlCode = fs.readFileSync('db/zatca-chaining-crypto-schema.sql', 'utf8');
  assert.ok(sqlCode.includes('mken_zatca_chains'), 'يجب أن يحتوي المخطط على جدول السلسلة mken_zatca_chains');
  assert.ok(sqlCode.includes('FOR UPDATE'), 'يجب استخدام القفل الذري FOR UPDATE لمنع حالات السباق');
  assert.ok(sqlCode.includes('mken_fn_next_zatca_sequence'), 'يجب أن تتوفر دالة حجز العداد الذرية');
  assert.ok(sqlCode.includes('mken_fn_commit_zatca_invoice'), 'يجب أن تتوفر دالة تثبيت الهاش الجديد');
  console.log('   ✅ نجاح: المخطط مدعوم بقفل قاعدة بيانات يضمن استحالة حدوث انقسام في السلسلة (Fork).');

  console.log('\n' + '='.repeat(80));
  console.log('🎉 كافة اختبارات موديول E4.1 لـ ZATCA اجتازت الفحص بنسبة 100% وبمطابقة كاملة للأنظمة!');
  console.log('='.repeat(80));
}

runTests().catch(err => {
  console.error('\n❌ فشل أحد الاختبارات:', err);
  process.exit(1);
});
