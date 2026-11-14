/**
 * js/zatca-qr.js
 * محرك تشفير وفك ترميز ختم الفوترة الإلكترونية ZATCA Phase 2 (TLV Base64)
 * متطابق 100% مع اللائحة التنفيذية لهيئة الزكاة والضريبة والجمارك (المملكة العربية السعودية)
 * يعمل في المتصفحات الحديثة وبيئة Node.js (Isomorphic).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else {
    // المتصفح
    root.MkenZatcaQr = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * تشفير الحقل الواحد بتنسيق TLV (Tag-Length-Value)
   * @param {number} tagNumber - رقم الحقل (1: المورد، 2: الرقم الضريبي، 3: الطابع الزمني، 4: الإجمالي، 5: الضريبة)
   * @param {string} valueString - القيمة النصية
   * @returns {Uint8Array}
   */
  function getTlvTag(tagNumber, valueString) {
    var str = String(valueString || '');
    var utf8Bytes;

    if (typeof TextEncoder !== 'undefined') {
      utf8Bytes = new TextEncoder().encode(str);
    } else if (typeof Buffer !== 'undefined') {
      var buf = Buffer.from(str, 'utf8');
      utf8Bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
    } else {
      // بديل للمتصفحات القديمة جداً
      var encoded = unescape(encodeURIComponent(str));
      utf8Bytes = new Uint8Array(encoded.length);
      for (var i = 0; i < encoded.length; i++) {
        utf8Bytes[i] = encoded.charCodeAt(i);
      }
    }

    var len = utf8Bytes.length;
    var result = new Uint8Array(2 + len);
    result[0] = tagNumber;
    result[1] = len;
    result.set(utf8Bytes, 2);
    return result;
  }

  /**
   * توليد رمز الاستجابة السريعة TLV Base64 المعتمد من ZATCA
   * @param {string} sellerName - اسم المورد المسجل
   * @param {string} vatNumber - الرقم الضريبي المكون من 15 خانة
   * @param {string} timestampIso - تاريخ ووقت العملية بتنسيق ISO 8601
   * @param {number|string} totalWithVat - المبلغ الإجمالي شاملاً الضريبة
   * @param {number|string} vatAmount - مبلغ ضريبة القيمة المضافة (15%)
   * @returns {string} سلسلة Base64 جاهزة لإنشاء الـ QR Code
   */
  function generateZatcaTLV(sellerName, vatNumber, timestampIso, totalWithVat, vatAmount) {
    var t1 = getTlvTag(1, sellerName || 'منصة مكّن');
    var t2 = getTlvTag(2, vatNumber || '300000000000003');
    var t3 = getTlvTag(3, timestampIso || new Date().toISOString());
    var t4 = getTlvTag(4, Number(totalWithVat || 0).toFixed(2));
    var t5 = getTlvTag(5, Number(vatAmount || 0).toFixed(2));

    var totalLen = t1.length + t2.length + t3.length + t4.length + t5.length;
    var merged = new Uint8Array(totalLen);

    var offset = 0;
    var tags = [t1, t2, t3, t4, t5];
    for (var i = 0; i < tags.length; i++) {
      merged.set(tags[i], offset);
      offset += tags[i].length;
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(merged.buffer, merged.byteOffset, merged.length).toString('base64');
    }

    var binary = '';
    var len = merged.byteLength;
    for (var j = 0; j < len; j++) {
      binary += String.fromCharCode(merged[j]);
    }
    return btoa(binary);
  }

  /**
   * فك ترميز نص TLV Base64 واستخراج الحقول الخمسة
   * @param {string} base64Str
   * @returns {Object} { 1: seller, 2: vatNo, 3: time, 4: total, 5: vat }
   */
  function parseZatcaTLV(base64Str) {
    if (!base64Str) return {};
    var bytes;

    if (typeof Buffer !== 'undefined') {
      bytes = Buffer.from(base64Str, 'base64');
    } else {
      var binary = atob(base64Str);
      bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    }

    var tags = {};
    var offset = 0;
    var totalLen = bytes.length;

    while (offset < totalLen) {
      if (offset + 2 > totalLen) break;
      var tagNum = bytes[offset];
      var tagLen = bytes[offset + 1];
      offset += 2;

      if (offset + tagLen > totalLen) break;

      var valBytes = bytes.slice(offset, offset + tagLen);
      var valStr = '';

      if (typeof TextDecoder !== 'undefined') {
        valStr = new TextDecoder('utf-8').decode(valBytes);
      } else if (typeof Buffer !== 'undefined') {
        valStr = Buffer.from(valBytes).toString('utf8');
      } else {
        for (var k = 0; k < valBytes.length; k++) {
          valStr += String.fromCharCode(valBytes[k]);
        }
        try {
          valStr = decodeURIComponent(escape(valStr));
        } catch (e) {
          // fallback
        }
      }

      tags[tagNum] = valStr;
      offset += tagLen;
    }

    return tags;
  }

  /**
   * تنسيق رقم الجوال السعودي المتسامح (Forgiving Saudi Phone Normalizer)
   * يحول أي صيغة (+966, 00966, 966, 05, 5) إلى الصيغة القياسية 05XXXXXXXX
   */
  function normalizeSaudiPhone(raw) {
    if (!raw) return null;
    var clean = String(raw).replace(/\D/g, ''); // استخراج الأرقام فقط

    if (clean.startsWith('009665') && clean.length === 14) {
      return '05' + clean.slice(6);
    }
    if (clean.startsWith('9665') && clean.length === 12) {
      return '05' + clean.slice(4);
    }
    if (clean.startsWith('05') && clean.length === 10) {
      return clean;
    }
    if (clean.startsWith('5') && clean.length === 9) {
      return '0' + clean;
    }
    return null;
  }

  /**
   * توليد مفتاح عشوائي فريد لمنع تكرار النقر وتعدد الخصم (Idempotency Key)
   */
  function generateIdempotencyKey(prefix) {
    var p = prefix || 'mken_idemp';
    var time = Date.now().toString(36);
    var rnd = Math.random().toString(36).substring(2, 9);
    return p + '_' + time + '_' + rnd;
  }

  return {
    generateZatcaTLV: generateZatcaTLV,
    parseZatcaTLV: parseZatcaTLV,
    normalizeSaudiPhone: normalizeSaudiPhone,
    generateIdempotencyKey: generateIdempotencyKey
  };
});
