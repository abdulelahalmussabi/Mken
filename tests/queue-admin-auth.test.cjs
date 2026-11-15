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
  console.log('🧪 بدء اختبار مصادقة وتجاوز مدير النظام (Admin Queue Auth)');
  console.log('====================================================\n');

  const tenant = 'admin_auth_test_' + Date.now();

  // 1️⃣ فحص الاستلام المباشر للكاونتر بصلاحية الأدمن (Admin Hot Swap Takeover)
  console.log('1️⃣ اختبار استلام الكاونتر فوراً بصلاحية الأدمن دون الحاجة لـ PIN...');
  {
    const { req, res } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      headers: {
        'x-admin-authenticated': '1'
      },
      body: {
        counterId: `cnt-1-${tenant}`,
        isAdmin: true,
        adminName: 'مدير المنشأة التنفيذي (Admin)',
        handoverOption: 'handover_active',
        handoverNotes: 'استلام مباشر بصلاحية الإدارة'
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(res._status, 200, `Expected 200, got ${res._status}`);
    assert.strictEqual(res._data.ok, true);
    assert.strictEqual(res._data.newAgent.role, 'admin');
    assert.ok(res._data.newAgent.full_name.includes('مدير'));
    console.log(`   ✅ نجح: تم تولي الكاونتر مباشرة للأدمن (${res._data.newAgent.full_name}) دون طلب PIN موظف.`);
  }

  // 2️⃣ فحص اعتماد تسليم شاشة القيادة للأدمن (Admin Reception Handover)
  console.log('\n2️⃣ اختبار اعتماد تسليم شاشة القيادة للأدمن دون الحاجة لـ PIN موظف...');
  {
    const { req, res } = mockReqRes({
      query: { tenant, action: 'reception-handover' },
      headers: {
        'x-is-super-admin': '1'
      },
      body: {
        outgoingUserId: 'usr-rec-default',
        isAdmin: true,
        adminName: 'مدير النظام العام',
        handoverNotes: 'استلام الإشراف العام للصالة'
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(res._status, 200, `Expected 200, got ${res._status}`);
    assert.strictEqual(res._data.ok, true);
    assert.strictEqual(res._data.incomingUser.role, 'admin');
    console.log(`   ✅ نجح: تم تسليم شاشة القيادة لمدير النظام (${res._data.incomingUser.full_name}) وتجاوز رمز الدخول.`);
  }

  // 3️⃣ فحص صلاحية الأدمن في تحويل التذاكر بحرية دون قيد "العميل الحالي فقط"
  console.log('\n3️⃣ اختبار تحويل التذاكر بحرية تامة للأدمن (Unrestricted Admin Transfer)...');
  {
    // إصدار تذكرة أولاً
    const { req: reqJoin, res: resJoin } = mockReqRes({
      query: { tenant, action: 'join-queue' },
      body: { queueId: `q-cs-${tenant}`, customerName: 'عبدالله السبيعي', customerPhone: '0509998877' }
    });
    await queueHandler(reqJoin, resJoin);
    const ticketId = resJoin._data.tickets[0].id;

    // الأدمن يحول التذكرة حتى لو لم تكن قيد خدمته المباشرة
    const { req: reqTransfer, res: resTransfer } = mockReqRes({
      query: { tenant, action: 'transfer-ticket' },
      headers: {
        'x-admin-authenticated': '1'
      },
      body: {
        ticketId: ticketId,
        toQueueId: `q-contracts-${tenant}`,
        priorityLevel: 'express',
        userRole: 'admin',
        isAdmin: true
      }
    });
    await queueHandler(reqTransfer, resTransfer);
    assert.strictEqual(resTransfer._status, 200, `Expected 200, got ${resTransfer._status}`);
    assert.strictEqual(resTransfer._data.ok, true);
    console.log('   ✅ نجح: تم تحويل التذكرة بصلاحية الأدمن دون أي قيود 403.');
  }

  // 4️⃣ التأكد من استمرار حظر الرموز الخاطئة لغير الأدمن (Security Negative Test)
  console.log('\n4️⃣ التحقق الأمني: رفض الرموز الخاطئة في حال عدم وجود جلسة أدمن...');
  {
    const { req, res } = mockReqRes({
      query: { tenant, action: 'hot-swap-authenticate' },
      body: {
        counterId: `cnt-1-${tenant}`,
        incomingPin: '0000', // رمز خاطئ
        isAdmin: false
      }
    });

    await queueHandler(req, res);
    assert.strictEqual(res._status, 401, 'يجب رفض الرمز الخاطئ برمز 401');
    assert.strictEqual(res._data.error, 'رمز الدخول السريع (PIN) غير صحيح.');
    console.log('   ✅ نجح: الرمز الخاطئ لموظف عادي تم رفضه كما هو متوقع أمنياً.');
  }

  console.log('\n====================================================');
  console.log('🎉 اكتملت جميع اختبارات مصادقة الأدمن بنظام الطابور بنجاح 100%!');
  console.log('====================================================\n');
}

runTest().catch(err => {
  console.error('❌ فشل الاختبار:', err);
  process.exit(1);
});
