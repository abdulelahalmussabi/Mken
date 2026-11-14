#!/usr/bin/env node
/**
 * منصة مكِّن — فحص مرونة العمل دون اتصال والمزامنة الخلفية (Offline PWA & Resilience Test)
 * كود المهمة: E3-OFFL-02
 * الامتثال: نظام التجارة الإلكترونية وضوابط جودة الخدمة الرقمية
 * الغرض: التحقق من تجربة العميل (أبو فهد) عند ضعف الشبكة أو انقطاعها التام
 */

const assert = require('assert');

// Simulated Local Client Storage (IndexedDB / LocalStorage replica)
class MockClientStorage {
  constructor() {
    this.store = new Map();
  }
  setItem(key, value) {
    this.store.set(key, JSON.stringify(value));
  }
  getItem(key) {
    const raw = this.store.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Resilient Booking Engine Client Simulator
class ResilientBookingClient {
  constructor(storage, networkOnline = true) {
    this.storage = storage;
    this.isOnline = networkOnline;
    this.offlineQueueKey = 'mken_offline_booking_queue';
    this.confirmedBookingsKey = 'mken_confirmed_bookings';
  }

  setNetworkState(isOnline) {
    this.isOnline = isOnline;
  }

  // Submit appointment with automatic offline fallback
  async submitBooking(appointmentData) {
    const offlineId = 'OFFLINE-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

    if (!this.isOnline) {
      // Offline fallback: Save in optimistic queue
      const queue = this.storage.getItem(this.offlineQueueKey) || [];
      const queuedItem = Object.assign({}, appointmentData, {
        temporary_id: offlineId,
        queued_at: new Date().toISOString(),
        sync_status: 'pending'
      });
      queue.push(queuedItem);
      this.storage.setItem(this.offlineQueueKey, queue);

      // Return immediate optimistic success with local reference
      return {
        status: 'queued_offline',
        reference_id: offlineId,
        message: 'تم حفظ موعدك محلياً بنجاح! سيتم التأكيد تلقائياً فور توفر الإنترنت.'
      };
    }

    // Online submission simulation
    const confirmedId = 'APT-SRV-' + Date.now();
    const confirmedList = this.storage.getItem(this.confirmedBookingsKey) || [];
    confirmedList.push({
      id: confirmedId,
      ...appointmentData,
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    });
    this.storage.setItem(this.confirmedBookingsKey, confirmedList);

    return {
      status: 'confirmed_online',
      reference_id: confirmedId,
      message: 'تم تأكيد موعدك بنجاح!'
    };
  }

  // Background Sync triggered when network returns
  async replayOfflineQueue() {
    if (!this.isOnline) {
      throw new Error('لا يمكن المزامنة أثناء انقطاع الشبكة');
    }

    const queue = this.storage.getItem(this.offlineQueueKey) || [];
    if (queue.length === 0) {
      return { syncedCount: 0 };
    }

    const confirmedList = this.storage.getItem(this.confirmedBookingsKey) || [];
    const syncedItems = [];

    for (const item of queue) {
      const serverId = 'APT-SYNC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      confirmedList.push({
        id: serverId,
        original_offline_id: item.temporary_id,
        customer_name: item.customer_name,
        phone: item.phone,
        service_id: item.service_id,
        date: item.date,
        time: item.time,
        status: 'confirmed_synced'
      });
      syncedItems.push(serverId);
    }

    // Clear offline queue and save confirmed list
    this.storage.setItem(this.confirmedBookingsKey, confirmedList);
    this.storage.setItem(this.offlineQueueKey, []);

    return {
      syncedCount: syncedItems.length,
      syncedIds: syncedItems
    };
  }
}

