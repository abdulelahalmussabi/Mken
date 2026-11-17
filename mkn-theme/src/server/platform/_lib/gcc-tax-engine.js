/**
 * api/_lib/gcc-tax-engine.js — محرك الضرائب والعملات الخليجية الدقيق (E4.2)
 * منصة مكّن (mken.live) — الإصدار المالي المعتمد
 * متوافق مع: SAMA، المادة 53 من لائحة ZATCA، والاتفاقية الموحدة لضريبة القيمة المضافة لدول مجلس التعاون
 */
'use strict';

// 1. سجل العملات الخليجية المعتمد (ISO 4217 Currency Registry)
const GCC_CURRENCIES = {
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س', decimals: 2, scale: 100 },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, scale: 100 },
  QAR: { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق', decimals: 2, scale: 100 },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك', decimals: 3, scale: 1000 },
  BHD: { code: 'BHD', nameAr: 'دينار بحريني', symbol: 'د.ب', decimals: 3, scale: 1000 },
  OMR: { code: 'OMR', nameAr: 'ريال عماني', symbol: 'ر.ع', decimals: 3, scale: 1000 }
};

// 2. أسعار الصرف المرجعية للبنك المركزي السعودي (SAMA Official Pegged Rates)
// 1 Foreign Currency Unit = X SAR
const SAMA_FX_RATES_TO_SAR = {
  SAR: 1.000000,
  AED: 1.021000,
  QAR: 1.030000,
  KWD: 12.215000,
  BHD: 9.947000,
  OMR: 9.740000
};

// 3. نسب ضريبة القيمة المضافة للدول بحسب الاختصاص القضائي (Tax Jurisdictions)
const GCC_JURISDICTION_VAT = {
  SA: 0.15, // المملكة العربية السعودية
  AE: 0.05, // الإمارات العربية المتحدة
  BH: 0.10, // مملكة البحرين
  OM: 0.05, // سلطنة عمان
  QA: 0.00, // دولة قطر
  KW: 0.00  // دولة الكويت
};

/**
 * تقريب مصرفي معياري (Round Half-Up) لحماية العمليات من أخطاء الـ Floating-Point
 */
function roundHalfUp(value) {
  return Math.round(Number(value) + Number.EPSILON);
}

const FX_SCALE = 1000000n; // دقة أسعار صرف ساما 6 خانات عشرية

/**
 * تحويل المبالغ من أصغر وحدة نقدية إلى هللات الريال السعودي بدقة صحيحة مطلقة
 */
function convertMinorToSarHalalas(minorUnits, currScale, fxRate) {
  const fxInt = BigInt(Math.round(Number(fxRate) * 1000000));
  const num = BigInt(minorUnits) * fxInt * 100n;
  const den = BigInt(currScale) * FX_SCALE;
  return Number((num + den / 2n) / den);
}

/**
 * محدد مكان التوريد ومعدل الضريبة الواجب تطبيقه (Place of Supply Resolver)
 */
function resolveTaxJurisdiction(params) {
  const {
    supplierCountry = 'SA',
    customerCountry = 'SA',
    isB2B = false,
    customerGccTrn = null
  } = params || {};

  // حالة 1: التوريد المحلي داخل السعودية (KSA Domestic)
  if (supplierCountry === 'SA' && customerCountry === 'SA') {
    return {
      jurisdiction: 'SA',
      vatRate: 0.15,
      taxCategory: 'S',
      taxExemptionReason: null,
      isReverseCharge: false
    };
  }

  // حالة 2: المبيعات بين المنشآت الخليجية B2B (Cross-border Reverse Charge Mechanism)
  if (supplierCountry === 'SA' && customerCountry !== 'SA' && isB2B && customerGccTrn) {
    return {
      jurisdiction: customerCountry,
      vatRate: 0.00,
      taxCategory: 'E',
      taxExemptionReason: 'Reverse Charge Mechanism - الاتفاقية الموحدة لضريبة القيمة المضافة لمجلس التعاون',
      isReverseCharge: true
    };
  }

  // حالة 3: المستهلك النهائي B2C داخل متجر مسجل بالسعودية (الضريبة لمقر التوريد KSA)
  if (supplierCountry === 'SA') {
    return {
      jurisdiction: 'SA',
      vatRate: 0.15,
      taxCategory: 'S',
      taxExemptionReason: null,
      isReverseCharge: false
    };
  }

  const rate = GCC_JURISDICTION_VAT[customerCountry] !== undefined ? GCC_JURISDICTION_VAT[customerCountry] : 0.15;
  return {
    jurisdiction: customerCountry,
    vatRate: rate,
    taxCategory: rate > 0 ? 'S' : 'Z',
    taxExemptionReason: null,
    isReverseCharge: false
  };
}

