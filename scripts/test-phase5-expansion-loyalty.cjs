// scripts/test-phase5-expansion-loyalty.cjs
// ملف الفحص الآلي الشامل للمرحلة الخامسة: التوسع والذكاء (تعدد الفروع، الولاء، الطاولات QR، وامتثال PDPL)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🚀 بدء اختبارات المرحلة الخامسة: التوسع والذكاء (Multi-Branch & Loyalty)');
console.log('================================================================\n');

async function runTests() {
  let passedCount = 0;
  const totalCount = 7;

  // -------------------------------------------------------------
  // اختبار 1: استقلالية الفروع المتزامنة (Multi-Branch Number Isolation)
  // -------------------------------------------------------------
  try {
    const createOrderHandler = require('../mkn-theme/src/server/platform/pos/create-order-with-ticket');

    // تذكرة 1 لفرع الرياض
    let resRiyadh1 = null;
    await createOrderHandler({
      method: 'POST',
      body: {
        tenant: 'cafe-chain',
        branch_id: 'riyadh-branch',
        customer_name: 'سلطان القحطاني',
        items: [{ id: 'latte', name: 'سبانش لاتيه بارد', price: 22, quantity: 1, category: 'drinks' }]
      }
    }, {
      status: (code) => ({
        json: (data) => { resRiyadh1 = data; return data; }
      })
    });

    // تذكرة 1 لفرع جدة
    let resJeddah1 = null;
    await createOrderHandler({
      method: 'POST',
      body: {
        tenant: 'cafe-chain',
        branch_id: 'jeddah-branch',
        customer_name: 'عمر باوزير',
        items: [{ id: 'v60', name: 'قهوة V60 إثيوبي', price: 20, quantity: 1, category: 'drinks' }]
      }
    }, {
      status: (code) => ({
        json: (data) => { resJeddah1 = data; return data; }
      })
    });

    assert.ok(resRiyadh1 && resRiyadh1.ticket_number, 'يجب إصدار تذكرة لفرع الرياض');
    assert.ok(resJeddah1 && resJeddah1.ticket_number, 'يجب إصدار تذكرة لفرع جدة');
    assert.strictEqual(resRiyadh1.ticket_number, 'C-001', 'التذكرة الأولى لفرع الرياض يجب أن تكون C-001');
    assert.strictEqual(resJeddah1.ticket_number, 'C-001', 'التذكرة الأولى لفرع جدة يجب أن تكون أيضاً C-001 مستقلة تماماً');

    // تذكرة ثانية لفرع الرياض للتأكد من تصاعد التسلسل في الرياض دون جدة
    let resRiyadh2 = null;
    await createOrderHandler({
      method: 'POST',
      body: {
        tenant: 'cafe-chain',
        branch_id: 'riyadh-branch',
        customer_name: 'خالد العنزي',
        items: [{ id: 'latte', name: 'لاتيه حار', price: 18, quantity: 1, category: 'drinks' }]
      }
    }, {
      status: (code) => ({
        json: (data) => { resRiyadh2 = data; return data; }
      })
    });

    assert.strictEqual(resRiyadh2.ticket_number, 'C-002', 'التذكرة الثانية لفرع الرياض يجب أن تكون C-002');
    console.log('✅ [نجاح] 1.1 استقلالية تسلسل أرقام التذاكر بين الفروع المتعددة (Riyadh C-001, Jeddah C-001)');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 1.1 استقلالية تسلسل الفروع:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 2: التحقق من ملف التكوين ولوحة المشرف العام متعدد الفروع
  // -------------------------------------------------------------
  try {
    const cafeChainPath = path.join(__dirname, '../data/tenants/cafe-chain.json');
    assert.ok(fs.existsSync(cafeChainPath), 'ملف cafe-chain.json يجب أن يكون موجوداً');
    const config = JSON.parse(fs.readFileSync(cafeChainPath, 'utf8'));
    assert.ok(Array.isArray(config.branches) && config.branches.length >= 2, 'يجب تعريف فرعين على الأقل');
    assert.ok(config.queues && config.queues.C && config.queues.T, 'يجب تعريف طوابير المشروبات والطاولات');
    assert.ok(config.loyalty && config.loyalty.enabled === true, 'برنامج الولاء يجب أن يكون مفعلاً');

    const supervisorPath = fs.existsSync(path.join(__dirname, '../mkn-theme/public/js/multi-branch-supervisor.jsx'))
      ? path.join(__dirname, '../mkn-theme/public/js/multi-branch-supervisor.jsx')
      : path.join(__dirname, '../js/multi-branch-supervisor.jsx');
    assert.ok(fs.existsSync(supervisorPath), 'ملف multi-branch-supervisor.jsx يجب أن يكون موجوداً');
    const supervisorCode = fs.readFileSync(supervisorPath, 'utf8');
    assert.ok(supervisorCode.includes('waitingCount'), 'يجب احتواء لوحة المشرف على مؤشر waitingCount');
    assert.ok(supervisorCode.includes('kdsPendingOrders'), 'يجب احتواء لوحة المشرف على مؤشر kdsPendingOrders');
    assert.ok(supervisorCode.includes('revenueToday'), 'يجب احتواء لوحة المشرف على مؤشر revenueToday');

    console.log('✅ [نجاح] 2.1 تكوين سلسلة الفروع ولوحة المشرف المركزي (Supervisor Dashboard)');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 2.1 لوحة المشرف وتكوين الفروع:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 3: احتساب نقاط الولاء عند إنهاء الخدمة والدفع
  // -------------------------------------------------------------
  try {
    const completeHandler = require('../mkn-theme/src/server/platform/pos/complete-service');
    const loyaltyEngine = require('../mkn-theme/src/server/platform/pos/loyalty');

    let completeRes = null;
    await completeHandler({
      method: 'POST',
      body: {
        tenant: 'cafe-chain',
        ticket_number: 'C-001',
        amount: 150.00,
        phone: '0559988776',
        customer_name: 'تركي المطيري',
        payment_method: 'card',
        seller_name: 'سلسلة مقاهي نجد المختصة',
        vat_number: '310123456700003'
      }
    }, {
      status: (code) => ({
        json: (data) => { completeRes = data; return data; }
      })
    });

    assert.ok(completeRes && completeRes.ok, 'عملية إنهاء الخدمة والدفع يجب أن تنجح');
    assert.ok(completeRes.loyalty, 'يجب احتواء الاستجابة على كائن الولاء');
    assert.strictEqual(completeRes.loyalty.points_earned, 15, 'المبلغ 150 ر.س يمنح 15 نقطة ولاء (1 نقطة لكل 10 ر.س)');
    assert.strictEqual(completeRes.loyalty.current_balance, 15, 'رصيد العميل يجب أن يصبح 15 نقطة');

    console.log('✅ [نجاح] 3.1 احتساب ومنح نقاط الولاء آلياً عند إنهاء الفاتورة والدفع (+15 نقطة)');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 3.1 نقاط الولاء عند الدفع:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 4: استعلام واسترداد نقاط الولاء (Redemption & Discount)
  // -------------------------------------------------------------
  try {
    const loyaltyEngine = require('../mkn-theme/src/server/platform/pos/loyalty');
    const customer = await loyaltyEngine.getCustomerLoyalty('cafe-chain', '0559988776');
    assert.strictEqual(customer.points, 15, 'يجب العثور على رصيد العميل السابق 15 نقطة');

    // استرداد 10 نقاط
    const redemption = await loyaltyEngine.redeemCustomerLoyalty('cafe-chain', '0559988776', 10);
    assert.ok(redemption.ok, 'استبدال النقاط يجب أن ينجح');
    assert.strictEqual(redemption.points_redeemed, 10, 'عدد النقاط المستردة 10');
    assert.strictEqual(redemption.discount_amount, 1.00, 'الخصم المكتسب 1.00 ر.س (10 نقاط = 1 ر.س)');
    assert.strictEqual(redemption.remaining_points, 5, 'الرصيد المتبقي 5 نقاط');

    console.log('✅ [نجاح] 4.1 استرداد نقاط الولاء وتطبيق الخصم (Redeem 10 pts = 1.00 SAR Discount)');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 4.1 استرداد نقاط الولاء:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 5: خدمة الطاولات الذكية (Dine-in QR Table Stand)
  // -------------------------------------------------------------
  try {
    const adminTablesPath = path.join(__dirname, '../mkn-theme/public/admin-tables.html');
    assert.ok(fs.existsSync(adminTablesPath), 'ملف admin-tables.html يجب أن يكون موجوداً');
    const htmlContent = fs.readFileSync(adminTablesPath, 'utf8');
    assert.ok(htmlContent.includes('service_type=dine_in'), 'يجب تضمين نوع الخدمة dine_in في رابط الطاولة');
    assert.ok(htmlContent.includes('queue=T'), 'يجب توجيه الطاولة لمسار الطابور T');

    // فحص إنشاء طلب طاولة مع تذكرة مسار T
    const createOrderHandler = require('../mkn-theme/src/server/platform/pos/create-order-with-ticket');
    let dineInRes = null;
    await createOrderHandler({
      method: 'POST',
      body: {
        tenant: 'cafe-chain',
        branch_id: 'riyadh-branch',
        customer_name: 'عائلة الشمري',
        service_type: 'dine_in',
        table_number: '7',
        items: [
          { id: 'burger', name: 'برجر ترافل لحم', price: 48, quantity: 2, category: 'food' },
          { id: 'fries', name: 'بطاطس مقلية بالجبن', price: 18, quantity: 1, category: 'food' }
        ]
      }
    }, {
      status: (code) => ({
        json: (data) => { dineInRes = data; return data; }
      })
    });

    assert.ok(dineInRes && dineInRes.ticket_number, 'يجب إصدار تذكرة لطلب الطاولة');
    assert.strictEqual(dineInRes.ticket_number.charAt(0), 'T', 'طلب الطاولة يجب أن يصدر تذكرة بالمسار T (طاولات)');
    assert.strictEqual(dineInRes.table_number, '7', 'يجب ربط رقم الطاولة 7 بالتذكرة');

    console.log('✅ [نجاح] 5.1 ملصقات الطاولات QR وإصدار تذكرة داين-إن مسار T (T-001 طاولة 7)');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 5.1 خدمة الطاولات الداين-إن:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 6: أتمتة امتثال نظام حماية البيانات الشخصية السعودي (PDPL)
  // -------------------------------------------------------------
  try {
    const pdplCron = require('../mkn-theme/src/server/platform/cron-queue-pdpl');
    assert.ok(typeof pdplCron.executePdplAnonymization === 'function', 'دالة executePdplAnonymization يجب أن تكون معرفة');

    const result = await pdplCron.executePdplAnonymization('cafe-chain', 30);
    assert.strictEqual(result.tenant, 'cafe-chain');
    assert.strictEqual(result.retention_days, 30);
    assert.strictEqual(result.status, 'success');
    assert.ok(typeof result.records_anonymized === 'number', 'يجب إرجاع عدد السجلات المعالجة');

    console.log('✅ [نجاح] 6.1 أتمتة إخفاء هوية سجلات الطابور القديمة وفق نظام PDPL السعودي');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 6.1 امتثال PDPL:', e.message);
  }

  // -------------------------------------------------------------
  // اختبار 7: مسارات vercel.json وتكامل التوجيهات
  // -------------------------------------------------------------
  try {
    const vercelPath = fs.existsSync(path.join(__dirname, '../mkn-theme/vercel.json'))
      ? path.join(__dirname, '../mkn-theme/vercel.json')
      : path.join(__dirname, '../vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const hasPdplCron = vercelConfig.crons.some(c => c.path === '/api/cron-queue-pdpl');
    assert.ok(hasPdplCron, 'يجب جدولة cron-queue-pdpl في vercel.json');

    const hasAdminTablesRewrite = vercelConfig.rewrites.some(r => r.source === '/admin-tables');
    assert.ok(hasAdminTablesRewrite, 'يجب توفير إعادة توجيه /admin-tables في vercel.json');

    console.log('✅ [نجاح] 7.1 توثيق كرون PDPL وتوجيهات /admin-tables في vercel.json');
    passedCount++;
  } catch (e) {
    console.error('❌ [فشل] 7.1 تكوين Vercel:', e.message);
  }

  console.log('\n================================================================');
  console.log(`📊 النتيجة النهائية: ${passedCount} من ${totalCount} اختبارات نجحت بنسبة ${Math.round((passedCount/totalCount)*100)}%!`);
  console.log('================================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests();
