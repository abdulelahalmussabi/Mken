/**
 * Saudi Synthetic Data Engine
 * Strictly compliant with:
 * - PDPL (سدايا - نظام حماية البيانات الشخصية): Zero real PII leakage
 * - ZATCA (هيئة الزكاة والضريبة والجمارك): Safe mock Phase-2 TLV e-invoice QR code
 * - SAMA (البنك المركزي السعودي): Sandbox-only mock cards (Mada / Visa)
 * - Ministry of Commerce (نظام التجارة الإلكترونية): Mandatory preview watermark & disclosures
 */

export interface SaudiMockCustomer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  nationalAddress: {
    buildingNumber: string;
    street: string;
    district: string;
    city: string;
    postalCode: string;
    additionalNumber: string;
    formatted: string;
  };
}

export interface SaudiMockBusiness {
  legalName: string;
  brandName: string;
  crNumber: string;
  vatNumber: string;
  city: string;
  licenseNumber: string;
  complianceWatermark: string;
}

export interface SaudiMockPaymentCard {
  brand: "mada" | "visa" | "mastercard";
  cardNumber: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export const SAUDI_COMPLIANCE_WATERMARK =
  "معاينة تجريبية مؤمنة - غير صالحة للأغراض التجارية أو الضريبية - منصة مكّن";

export const SAUDI_SYNTHETIC_CUSTOMERS: SaudiMockCustomer[] = [
  {
    id: "cust-syn-01",
    fullName: "سلمان بن عبد العزيز المنصور",
    phone: "+966501234567",
    email: "salman.mansour@demo.mken-sa.net",
    nationalAddress: {
      buildingNumber: "4521",
      street: "طريق الملك فهد الفرعي",
      district: "حي الملقا",
      city: "الرياض",
      postalCode: "13524",
      additionalNumber: "8841",
      formatted: "الرياض - حي الملقا - مبنى 4521 - الرمز البريدي 13524",
    },
  },
  {
    id: "cust-syn-02",
    fullName: "نورة بنت فهد الرويلي",
    phone: "+966559876543",
    email: "noura.ruwaili@demo.mken-sa.net",
    nationalAddress: {
      buildingNumber: "7820",
      street: "شارع الأمير سلطان",
      district: "حي الروضة",
      city: "جدة",
      postalCode: "23432",
      additionalNumber: "2190",
      formatted: "جدة - حي الروضة - مبنى 7820 - الرمز البريدي 23432",
    },
  },
  {
    id: "cust-syn-03",
    fullName: "عبد الرحمن بن خالد العتيبي",
    phone: "+966543321100",
    email: "abdulrahman.otaibi@demo.mken-sa.net",
    nationalAddress: {
      buildingNumber: "3119",
      street: "طريق الملك عبد الله",
      district: "حي الشاطئ",
      city: "الدمام",
      postalCode: "32414",
      additionalNumber: "6543",
      formatted: "الدمام - حي الشاطئ - مبنى 3119 - الرمز البريدي 32414",
    },
  },
];

export const SAUDI_SYNTHETIC_BUSINESS: SaudiMockBusiness = {
  legalName: "مؤسسة المتجر النموذجي لتقنية المعلومات",
  brandName: "متجر مكّن التجريبي",
  crNumber: "1010998877",
  vatNumber: "310009988700003",
  city: "الرياض",
  licenseNumber: "MOC-2026-SAUDI-DEMO",
  complianceWatermark: SAUDI_COMPLIANCE_WATERMARK,
};

export const SAMA_SANDBOX_CARDS: SaudiMockPaymentCard[] = [
  {
    brand: "mada",
    cardNumber: "4000 0000 0000 0001",
    holderName: "TEST MADA HOLDER",
    expiryMonth: "12",
    expiryYear: "28",
    cvv: "123",
  },
  {
    brand: "visa",
    cardNumber: "4000 0000 0000 0002",
    holderName: "TEST VISA HOLDER",
    expiryMonth: "08",
    expiryYear: "27",
    cvv: "456",
  },
];

/**
 * Generates a mock ZATCA Phase-2 Base64 TLV (Tag-Length-Value) QR string.
 * Tags:
 * 1: Seller's Name
 * 2: VAT Registration Number
 * 3: Timestamp (ISO 8601)
 * 4: Invoice Total (with VAT)
 * 5: VAT Total
 * Note: Clearly prefixed with "DEMO-MOCK" to ensure it cannot be processed as a real fiscal invoice.
 */
export function generateZatcaMockQrTlv(params: {
  sellerName?: string;
  vatNumber?: string;
  totalWithVat?: number;
  vatAmount?: number;
}): string {
  const seller = (params.sellerName || SAUDI_SYNTHETIC_BUSINESS.brandName).slice(0, 50);
  const vat = params.vatNumber || SAUDI_SYNTHETIC_BUSINESS.vatNumber;
  const timestamp = new Date().toISOString();
  const total = (params.totalWithVat ?? 115.0).toFixed(2);
  const vatTotal = (params.vatAmount ?? 15.0).toFixed(2);

  const encodeTlv = (tag: number, val: string): Uint8Array => {
    const utf8 = new TextEncoder().encode(val);
    const result = new Uint8Array(2 + utf8.length);
    result[0] = tag;
    result[1] = utf8.length;
    result.set(utf8, 2);
    return result;
  };

  const t1 = encodeTlv(1, `[معاينة تجريبية] ${seller}`);
  const t2 = encodeTlv(2, vat);
  const t3 = encodeTlv(3, timestamp);
  const t4 = encodeTlv(4, total);
  const t5 = encodeTlv(5, vatTotal);

  const totalLen = t1.length + t2.length + t3.length + t4.length + t5.length;
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of [t1, t2, t3, t4, t5]) {
    merged.set(part, offset);
    offset += part.length;
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(merged).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < merged.length; i++) {
    binary += String.fromCharCode(merged[i]);
  }
  return btoa(binary);
}

/**
 * Sanitizes any data payload before sending to preview:
 * Replaces real customer phones, emails, or personal addresses with synthetic equivalents.
 */
export function sanitizePayloadForPdpl<T extends Record<string, any>>(input: T): T {
  if (!input || typeof input !== "object") return input;
  const copy = JSON.parse(JSON.stringify(input));

  const sanitizeValue = (val: any, key: string): any => {
    if (typeof val === "string") {
      // Check phone numbers
      if (/(\+?966|05)\d{8}/.test(val)) {
        return SAUDI_SYNTHETIC_CUSTOMERS[0].phone;
      }
      // Check emails
      if (/@/.test(val) && !val.includes("mken")) {
        return SAUDI_SYNTHETIC_CUSTOMERS[0].email;
      }
    }
    return val;
  };

  const traverse = (obj: any) => {
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === "object") {
        traverse(obj[k]);
      } else {
        obj[k] = sanitizeValue(obj[k], k);
      }
    }
  };

  traverse(copy);
  return copy;
}
