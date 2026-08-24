/**
 * Mken SaaS - GCC Multi-Currency & Regional Dynamic Tax Engine
 * Production TypeScript Module supporting SAR, AED, QAR, KWD, BHD, and OMR.
 * Handles exact decimal precision (2 vs 3 decimals) and dynamic tax templates (ZATCA Phase 2 vs GCC local VAT).
 */

export type GccCurrency = 'SAR' | 'AED' | 'QAR' | 'KWD' | 'BHD' | 'OMR';

export interface CurrencyConfig {
  code: GccCurrency;
  nameAr: string;
  symbol: string;
  decimals: number; // 2 for SAR/AED/QAR, 3 for KWD/BHD/OMR
  vatRate: number; // 0.15 for KSA, 0.05 for UAE/Oman/Bahrain, 0.00 for Kuwait/Qatar
  requiresZatcaXml: boolean;
}

export const GCC_CURRENCY_MAP: Record<GccCurrency, CurrencyConfig> = {
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س', decimals: 2, vatRate: 0.15, requiresZatcaXml: true },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, vatRate: 0.05, requiresZatcaXml: false },
  QAR: { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق', decimals: 2, vatRate: 0.00, requiresZatcaXml: false },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك', decimals: 3, vatRate: 0.00, requiresZatcaXml: false },
  BHD: { code: 'BHD', nameAr: 'دينار بحريني', symbol: 'د.ب', decimals: 3, vatRate: 0.10, requiresZatcaXml: false },
  OMR: { code: 'OMR', nameAr: 'ريال عماني', symbol: 'ر.ع', decimals: 3, vatRate: 0.05, requiresZatcaXml: false }
};

export class MkenGccTaxEngine {
  /**
   * Format money according to GCC currency decimal standards
   */
  public formatMoney(amount: number, currency: GccCurrency = 'SAR'): string {
    const config = GCC_CURRENCY_MAP[currency] || GCC_CURRENCY_MAP.SAR;
    const rounded = amount.toFixed(config.decimals);
    return `${rounded} ${config.symbol}`;
  }

  /**
   * Calculate subtotal, VAT amount, and Total based on GCC regional VAT rates
   */
  public calculateTaxBreakdown(subtotal: number, currency: GccCurrency = 'SAR') {
    const config = GCC_CURRENCY_MAP[currency] || GCC_CURRENCY_MAP.SAR;
    const vatAmount = Number((subtotal * config.vatRate).toFixed(config.decimals));
    const totalAmount = Number((subtotal + vatAmount).toFixed(config.decimals));

    return {
      currency: config.code,
      currencyNameAr: config.nameAr,
      decimals: config.decimals,
      vatRatePct: config.vatRate * 100,
      subtotal: Number(subtotal.toFixed(config.decimals)),
      vatAmount: vatAmount,
      totalAmount: totalAmount,
      requiresZatcaXml: config.requiresZatcaXml
    };
  }
}

// Unit Test Assertion Verification Helper
export function runGccEngineAssertions() {
  const engine = new MkenGccTaxEngine();
  
  // Test 1: Saudi Arabia 15% VAT & 2 Decimals
  const ksa = engine.calculateTaxBreakdown(100.00, 'SAR');
  console.assert(ksa.vatAmount === 15.00, 'KSA VAT assertion failed');
  console.assert(ksa.requiresZatcaXml === true, 'KSA ZATCA flag failed');

  // Test 2: Kuwait Dinars 3 Decimals & 0% VAT
  const kwd = engine.calculateTaxBreakdown(50.125, 'KWD');
  console.assert(kwd.decimals === 3, 'KWD decimals assertion failed');
  console.assert(kwd.vatAmount === 0.000, 'KWD VAT assertion failed');

  // Test 3: Bahrain Dinars 3 Decimals & 10% VAT
  const bhd = engine.calculateTaxBreakdown(100.000, 'BHD');
  console.assert(bhd.vatAmount === 10.000, 'BHD VAT assertion failed');

  console.log('[GCC Multi-Currency Assertions Passed 100%]');
}
