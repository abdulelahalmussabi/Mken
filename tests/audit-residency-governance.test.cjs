'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const auditEngine = require('../api/_lib/audit-governance-engine');
const governanceHandler = require('../api/v1/governance');

console.log('================================================================');
console.log('🧪 اختبارات التحقق الشاملة لحوكمة توطين البيانات وسجلات التدقيق');
console.log('🛡️ الامتثال: ضوابط الأمن السيبراني NCA ECC-1:2018، ونظام PDPL لسدايا');
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
// Test 1: فحص قفل منع الحذف والتعديل على سجلات التدقيق (SQL Immutability Gate)
// -----------------------------------------------------------------------------
runTest('1. التحقق من وجود مشغل منع التعديل والمحو الإلزامي لسجلات التدقيق (NCA Control 2-3)', () => {
  const schemaPath = path.join(__dirname, '../db/audit-residency-governance-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  assert(sql.includes('trg_mken_audit_immutable'), 'Schema must define immutable trigger');
  assert(sql.includes('BEFORE UPDATE OR DELETE ON public.mken_immutable_audit_logs'), 'Trigger must intercept UPDATE and DELETE');
  assert(sql.includes('RAISE EXCEPTION'), 'Trigger must throw exception on modification');
});

// -----------------------------------------------------------------------------
// Test 2: التحقق من السلسلة التشفيرية واكتشاف التلاعب (Cryptographic Hash Chaining)
// -----------------------------------------------------------------------------
runTest('2. التحقق من ترابط الهاش المتسلسل (SHA-256) واكتشاف محاولات التلاعب والحذف', () => {
  const records = [];
  let prevHash = auditEngine.GENESIS_PREV_HASH;

  // توليد 4 سجلات متسلسلة تشفيرياً
  for (let i = 0; i < 4; i++) {
    const data = {
      id: `log_${i}`,
      actor_id: `user_${i}`,
      actor_role: 'admin',
      action: 'PII_ACCESS',
      resource_type: 'customer',
      resource_id: `cust_${i}`,
      status: 'SUCCESS',
      tenant_slug: 'default',
      timestamp: '2026-11-13T20:00:00.000Z'
    };

    const recordHash = auditEngine.computeAuditRecordHash(prevHash, data);
    records.push({
      ...data,
      prev_record_hash: prevHash,
      record_hash: recordHash
    });
    prevHash = recordHash;
  }

  // 1. فحص سلامة السلسلة السليمة
  const intactCheck = auditEngine.verifyAuditChainIntegrity(records);
  assert.strictEqual(intactCheck.intact, true, 'Intact chain must pass 100%');
  assert.strictEqual(intactCheck.verifiedCount, 4);

  // 2. اختبار ترويض التلاعب: تعديل بيانات السجل الثاني في الخفاء
  const tamperedRecords = JSON.parse(JSON.stringify(records));
  tamperedRecords[1].actor_id = 'attacker_id'; // تعديل صامت

  const tamperedCheck = auditEngine.verifyAuditChainIntegrity(tamperedRecords);
  assert.strictEqual(tamperedCheck.intact, false, 'Tampered record must be detected');
  assert.strictEqual(tamperedCheck.brokenIndex, 1, 'Broken index must be 1');
  assert(tamperedCheck.error.includes('تلاعب في محتوى السجل'));

  // 3. اختبار حذف سجل من المنتصف (Broken Chain Detection)
  const deletedRecords = [records[0], records[2], records[3]]; // حذف السجل رقم 1
  const deleteCheck = auditEngine.verifyAuditChainIntegrity(deletedRecords);
  assert.strictEqual(deleteCheck.intact, false, 'Deleted record must cause chain rupture');
  assert.strictEqual(deleteCheck.brokenIndex, 1);
  assert(deleteCheck.error.includes('انقطاع في تسلسل'));
});

// -----------------------------------------------------------------------------
// Test 3: فحص حارس التصدير والعلامة المائية الرقمية (Export Sentinel Guard)
// -----------------------------------------------------------------------------
async function runAsyncExportGuardTest() {
  totalTests++;

  // 1. محاولة تصدير من موظف عادي (staff) -> يجب أن تُرفض بـ 403 Forbidden
  const unauthorizedReq = {
    method: 'POST',
    url: '/api/v1/governance?action=export-guard',
    headers: { 'content-type': 'application/json' },
    query: { action: 'export-guard' },
    body: {
      actorId: 'sales_rep_5',
      actorEmail: 'sales5@mken.live',
      actorRole: 'staff', // ليس مديراً
      resourceType: 'customers',
      rowCount: 1000
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

  await governanceHandler(unauthorizedReq, mockRes);
  assert.strictEqual(statusCode, 403, 'Unauthorized export attempt must return 403 Forbidden');
  assert.strictEqual(jsonResponse.action, 'BLOCKED');

  // 2. محاولة تصدير مصرح بها من المدير (admin) -> تنجح وتُحقن بالعلامة المائية
  const authorizedReq = {
    method: 'POST',
    url: '/api/v1/governance?action=export-guard',
    headers: { 'content-type': 'application/json' },
    query: { action: 'export-guard' },
    body: {
      actorId: 'admin_fahd',
      actorEmail: 'fahd@mken.live',
      actorRole: 'admin',
      resourceType: 'customers',
      rowCount: 1000,
      tenantSlug: 'demo_store'
    }
  };

  await governanceHandler(authorizedReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Authorized export must return 200 OK');
  assert.strictEqual(jsonResponse.allowed, true);
  assert(jsonResponse.watermark, 'Watermark must be generated');
  assert(jsonResponse.watermark.watermarkId.startsWith('MKN-EXP-'), 'Watermark ID format verified');

  console.log('✅ [PASS] 3. حارس تصدير البيانات (Export Guard) والعلامة المائية لمنع التسريب');
  passedTests++;
}

// -----------------------------------------------------------------------------
// Test 4: التوفيق بين حق النسيان (PDPL) والاحتفاظ الفاتوري لـ ZATCA (PII Scrubbing)
// -----------------------------------------------------------------------------
runTest('4. تعمية البيانات الشخصية مع الحفاظ الصارم على فواتير وهيئة الزكاة (ZATCA Reconciliation)', () => {
  const originalOrder = {
    id: 'ord_12345678',
    customer_name: 'سلطان بن عبدالعزيز',
    phone: '0555555555',
    location_address: 'فيلا 12 - شارع التخصصي - الرياض',
    customer_lat: 24.7136,
    customer_lng: 46.6753,
    subtotal: 500.00,
    tax_amount: 75.00,
    total_amount: 575.00,
    currency: 'SAR',
    zatca_qr_code: 'AQZNa2VuAA8zMDAwMDAwMDAwMDAwMDMCFDIwMjYtMTEtMTNUMjA6MDA6MDBaBAY1NzUuMDACBDE1LjAw',
    items: [
      { name: 'جهاز تكييف سبليت', price: 500.00, quantity: 1 }
    ]
  };

  // تطبيق التعمية التشفيرية لممارسة حق النسيان
  const scrubbedOrder = auditEngine.anonymizeCustomerPii(originalOrder, 'ANON-9999');

  // التحقق من تعمية الهوية الشخصية (PDPL Art. 5)
  assert.strictEqual(scrubbedOrder.customer_name, 'مستهلك معفى الهوية (#ANON-9999)');
  assert.strictEqual(scrubbedOrder.phone, '0500000000');
  assert.strictEqual(scrubbedOrder.location_address, 'حي معفى الهوية - الرياض');
  assert.strictEqual(scrubbedOrder.customer_lat, null, 'Latitude must be wiped');
  assert.strictEqual(scrubbedOrder.customer_lng, null, 'Longitude must be wiped');

  // التحقق من سلامة البيانات المالية والفاتورية لـ ZATCA
  assert.strictEqual(scrubbedOrder.subtotal, 500.00, 'Subtotal must NOT be changed');
  assert.strictEqual(scrubbedOrder.tax_amount, 75.00, 'Tax amount must NOT be changed');
  assert.strictEqual(scrubbedOrder.total_amount, 575.00, 'Total amount must NOT be changed');
  assert.strictEqual(scrubbedOrder.zatca_qr_code, originalOrder.zatca_qr_code, 'ZATCA QR code must be preserved');
  assert.strictEqual(scrubbedOrder.items.length, 1, 'Line items must be preserved');
});

// -----------------------------------------------------------------------------
// Test 5: فحص حدود توطين البيانات السعودية ومنع النقل الخارجي (Data Residency Guard)
// -----------------------------------------------------------------------------
runTest('5. فحص حدود توطين البيانات وحظر نقل البيانات الحساسة لخوادم خارجية غير مرخصة', () => {
  // نطاق سعودي معتمد -> مسموح
  const zatcaRes = auditEngine.validateSaudiDataResidency('https://zatca.gov.sa/invoicing', 'Restricted');
  assert.strictEqual(zatcaRes.allowed, true);

  // نطاق منصة مكّن -> مسموح
  const mkenRes = auditEngine.validateSaudiDataResidency('https://mken.live/api/v1/checkout', 'Secret');
  assert.strictEqual(mkenRes.allowed, true);

  // خادم خارجي مجهول لبيانات حساسة -> مرفوض ومحظور فوراً
  const blockedRes = auditEngine.validateSaudiDataResidency('https://analytics-unauthorized-us.com/collect', 'Restricted');
  assert.strictEqual(blockedRes.allowed, false);
  assert(blockedRes.error.includes('محظور نظاماً'));
});

// -----------------------------------------------------------------------------
// Test 6: دورة حياة التدقيق والتحقق المتكاملة (Governance API Integration)
// -----------------------------------------------------------------------------
async function runAsyncGovernanceIntegrationTest() {
  totalTests++;

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

  // 1. تسجيل حدث وصول للبيانات الحساسة
  const logReq = {
    method: 'POST',
    url: '/api/v1/governance?action=log-access',
    headers: { 'content-type': 'application/json' },
    query: { action: 'log-access' },
    body: {
      actorId: 'admin_1',
      actorRole: 'admin',
      actionName: 'PII_ACCESS',
      resourceType: 'customer',
      resourceId: 'cust_777',
      tenantSlug: 'test_store'
    }
  };
  await governanceHandler(logReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert(jsonResponse.recordHash, 'Hash must be generated');

  // 2. تنفيذ طلب التعمية لحق النسيان
  const anonReq = {
    method: 'POST',
    url: '/api/v1/governance?action=anonymize-pii',
    headers: { 'content-type': 'application/json' },
    query: { action: 'anonymize-pii' },
    body: {
      customerPhone: '0512345678',
      tenantSlug: 'test_store',
      requestedBy: 'dpo_compliance'
    }
  };
  await governanceHandler(anonReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.anonymized, true);

  // 3. التحقق من سلامة السلسلة التشفيرية لسجل التدقيق
  const verifyReq = {
    method: 'GET',
    url: '/api/v1/governance?action=verify-ledger&tenant=test_store',
    headers: { 'content-type': 'application/json' },
    query: { action: 'verify-ledger', tenant: 'test_store' }
  };
  await governanceHandler(verifyReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.intact, true, 'Audit ledger chain must be 100% intact');

  console.log('✅ [PASS] 6. فحص النزاهة التشفيرية والتحقق من سلامة السجلات (Audit Ledger Verification)');
  passedTests++;
}

Promise.all([runAsyncExportGuardTest(), runAsyncGovernanceIntegrationTest()]).then(() => {
  console.log('\n================================================================');
  console.log(`🎉 كافة اختبارات حوكمة توطين البيانات وسجلات التدقيق اجتازت الفحص بنجاح: ${passedTests}/${totalTests}`);
  console.log('================================================================');
}).catch((err) => {
  console.error('\n❌ فشل أحد الاختبارات:', err);
  process.exit(1);
});
