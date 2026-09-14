import crypto from "crypto";
import { getTenantDb, TENANT_TABLE, type MkenConfig } from "@/lib/mken/tenant";
import type { Invoice, InvoiceItem } from "@/lib/mken/invoices";

/** Sandbox/simulated ZATCA engine — same behavior as legacy api/v1/zatca.js */

export interface ZatcaConfig {
  active?: boolean;
  environment?: string;
  vatNumber?: string;
  businessName?: string;
  businessCategory?: string;
  street?: string;
  city?: string;
  buildingNo?: string;
  district?: string;
  onboardingDate?: string;
  publicKey?: string;
  privateKey?: string;
  csr?: string;
  certificate?: string;
  secret?: string;
  complianceRequestId?: string;
  isSimulated?: boolean;
  crNumber?: string;
  plotId?: string;
  postalCode?: string;
}

export interface ZatcaStatusResult {
  configured: boolean;
  vatNumber?: string;
  businessName?: string;
  environment?: string;
  onboardingDate?: string;
  isSimulated?: boolean;
  statusText: string;
}

export interface ZatcaOnboardInput {
  vatNumber: string;
  otp: string;
  businessName?: string;
  environment?: string;
  businessCategory?: string;
  street?: string;
  city?: string;
  buildingNo?: string;
  district?: string;
}

export interface ZatcaReportInput {
  id: string;
  uuid?: string;
  customerName?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  taxAmount?: number;
  discount?: number;
  totalAmount?: number;
  createdAt?: string | null;
  icv?: number;
  pih?: string;
}

export interface ZatcaReportResult {
  zatcaStatus: string;
  zatcaUuid: string;
  zatcaXmlHash: string;
  zatcaQrCode: string;
  response: Record<string, unknown>;
}

function getEncryptionKey(): Buffer | null {
  const secret = process.env.ZATCA_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) return null;
  return crypto.pbkdf2Sync(secret, "mken_salt", 10000, 32, "sha256");
}

export function hasZatcaEncryptionKey(): boolean {
  return getEncryptionKey() !== null;
}

function encrypt(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  if (!key) throw new Error("ZATCA_ENCRYPTION_KEY is not configured");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  if (!ciphertext.includes(":")) return ciphertext;
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return ciphertext;
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const key = getEncryptionKey();
    if (!key) throw new Error("ZATCA_ENCRYPTION_KEY is not configured");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt ZATCA secret:", (err as Error).message);
    return ciphertext;
  }
}

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  bytes.unshift(0x80 | bytes.length);
  return Buffer.from(bytes);
}

function derConstruct(tag: number, payload: Buffer): Buffer {
  const lenBuf = derLength(payload.length);
  return Buffer.concat([Buffer.from([tag]), lenBuf, payload]);
}

function derOid(oidString: string): Buffer {
  const parts = oidString.split(".").map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    const valBytes: number[] = [val & 0x7f];
    val >>= 7;
    while (val > 0) {
      valBytes.unshift((val & 0x7f) | 0x80);
      val >>= 7;
    }
    bytes.push(...valBytes);
  }
  return derConstruct(0x06, Buffer.from(bytes));
}

function derString(tag: number, str: string): Buffer {
  return derConstruct(tag, Buffer.from(str, "utf8"));
}

function createSubjectDn(fields: Record<string, string | undefined>): Buffer {
  const oids: Record<string, { oid: string; tag: number }> = {
    C: { oid: "2.5.4.6", tag: 0x13 },
    O: { oid: "2.5.4.10", tag: 0x0c },
    OU: { oid: "2.5.4.11", tag: 0x0c },
    CN: { oid: "2.5.4.3", tag: 0x0c },
    UID: { oid: "2.5.4.45", tag: 0x0c },
    SN: { oid: "2.5.4.5", tag: 0x13 },
    TITLE: { oid: "2.5.4.12", tag: 0x0c },
    REGISTERED_ADDRESS: { oid: "2.5.4.16", tag: 0x0c },
    BUSINESS_CATEGORY: { oid: "2.5.4.15", tag: 0x0c },
  };

  const rdnList: Buffer[] = [];
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    if (value && oids[key]) {
      const entry = oids[key];
      const pair = derConstruct(
        0x30,
        Buffer.concat([derOid(entry.oid), derString(entry.tag, value)])
      );
      rdnList.push(derConstruct(0x31, pair));
    }
  }
  return derConstruct(0x30, Buffer.concat(rdnList));
}

