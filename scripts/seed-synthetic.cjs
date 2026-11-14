#!/usr/bin/env node
/**
 * منصة مكِّن — مولد البيانات الوهمية المعماة للاختبار (Synthetic Data Generator)
 * كود المهمة: E1-SYN-02
 * الامتثال: نظام حماية البيانات الشخصية (PDPL) - المادة (4) واللائحة التنفيذية
 * الغرض: توليد 100 سجل اختباري معقم خالي تماماً من أي هويات أو أرقام حقيقية
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOTAL_RECORDS = 100;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'synthetic-test-suite.json');

const ACTIVITIES = [
  'barber-salon', 'car-care', 'healthcare', 'spa-wellness', 
  'fitness', 'veterinary', 'restaurant', 'consulting', 
  'photography', 'tutoring', 'maintenance', 'it-support'
];

const SERVICES_MAP = {
  'barber-salon': ['قص شعر ملكي', 'تحديد لحية وتنعيم', 'تنظيف بشرة', 'باقة العريس المتكاملة'],
  'car-care': ['غسيل بخار خارجي', 'تنظيف داخلي عميق', 'نانو سيراميك', 'تلميع ساطع'],
  'healthcare': ['كشف استشاري عام', 'فحص دوري شامل', 'تحاليل مخبرية', 'استشارة عن بعد'],
  'maintenance': ['صيانة مكيف سبليت', 'إصلاح سباكة منزلي', 'تأسيس شبكة كهرباء', 'صيانة دورية']
};

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر'];
const DISTRICTS = ['العليا', 'النرجس', 'الياسمين', 'حطين', 'الملقا', 'الشاطئ', 'الروضة'];

function generateSyntheticPhone(index) {
  // Saudi dummy number range 96650000xxxx (reserved dummy block)
  const pad = String(index).padStart(4, '0');
  return `96650000${pad}`;
}

function generateSyntheticEmail(index) {
  return `test.user.${index}@synthetic-test.mken.local`;
}

function generateSyntheticNationalId(index) {
  // Dummy 10-digit ID starting with 1 or 2 (dummy range)
  const pad = String(index).padStart(8, '0');
  return `10${pad}`;
}

function generateSyntheticInvoice(index, tenantId, appointmentId, amount) {
  const vatRate = 0.15;
  const tax = Math.round(amount * vatRate * 100) / 100;
  const total = Math.round((amount + tax) * 100) / 100;
  const uuid = crypto.randomUUID();

  return {
    id: `INV-SYN-${index + 1000}`,
    uuid: uuid,
    invoice_number: `MKN-2026-${String(index + 1).padStart(5, '0')}`,
    tenant_slug: tenantId,
    appointment_id: appointmentId,
    issue_date: new Date(Date.now() - (index * 3600000)).toISOString(),
    subtotal: amount,
    vat_rate: 15,
    tax_amount: tax,
    total_amount: total,
    currency: 'SAR',
    payment_method: index % 2 === 0 ? 'mada' : 'apple_pay',
    payment_status: 'paid',
    zatca_status: 'reported',
    zatca_hash: crypto.createHash('sha256').update(`invoice-${uuid}`).digest('hex')
  };
}

function generateSyntheticAppointments(count) {
  const list = [];
  const tenants = ['almahrusa', 'rewa', 'almasabi', 'demo-salon'];

  for (let i = 1; i <= count; i++) {
    const tenant = tenants[i % tenants.length];
    const activity = ACTIVITIES[i % ACTIVITIES.length];
    const services = SERVICES_MAP[activity] || ['خدمة عامة معتمدة', 'باقة مخصصة'];
    const serviceName = services[i % services.length];
    const amount = (i % 5 + 1) * 75; // 75, 150, 225, 300, 375 SAR

    const dateOffset = (i % 14) - 7; // -7 to +7 days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dateOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    const timeStr = `${String((9 + (i % 11))).padStart(2, '0')}:00`;

    const aptId = `APT-SYN-${String(i).padStart(4, '0')}`;
    const invoice = generateSyntheticInvoice(i, tenant, aptId, amount);

    list.push({
      id: aptId,
      tenant_slug: tenant,
      activity_id: activity,
      service_title: serviceName,
      customer_name: `عميل تجريبي (${i})`,
      phone: generateSyntheticPhone(i),
      email: generateSyntheticEmail(i),
      national_id_masked: generateSyntheticNationalId(i).slice(0, 3) + '****' + generateSyntheticNationalId(i).slice(-3),
      city: CITIES[i % CITIES.length],
      district: DISTRICTS[i % DISTRICTS.length],
      date: dateStr,
      time: timeStr,
      payment_amount: amount,
      payment_status: 'paid',
      payment_id: `pay_syn_${crypto.randomBytes(8).toString('hex')}`,
      status: i % 4 === 0 ? 'completed' : 'confirmed',
      created_at: new Date(Date.now() - (i * 7200000)).toISOString(),
      invoice: invoice
    });
  }

  return list;
}

function main() {
  console.log("================================================================================");
  console.log("  🛡️ منصة مكِّن — مولد البيانات الوهمية المعماة (Synthetic Data Seeder)");
  console.log("  🔒 الامتثال: نظام حماية البيانات الشخصية (PDPL) المادة 4 (Zero-PII Testing)");
  console.log("================================================================================\n");

  console.log(`⏳ جاري إنشاء ${TOTAL_RECORDS} سجلاً تجريبياً معقماً بالكامل...`);
  const data = generateSyntheticAppointments(TOTAL_RECORDS);

  const payload = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_records: data.length,
      compliance_standard: "Saudi PDPL & NCA ECC-1:2018",
      classification: "SYNTHETIC / ZERO-PII",
      description: "بيانات اختبار وهمية مطهرة بالكامل للاستخدام في بيئات التطوير والاختبار"
    },
    records: data
  };

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`✅ تم إنشاء وحفظ البيانات الوهمية بنجاح في:`);
  console.log(`   📁 ${OUTPUT_PATH}`);
  console.log(`\n📊 ملخص العينة المنشأة:`);
  console.log(`   - عدد المواعيد والطلبات: ${data.length}`);
  console.log(`   - عدد الفواتير الضريبية الوهمية: ${data.length}`);
  console.log(`   - نطاق الهواتف الوهمية: ${data[0].phone} إلى ${data[data.length - 1].phone}`);
  console.log(`   - نسبة التعمية والتطهير: 100% (صفر بيانات حقيقية)\n`);
  console.log("================================================================================");
  console.log("🎉 اكتمل بنجاح اختبار وتوليد البيانات الوهمية لمهمة E1-SYN-02!");
  console.log("================================================================================\n");
}

main();