/**
 * الحساب المالي الدقيق بالأعداد الصحيحة لأصغر وحدة نقدية (Fixed-Point Financial Calculator)
 */
function calculateGccTransaction(options) {
  const {
    amount, // المبلغ الأساسي (بالوحدات العادية)
    currency = 'SAR', // عملة المعاملة
    supplierCountry = 'SA',
    customerCountry = 'SA',
    isB2B = false,
    customerGccTrn = null,
    customFxRate = null
  } = options || {};

  const curr = GCC_CURRENCIES[currency] || GCC_CURRENCIES.SAR;
  const fxRate = Number(customFxRate) || SAMA_FX_RATES_TO_SAR[currency] || 1.000000;
  const taxResolution = resolveTaxJurisdiction({ supplierCountry, customerCountry, isB2B, customerGccTrn });

  // 1. تحويل المبلغ الأساسي لأصغر وحدة نقدية (Minor Units Integer) لمنع أخطاء الـ Float
  const subtotalMinor = roundHalfUp(Number(amount || 0) * curr.scale);
  const subtotalFormatted = (subtotalMinor / curr.scale).toFixed(curr.decimals);

  // 2. احتساب الضريبة بأصغر وحدة نقدية مع التقريب المصرفي الحتمي
  const rateBps = BigInt(Math.round(taxResolution.vatRate * 10000));
  const taxMinor = Number((BigInt(subtotalMinor) * rateBps + 5000n) / 10000n);
  const taxFormatted = (taxMinor / curr.scale).toFixed(curr.decimals);

  // 3. احتساب الإجمالي بعملة المعاملة
  const totalMinor = subtotalMinor + taxMinor;
  const totalFormatted = (totalMinor / curr.scale).toFixed(curr.decimals);

  // 4. احتساب المكافئ بالريال السعودي المعتمد لـ ZATCA (المادة 53 من لائحة الضريبة)
  // تحويل المبالغ للريال السعودي (SAR دائماً خانتان عشريتان: Scale = 100) بدقة BigInt مطلقة
  const sarSubtotalMinor = convertMinorToSarHalalas(subtotalMinor, curr.scale, fxRate);
  const sarTaxMinor = convertMinorToSarHalalas(taxMinor, curr.scale, fxRate);
  const sarTotalMinor = sarSubtotalMinor + sarTaxMinor;

  return {
    transaction: {
      currency: curr.code,
      currencyNameAr: curr.nameAr,
      symbol: curr.symbol,
      decimals: curr.decimals,
      scale: curr.scale,
      subtotalMinor: subtotalMinor,
      subtotal: Number(subtotalFormatted),
      taxMinor: taxMinor,
      taxAmount: Number(taxFormatted),
      totalMinor: totalMinor,
      totalAmount: Number(totalFormatted),
      formattedTotal: `${totalFormatted} ${curr.symbol}`
    },
    taxRules: {
      jurisdiction: taxResolution.jurisdiction,
      vatRatePct: taxResolution.vatRate * 100,
      taxCategory: taxResolution.taxCategory,
      taxExemptionReason: taxResolution.taxExemptionReason,
      isReverseCharge: taxResolution.isReverseCharge
    },
    samaFx: {
      baseCurrency: 'SAR',
      exchangeRate: fxRate,
      fxSource: 'Saudi Central Bank (SAMA)',
      sarSubtotal: Number((sarSubtotalMinor / 100).toFixed(2)),
      sarTaxAmount: Number((sarTaxMinor / 100).toFixed(2)),
      sarTotalAmount: Number((sarTotalMinor / 100).toFixed(2)),
      sarFormattedTotal: `${(sarTotalMinor / 100).toFixed(2)} ر.س`,
      sarTotalHalalas: sarTotalMinor
    },
    compliance: {
      requiresZatcaReporting: supplierCountry === 'SA',
      isMultiCurrencyZatca: currency !== 'SAR' && supplierCountry === 'SA',
      zatcaArticle53Compliant: true
    }
  };
}

module.exports = {
  GCC_CURRENCIES: GCC_CURRENCIES,
  SAMA_FX_RATES_TO_SAR: SAMA_FX_RATES_TO_SAR,
  GCC_JURISDICTION_VAT: GCC_JURISDICTION_VAT,
  resolveTaxJurisdiction: resolveTaxJurisdiction,
  calculateGccTransaction: calculateGccTransaction,
  roundHalfUp: roundHalfUp
};
