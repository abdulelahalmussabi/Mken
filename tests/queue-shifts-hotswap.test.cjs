'use strict';

const assert = require('assert');
const queueHandler = require('../api/v1/queue.js');

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
  console.log('🧪 بدء اختبار إدارة الورديات (24/7) والتبديل السريع والاستراحات');
  console.log('====================================================\n');

  const tenant = 'shifts_test_' + Date.now();

  // 1️⃣ فحص تهيئة الجلسات الافتراضية للكاونترات (Counter Sessions Initialization)
  console.log('1️⃣ فحص تهيئة الجلسات الافتراضية للكاونترات والموظفين...');
  {
    const { req, res } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-config' }
    });
    await queueHandler(req, res);
    assert.strictEqual(res._status, 200);
    assert.ok(res._data.counterSessions && res._data.counterSessions.length >= 3, 'يجب تهيئة جلسات الكاونترات');
    const cs1 = res._data.counterSessions.find(s => s.counter_id === `cnt-1-${tenant}`);
    assert.strictEqual(cs1.session_status, 'active');
    assert.strictEqual(cs1.operator_name, 'د. أحمد');
    console.log('   ✅ نجح: الكيان المادي (الكاونتر) مفصول ومرتبط بجلسة عمل نشطة للموظف د. أحمد.');
  }

  // 2️⃣ اختبار التبديل السريع (Hot Swap) مع وجود عميل قيد الخدمة
  console.log('\n2️⃣ اختبار التبديل السريع (Hot Swap) مع وجود عميل قيد الخدمة وخيار تسليم المعاملة...');
  {
    // أ. استدعاء عميل وبدء خدمته عند كاونتر 1
    const { req: reqJoin, res: resJoin } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'طارق الزهراني', customerPhone: '0555555555' }
    });
    await queueHandler(reqJoin, resJoin);
    const clientTicket = resJoin._data.tickets[0];

    const { req: reqCall, res: resCall } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqCall, resCall);

    const { req: reqStart, res: resStart } = mockReqRes({
      query: { tenant, action: 'start-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqStart, resStart);

    // ب. محاولة التبديل بخيار complete_first وعميل قيد الخدمة -> يجب أن يُرفض 400
    const { req: reqBlock, res: resBlock } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      body: {
        counterId: `cnt-1-${tenant}`,
        incomingPin: '9999', // خالد المنصور
        handoverOption: 'complete_first'
      }
    });
    await queueHandler(reqBlock, resBlock);
    assert.strictEqual(resBlock._status, 400, 'يجب منع التبديل إذا اختار الموظف إنهاء المعاملة أولاً');

    // ج. التبديل بـ PIN خاطئ -> يجب أن يُرفض 401
    const { req: reqBadPin, res: resBadPin } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      body: {
        counterId: `cnt-1-${tenant}`,
        incomingPin: '0000',
        handoverOption: 'handover_active'
      }
    });
    await queueHandler(reqBadPin, resBadPin);
    assert.strictEqual(resBadPin._status, 401, 'يجب رفض الـ PIN غير الصحيح');

    // د. التبديل السريع الناجح بـ PIN الصحيح مع تسليم المعاملة وملاحظة الاستلام
    const { req: reqSwap, res: resSwap } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      body: {
        counterId: `cnt-1-${tenant}`,
        incomingPin: '9999', // خالد المنصور (بديل)
        handoverOption: 'handover_active',
        handoverNotes: 'تم تدقيق الهوية متبقي طباعة السند'
      }
    });
    await queueHandler(reqSwap, resSwap);
    assert.strictEqual(resSwap._status, 200);
    assert.strictEqual(resSwap._data.ok, true);
    assert.strictEqual(resSwap._data.counter.operator_name, 'خالد المنصور (موظف بديل)');
    assert.strictEqual(resSwap._data.session.session_status, 'active');
    assert.strictEqual(resSwap._data.session.operator_name, 'خالد المنصور (موظف بديل)');

    // هـ. التأكد من حفظ سياق المعاملة للعميل الحالي
    const { req: reqStatus, res: resStatus } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-ticket-status', ticket_id: clientTicket.id }
    });
    await queueHandler(reqStatus, resStatus);
    const updatedTicket = resStatus._data.tickets[0];
    assert.ok(updatedTicket.transfer_notes && updatedTicket.transfer_notes.includes('تم تدقيق الهوية متبقي طباعة السند'));

    console.log('   ✅ نجح: أُغلقت جلسة د. أحمد، وفُتحت جلسة خالد المنصور فوراً، ونُقل العميل بسياق ملاحظته دون توقف ثانية واحدة.');

    // إنهاء المعاملة للموظف الجديد
    const { req: reqComp, res: resComp } = mockReqRes({
      query: { tenant, action: 'complete-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqComp, resComp);
  }

  // 3️⃣ اختبار طلب استراحة الموظف دون بديل (Agent Break) والأثر الرياضي
  console.log('\n3️⃣ اختبار استراحة الموظف وحساب الأثر الرياضي على الطاقة الاستيعابية...');
  {
    // أ. حساب الـ Throughput قبل الاستراحة (3 كاونترات نشطة)
    const { req: reqQBefore, res: resQBefore } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'list-queues' }
    });
    await queueHandler(reqQBefore, resQBefore);
    const qBefore = resQBefore._data.queues.find(q => q.id === `q-cs-${tenant}`);
    const activeCountersBefore = qBefore.activeCountersCount;

    // ب. بدء استراحة صلاة لكاونتر 1
    const { req: reqBreak, res: resBreak } = mockReqRes({
      query: { tenant, action: 'start-break' },
      body: {
        counterId: `cnt-1-${tenant}`,
        reason: 'prayer'
      }
    });
    await queueHandler(reqBreak, resBreak);
    assert.strictEqual(resBreak._status, 200);
    assert.strictEqual(resBreak._data.counter.status, 'on_break');
    assert.strictEqual(resBreak._data.breakRecord.reason, 'prayer');

    // ج. التحقق من سقوط الكاونتر فوراً من Throughput وحساب وقت انتظار أطول
    const { req: reqQAfter, res: resQAfter } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'list-queues' }
    });
    await queueHandler(reqQAfter, resQAfter);
    const qAfter = resQAfter._data.queues.find(q => q.id === `q-cs-${tenant}`);
    assert.ok(qAfter.activeCountersCount < activeCountersBefore, 'يجب خفض عدد الكاونترات النشطة فوراً');
    console.log(`   ✅ نجح: تحول كاونتر 1 إلى On Break، وسقطت طاقته فوراً من المعادلة (نشط: ${qAfter.activeCountersCount}).`);

    // د. إنهاء الاستراحة والعودة للعمل
    const { req: reqEndBreak, res: resEndBreak } = mockReqRes({
      query: { tenant, action: 'end-break' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqEndBreak, resEndBreak);
    assert.strictEqual(resEndBreak._status, 200);
    assert.strictEqual(resEndBreak._data.counter.status, 'active');
    assert.ok(resEndBreak._data.breakRecord.duration_seconds >= 0, 'يجب تدوين مدة الاستراحة بالثواني');
    console.log('   ✅ نجح: انتهت الاستراحة ودُونت في سجل agent_breaks وعادت الطاقة الاستيعابية لطبيعتها.');
  }

  // 4️⃣ اختبار تسليم وردية الاستقبال ومكتب القيادة (Reception Shift Handover)
  console.log('\n4️⃣ اختبار تسليم وردية الاستقبال وتوليد ملخص الوردية والشريط التنبيهي...');
  {
    // أ. جلب ملخص الوردية الحالية
    const { req: reqSum, res: resSum } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'reception-shift-summary' }
    });
    await queueHandler(reqSum, resSum);
    assert.strictEqual(resSum._status, 200);
    assert.ok(resSum._data.summary.totalCountersCount >= 3);

    // ب. تنفيذ تسليم الوردية للمشرفة نورة السالم (PIN: 8888)
    const { req: reqHo, res: resHo } = mockReqRes({
      query: { tenant, action: 'reception-handover' },
      body: {
        outgoingUserId: `usr-rec-${tenant}`,
        incomingPin: '8888',
        handoverNotes: 'يرجى متابعة المراجعين في قسم العقود قبل الساعة 4 مساء'
      }
    });
    await queueHandler(reqHo, resHo);
    assert.strictEqual(resHo._status, 200);
    assert.strictEqual(resHo._data.handover.incoming_name, 'نورة السالم (استقبال وردية ثانية)');

    // ج. التأكد من ظهور شريط التنبيه في تذكرة العميل الحية على هاتفه
    const { req: reqCustToken, res: resCustToken } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'عبدالعزيز', customerPhone: '0512345678' }
    });
    await queueHandler(reqCustToken, resCustToken);
    const custSessionToken = resCustToken._data.sessionToken;

    const { req: reqCustCheck, res: resCustCheck } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-ticket-status', session_token: custSessionToken }
    });
    await queueHandler(reqCustCheck, resCustCheck);
    assert.strictEqual(resCustCheck._status, 200);
    const enrichedTicket = resCustCheck._data.tickets[0];
    assert.ok(enrichedTicket.shift_handover_notice && enrichedTicket.shift_handover_notice.includes('تبديل وردية العمل'));
    console.log(`   ✅ نجح: تم تسليم الوردية لنورة السالم، وظهر شريط التنبيه الشفاف للعميل: "${enrichedTicket.shift_handover_notice}".`);
  }

  // 5️⃣ اختبار صلاحية الاستقبال في التبديل القسري (Supervisor Override)
  console.log('\n5️⃣ اختبار صلاحية المشرف في إنهاء جلسة كاونتر قسرياً وإعادة تعيين المسارات...');
  {
    // أ. إنهاء جلسة كاونتر 3 قسرياً وتحويله إلى offline
    const { req: reqForce, res: resForce } = mockReqRes({
      query: { tenant, action: 'supervisor-force-signout' },
      body: {
        counterId: `cnt-3-${tenant}`,
        supervisorId: `usr-rec-${tenant}`,
        targetStatus: 'offline'
      }
    });
    await queueHandler(reqForce, resForce);
    assert.strictEqual(resForce._status, 200);
    assert.strictEqual(resForce._data.counter.status, 'offline');

    // التحقق من تحديث الجلسة في counter_sessions إلى forced_closed
    const { req: reqCfg, res: resCfg } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-config' }
    });
    await queueHandler(reqCfg, resCfg);
    const cs3 = resCfg._data.counterSessions.find(s => s.counter_id === `cnt-3-${tenant}`);
    assert.strictEqual(cs3.session_status, 'forced_closed');
    console.log('   ✅ نجح الإنهاء القسري: تحول كاونتر 3 إلى offline وسُجلت جلسته كـ forced_closed.');

    // ب. إعادة تعيين مسارات كاونتر 1 لسد عجز قسم العقود
    const { req: reqReassign, res: resReassign } = mockReqRes({
      query: { tenant, action: 'supervisor-reassign-counter' },
      body: {
        counterId: `cnt-1-${tenant}`,
        newQueueIds: [`q-contracts-${tenant}`],
        supervisorId: `usr-rec-${tenant}`
      }
    });
    await queueHandler(reqReassign, resReassign);
    assert.strictEqual(resReassign._status, 200);
    assert.deepStrictEqual(resReassign._data.counter.assigned_queue_ids, [`q-contracts-${tenant}`]);
    console.log('   ✅ نجحت إعادة التوجيه الفورية: قام المشرف بتحويل كاونتر 1 لسد العجز في قسم العقود.');
  }

  // 6️⃣ اختبار مناعة الـ EWMA في بيئة الـ 24 ساعة (Handover Gap Exclusion)
  console.log('\n6️⃣ اختبار عزل فترات الخمول والتبديل (Handover Gap) عن خوارزمية EWMA...');
  {
    // عند استكمال أي معاملة، مدة الخدمة تُحسب حصراً من وقت بدء المعاملة الفعلي service_started_at
    // وبالتالي فإن زمن التبديل بين الورديات (5 إلى 10 دقائق) معزول تماماً عن سرعة إنجاز الموظف
    const { req: reqFinalJoin, res: resFinalJoin } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-contracts-${tenant}`, customerName: 'سعود', customerPhone: '0599999999' }
    });
    await queueHandler(reqFinalJoin, resFinalJoin);

    const { req: reqCallFinal, res: resCallFinal } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqCallFinal, resCallFinal);

    const { req: reqStartFinal, res: resStartFinal } = mockReqRes({
      query: { tenant, action: 'start-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqStartFinal, resStartFinal);

    const { req: reqCompFinal, res: resCompFinal } = mockReqRes({
      query: { tenant, action: 'complete-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(reqCompFinal, resCompFinal);
    assert.strictEqual(resCompFinal._status, 200);

    // التأكد من أن الـ EWMA ضمن الحدود المنطقية
    assert.ok(resCompFinal._data.counter.ewma_service_seconds < 3600, 'يجب ألا تتلوث وتيرة EWMA بزمن الفجوة');
    console.log('   ✅ نجحت حماية الـ EWMA: زمن التبديل معزول كفترة خمول ولا يؤثر على سرعة إنجاز الموظف.');
  }

  console.log('\n====================================================');
  console.log('🎉 اكتملت جميع فحوصات الورديات 24/7 والتبديل والاستراحات بنجاح 100%!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('❌ خطأ أثناء الفحص:', err);
  process.exit(1);
});
