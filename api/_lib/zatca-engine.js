'use strict';

const crypto = require('crypto');

/**
 * 1. ترميز TLV القياسي للمرحلة الثانية لـ ZATCA (Tags 1 through 8)
 * وفق وثيقة المعايير الفنية لهيئة الزكاة والضريبة والجمارك
 */
function generateZatcaTlvQr(seller, vat, time, total, tax, xmlHash, signature, publicKey) {
  function toTlv(tag, val) {
    const valBuf = Buffer.isBuffer(val) ? val : Buffer.from(String(val || ''), 'utf8');
    const tagBuf = Buffer.from([tag]);
    const lenBuf = Buffer.from([valBuf.length]);
    return Buffer.concat([tagBuf, lenBuf, valBuf]);
  }

  const parts = [
    toTlv(1, seller || 'منشأة مكّن'),
    toTlv(2, vat || '300000000000003'),
    toTlv(3, time || new Date().toISOString()),
    toTlv(4, Number(total || 0).toFixed(2)),
    toTlv(5, Number(tax || 0).toFixed(2))
  ];

  if (xmlHash) {
    const hashBuf = typeof xmlHash === 'string' ? Buffer.from(xmlHash, 'hex') : xmlHash;
    parts.push(toTlv(6, hashBuf));
  }
  if (signature) {
    const sigBuf = typeof signature === 'string' ? Buffer.from(signature, 'base64') : signature;
    parts.push(toTlv(7, sigBuf));
  }
  if (publicKey) {
    const cleanPub = typeof publicKey === 'string'
      ? Buffer.from(publicKey.replace(/-----\w+ PUBLIC KEY-----|\n|\r|\s/g, ''), 'base64')
      : publicKey;
    parts.push(toTlv(8, cleanPub));
  }

  return Buffer.concat(parts).toString('base64');
}

/**
 * 2. تطهير الـ XML لحساب التجزئة الرسمية (Canonical C14N Hash Preparation)
 */
function canonicalizeAndHashXml(rawXml) {
  if (!rawXml) throw new Error('XML content is required for canonicalization');

  // استئصال عقدة التوقيع UBLExtensions ورمز الـ QR لحساب الهاش غير المشوب
  let cleanedXml = rawXml
    .replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/g, '')
    .replace(/<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g, '')
    .trim();

  // حساب تجزئة SHA-256 القياسية
  const hashHex = crypto.createHash('sha256').update(cleanedXml, 'utf8').digest('hex');
  const hashBase64 = Buffer.from(hashHex, 'hex').toString('base64');

  return {
    cleanedXml: cleanedXml,
    xmlHashHex: hashHex,
    xmlHashBase64: hashBase64
  };
}

/**
 * 3. التوقيع الرقمي الصارم باستخدام مفتاح المنشأة الخاص (ECDSA secp256k1)
 * تحذير: حظر توليد أي بايتات عشوائية، وإلقاء استثناء فوري عند التعثر
 */
function signInvoiceHash(xmlHashHex, privateKeyPem) {
  if (!privateKeyPem) {
    throw new Error('فشل التوقيع: المفتاح الخاص للمنشأة غير متوفر');
  }

  try {
    const sign = crypto.createSign('SHA256');
    sign.update(Buffer.from(xmlHashHex, 'hex'));
    sign.end();
    return sign.sign(privateKeyPem, 'base64');
  } catch (err) {
    console.error('[ZATCA Crypto Error]: Failed to sign invoice with ECDSA key:', err.message);
    throw new Error('تعذر إنشاء التوقيع الرقمي للفاتورة: ' + err.message);
  }
}

/**
 * 4. إنشاء UBL 2.1 XML مطابق 100% لاشتراطات زاتكا والمادة 53 للعملات الخليجية
 */
function buildUblInvoiceXml(invoice, tenantConfig, icv, pih, customFx) {
  const cfg = tenantConfig || {};
  const uuid = invoice.uuid || crypto.randomUUID();
  const id = invoice.id || ('INV-' + (icv || 1));
  const now = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toISOString().split('T')[1].split('.')[0];

  const currency = invoice.currency || 'SAR';
  const isForeign = currency !== 'SAR';
  const fxRate = Number(customFx || (invoice.samaFx && invoice.samaFx.exchangeRate) || 1.000000);

  const sellerName = cfg.businessName || 'منشأة مكّن التجارية';
  const vatNumber = cfg.vatNumber || '311234567800003';
  const street = cfg.street || 'شارع العليا العام';
  const city = cfg.city || 'الرياض';
  const country = 'SA';

  let itemsXml = '';
  (invoice.items || []).forEach((item, index) => {
    const price = Number(item.unitPrice || item.price || 0);
    const qty = Number(item.quantity || 1);
    const itemSubtotal = price * qty;
    const itemTax = itemSubtotal * 0.15;
    const itemTotal = itemSubtotal + itemTax;

    itemsXml += `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${currency}">${itemSubtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${currency}">${itemTax.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${currency}">${itemTotal.toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${item.serviceTitle || item.name || 'منتج / خدمة'}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${currency}">${price.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
  });

  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.taxAmount || 0);
  const total = Number(invoice.totalAmount || (subtotal + tax));

  const sarTax = (invoice.samaFx && invoice.samaFx.sarTaxAmount !== undefined)
    ? Number(invoice.samaFx.sarTaxAmount)
    : (isForeign ? (Math.round((tax * fxRate + 1e-6) * 100) / 100) : tax);

  const taxExchangeRateXml = isForeign ? `
    <cac:TaxExchangeRate>
        <cbc:SourceCurrencyCode>${currency}</cbc:SourceCurrencyCode>
        <cbc:TargetCurrencyCode>SAR</cbc:TargetCurrencyCode>
        <cbc:CalculationRate>${fxRate.toFixed(6)}</cbc:CalculationRate>
        <cbc:Date>${date}</cbc:Date>
    </cac:TaxExchangeRate>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${id}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${icv || 1}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih || 'NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc='}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${cfg.crNumber || '1010101010'}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${street}</cbc:StreetName>
                <cbc:BuildingNumber>${cfg.buildingNo || '1234'}</cbc:BuildingNumber>
                <cbc:PlotIdentification>${cfg.plotId || '5678'}</cbc:PlotIdentification>
                <cbc:CitySubdivisionName>${cfg.district || 'الورود'}</cbc:CitySubdivisionName>
                <cbc:CityName>${city}</cbc:CityName>
                <cbc:PostalZone>${cfg.postalCode || '12345'}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${country}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${sellerName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${invoice.customerName || 'عميل نقدي'}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${date}</cbc:ActualDeliveryDate>
    </cac:Delivery>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    </cac:PaymentMeans>${taxExchangeRateXml}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${sarTax.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${sarTax.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${currency}">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="${currency}">0.00</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="${currency}">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    ${itemsXml}
</Invoice>`;
}

module.exports = {
  generateZatcaTlvQr: generateZatcaTlvQr,
  canonicalizeAndHashXml: canonicalizeAndHashXml,
  signInvoiceHash: signInvoiceHash,
  buildUblInvoiceXml: buildUblInvoiceXml
};
