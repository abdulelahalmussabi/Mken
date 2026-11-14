'use strict';

const assert = require('assert');
const gccTaxEngine = require('../api/_lib/gcc-tax-engine');
const zatcaEngine = require('../api/_lib/zatca-engine');
const checkoutHandler = require('../api/v1/checkout');

console.log('================================================================');
console.log('🧪 اختبارات التحقق الشاملة لمحرك الضرائب والعملات الخليجية (E4.2)');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Test 1: الدقة العشرية للعملات الخليجية (2 خانات لـ SAR/AED/QAR و3 لـ KWD/BHD/OMR)
// -----------------------------------------------------------------------------
runTest('1. التحقق من السجل الرسمي لدقة العملات الخليجية (ISO 4217 & Decimals)', () => {
  const currencies = gccTaxEngine.GCC_CURRENCIES;

  assert.strictEqual(currencies.SAR.decimals, 2, 'SAR must have 2 decimals');
  assert.strictEqual(currencies.SAR.scale, 100, 'SAR scale must be 100');

  assert.strictEqual(currencies.AED.decimals, 2, 'AED must have 2 decimals');
  assert.strictEqual(currencies.AED.scale, 100, 'AED scale must be 100');

  assert.strictEqual(currencies.QAR.decimals, 2, 'QAR must have 2 decimals');
  assert.strictEqual(currencies.QAR.scale, 100, 'QAR scale must be 100');

  assert.strictEqual(currencies.KWD.decimals, 3, 'KWD must have 3 decimals');
  assert.strictEqual(currencies.KWD.scale, 1000, 'KWD scale must be 1000');

  assert.strictEqual(currencies.BHD.decimals, 3, 'BHD must have 3 decimals');
  assert.strictEqual(currencies.BHD.scale, 1000, 'BHD scale must be 1000');

  assert.strictEqual(currencies.OMR.decimals, 3, 'OMR must have 3 decimals');
  assert.strictEqual(currencies.OMR.scale, 1000, 'OMR scale must be 1000');
});

// -----------------------------------------------------------------------------
// Test 2: حماية الحسابات من انزلاق الفواصل العشرية (Floating-Point Drift Immunity)
// -----------------------------------------------------------------------------
runTest('2. حماية العمليات المالية بالأعداد الصحيحة ومنع مشاكل الفلوت (Float Drift Immunity)', () => {
  // مثال كلاسيكي في جافاسكريبت: 19.99 * 0.15 = 2.9984999999999997
  const result = gccTaxEngine.calculateGccTransaction({
    amount: 19.99,
    currency: 'SAR',
    supplierCountry: 'SA',
    customerCountry: 'SA'
  });

  // يجب أن تقرب بدقة إلى 3.00 ريال
  assert.strictEqual(result.transaction.subtotal, 19.99);
  assert.strictEqual(result.transaction.taxAmount, 3.00);
  assert.strictEqual(result.transaction.totalAmount, 22.99);
  assert.strictEqual(result.transaction.totalMinor, 2299);
});

// -----------------------------------------------------------------------------
// Test 3: فحص التوريد المحلي بالعملات الأجنبية (Place of Supply - Domestic in AED)
// -----------------------------------------------------------------------------
runTest('3. التوريد المحلي السعودي بالدرهم الإماراتي يخضع لضريبة 15% كاملة (Place of Supply)', () => {
  const result = gccTaxEngine.calculateGccTransaction({
    amount: 100.00,
    currency: 'AED',
    supplierCountry: 'SA',
    customerCountry: 'SA'
  });

  assert.strictEqual(result.taxRules.jurisdiction, 'SA');
  assert.strictEqual(result.taxRules.vatRatePct, 15);
  assert.strictEqual(result.taxRules.isReverseCharge, false);
  assert.strictEqual(result.transaction.taxAmount, 15.00);
  assert.strictEqual(result.transaction.totalAmount, 115.00);

  // التحقق من تحويل SAMA المعتمد (1 AED = 1.021000 SAR)
  // 115 AED * 1.021 = 117.415 -> 117.42 SAR (11742 هللة)
  assert.strictEqual(result.samaFx.exchangeRate, 1.021000);
  assert.strictEqual(result.samaFx.sarTotalAmount, 117.42);
  assert.strictEqual(result.samaFx.sarTotalHalalas, 11742);
});