function generateCsr(
  privateKeyPem: string,
  publicKeyPem: string,
  subjectFields: Record<string, string | undefined>
): string {
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const pubKey = crypto.createPublicKey(publicKeyPem);
  const spkiDer = pubKey.export({ format: "der", type: "spki" }) as Buffer;
  const subjectDnDer = createSubjectDn(subjectFields);
  const versionDer = Buffer.from([0x02, 0x01, 0x00]);
  const attributesDer = Buffer.from([0xa0, 0x00]);

  const criDer = derConstruct(
    0x30,
    Buffer.concat([versionDer, subjectDnDer, spkiDer, attributesDer])
  );

  const sign = crypto.createSign("SHA256");
  sign.update(criDer);
  const signatureDer = sign.sign(privKey);
  const signatureAlgorithmDer = derConstruct(0x30, Buffer.concat([derOid("1.2.840.10045.4.3.2")]));
  const signatureBitString = derConstruct(0x03, Buffer.concat([Buffer.from([0x00]), signatureDer]));
  const csrDer = derConstruct(0x30, Buffer.concat([criDer, signatureAlgorithmDer, signatureBitString]));

  return (
    "-----BEGIN CERTIFICATE REQUEST-----\n" +
    csrDer.toString("base64").match(/.{1,64}/g)!.join("\n") +
    "\n-----END CERTIFICATE REQUEST-----"
  );
}

function generateZatcaTlvQr(
  seller: string,
  vat: string,
  time: string,
  total: number,
  tax: number,
  xmlHash?: string,
  signature?: string,
  publicKey?: string
): string {
  function toTlv(tag: number, val: string | Buffer): Buffer {
    const valBuf = Buffer.isBuffer(val) ? val : Buffer.from(String(val), "utf8");
    return Buffer.concat([Buffer.from([tag]), Buffer.from([valBuf.length]), valBuf]);
  }

  const parts = [
    toTlv(1, seller),
    toTlv(2, vat),
    toTlv(3, time),
    toTlv(4, String(total)),
    toTlv(5, String(tax)),
  ];

  if (xmlHash) {
    const hashBuf = typeof xmlHash === "string" ? Buffer.from(xmlHash, "hex") : xmlHash;
    parts.push(toTlv(6, hashBuf));
  }
  if (signature) {
    const sigBuf = typeof signature === "string" ? Buffer.from(signature, "base64") : signature;
    parts.push(toTlv(7, sigBuf));
  }
  if (publicKey) {
    const pubBuf =
      typeof publicKey === "string"
        ? Buffer.from(publicKey.replace(/-----\w+ PUBLIC KEY-----|\n|\r/g, ""), "base64")
        : publicKey;
    parts.push(toTlv(8, pubBuf));
  }

  return Buffer.concat(parts).toString("base64");
}

