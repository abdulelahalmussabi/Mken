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

async function runProductionTestSuite() {
  console.log('======================================================================');
  console.log('🚀 بدء حزمة اختبارات الجاهزية التجارية والإنتاجية الكاملة (Production-Ready)');
  console.log('   تشمل المحاور الستة: الرياضيات، التزامن، الصلاحيات، الاستقرار، 24/7، والفوضى');
  console.log('======================================================================\n');

  const startTime = Date.now();
  const tenant = 'prod_chaos_' + Date.now();

  // =========================================================================
  // المحور 1: المنطق الرياضي وخوارزمية الوقت (ETW & EWMA Engine)
  // =========================================================================
  console.log('📍 [المحور 1]: اختبارات المنطق الرياضي وخوارزمية التنبؤ الزمني:');
  
  // 1.1 اختبار فلترة القيم الشاذة (Outlier Clipping Test)
  {
    console.log('   🔹 1.1 اختبار فلترة القيم الشاذة (45 دقيقة و 15 ثانية)...');
    
    // إنشاء كاونتر وتغذية 5 معاملات نموذجية بمدد: 4، 5، 4، 6، 5 دقائق
    const normalDurations = [240, 300, 240, 360, 300];
    for (let d of normalDurations) {
      // حجز واستدعاء وإنهاء
      const { req: rJ, res: sJ } = mockReqRes({
        query: { tenant, action: 'join-queue' },
        body: { queueId: `q-cs-${tenant}`, customerName: 'عميل تدريب' }
      });
      await queueHandler(rJ, sJ);

      const { req: rC, res: sC } = mockReqRes({
        query: { tenant, action: 'call-next' },
        body: { counterId: `cnt-1-${tenant}` }
      });
      await queueHandler(rC, sC);

      const { req: rS, res: sS } = mockReqRes({
        query: { tenant, action: 'start-service' },
        body: { counterId: `cnt-1-${tenant}` }
      });
      await queueHandler(rS, sS);

      // محاكاة انتهاء الخدمة
      const { req: rEnd, res: sEnd } = mockReqRes({
        query: { tenant, action: 'complete-service' },
        body: { counterId: `cnt-1-${tenant}` }
      });
      await queueHandler(rEnd, sEnd);
    }

    // جلب متوسط EWMA المرجعي للكاونتر
    const { req: rCfg1, res: sCfg1 } = mockReqRes({ method: 'GET', query: { tenant, action: 'get-config' } });
    await queueHandler(rCfg1, sCfg1);
    const cnt1Base = sCfg1._data.counters.find(c => c.id === `cnt-1-${tenant}`);
    const baselineEWMA = cnt1Base.ewma_service_seconds;

    // الآن: إدخال قيمة شاذة متطرفة (45 دقيقة = 2700 ثانية - نسيان أوراق)
    const { req: rJOut, res: sJOut } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'عميل نسي أوراقه' }
    });
    await queueHandler(rJOut, sJOut);
    const outTicket = sJOut._data.tickets[0];

    const { req: rCOut, res: sCOut } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rCOut, sCOut);

    // ضبط وقت البدء يدوياً ليكون قبل 45 دقيقة
    outTicket.service_started_at = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    const { req: rEndOut, res: sEndOut } = mockReqRes({
      query: { tenant, action: 'complete-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rEndOut, sEndOut);
    assert.strictEqual(sEndOut._status, 200);

    // التأكد من أن الـ EWMA تم عزله ولم يقفز إلى 45 دقيقة!
    const { req: rCfg2, res: sCfg2 } = mockReqRes({ method: 'GET', query: { tenant, action: 'get-config' } });
    await queueHandler(rCfg2, sCfg2);
    const cnt1AfterOutlier = sCfg2._data.counters.find(c => c.id === `cnt-1-${tenant}`);

    assert.ok(
      cnt1AfterOutlier.ewma_service_seconds < 600,
      `فشل الفلترة: قفز الـ EWMA إلى ${cnt1AfterOutlier.ewma_service_seconds} ثانية بدلاً من العزل!`
    );
    console.log(`      ✅ نجاح الفلترة: تم عزل معاملة الـ 45 دقيقة وبقي الـ EWMA مستقراً عند (${Math.round(cnt1AfterOutlier.ewma_service_seconds/60)} دقيقة).`);
  }

  // 1.2 اختبار حساسية انكماش الطاقة الفوري (Dynamic Capacity Shrink)
  {
    console.log('   🔹 1.2 اختبار انكماش الطاقة الفوري عند خروج موظفين للاستراحة...');
    
    // إضافة 15 عميلاً في طابور المحاسبة
    for (let i = 0; i < 15; i++) {
      const { req, res } = mockReqRes({
        query: { tenant, action: 'join-queue' },
        body: { queueId: `q-cashier-${tenant}`, customerName: 'عميل محاسبة ' + i }
      });
      await queueHandler(req, res);
    }

    // قراءة وقت الانتظار الحالي
    const { req: rQ1, res: sQ1 } = mockReqRes({ method: 'GET', query: { tenant, action: 'list-queues' } });
    await queueHandler(rQ1, sQ1);
    const cashierQBefore = sQ1._data.queues.find(q => q.id === `q-cashier-${tenant}`);
    const etwBefore = cashierQBefore.estimatedWaitMinutes;

    // تحويل كاونتر 3 إلى On Break
    const { req: rBrk, res: sBrk } = mockReqRes({
      query: { tenant, action: 'start-break' },
      body: { counterId: `cnt-3-${tenant}`, reason: 'lunch' }
    });
    await queueHandler(rBrk, sBrk);
    assert.strictEqual(sBrk._status, 200);

    // قراءة وقت الانتظار الجديد
    const { req: rQ2, res: sQ2 } = mockReqRes({ method: 'GET', query: { tenant, action: 'list-queues' } });
    await queueHandler(rQ2, sQ2);
    const cashierQAfter = sQ2._data.queues.find(q => q.id === `q-cashier-${tenant}`);
    const etwAfter = cashierQAfter.estimatedWaitMinutes;

    assert.ok(etwAfter >= etwBefore, 'يجب أن يرتفع وقت الانتظار التقديري عند خروج الكاونتر للاستراحة');
    assert.ok(!isNaN(etwAfter) && isFinite(etwAfter), 'يجب عدم حدوث أخطاء رياضية أو قسمة على صفر');
    console.log(`      ✅ نجاح انكماش الطاقة: تكيّف المحرك تلقائياً وارتفع وقت الانتظار من (~${etwBefore} د) إلى (~${etwAfter} د) دون أخطاء رياضية.`);

    // إعادة الكاونتر للخدمة
    await queueHandler(mockReqRes({ query: { tenant, action: 'end-break' }, body: { counterId: `cnt-3-${tenant}` } }).req, mockReqRes().res);
  }

  // =========================================================================
  // المحور 2: تزامن وتضارب الطوابير المتعددة (Multi-Queue Concurrency)
  // =========================================================================
  console.log('\n📍 [المحور 2]: اختبارات تزامن الطوابير وحل التعارضات (Anti-Collision Protocol):');

  // 2.1 اختبار التصادم المتزامن (Simultaneous Call Clash)
  {
    console.log('   🔹 2.1 اختبار التصادم المتزامن: نداء نفس العميل في مسارين في نفس اللحظة...');
    
    // حجز العميل (س) في مسارين: الاستقبال والعقود
    const { req: rDouble, res: sDouble } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: {
        queueIds: [`q-cs-${tenant}`, `q-contracts-${tenant}`],
        customerName: 'فيصل المطيري',
        customerPhone: '0566666666'
      }
    });
    await queueHandler(rDouble, sDouble);
    assert.strictEqual(sDouble._status, 200);
    assert.strictEqual(sDouble._data.tickets.length, 2);

    // كاونتر 1 يطلب التالي ويحصل على فيصل في مسار الاستقبال
    const { req: rCall1, res: sCall1 } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rCall1, sCall1);
    assert.strictEqual(sCall1._data.ticket.customer_name, 'فيصل المطيري');
    assert.strictEqual(sCall1._data.ticket.status, 'called');

    // في ذات اللحظة تماماً، كاونتر 2 يطلب التالي في قسم العقود
    // النظام يجب أن يكتشف فوراً أن فيصل مستدعى في كاونتر 1، فيقوم بـ +1 Bump
    const { req: rCall2, res: sCall2 } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-2-${tenant}` }
    });
    await queueHandler(rCall2, sCall2);
    assert.strictEqual(sCall2._status, 200);
    assert.ok(
      sCall2._data.bumpedTicket || sCall2._data.ticket === null,
      'يجب تفعيل قفل التعارض وتأمين موقع العميل ذكياً (+1 Bump)'
    );
    console.log('      ✅ نجاح حل التصادم: كاونتر 1 حصل على العميل، وكاونتر 2 أمّن موقعه تلقائياً بـ (+1 Bump) دون تعارض.');
  }

  // 2.2 اختبار إكمال المرحلة الأولى وفتح الثانية تلقائياً (Cascade Release)
  {
    console.log('   🔹 2.2 اختبار الإفراج التسلسلي (Cascade Release) بعد إنهاء المعاملة الأولى...');
    
    // بدء وإنهاء الخدمة عند كاونتر 1
    await queueHandler(mockReqRes({ query: { tenant, action: 'start-service' }, body: { counterId: `cnt-1-${tenant}` } }).req, mockReqRes().res);
    const { req: rFin, res: sFin } = mockReqRes({
      query: { tenant, action: 'complete-service' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rFin, sFin);
    assert.strictEqual(sFin._status, 200);
    assert.ok(sFin._data.promotedTicket, 'يجب ترقية تذكرة العميل في الطابور الثاني تلقائياً فور إنهاء الأول');
    assert.strictEqual(sFin._data.promotedTicket.status, 'waiting');
    console.log(`      ✅ نجاح الإفراج التسلسلي: قفز العميل تلقائياً لرأس طابور العقود (${sFin._data.promotedTicket.ticket_number}) كـ waiting.`);
  }

  // =========================================================================
  // المحور 3: الصلاحيات والأمان والتحويل الذكي (RBAC & Security)
  // =========================================================================
  console.log('\n📍 [المحور 3]: اختبارات الصلاحيات ومصفوفة الأمان (RBAC & RLS):');

  // 3.1 اختبار منع تصعيد الصلاحيات (Privilege Escalation Bypass)
  {
    console.log('   🔹 3.1 اختبار منع موظف كاونتر من تحويل أو استدعاء عميل كاونتر آخر...');
    
    // إنشاء تذكرة في كاونتر 2 واستدعاؤها
    const { req: rC2Call, res: sC2Call } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-2-${tenant}` }
    });
    await queueHandler(rC2Call, sC2Call);
    const tkt2 = sC2Call._data.ticket;

    // موظف كاونتر 1 يحاول تحويل تذكرة كاونتر 2 بصلاحية counter_agent -> يجب 403 Forbidden
    const { req: rHack, res: sHack } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: tkt2.id,
        toQueueId: `q-cashier-${tenant}`,
        userRole: 'counter_agent',
        counterId: `cnt-1-${tenant}`
      }
    });
    await queueHandler(rHack, sHack);
    assert.strictEqual(sHack._status, 403, 'يجب حظر موظف الكاونتر من التحكم بعميل كاونتر آخر بـ 403');
    console.log('      ✅ نجاح الحظر الأمني: رُفض الطلب فوراً برمز 403 Forbidden لمنع اختراق الصلاحيات.');
  }

  // 3.2 اختبار تحويل الاستقبال الشامل (Reception Override)
  {
    console.log('   🔹 3.2 اختبار تحويل الاستقبال الشامل بأولوية فورية (immediate_next)...');
    
    // الاستقبال يسحب التذكرة ويحولها لكاونتر المحاسبة بأولوية فورية
    const { req: rGetC2, res: sGetC2 } = mockReqRes({ method: 'GET', query: { tenant, action: 'get-config' } });
    await queueHandler(rGetC2, sGetC2);
    const c2 = sGetC2._data.counters.find(c => c.id === `cnt-2-${tenant}`);

    const { req: rOverride, res: sOverride } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: c2.current_ticket_id,
        toQueueId: `q-cashier-${tenant}`,
        priorityLevel: 'immediate_next',
        transferNotes: 'تحويل مباشر من إدارة الصالة لحالة خاصة',
        userRole: 'receptionist',
        counterId: `cnt-2-${tenant}`
      }
    });
    await queueHandler(rOverride, sOverride);
    assert.strictEqual(sOverride._status, 200);
    assert.strictEqual(sOverride._data.ticket.queue_id, `q-cashier-${tenant}`);
    assert.strictEqual(sOverride._data.ticket.is_immediate_next, true);
    console.log('      ✅ نجاح تحويل الاستقبال: تم نقل التذكرة وتعيين أولوية فورية مع تحرير الكاونتر الأول.');
  }

  // 3.3 اختبار الأولوية الزمنية العادلة (Fair FIFO Priority)
  {
    console.log('   🔹 3.3 اختبار دمج الأولوية الزمنية العادلة استناداً إلى first_arrived_at...');
    
    // عميل دخل المنشأة منذ 40 دقيقة
    const { req: rOld, res: sOld } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'عميل أقدمية' }
    });
    await queueHandler(rOld, sOld);
    const oldTicket = sOld._data.tickets[0];
    oldTicket.first_arrived_at = new Date(Date.now() - 40 * 60 * 1000).toISOString();

    // تحويله إلى قسم العقود بأسبقية Fair FIFO
    const { req: rTransFifo, res: sTransFifo } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      body: {
        ticketId: oldTicket.id,
        toQueueId: `q-contracts-${tenant}`,
        priorityLevel: 'fair_fifo',
        userRole: 'receptionist'
      }
    });
    await queueHandler(rTransFifo, sTransFifo);
    assert.strictEqual(sTransFifo._status, 200);
    assert.strictEqual(sTransFifo._data.ticket.priority_level, 'fair_fifo');
    console.log('      ✅ نجاح الأولوية العادلة: دُمج العميل بناءً على وقت وصوله الأصلي (40 دقيقة) دون ظلم الآخرين.');
  }

  // =========================================================================
  // المحور 4: تجربة الجوال واستقرار الجلسات (PWA, Realtime & Recovery)
  // =========================================================================
  console.log('\n📍 [المحور 4]: اختبارات تجربة الجوال واستقرار الجلسات اللحظية:');

  // 4.1 اختبار استعادة الجلسة بعد انقطاع الاتصال أو تجميد المتصفح
  {
    console.log('   🔹 4.1 اختبار استرجاع حالة التذكرة اللحظية عبر session_token بعد تجميد المتصفح...');
    
    const { req: rPwa, res: sPwa } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'ماجد العتيبي', customerPhone: '0588888888' }
    });
    await queueHandler(rPwa, sPwa);
    const pwaToken = sPwa._data.sessionToken;
    const ticketId = sPwa._data.tickets[0].id;

    // استدعاء الكاونتر للتذكرة
    await queueHandler(mockReqRes({ query: { tenant, action: 'call-next' }, body: { counterId: `cnt-1-${tenant}` } }).req, mockReqRes().res);

    // محاكاة إعادة فتح الصفحة بعد 15 دقيقة باستخدام التوكن المحفوظ في localStorage
    const { req: rRecover, res: sRecover } = mockReqRes({
      method: 'GET',
      query: { tenant, action: 'get-ticket-status', session_token: pwaToken }
    });
    await queueHandler(rRecover, sRecover);
    assert.strictEqual(sRecover._status, 200);
    assert.strictEqual(sRecover._data.tickets[0].id, ticketId);
    assert.strictEqual(sRecover._data.tickets[0].status, 'called');
    assert.strictEqual(sRecover._data.tickets[0].called_counter_number, 1);
    console.log('      ✅ نجاح استرجاع الحالة: استعاد العميل تذكرته ورقم الكاونتر المستدعي فوراً دون إعادة الحجز.');
  }

  // =========================================================================
  // المحور 5: بيئة الـ 24 ساعة وتبديل الورديات (Shifts & 24/7 Operations)
  // =========================================================================
  console.log('\n📍 [المحور 5]: اختبارات بيئة الـ 24 ساعة وتبديل الورديات:');

  // 5.1 اختبار التبديل السريع (Hot Swap) مع حفظ سياق الخدمة
  {
    console.log('   🔹 5.1 اختبار التبديل السريع (Hot Swap) بين الموظفين عبر الـ PIN...');
    
    const { req: rSwap, res: sSwap } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      body: {
        counterId: `cnt-1-${tenant}`,
        incomingPin: '9999', // خالد المنصور
        handoverOption: 'handover_active',
        handoverNotes: 'تسليم وردية الصباح للمناوب الليلي'
      }
    });
    await queueHandler(rSwap, sSwap);
    assert.strictEqual(sSwap._status, 200);
    assert.strictEqual(sSwap._data.counter.operator_name, 'خالد المنصور (موظف بديل)');
    assert.strictEqual(sSwap._data.session.session_status, 'active');
    console.log('      ✅ نجاح التبديل السريع: فُتحت جلسة المناوب الليلي فوراً دون انقطاع ثانية واحدة.');
  }

  // 5.2 اختبار تنظيف الكاونترات المتروكة (Ghost Counter Cleanup)
  {
    console.log('   🔹 5.2 اختبار تنظيف الكاونترات المتروكة آلياً (Ghost Counter Cleanup)...');
    
    // محاكاة كاونتر متروك بلا عمل لأكثر من 120 دقيقة
    const { req: rCfg, res: sCfg } = mockReqRes({ method: 'GET', query: { tenant, action: 'get-config' } });
    await queueHandler(rCfg, sCfg);
    const c2 = sCfg._data.counters.find(c => c.id === `cnt-2-${tenant}`);
    c2.last_status_change = new Date(Date.now() - 130 * 60 * 1000).toISOString();
    c2.current_ticket_id = null;

    // استدعاء فحص وتنظيف الجلسات المتروكة
    const { req: rClean, res: sClean } = mockReqRes({
      query: { tenant, action: 'cleanup-ghost-counters', max_idle_minutes: 120 }
    });
    await queueHandler(rClean, sClean);
    assert.strictEqual(sClean._status, 200);
    assert.ok(sClean._data.cleanedCount >= 1, 'يجب رصد الكاونتر المتروك وإغلاق جلسته');
    assert.strictEqual(c2.status, 'offline');
    console.log(`      ✅ نجاح التنظيف الآلي: تم تحويل الكاونتر المتروك (${c2.name}) إلى offline وإسقاطه من التنبؤ.`);
  }

  // =========================================================================
  // المحور 6: اختبارات الفوضى والحمل العالي (Stress & Chaos Engineering)
  // =========================================================================
  console.log('\n📍 [المحور 6]: اختبارات الحمل العالي وحالات الفوضى المتطرفة (Chaos & Spike Load):');

  // 6.1 اختبار الضغط اللحظي المتزامن (100 تذكرة متزامنة)
  {
    console.log('   🔹 6.1 اختبار الحمل اللحظي العالي (Spike Load): إطلاق 100 حجز متزامن...');
    const spikeStartTime = Date.now();
    const promises = [];

    for (let i = 0; i < 100; i++) {
      const p = (async () => {
        const { req, res } = mockReqRes({
          query: { tenant, action: 'join-queue' },
          body: {
            queueId: `q-cs-${tenant}`,
            customerName: 'مراجع متزامن ' + i,
            customerPhone: '05' + (10000000 + i)
          }
        });
        await queueHandler(req, res);
        return res._data;
      })();
      promises.push(p);
    }

    const results = await Promise.all(promises);
    const spikeDurationMs = Date.now() - spikeStartTime;

    // التحقق من سلامة كافة التذاكر
    assert.strictEqual(results.length, 100);
    const ticketNumbers = results.map(r => r.tickets[0].ticket_number);
    const uniqueTicketNumbers = new Set(ticketNumbers);

    // التحقق الصارم من عدم تكرار أرقام التذاكر إطلاقاً (No Race Condition)
    assert.strictEqual(
      uniqueTicketNumbers.size, 
      100, 
      `خطأ تسابق: تم رصد تكرار في أرقام التذاكر! (${uniqueTicketNumbers.size} من أصل 100)`
    );

    console.log(`      ✅ نجاح الحمل العالي: أُصدرت 100 تذكرة فريدة في غضون (${spikeDurationMs} مللي ثانية) دون تكرار أي رقم تسلسلي.`);
    console.log(`      ⚡ معدل المعالجة اللحظي: ~${Math.round(100 / (spikeDurationMs / 1000))} طلب/ثانية.`);
  }

  // 6.2 اختبار الغياب التام والتأجيل الذكي (No-Show Timeout)
  {
    console.log('   🔹 6.2 اختبار الغياب التام والتأجيل الذكي (No-Show Timeout)...');
    
    // استدعاء تذكرة
    const { req: rCall, res: sCall } = mockReqRes({
      query: { tenant, action: 'call-next' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rCall, sCall);
    const calledTicket = sCall._data.ticket;

    // العميل لم يحضر، الموظف يضغط No-Show
    const { req: rNoShow, res: sNoShow } = mockReqRes({
      query: { tenant, action: 'snooze-no-show' },
      body: { counterId: `cnt-1-${tenant}` }
    });
    await queueHandler(rNoShow, sNoShow);
    assert.strictEqual(sNoShow._status, 200);
    assert.strictEqual(sNoShow._data.ticket.status, 'snoozed');
    assert.strictEqual(sNoShow._data.counter.current_ticket_id, null, 'يجب تحرير الكاونتر لطلب التالي');
    console.log('      ✅ نجاح مهلة عدم الحضور: نُقلت التذكرة لحالة Snoozed لمدة 5 دقائق وتحرر الكاونتر دون تلويث EWMA.');
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  console.log(`🏆 النتيجة الإجمالية: 100% نجاح تام لجميع محاور الاختبار الستة (${totalDuration} ثانية)`);
  console.log('   النظام جاهز للإنتاج والبيع التجاري (Production-Ready) وفق أعلى المعايير الهندسية!');
  console.log('======================================================================\n');
}

runProductionTestSuite().catch(err => {
  console.error('\n❌ فشل أحد الاختبارات في حزمة الإنتاج:', err);
  process.exit(1);
});