// -----------------------------------------------------------------------------
// Test 4: آلية الاحتساب العكسي B2B الخليجية (Reverse Charge Mechanism)
// -----------------------------------------------------------------------------
runTest('4. التوريد الخليجي بين المنشآت B2B مع رقم ضريبي يخضع للاحتساب العكسي 0% (RCM)', () => {
  const result = gccTaxEngine.calculateGccTransaction({
    amount: 500.00,
    currency: 'AED',
    supplierCountry: 'SA',
    customerCountry: 'AE',
    isB2B: true,
    customerGccTrn: 'AE1002003004005'
  });

  assert.strictEqual(result.taxRules.jurisdiction, 'AE');
  assert.strictEqual(result.taxRules.vatRatePct, 0);
  assert.strictEqual(result.taxRules.isReverseCharge, true);
  assert.strictEqual(result.taxRules.taxCategory, 'E');
  assert.strictEqual(result.transaction.taxAmount, 0.00);
  assert.strictEqual(result.transaction.totalAmount, 500.00);
  assert(result.taxRules.taxExemptionReason.includes('Reverse Charge'));
});

// -----------------------------------------------------------------------------
// Test 5: الدينار الكويتي بثلاث خانات عشرية وتحويل SAMA للريال
// -----------------------------------------------------------------------------
runTest('5. احتساب الدينار الكويتي بدقة 3 خانات ومكافئ SAMA الرسمي (12.215 SAR)', () => {
  const result = gccTaxEngine.calculateGccTransaction({
    amount: 10.500, // 10 دنانير و 500 فلس
    currency: 'KWD',
    supplierCountry: 'SA',
    customerCountry: 'KW'
  });

  // مبيعات B2C من متجر سعودي تخضع لـ 15% ضريبة بلد التوريد
  assert.strictEqual(result.transaction.decimals, 3);
  assert.strictEqual(result.transaction.scale, 1000);
  assert.strictEqual(result.transaction.subtotal, 10.5);
  // 10.500 * 0.15 = 1.575 KWD
  assert.strictEqual(result.transaction.taxAmount, 1.575);
  assert.strictEqual(result.transaction.totalAmount, 12.075);
  assert.strictEqual(result.transaction.totalMinor, 12075);

  // مكافئ SAMA للريال السعودي:
  // 12.075 KWD * 12.215 = 147.496125 -> 147.50 SAR
  assert.strictEqual(result.samaFx.exchangeRate, 12.215);
  assert.strictEqual(result.samaFx.sarTotalAmount, 147.50);
  assert.strictEqual(result.samaFx.sarTotalHalalas, 14750);
});

// -----------------------------------------------------------------------------
// Test 6: مطابقة UBL XML للمادة 53 من لائحة الزكاة والضريبة والجمارك (ZATCA Article 53)
// -----------------------------------------------------------------------------
runTest('6. إنشاء فاتورة ZATCA UBL XML متعددة العملات مع cac:TaxExchangeRate ومكافئ SAR', () => {
  const invoice = {
    id: 'INV-GCC-001',
    uuid: '11111111-2222-3333-4444-555555555555',
    currency: 'AED',
    subtotal: 100.00,
    taxAmount: 15.00,
    totalAmount: 115.00,
    samaFx: {
      exchangeRate: 1.021000,
      sarTaxAmount: 15.32,
      sarTotalAmount: 117.42
    },
    items: [
      { name: 'استشارة فنية متقدمة', price: 100.00, quantity: 1 }
    ]
  };

  const tenantConfig = {
    businessName: 'منصة مكّن الاستشارية',
    vatNumber: '310987654300003',
    crNumber: '1010998877'
  };

  const xml = zatcaEngine.buildUblInvoiceXml(invoice, tenantConfig, 42, 'PIH_TEST_HASH');

  // التحقق من متطلبات المادة 53 الصارمة:
  assert(xml.includes('<cbc:DocumentCurrencyCode>AED</cbc:DocumentCurrencyCode>'), 'XML must contain DocumentCurrencyCode = AED');
  assert(xml.includes('<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>'), 'XML must contain TaxCurrencyCode = SAR');
  assert(xml.includes('<cac:TaxExchangeRate>'), 'XML must contain cac:TaxExchangeRate');
  assert(xml.includes('<cbc:SourceCurrencyCode>AED</cbc:SourceCurrencyCode>'), 'Exchange rate source currency must be AED');
  assert(xml.includes('<cbc:TargetCurrencyCode>SAR</cbc:TargetCurrencyCode>'), 'Exchange rate target currency must be SAR');
  assert(xml.includes('<cbc:CalculationRate>1.021000</cbc:CalculationRate>'), 'CalculationRate must be 1.021000');
  assert(xml.includes('<cbc:TaxAmount currencyID="SAR">15.32</cbc:TaxAmount>'), 'TaxAmount must be in SAR currency equivalent');
});

