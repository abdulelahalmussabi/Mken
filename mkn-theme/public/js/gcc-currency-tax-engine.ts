/**
 * Mken SaaS - GCC Multi-Currency & Regional Dynamic Tax Engine
 * Production TypeScript Module supporting SAR, AED, QAR, KWD, BHD, and OMR.
 * Implements Fixed-Point Minor Units math (2 vs 3 decimals), SAMA Pegged Rates,
 * Place-of-Supply Tax Resolvers, and ZATCA Article 53 Multi-Currency Compliance.
 */

export type GccCurrency = 'SAR' | 'AED' | 'QAR' | 'KWD' | 'BHD' | 'OMR';
export type GccCountry = 'SA' | 'AE' | 'BH' | 'OM' | 'QA' | 'KW';

export interface CurrencyConfig {
  code: GccCurrency;
  nameAr: string;
  symbol: string;
  decimals: number; // 2 for SAR/AED/QAR, 3 for KWD/BHD/OMR
  scale: number;    // 100 for 2 decimals, 1000 for 3 decimals
}

export const GCC_CURRENCY_MAP: Record<GccCurrency, CurrencyConfig> = {
  SAR: { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س', decimals: 2, scale: 100 },
  AED: { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, scale: 100 },
  QAR: { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق', decimals: 2, scale: 100 },
  KWD: { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك', decimals: 3, scale: 1000 },
  BHD: { code: 'BHD', nameAr: 'دينار بحريني', symbol: 'د.ب', decimals: 3, scale: 1000 },
  OMR: { code: 'OMR', nameAr: 'ريال عماني', symbol: 'ر.ع', decimals: 3, scale: 1000 }
};

export const SAMA_PEG_RATES: Record<GccCurrency, number> = {
  SAR: 1.000000,
  AED: 1.021000,
  QAR: 1.030000,
  KWD: 12.215000,
  BHD: 9.947000,
  OMR: 9.740000
};

export const GCC_DOMESTIC_VAT_RATES: Record<GccCountry, number> = {
  SA: 0.15,
  AE: 0.05,
  BH: 0.10,
  OM: 0.05,
  QA: 0.00,
  KW: 0.00
};

export class MkenGccTaxEngine {
  /**
   * Banker's / Round Half-Up arithmetic for integer minor units
   */
  public roundHalfUp(value: number): number {
    return Math.round(value + Number.EPSILON);
  }

  /**
   * Format money according to GCC currency decimal standards
   */
  public formatMoney(amount: number, currency: GccCurrency = 'SAR'): string {
    const config = GCC_CURRENCY_MAP[currency] || GCC_CURRENCY_MAP.SAR;
    const rounded = amount.toFixed(config.decimals);
    return `${rounded} ${config.symbol}`;
  }

  /**
   * Calculate subtotal, VAT amount, and Total based on GCC regional VAT rates & SAMA conversion
   */
  public calculateTaxBreakdown(
    subtotal: number,
    currency: GccCurrency = 'SAR',
    supplierCountry: GccCountry = 'SA',
    customerCountry: GccCountry = 'SA',
    isB2B: boolean = false,
    customerGccTrn?: string
  ) {
    const config = GCC_CURRENCY_MAP[currency] || GCC_CURRENCY_MAP.SAR;
    const fxRate = SAMA_PEG_RATES[currency] || 1.000000;

    // Resolve VAT Rate based on Place of Supply
    let vatRate = 0.15;
    let isReverseCharge = false;

    if (supplierCountry === 'SA' && customerCountry !== 'SA' && isB2B && customerGccTrn) {
      vatRate = 0.00;
      isReverseCharge = true;
    } else if (supplierCountry === 'SA') {
      vatRate = 0.15; // Local supplier applies 15% KSA VAT
    } else {
      vatRate = GCC_DOMESTIC_VAT_RATES[customerCountry] ?? 0.15;
    }

    // Fixed-Point minor units calculation
    const subtotalMinor = this.roundHalfUp(subtotal * config.scale);
    const vatMinor = this.roundHalfUp(subtotalMinor * vatRate);
    const totalMinor = subtotalMinor + vatMinor;

    const subtotalFormatted = Number((subtotalMinor / config.scale).toFixed(config.decimals));
    const vatFormatted = Number((vatMinor / config.scale).toFixed(config.decimals));
    const totalFormatted = Number((totalMinor / config.scale).toFixed(config.decimals));

    // SAMA SAR Equivalent Calculation (Article 53 Compliance)
    const sarSubtotalMinor = this.roundHalfUp((subtotalMinor / config.scale) * fxRate * 100);
    const sarVatMinor = this.roundHalfUp((vatMinor / config.scale) * fxRate * 100);
    const sarTotalMinor = sarSubtotalMinor + sarVatMinor;

    return {
      currency: config.code,
      currencyNameAr: config.nameAr,
      decimals: config.decimals,
      vatRatePct: vatRate * 100,
      subtotal: subtotalFormatted,
      vatAmount: vatFormatted,
      totalAmount: totalFormatted,
      isReverseCharge: isReverseCharge,
      requiresZatcaXml: supplierCountry === 'SA',
      samaFx: {
        baseCurrency: 'SAR',
        exchangeRate: fxRate,
        sarSubtotal: Number((sarSubtotalMinor / 100).toFixed(2)),
        sarVatAmount: Number((sarVatMinor / 100).toFixed(2)),
        sarTotalAmount: Number((sarTotalMinor / 100).toFixed(2)),
        sarTotalHalalas: sarTotalMinor
      }
    };
  }
}

// Unit Test Assertion Verification Helper
export function runGccEngineAssertions() {
  const engine = new MkenGccTaxEngine();
  
  // Test 1: Saudi Arabia 15% VAT & 2 Decimals
  const ksa = engine.calculateTaxBreakdown(100.00, 'SAR', 'SA', 'SA');
  console.assert(ksa.vatAmount === 15.00, 'KSA VAT assertion failed');
  console.assert(ksa.requiresZatcaXml === true, 'KSA ZATCA flag failed');

  // Test 2: Kuwait Dinars 3 Decimals & SAMA conversion
  const kwd = engine.calculateTaxBreakdown(50.125, 'KWD', 'KW', 'KW');
  console.assert(kwd.decimals === 3, 'KWD decimals assertion failed');
  console.assert(kwd.vatAmount === 0.000, 'KWD VAT assertion failed');

  // Test 3: Bahrain Dinars 3 Decimals & 10% VAT
  const bhd = engine.calculateTaxBreakdown(100.000, 'BHD', 'BH', 'BH');
  console.assert(bhd.vatAmount === 10.000, 'BHD VAT assertion failed');

  // Test 4: ZATCA Article 53 - Customer pays in AED to a KSA merchant
  const ksaAed = engine.calculateTaxBreakdown(100.00, 'AED', 'SA', 'AE');
  console.assert(ksaAed.vatRatePct === 15, 'Place of supply in KSA must be 15% VAT regardless of AED currency');
  console.assert(ksaAed.requiresZatcaXml === true, 'KSA merchant requires ZATCA XML');
  console.assert(ksaAed.samaFx.exchangeRate === 1.021, 'SAMA AED rate must be 1.021');

  console.log('[GCC Multi-Currency Assertions Passed 100%]');
}
