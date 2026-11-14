#!/usr/bin/env node
/**
 * منصة مكِّن — فاحص سلامة تسلسل الفواتير المشفرة (ZATCA Invoice Hash Chain Validator)
 * كود المهمة: E4-HASH-02
 * الامتثال: متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA) للفوترة الإلكترونية — المرحلة الثانية
 * 
 * المبدأ:
 * - كل فاتورة ترتبط رياضياً بـ Previous Invoice Hash (PIH) للفاتورة السابقة.
 * - أي محاولة تعديل أو حذف أو تلاعب بأي فاتورة سابقة يكسر السلسلة فوراً ويتم كشفه.
 */

const crypto = require('crypto');
const assert = require('assert');

// ZATCA Standard Initial Seed for the very first invoice (Base64 of SHA-256('0'))
const ZATCA_INITIAL_PIH = Buffer.from(
  crypto.createHash('sha256').update('0').digest('hex')
).toString('base64');

class ZatcaChainValidator {
  constructor() {
    this.chain = [];
  }

  // Calculate cryptographic hash of invoice canonical representation
  calculateInvoiceHash(invoiceData) {
    const canonicalPayload = [
      invoiceData.uuid,
      invoiceData.invoiceNumber,
      invoiceData.issueDate,
      invoiceData.issueTime,
      invoiceData.sellerVat,
      invoiceData.totalWithVat.toFixed(2),
      invoiceData.taxAmount.toFixed(2),
      invoiceData.previousInvoiceHash
    ].join('|');

    return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  }

  // Issue a new invoice in the chain
  appendInvoice({ uuid, invoiceNumber, issueDate, issueTime, sellerVat, totalWithVat, taxAmount }) {
    const previousHash = this.chain.length === 0 
      ? ZATCA_INITIAL_PIH 
      : this.chain[this.chain.length - 1].hash;

    const invoiceRecord = {
      index: this.chain.length + 1,
      uuid,
      invoiceNumber,
      issueDate,
      issueTime,
      sellerVat,
      totalWithVat,
      taxAmount,
      previousInvoiceHash: previousHash,
      hash: null
    };

    invoiceRecord.hash = this.calculateInvoiceHash(invoiceRecord);
    this.chain.push(invoiceRecord);
    return invoiceRecord;
  }

  // Validate the unbroken cryptographic continuity of the entire ledger
  verifyChainIntegrity() {
    console.log(`🔍 جاري فحص سلامة السلسلة التشفيرية لـ ${this.chain.length} فواتير...`);

    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];

      // 1. Check Previous Hash matching
      if (i === 0) {
        if (current.previousInvoiceHash !== ZATCA_INITIAL_PIH) {
          return {
            valid: false,
            errorIndex: i,
            reason: `الفاتورة الأولى لا تحتوي على الـ PIH الابتدائي المعتمد من ZATCA`
          };
        }
      } else {
        const prev = this.chain[i - 1];
        if (current.previousInvoiceHash !== prev.hash) {
          return {
            valid: false,
            errorIndex: i,
            invoiceNumber: current.invoiceNumber,
            reason: `انقطاع في تسلسل الـ Hash! الفاتورة [${current.invoiceNumber}] تشير إلى PIH مختلف عن هاش الفاتورة السابقة [${prev.invoiceNumber}]`
          };
        }
      }

      // 2. Re-compute hash to detect in-place tampering of data
      const computedHash = this.calculateInvoiceHash(current);
      if (computedHash !== current.hash) {
        return {
          valid: false,
          errorIndex: i,
          invoiceNumber: current.invoiceNumber,
          reason: `اكتشاف تلاعب في بيانات الفاتورة [${current.invoiceNumber}]! الهاش المسجل لا يطابق الهاش المعاد حسابه.`
        };
      }
    }

    return { valid: true, totalVerified: this.chain.length };
  }
}

async function runChainValidationTest() {
  console.log("================================================================================");
  console.log("  ⛓️ فاحص سلامة تسلسل الفواتير المشفرة (ZATCA Hash Chaining Validator)");
  console.log("  🏛️ الامتثال: لائحة الفوترة الإلكترونية المرحلة الثانية — غير قابلة للكسر");
  console.log("================================================================================\n");

  const ledger = new ZatcaChainValidator();

  // Step 1: Issue 5 legitimate sequential invoices
  console.log("1️⃣ إصدار 5 فواتير ضريبية مبسطة متسلسلة وفق معيار ZATCA...");
  const sellerVat = '311234567800003';

  for (let i = 1; i <= 5; i++) {
    const inv = ledger.appendInvoice({
      uuid: crypto.randomUUID(),
      invoiceNumber: `INV-2026-${String(i).padStart(5, '0')}`,
      issueDate: '2026-11-13',
      issueTime: `10:${String(i * 10).padStart(2, '0')}:00`,
      sellerVat: sellerVat,
      totalWithVat: i * 115.00,
      taxAmount: i * 15.00
    });
    console.log(`   📄 تم قيد [${inv.invoiceNumber}] — الهاش: ${inv.hash.slice(0, 16)}...`);
  }

  // Step 2: Verify intact chain
  console.log("\n2️⃣ التحقق الأولي من سلامة السلسلة النظامية...");
  const initialCheck = ledger.verifyChainIntegrity();
  assert.strictEqual(initialCheck.valid, true, "يجب أن تكون السلسلة الأصلية صحيحة 100%");
  console.log(`   ✅ نجاح تام: السلسلة متصلة وخالية من أي انقطاع (${initialCheck.totalVerified} فواتير معتمدة).\n`);

  // Step 3: Simulate Tampering (Fraud detection attack)
  console.log("3️⃣ محاكاة هجوم احتيالي: محاولة تعديل قيمة الفاتورة رقم 3 خلسة من 345 إلى 150 ريال...");
  const targetInvoice = ledger.chain[2]; // Invoice 3
  const originalTotal = targetInvoice.totalWithVat;
  targetInvoice.totalWithVat = 150.00; // Malicious modification

  const tamperedCheck = ledger.verifyChainIntegrity();
  assert.strictEqual(tamperedCheck.valid, false, "يجب أن يفشل الفحص عند وجود تلاعب");
  console.log(`   🚨 تم رصد التلاعب بنجاح!`);
  console.log(`      السبب: ${tamperedCheck.reason}`);
  console.log(`      الموقع: الفاتورة رقم ${tamperedCheck.invoiceNumber}`);

  // Step 4: Restore and verify recovery
  console.log("\n4️⃣ استعادة القيمة الأصلية والتحقق من عودة السلسلة للسلامة...");
  targetInvoice.totalWithVat = originalTotal;
  const recoveredCheck = ledger.verifyChainIntegrity();
  assert.strictEqual(recoveredCheck.valid, true);
  console.log("   ✅ نجاح: عادت السلسلة لحالتها المعتمدة والمشفرة.\n");

  console.log("================================================================================");
  console.log("🎉 تم اجتياز كافة اختبارات تسلسل الهاش الضريبي لـ ZATCA بنسبة 100%!");
  console.log("================================================================================\n");
}

runChainValidationTest().catch(err => {
  console.error("❌ فشل اختبار تسلسل ZATCA:", err);
  process.exit(1);
});