// -----------------------------------------------------------------------------
// Test 7: تكامل مع API نقطة الدخول (api/v1/checkout create-session مع عملات خليجية)
// -----------------------------------------------------------------------------
async function runAsyncApiTest() {
  totalTests++;
  const mockReq = {
    method: 'POST',
    url: '/api/v1/checkout?action=create-session',
    headers: { 'content-type': 'application/json' },
    query: { action: 'create-session' },
    body: {
      tenantSlug: 'demo_store',
      customerName: 'فهد المطيري',
      customerPhone: '+96598765432', // رقم كويتي صالح
      customerCountry: 'KW',
      currency: 'KWD',
      items: [
        { serviceId: 'srv_kwd_1', serviceTitle: 'اشتراك شهري مميز', unitPrice: 20.000, quantity: 2 }
      ],
      shippingCost: 2.500
    }
  };

  let statusCode = null;
  let jsonResponse = null;

  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
    setHeader() {}
  };

  await checkoutHandler(mockReq, mockRes);

  assert.strictEqual(statusCode, 200, 'Checkout API must return HTTP 200');
  assert.strictEqual(jsonResponse.success, true, 'Checkout must succeed');
  assert.strictEqual(jsonResponse.currency, 'KWD', 'Response currency must be KWD');
  assert.strictEqual(jsonResponse.decimals, 3, 'Decimals for KWD must be 3');
  assert.strictEqual(jsonResponse.subtotal, 40.000, 'Subtotal must be 40 KWD');
  assert.strictEqual(jsonResponse.shippingCost, 2.500, 'Shipping must be 2.5 KWD');
  // 42.500 * 0.15 = 6.375 KWD
  assert.strictEqual(jsonResponse.taxAmount, 6.375, 'Tax amount must be 6.375 KWD');
  // Total = 48.875 KWD
  assert.strictEqual(jsonResponse.totalAmount, 48.875, 'Total must be 48.875 KWD');
  assert.strictEqual(jsonResponse.totalMinor, 48875, 'Total minor must be 48875 fils');

  // التحقق من المكافئ بالريال السعودي SAMA
  // 48.875 * 12.215 = 597.008125 -> 597.01 SAR -> 59701 هللة
  assert.strictEqual(jsonResponse.samaFx.exchangeRate, 12.215);
  assert.strictEqual(jsonResponse.samaFx.sarTotalAmount, 597.01);
  assert.strictEqual(jsonResponse.totalHalalas, 59701);

  console.log(`✅ [PASS] 7. تكامل Checkout API مع العملات الخليجية (KWD & SAMA SAR Conversion)`);
  passedTests++;
}

runAsyncApiTest().then(() => {
  console.log('\n================================================================');
  console.log(`🎉 جميع اختبارات محرك الضرائب والعملات الخليجية اجتازت بنجاح: ${passedTests}/${totalTests}`);
  console.log('================================================================');
}).catch((err) => {
  console.error('\n❌ فشل أحد الاختبارات:', err);
  process.exit(1);
});
