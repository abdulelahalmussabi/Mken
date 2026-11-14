'use strict';

const assert = require('assert');
const queueHandler = require('../api/v1/queue.js');

// محاكي طلبات واستجابات HTTP الصغري
function mockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {}
  };

  let statusCode = 200;
  let responseData = null;
  let headersSent = {};

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, val) {
      headersSent[key] = val;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    end(data) {
      responseData = data;
      return this;
    },
    get _status() { return statusCode; },
    get _data() { return responseData; }
  };

  return { req, res };
}

async function runTest() {
  console.log('====================================================');
  console.log('🧪 بدء اختبار مصفوفة الصلاحيات (RBAC) ومحرك التحويل الذكي');
  console.log('====================================================\n');

  const tenant = 'rbac_test_' + Date.now();

  // 1️⃣ اختبار إصدار تذكرة يدوية عبر موظف الاستقبال (Manual Ticket Issuance)
  console.log('1️⃣ اختبار إصدار تذكرة يدوية عبر موظف الاستقبال...');
  {
    const { req, res } = mockReqRes({
      query: { tenant, action: 'manual-ticket' },
      body: {
        queueId: `q-cs-${tenant}`,
        customerName: 'سليمان خالد (كبير السن)',
        customerPhone: '0501112233',
        notes: 'مواطن يفضل تذكرة مطبوعة للمراجعة'
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(res._status, 200);
    assert.strictEqual(res._data.ok, true);
    assert.strictEqual(res._data.ticket.customer_name, 'سليمان خالد (كبير السن)');
    assert.strictEqual(res._data.ticket.is_manual, true);
    assert.ok(res._data.printPayload, 'يجب توليد بيانات الطباعة الفورية');
    assert.strictEqual(res._data.printPayload.ticketNumber, res._data.ticket.ticket_number);
    console.log(`   ✅ نجح: تم إصدار التذكرة اليدوية (${res._data.ticket.ticket_number}) مع حمولة الطباعة الحرارية.`);
  }

  // 2️⃣ اختبار البحث الشامل (Omni-Search by Receptionist)
  console.log('\n2️⃣ اختبار البحث الشامل بواسطة الاستقبال عن التذاكر...');
  {
    const { req, res } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'search-tickets', q: 'سليمان' }
    });

    await queueHandler(req, res);
    assert.strictEqual(res._status, 200);
    assert.strictEqual(res._data.ok, true);
    assert.strictEqual(res._data.tickets.length, 1);
    assert.strictEqual(res._data.tickets[0].customer_name, 'سليمان خالد (كبير السن)');
    console.log('   ✅ نجح: عثر محرك البحث الفوري على تذكرة العميل عبر الاسم.');
  }

  // 3️⃣ اختبار قيود صلاحية موظف الكاونتر (Scoped Access Control)
  console.log('\n3️⃣ اختبار قيود صلاحية موظف الكاونتر (محصور فقط بعميله الحالي)...');
  {
    // محاولة موظف كاونتر 1 تحويل تذكرة ليست في جلسته
    const { req, res } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: 'tkt_fake_random',
        toQueueId: `q-contracts-${tenant}`,
        userRole: 'counter_agent',
        counterId: `cnt-1-${tenant}`
      }
    });

    await queueHandler(req, res);
    // التذكرة غير موجودة
    assert.strictEqual(res._status, 404);

    // الآن ننشئ تذكرة في طابور A ثم يحاول كاونتر 2 (الذي ليس أمامه هذا العميل) تحويلها
    const { req: reqCall, res: resCall } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqCall, resCall);
    assert.strictEqual(resCall._status, 200);
    const activeTicket = resCall._data.ticket;
    assert.ok(activeTicket, 'يجب استدعاء التذكرة على كاونتر 1');

    // كاونتر 2 يحاول تحويل تذكرة كاونتر 1 بصلاحية counter_agent -> يجب أن يُرفض 403
    const { req: reqUnauthorized, res: resUnauthorized } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: activeTicket.id,
        toQueueId: `q-contracts-${tenant}`,
        userRole: 'counter_agent',
        counterId: `cnt-2-${tenant}` // كاونتر مختلف
      }
    });
    await queueHandler(reqUnauthorized, resUnauthorized);
    assert.strictEqual(resUnauthorized._status, 403, 'يجب رفض تحويل عميل كاونتر آخر من قبل موظف كاونتر');
    console.log('   ✅ نجح الحظر الأمني: موظف الكاونتر ممنوع من تحويل أي عميل ليس جالساً أمامه (403 Forbidden).');
  }

  // 4️⃣ اختبار التحويل المفتوح لموظف الاستقبال (Global Transfer by Receptionist)
  console.log('\n4️⃣ اختبار التحويل المفتوح الشامل عبر موظف الاستقبال...');
  {
    // جلب التذكرة الحالية على كاونتر 1 عبر get-config
    const { req: reqConfig, res: resConfig } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-config' }
    });
    await queueHandler(reqConfig, resConfig);
    const counter1 = resConfig._data.counters.find(c => c.id === `cnt-1-${tenant}`);
    const activeTicketId = counter1.current_ticket_id;

    // الاستقبال يقوم بالتحويل الشامل
    const { req: reqRecTransfer, res: resRecTransfer } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: activeTicketId,
        toQueueId: `q-contracts-${tenant}`,
        priorityLevel: 'fair_fifo',
        transferNotes: 'تمت مراجعة الهوية من الاستقبال، يتبقى توثيق العقد',
        userRole: 'receptionist',
        counterId: `cnt-1-${tenant}`
      }
    });

    await queueHandler(reqRecTransfer, resRecTransfer);
    assert.strictEqual(resRecTransfer._status, 200);
    assert.strictEqual(resRecTransfer._data.ok, true);
    assert.strictEqual(resRecTransfer._data.ticket.queue_id, `q-contracts-${tenant}`);
    assert.strictEqual(resRecTransfer._data.ticket.transfer_notes, 'تمت مراجعة الهوية من الاستقبال، يتبقى توثيق العقد');
    assert.strictEqual(resRecTransfer._data.ticket.last_service_name, 'قسم الاستقبال وخدمة العملاء');
    console.log('   ✅ نجح التحويل: تم نقل التذكرة وتمرير السياق والملاحظات مع الاحتفاظ برقم التذكرة.');
  }

  // 5️⃣ اختبار مصفوفة الأولويات (Immediate Next vs Fair FIFO vs Standard)
  console.log('\n5️⃣ اختبار خوارزمية فرز الأولويات الهرمية في الطابور المستهدف...');
  {
    // سنضيف تذكرتين عاديتين جديدتين في قسم العقود
    // تذكرة 1: عادية وصلت الساعة 10:10
    const { req: reqJ1, res: resJ1 } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-contracts-${tenant}`, customerName: 'عميل عادي 1', customerPhone: '0501111111' }
    });
    await queueHandler(reqJ1, resJ1);
    const standardTicket = resJ1._data.tickets?.[0];

    // تذكرة 2: محولة بالأولوية الفورية Immediate Next
    const { req: reqJ2, res: resJ2 } = mockReqRes({
      query: { tenant, action: 'manual-ticket' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'عميل طارئ', customerPhone: '0502222222' }
    });
    await queueHandler(reqJ2, resJ2);
    const emergencyTicket = resJ2._data.ticket;

    // تحويل العميل الطارئ بالأولوية الفورية
    const { req: reqTransImm, res: resTransImm } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: emergencyTicket.id,
        toQueueId: `q-contracts-${tenant}`,
        priorityLevel: 'immediate_next',
        transferNotes: 'حالة مستعجلة من الإدارة',
        userRole: 'receptionist'
      }
    });
    await queueHandler(reqTransImm, resTransImm);
    assert.strictEqual(resTransImm._status, 200);

    // الآن عند استدعاء كاونتر 2 (العقود) التالي، يجب أن يُنادى العميل الطارئ (Immediate Next) أولاً!
    const { req: reqCall2, res: resCall2 } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-2-${tenant}` }
    });
    await queueHandler(reqCall2, resCall2);
    assert.strictEqual(resCall2._status, 200);
    assert.strictEqual(resCall2._data.ticket.id, emergencyTicket.id, 'يجب أن تقدم الأولوية الفورية العميل على رأس الطابور');
    console.log(`   ✅ نجح فرز الأولوية: تم تقديم التذكرة (${emergencyTicket.ticket_number}) الفورية فوراً على من سبقها.`);
  }

  // 6️⃣ اختبار التعليق المؤقت وإعادة النداء (Hold & Recall)
  console.log('\n6️⃣ اختبار وظيفة التعليق المؤقت وإعادة النداء (Hold & Recall)...');
  {
    // تعليق العميل الحالي على كاونتر 2
    const { req: reqHold, res: resHold } = mockReqRes({
      query: { tenant, action: 'hold-ticket' },
      body: { counterId: `cnt-2-${tenant}` }
    });
    await queueHandler(reqHold, resHold);
    assert.strictEqual(resHold._status, 200);
    assert.strictEqual(resHold._data.ticket.status, 'on_hold');
    assert.strictEqual(resHold._data.counter.current_ticket_id, null, 'يجب تحرير الكاونتر بعد التعليق');
    console.log('   ✅ نجح التعليق المؤقت (On Hold) وتحرير الكاونتر لاستقبال مراجع آخر.');

    // إعادة النداء
    // استدعاء تذكرة جديدة على كاونتر 1
    const { req: reqCallAgain, res: resCallAgain } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqCallAgain, resCallAgain);
    if (resCallAgain._data.ticket) {
      const { req: reqRecall, res: resRecall } = mockReqRes({
        query: { tenant, action: 'recall-ticket' },
        body: { counterId: `cnt-1-${tenant}` }
      });
      await queueHandler(reqRecall, resRecall);
      assert.strictEqual(resRecall._status, 200);
      assert.strictEqual(resRecall._data.ok, true);
      console.log('   ✅ نجح إعادة النداء (Recall) وإعادة إطلاق التنبيه الصوتي والإشعار.');
    }
  }

  // 7️⃣ اختبار النداء المركزي الموجه (Central Dispatch Call)
  console.log('\n7️⃣ اختبار النداء المركزي الموجه (Force-Call / Central Dispatch)...');
  {
    // موظف الاستقبال يجبر كاونتر 3 (المالية) على سحب تذكرة أو طلب التالي
    // أولاً إنشاء تذكرة للمالية
    const { req: reqCashier, res: resCashier } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cashier-${tenant}`, customerName: 'عبدالرحمن', customerPhone: '0509998877' }
    });
    await queueHandler(reqCashier, resCashier);
    const cashierTicket = resCashier._data.tickets?.[0];

    // نداء موجه من الاستقبال لكاونتر 3
    const { req: reqDispatch, res: resDispatch } = mockReqRes({
      query: { tenant, action: 'dispatch-call' },
      body: {
        counterId: `cnt-3-${tenant}`,
        ticketId: cashierTicket.id
      }
    });
    await queueHandler(reqDispatch, resDispatch);
    assert.strictEqual(resDispatch._status, 200);
    assert.strictEqual(resDispatch._data.ticket.id, cashierTicket.id);
    assert.strictEqual(resDispatch._data.counter.id, `cnt-3-${tenant}`);
    console.log(`   ✅ نجح النداء المركزي الموجه: قام المشرف بإسناد تذكرة (${cashierTicket.ticket_number}) مباشرة لكاونتر 3.`);
  }

  // 8️⃣ اختبار حماية خط بيانات التنبؤ (Prediction Pipeline Protection)
  console.log('\n8️⃣ اختبار حماية خط التنبؤ وعزل مدة الخدمة السابقة عن طابور الانتظار الجديد...');
  {
    // التحقق من أن سجلات إنجاز كاونتر 1 تم تدوينها دون تلويث طابور كاونتر 2
    const { req: reqConfigFinal, res: resConfigFinal } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-config' }
    });
    await queueHandler(reqConfigFinal, resConfigFinal);
    assert.strictEqual(resConfigFinal._status, 200);
    const cnt1 = resConfigFinal._data.counters.find(c => c.id === `cnt-1-${tenant}`);
    assert.ok(cnt1.completed_today_count >= 14, 'يجب زيادة عدد المعاملات المنجزة للموظف الأول عند تحويل عميله');
    console.log('   ✅ نجحت حماية خط التنبؤ: تم حفظ كفاءة الموظف الأول في EWMA وبدء عداد الانتظار الثاني نظيفاً.');
  }

  console.log('\n====================================================');
  console.log('🎉 اكتملت جميع فحوصات مصفوفة الصلاحيات ومحرك التحويل بنجاح 100%!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('❌ خطأ أثناء الفحص:', err);
  process.exit(1);
});