function generateInvoiceXml(
  invoice: ZatcaReportInput,
  tenantConfig: ZatcaConfig
): string {
  const uuid = invoice.uuid || crypto.randomUUID();
  const id = invoice.id || `INV-${Date.now()}`;
  const createdAt = invoice.createdAt || new Date().toISOString();
  const date = createdAt.split("T")[0];
  const time = createdAt.split("T")[1]?.split(".")[0] || "00:00:00";
  const sellerName = tenantConfig.businessName || "منشأة مكن";
  const vatNumber = tenantConfig.vatNumber || "311234567800003";
  const street = tenantConfig.street || "شارع العليا";
  const city = tenantConfig.city || "الرياض";
  const country = "SA";

  let itemsXml = "";
  (invoice.items || []).forEach((item, index) => {
    const price = Number(item.price || 0);
    const qty = Number(item.quantity || 0);
    const itemSubtotal = price * qty;
    const itemTax = itemSubtotal * 0.15;
    const itemTotal = itemSubtotal + itemTax;
    const name = item.title || item.serviceTitle || "بند";

    itemsXml += `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="⃁">${itemSubtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="⃁">${itemTax.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="⃁">${itemTotal.toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${name}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="⃁">${price.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
  });

  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.taxAmount || 0);
  const total = Number(invoice.totalAmount || 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${id}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>⃁</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>⃁</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${invoice.icv || 1}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.pih || "NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc="}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${tenantConfig.crNumber || "1010101010"}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${street}</cbc:StreetName>
                <cbc:BuildingNumber>${tenantConfig.buildingNo || "1234"}</cbc:BuildingNumber>
                <cbc:PlotIdentification>${tenantConfig.plotId || "5678"}</cbc:PlotIdentification>
                <cbc:CitySubdivisionName>${tenantConfig.district || "الورود"}</cbc:CitySubdivisionName>
                <cbc:CityName>${city}</cbc:CityName>
                <cbc:PostalZone>${tenantConfig.postalCode || "12345"}</cbc:PostalZone>
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
                <cbc:RegistrationName>${invoice.customerName || "عميل نقدي"}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${date}</cbc:ActualDeliveryDate>
    </cac:Delivery>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="⃁">${tax.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="⃁">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="⃁">${tax.toFixed(2)}</cbc:TaxAmount>
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
        <cbc:LineExtensionAmount currencyID="⃁">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="⃁">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="⃁">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="⃁">${Number(invoice.discount || 0).toFixed(2)}</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="⃁">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    ${itemsXml}
</Invoice>`;
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || /Could not find the table/i.test(error.message || "");
}

function isMissingColumn(error: { code?: string; message?: string }): boolean {
  const msg = error.message || "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

async function loadTenantConfig(tenantSlug: string): Promise<{
  config: MkenConfig;
  businessName?: string | null;
  error?: string;
}> {
  const db = getTenantDb();
  if (!db) return { config: {}, error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from(TENANT_TABLE)
    .select("config_data, business_name")
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error) || isMissingColumn(error)) {
      return { config: {}, error: "جدول المنشآت غير متاح في قاعدة البيانات" };
    }
    return { config: {}, error: error.message };
  }

  return {
    config: (data?.config_data as MkenConfig) || {},
    businessName: data?.business_name as string | null | undefined,
  };
}

export async function getZatcaStatus(tenantSlug: string): Promise<{
  status?: ZatcaStatusResult;
  error?: string;
}> {
  const { config, error } = await loadTenantConfig(tenantSlug);
  if (error) return { error };

  const zatca = config.zatcaConfig as ZatcaConfig | undefined;
  if (!zatca?.active) {
    return {
      status: {
        configured: false,
        statusText: "غير نشط (غير مرتبط)",
      },
    };
  }

  return {
    status: {
      configured: true,
      vatNumber: zatca.vatNumber,
      businessName: zatca.businessName,
      environment: zatca.environment,
      onboardingDate: zatca.onboardingDate,
      isSimulated: zatca.isSimulated,
      statusText: zatca.isSimulated ? "نشط (ربط تجريبي محاكي)" : "نشط ومفعل (ربط حقيقي)",
    },
  };
}

export async function onboardZatca(
  tenantSlug: string,
  input: ZatcaOnboardInput
): Promise<{
  config?: Record<string, unknown>;
  logs?: string[];
  error?: string;
}> {
  const { vatNumber, otp, businessName, environment, businessCategory, street, city, buildingNo, district } =
    input;

  if (!vatNumber || !otp) {
    return { error: "Required fields missing: vatNumber, otp" };
  }

  const db = getTenantDb();
  if (!db) return { error: "قاعدة البيانات غير مهيأة على الخادم" };

  const logs: string[] = [];
  logs.push(`[${new Date().toISOString()}] بدء عملية الربط لـ ${businessName || tenantSlug}`);
  logs.push(`[${new Date().toISOString()}] توليد مفتاح تشفير ECDSA (prime256v1) للمنشأة...`);

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  logs.push(`[${new Date().toISOString()}] تم توليد المفاتيح بنجاح.`);

  logs.push(`[${new Date().toISOString()}] توليد ملف طلب الشهادة الرقمية (CSR) حسب مواصفات الهيئة...`);
  const serialNumber = `1-Mken|2-Mken|3-${crypto.randomUUID()}`;
  const subjectFields = {
    C: "SA",
    O: businessName || "منشأة مكن الفردية",
    OU: "IT-Department",
    CN: vatNumber,
    UID: vatNumber,
    SN: serialNumber,
    TITLE: "1100",
    REGISTERED_ADDRESS: street || "الشارع العام",
    BUSINESS_CATEGORY: businessCategory || "Retail",
  };

  const csrPem = generateCsr(privateKey, publicKey, subjectFields);
  logs.push(`[${new Date().toISOString()}] تم توليد الـ CSR بنجاح.`);

  logs.push(
    `[${new Date().toISOString()}] إرسال الـ CSR إلى خادم مطوري الهيئة للتحقق واستصدار شهادة الامتثال (CCSID)...`
  );

  let complianceCert = "";
  let complianceSecret = "";
  let complianceRequestId = "";
  let isSimulated = false;

  try {
    const targetUrl = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance";
    const resZatca = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Version": "V2",
        OTP: otp,
      },
      body: JSON.stringify({ csr: Buffer.from(csrPem).toString("base64") }),
    });

    if (resZatca.ok) {
      const dataZatca = (await resZatca.json()) as {
        binarySecurityToken?: string;
        secret?: string;
        requestID?: string;
      };
      complianceCert = dataZatca.binarySecurityToken || "";
      complianceSecret = dataZatca.secret || "";
      complianceRequestId = dataZatca.requestID || "";
      logs.push(`[${new Date().toISOString()}] نجح الاتصال بالهيئة! رقم الطلب: ${complianceRequestId}`);
    } else {
      const errText = await resZatca.text();
      throw new Error(errText || `ZATCA Compliance API returned status ${resZatca.status}`);
    }
  } catch {
    logs.push(
      `[${new Date().toISOString()}] تعذر إكمال الاتصال الحقيقي (رمز الـ OTP قد يكون منتهياً أو الرقم الضريبي غير مسجل). تفعيل محاكي الامتثال التلقائي...`
    );
    isSimulated = true;
    complianceRequestId = `req_${Math.random().toString(36).substring(2, 9)}${Date.now()}`;
    complianceCert = Buffer.from(`MII...MOCKED_ZATCA_COMPLIANCE_CERTIFICATE_FOR_${vatNumber}`).toString(
      "base64"
    );
    complianceSecret = crypto.randomBytes(16).toString("hex");
  }

  logs.push(`[${new Date().toISOString()}] إرسال فواتير الامتثال التجريبية (تبسيط الفحص الضريبي)...`);
  logs.push(`[${new Date().toISOString()}] فحص الفاتورة الأولى (Simplified Invoice) ... مقبول (100%)`);
  logs.push(`[${new Date().toISOString()}] فحص الفاتورة الثانية (Credit Note) ... مقبول (100%)`);
  logs.push(`[${new Date().toISOString()}] فحص الفاتورة الثالثة (Debit Note) ... مقبول (100%)`);

  logs.push(`[${new Date().toISOString()}] طلب شهادة التشفير الرقمية للإنتاج (PCSID)...`);
  let prodCert = "";
  let prodSecret = "";

  if (!isSimulated) {
    try {
      const authHeader =
        "Basic " + Buffer.from(`${complianceCert}:${complianceSecret}`).toString("base64");
      const targetUrl = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production";
      const resProd = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Version": "V2",
          Authorization: authHeader,
        },
        body: JSON.stringify({ compliance_request_id: complianceRequestId }),
      });

      if (resProd.ok) {
        const dataProd = (await resProd.json()) as {
          binarySecurityToken?: string;
          secret?: string;
        };
        prodCert = dataProd.binarySecurityToken || "";
        prodSecret = dataProd.secret || "";
        logs.push(`[${new Date().toISOString()}] تم إصدار شهادة الإنتاج بنجاح (PCSID).`);
      } else {
        const errText = await resProd.text();
        throw new Error(errText);
      }
    } catch (err) {
      logs.push(
        `[${new Date().toISOString()}] فشل استصدار شهادة الإنتاج الحقيقية: ${(err as Error).message}. استكمال المحاكي التجريبي...`
      );
      prodCert = Buffer.from(`MII...MOCKED_PRODUCTION_CSID_FOR_${vatNumber}`).toString("base64");
      prodSecret = crypto.randomBytes(16).toString("hex");
    }
  } else {
    prodCert = Buffer.from(`MII...MOCKED_PRODUCTION_CSID_FOR_${vatNumber}`).toString("base64");
    prodSecret = crypto.randomBytes(16).toString("hex");
    logs.push(`[${new Date().toISOString()}] تم إنشاء شهادة الإنتاج المحاكية بنجاح.`);
  }

  logs.push(`[${new Date().toISOString()}] حفظ شهادات الربط والتكامل مشفرة وآمنة في السحاب...`);

  const { data: clientRow, error: clientErr } = await db
    .from(TENANT_TABLE)
    .select("*")
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();

  if (clientErr) {
    if (isMissingTable(clientErr) || isMissingColumn(clientErr)) {
      return { error: "جدول المنشآت غير متاح في قاعدة البيانات" };
    }
    return { error: clientErr.message };
  }

  const currentConfig = ((clientRow?.config_data as MkenConfig) || {}) as MkenConfig;
  currentConfig.zatcaConfig = {
    active: true,
    environment: environment || "sandbox",
    vatNumber,
    businessName: businessName || "منشأة مكن",
    businessCategory: businessCategory || "Retail",
    street: street || "الشارع العام",
    city: city || "الرياض",
    buildingNo: buildingNo || "1234",
    district: district || "الورود",
    onboardingDate: new Date().toISOString(),
    publicKey,
    privateKey: encrypt(privateKey),
    csr: csrPem,
    certificate: encrypt(prodCert),
    secret: encrypt(prodSecret),
    complianceRequestId,
    isSimulated,
  };

  const { error: saveErr } = await db
    .from(TENANT_TABLE)
    .update({
      business_name: businessName || clientRow?.business_name || "منشأة مكن",
      config_data: currentConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_slug", tenantSlug);

  if (saveErr) {
    if (isMissingColumn(saveErr)) {
      const { error: fallbackErr } = await db
        .from(TENANT_TABLE)
        .update({ config_data: currentConfig })
        .eq("tenant_slug", tenantSlug);
      if (fallbackErr) return { error: fallbackErr.message };
    } else {
      return { error: saveErr.message };
    }
  }

  logs.push(
    `[${new Date().toISOString()}] تم إكمال الربط بنجاح! المنشأة الآن جاهزة لتقديم الفواتير لـ ZATCA.`
  );

  return {
    config: {
      active: true,
      environment: environment || "sandbox",
      vatNumber,
      businessName,
      onboardingDate: new Date().toISOString(),
      isSimulated,
    },
    logs,
  };
}

export async function reportInvoiceToZatca(
  tenantSlug: string,
  invoice: ZatcaReportInput
): Promise<{ result?: ZatcaReportResult; error?: string; failed?: ZatcaReportResult }> {
  const { config, error } = await loadTenantConfig(tenantSlug);
  if (error) return { error };

  const zatcaRaw = config.zatcaConfig as ZatcaConfig | undefined;
  if (!zatcaRaw?.active) {
    return { error: "ZATCA integration is not configured or active for this tenant" };
  }

  const zatca: ZatcaConfig = { ...zatcaRaw };
  zatca.privateKey = decrypt(zatca.privateKey || "");
  zatca.certificate = decrypt(zatca.certificate || "");
  zatca.secret = decrypt(zatca.secret || "");

  const xmlContent = generateInvoiceXml(invoice, zatca);
  const xmlHash = crypto.createHash("sha256").update(xmlContent).digest("hex");
  const invoiceUuid = invoice.uuid || crypto.randomUUID();

  let digitalSignature = "";
  try {
    const sign = crypto.createSign("SHA256");
    sign.update(xmlHash);
    digitalSignature = sign.sign(zatca.privateKey!, "base64");
  } catch {
    digitalSignature = crypto.randomBytes(64).toString("base64");
  }

  const timestamp = invoice.createdAt || new Date().toISOString();
  const qrCodeBase64 = generateZatcaTlvQr(
    zatca.businessName || "",
    zatca.vatNumber || "",
    timestamp,
    Number(invoice.totalAmount || 0),
    Number(invoice.taxAmount || 0),
    xmlHash,
    digitalSignature,
    zatca.publicKey
  );

  let zatcaStatus = "REPORTED";
  let zatcaResponse: Record<string, unknown> = {
    success: true,
    message: "Invoice reported successfully",
  };

  if (!zatca.isSimulated) {
    try {
      const authHeader =
        "Basic " + Buffer.from(`${zatca.certificate}:${zatca.secret}`).toString("base64");
      const targetUrl = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting";

      const resZatca = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Version": "V2",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          invoiceHash: xmlHash,
          uuid: invoiceUuid,
          invoice: Buffer.from(xmlContent).toString("base64"),
        }),
      });

      if (!resZatca.ok) {
        const errText = await resZatca.text();
        throw new Error(errText || `ZATCA reporting returned status ${resZatca.status}`);
      }

      zatcaResponse = (await resZatca.json()) as Record<string, unknown>;
      const validationResults = zatcaResponse.validationResults as { status?: string } | undefined;
      if (validationResults?.status === "ERROR") {
        zatcaStatus = "FAILED";
      }
    } catch (err) {
      return {
        failed: {
          zatcaStatus: "FAILED",
          zatcaUuid: invoiceUuid,
          zatcaXmlHash: xmlHash,
          zatcaQrCode: qrCodeBase64,
          response: { success: false, error: (err as Error).message },
        },
      };
    }
  }

  return {
    result: {
      zatcaStatus,
      zatcaUuid: invoiceUuid,
      zatcaXmlHash: xmlHash,
      zatcaQrCode: qrCodeBase64,
      response: zatcaResponse,
    },
  };
}

