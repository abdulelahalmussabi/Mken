#!/usr/bin/env node
/**
 * منصة مكِّن — بوابة الفحص والاعتماد الشاملة (Master Quality & Regulatory Gate)
 * كود المهمة: E0-REG-01
 * الامتثال: ضوابط الهيئة الوطنية للأمن السيبراني (NCA ECC-1:2018) ونظام حماية البيانات الشخصية (PDPL)
 * 
 * البوابات المفحوصة (7 بوابات سيادية):
 * 1. E1-RLS-01: عزل المستأجرين وحماية الخصوصية (Tenant Isolation & RLS Pen-Test)
 * 2. E1-SYN-02: توليد البيانات المعماة وتطهير بيئة الاختبار (PDPL Compliance)
 * 3. E3-IDEM-01: حتمية الدفع ومنع التكرار المالي في Webhook ميسر (SAMA / PCI-DSS)
 * 4. E4-HASH-02: تسلسل السلسلة المشفرة للفواتير (ZATCA Phase 2 Fatoora Hash)
 * 5. E3-OFFL-02: مرونة الحجز والطلب بدون اتصال (PWA Offline Resilience)
 * 6. E6-FLT-01: خوارزمية الأسطول الميداني وترشيح إحداثيات GPS لتوفير البطارية
 * 7. E0-SYNC-01: مزامنة خارطة طريق المشروع مع Notion و Slack (Zero-PII Governance)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SUITE = [
  {
    code: 'E1-RLS-01',
    name: 'عزل المستأجرين وحماية الخصوصية (Tenant Isolation & Zero-Leakage Pen-Test)',
    command: 'node',
    args: ['scripts/test-tenant-isolation.cjs']
  },
  {
    code: 'E2-PRAYER-01',
    name: 'بريك الصلاة ونظام العمل السعودي في الطابور (Prayer Breaks & Labor Compliance)',
    command: 'node',
    args: ['tests/queue-prayer-onboarding.test.cjs']
  },
  {
    code: 'E2-PII-02',
    name: 'شاشة الطابور المنقحة وانعدام البيانات الشخصية (Zero-PII Token Display Gate)',
    command: 'node',
    args: ['tests/queue-zero-pii-display.test.cjs']
  },
  {
    code: 'E1-SYN-02',
    name: 'توليد البيانات المعماة وتطهير بيئة الاختبار (PDPL Compliance)',
    command: 'node',
    args: ['scripts/seed-synthetic.cjs']
  },
  {
    code: 'E3-IDEM-01',
    name: 'حتمية الدفع ومنع التكرار المالي في Webhook ميسر (SAMA / PCI-DSS)',
    command: 'node',
    args: ['tests/payment-concurrency.test.cjs']
  },
  {
    code: 'E4-HASH-02',
    name: 'تسلسل السلسلة المشفرة للفواتير (ZATCA Phase 2 Fatoora Hash)',
    command: 'node',
    args: ['scripts/verify-chain.cjs']
  },
  {
    code: 'E3-OFFL-02',
    name: 'مرونة الحجز والطلب بدون اتصال (PWA Offline Resilience)',
    command: 'node',
    args: ['tests/test-pwa-offline.cjs']
  },
  {
    code: 'E6-FLT-01',
    name: 'خوارزمية الأسطول الميداني وترشيح إحداثيات GPS لتوفير البطارية',
    command: 'node',
    args: ['tests/test-fleet-logic.cjs']
  },
  {
    code: 'E0-SYNC-01',
    name: 'مزامنة خارطة طريق المشروع مع Notion و Slack (Zero-PII Governance)',
    command: 'node',
    args: ['scripts/sync-roadmap.cjs', '--dry-run']
  }
];

function runMasterGate() {
  console.log("================================================================================");
  console.log("  🏛️ بوابة الفحص والاعتماد الشاملة لمنصة مكّن (Master Production Gate)");
  console.log("  🔒 المعايير: NCA ECC-1:2018 | PDPL سدايا | ZATCA المرحلة 2 | SAMA Payments");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;
  const results = [];

  for (let i = 0; i < SUITE.length; i++) {
    const test = SUITE[i];
    console.log(`[${i + 1}/${SUITE.length}] تشغيل بوابة: [${test.code}] ${test.name}...`);
    
    const startTime = Date.now();
    const proc = spawnSync(test.command, test.args, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: process.env
    });
    const duration = Date.now() - startTime;

    if (proc.status === 0) {
      console.log(`   ✅ نجاح (المدة: ${duration}ms)`);
      passed++;
      results.push({ code: test.code, status: 'PASSED', duration: `${duration}ms` });
    } else {
      console.error(`   ❌ إخفاق (كود الخطأ: ${proc.status})`);
      if (proc.stderr) console.error(proc.stderr.slice(0, 300));
      failed++;
      results.push({ code: test.code, status: 'FAILED', duration: `${duration}ms` });
    }
    console.log('--------------------------------------------------------------------------------');
  }

  console.log("\n================================================================================");
  console.log("📊 لوحة النتائج النهائية لبوابات الاعتماد (Production Readiness Dashboard):");
  console.log("================================================================================");
  results.forEach(r => {
    const icon = r.status === 'PASSED' ? '🟢' : '🔴';
    console.log(`  ${icon} [${r.code.padEnd(10, ' ')}] الحالة: ${r.status.padEnd(8, ' ')} | زمن التنفيذ: ${r.duration}`);
  });

  console.log("\n--------------------------------------------------------------------------------");
  if (failed === 0) {
    console.log(`🎉 النتيجة: اجتياز كامل 100% (${passed}/${SUITE.length} بوابات معتمدة بنجاح).`);
    console.log(`🛡️ المنصة جاهزة للإنتاج البرمجي المباشر وممتثلة لكافة اللوائح السعودية.`);
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.error(`🚨 النتيجة: فشل في ${failed} بوابات! يُحظر النشر للإنتاج حتى معالجة الإشكالات.`);
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runMasterGate();