async function runOfflineTests() {
  console.log("================================================================================");
  console.log("  📲 فحص مرونة العمل دون اتصال وتزامن PWA (Offline & Background Sync)");
  console.log("  🛡️ تجربة المستخدم: ضمان عدم ضياع أي حجز في الميدان والشوارع");
  console.log("================================================================================\n");

  const storage = new MockClientStorage();
  const client = new ResilientBookingClient(storage, true);

  // 1. Test Online Submission
  console.log("1️⃣ اختبار الحجز المباشر أثناء توفر الإنترنت (Online Submission)...");
  const onlineBooking = await client.submitBooking({
    customer_name: "أبو فهد",
    phone: "966500000001",
    service_id: "car-wash-vip",
    date: "2026-11-14",
    time: "16:00"
  });
  assert.strictEqual(onlineBooking.status, 'confirmed_online');
  assert.ok(onlineBooking.reference_id.startsWith('APT-SRV-'));
  console.log(`   ✅ نجاح: تم تأكيد الحجز مباشرة وحفظه برقم: ${onlineBooking.reference_id}\n`);

  // 2. Simulate Network Drop (3G cut / underground / outdoor heat)
  console.log("2️⃣ محاكاة انقطاع الإنترنت التام أثناء محاولة الحجز (Network Dropout)...");
  client.setNetworkState(false);

  const offlineBooking1 = await client.submitBooking({
    customer_name: "أبو فهد",
    phone: "966500000001",
    service_id: "haircut-vip",
    date: "2026-11-14",
    time: "18:00"
  });

  const offlineBooking2 = await client.submitBooking({
    customer_name: "عميل ميداني 2",
    phone: "966500000002",
    service_id: "oil-change",
    date: "2026-11-14",
    time: "19:00"
  });

  assert.strictEqual(offlineBooking1.status, 'queued_offline');
  assert.strictEqual(offlineBooking2.status, 'queued_offline');
  assert.ok(offlineBooking1.reference_id.startsWith('OFFLINE-'));

  const pendingQueue = storage.getItem(client.offlineQueueKey);
  assert.strictEqual(pendingQueue.length, 2, "يجب أن يحتوي طابور الانتظار المحلي على طلبين");
  console.log(`   ✅ نجاح تام: لم تظهر شاشة خطأ مزعجة للعميل!`);
  console.log(`   ✅ تم توليد رقم مرجعي محلي فوري: ${offlineBooking1.reference_id}`);
  console.log(`   ✅ تم حجز الطلبين في الذاكرة المحلية (IndexedDB/Storage) بأمان.\n`);

  // 3. Simulate Network Recovery & Background Sync
  console.log("3️⃣ محاكاة عودة الاتصال وتفعيل المزامنة الخلفية (Background Replay Sync)...");
  client.setNetworkState(true);

  const syncResult = await client.replayOfflineQueue();
  assert.strictEqual(syncResult.syncedCount, 2, "يجب مزامنة كلا الطلبين المعلقين");

  const emptyQueue = storage.getItem(client.offlineQueueKey);
  assert.strictEqual(emptyQueue.length, 0, "يجب تفريغ طابور الأوفلاين بعد نجاح المزامنة");

  const totalConfirmed = storage.getItem(client.confirmedBookingsKey);
  assert.strictEqual(totalConfirmed.length, 3, "يجب أن يصبح إجمالي الحجوزات المؤكدة 3 (1 أونلاين + 2 تمت مزامنتهما)");

  console.log(`   ✅ تم ترحيل كافة الطلبات المعلقة (${syncResult.syncedCount} طلبات) إلى الخادم المركزي.`);
  console.log(`   ✅ تم تنظيف طابور الانتظار وتحديث السجلات المؤكدة دون أي فقدان للبيانات.\n`);

  console.log("================================================================================");
  console.log("🎉 تم اجتياز اختبار مرونة الحجز دون اتصال بنجاح 100%!");
  console.log("================================================================================\n");
}

runOfflineTests().catch(err => {
  console.error("❌ فشل اختبار الأوفلاين:", err);
  process.exit(1);
});