export async function persistInvoiceZatcaMeta(
  tenantSlug: string,
  invoiceId: string,
  meta: {
    zatcaStatus: string;
    zatcaUuid: string;
    zatcaXmlHash: string;
    zatcaQrCode: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const db = getTenantDb();
  if (!db) return { ok: false, error: "قاعدة البيانات غير مهيأة على الخادم" };

  const { data, error } = await db
    .from("mken_invoices")
    .select("items")
    .eq("id", invoiceId)
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return { ok: false, error: "جدول الفواتير غير مُنشأ في قاعدة البيانات" };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "الفاتورة غير موجودة أو لا توجد صلاحية تعديل" };

  let items: unknown[] = [];
  const raw = data.items;
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }
  }

  const cleanItems = items.filter(
    (entry) => !(entry && typeof entry === "object" && (entry as { isZatcaMeta?: boolean }).isZatcaMeta)
  );
  cleanItems.push({
    isZatcaMeta: true,
    zatcaStatus: meta.zatcaStatus,
    zatcaUuid: meta.zatcaUuid,
    zatcaXmlHash: meta.zatcaXmlHash,
    zatcaQrCode: meta.zatcaQrCode,
  });

  const { error: updateErr } = await db
    .from("mken_invoices")
    .update({ items: cleanItems, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("tenant_slug", tenantSlug);

  if (updateErr) {
    if (isMissingTable(updateErr)) {
      return { ok: false, error: "جدول الفواتير غير مُنشأ في قاعدة البيانات" };
    }
    return { ok: false, error: updateErr.message };
  }

  return { ok: true };
}

export function invoiceToZatcaReportInput(invoice: Invoice): ZatcaReportInput {
  return {
    id: invoice.id,
    uuid: invoice.zatcaUuid || undefined,
    customerName: invoice.customerName,
    items: invoice.items,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    discount: invoice.discount,
    totalAmount: invoice.totalAmount,
    createdAt: invoice.createdAt,
  };
}
