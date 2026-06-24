/**
 * اختبارات منطق الحجز — slotDuration و maxPerSlot و deliveryMode
 * التشغيل: node scripts/test-booking-logic.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadScript(relativePath, context) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const storage = {};
  const context = {
    window: {},
    console,
    localStorage: {
      getItem(k) { return storage[k] || null; },
      setItem(k, v) { storage[k] = v; },
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
  };
  vm.createContext(context);

  loadScript('js/activities-catalog.js', context);
  loadScript('js/services-catalog.js', context);
  loadScript('js/booking-store.js', context);

  const store = context.window.MkenBookingStore;
  const catalog = context.window.MkenServicesCatalog;
  const activities = context.window.MkenActivitiesCatalog;

  assert(store, 'MkenBookingStore failed to load');
  assert(catalog, 'MkenServicesCatalog failed to load');

  const tutoring = activities.find((a) => a.id === 'tutoring');
  const fitness = activities.find((a) => a.id === 'fitness');
  const baseBooking = {
    workingHours: { start: '09:00', end: '22:00' },
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    advanceDays: 14,
    slotDuration: 60,
    maxPerSlot: 3,
  };
  const bookingTutoring = Object.assign({}, baseBooking, tutoring.booking);
  const bookingFitness = Object.assign({}, baseBooking, fitness.booking);

  const examPrep = catalog.find((s) => s.id === 'exam-prep');
  const gymDay = catalog.find((s) => s.id === 'gym-day-pass');
  const groupClass = catalog.find((s) => s.id === 'group-class');
  const personalTraining = catalog.find((s) => s.id === 'personal-training');
  const onlineTutoring = catalog.find((s) => s.id === 'online-tutoring');

  // slotDuration من الخدمة وليس النشاط فقط
  assert(store.getServiceSlotDuration(examPrep, bookingTutoring) === 90, 'exam-prep should be 90 min');
  assert(store.getServiceSlotDuration(gymDay, bookingFitness) === 480, 'gym-day-pass should be 480 min');
  assert(store.getServiceSlotDuration(groupClass, bookingFitness) === 45, 'group-class should be 45 min');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = store.formatDateISO(tomorrow);

  const slots90 = store.getSlotsForDate('exam-prep', dateStr, bookingTutoring, [], examPrep);
  assert(slots90.length > 0, 'exam-prep should have slots');
  if (slots90.length >= 2) {
    const gap = store.parseDateISO ? null : null;
    const t0 = slots90[0].split(':').map(Number);
    const t1 = slots90[1].split(':').map(Number);
    const diff = (t1[0] * 60 + t1[1]) - (t0[0] * 60 + t0[1]);
    assert(diff === 90, 'exam-prep slot gap should be 90 min, got ' + diff);
  }

  const slots45 = store.getSlotsForDate('group-class', dateStr, bookingFitness, [], groupClass);
  if (slots45.length >= 2) {
    const a = slots45[0].split(':').map(Number);
    const b = slots45[1].split(':').map(Number);
    assert((b[0] * 60 + b[1]) - (a[0] * 60 + a[1]) === 45, 'group-class slot gap should be 45 min');
  }

  // maxPerSlot — PT = 1
  assert(store.getAppointmentCapacity(personalTraining, bookingFitness) === 1, 'PT capacity should be 1');
  assert(store.getAppointmentCapacity(groupClass, bookingFitness) === 12, 'group-class capacity should be 12');

  const slot = slots45[0] || '10:00';
  const oneBooked = [{
    serviceId: 'personal-training',
    date: dateStr,
    time: slot,
    status: 'confirmed',
  }];
  const ptSlots = store.getSlotsForDate('personal-training', dateStr, bookingFitness, oneBooked, personalTraining);
  assert(!ptSlots.includes(slot), 'PT slot should be full after one booking');

  const groupSlots = store.getSlotsForDate('group-class', dateStr, bookingFitness, oneBooked.map((a) => ({
    serviceId: 'group-class', date: dateStr, time: slot, status: 'confirmed',
  })), groupClass);
  assert(groupSlots.includes(slot), 'group-class slot should still be open with one booking');

  // deliveryMode في الكتالوج
  assert(onlineTutoring.deliveryMode === 'remote', 'online-tutoring should be remote');
  assert(examPrep.deliveryMode !== 'remote', 'exam-prep should not be remote-only');

  // رسالة واتساب تتضمن طريقة الحضور
  const msg = store.buildWhatsAppMessage('مكن', {
    date: dateStr,
    time: '10:00',
    customerName: 'اختبار',
    phone: '0500000000',
    deliveryMode: 'remote',
    meetingContact: 'zoom.us/j/test',
    stayBooking: false,
  }, 'دروس عن بُعد', 'دروس');
  assert(msg.includes('عن بُعد'), 'WhatsApp message should mention remote');
  assert(msg.includes('zoom.us'), 'WhatsApp message should include meeting contact');

  console.log('✅ جميع اختبارات منطق الحجز نجحت (8 فحوصات)');
}

try {
  run();
} catch (err) {
  console.error('❌ فشل الاختبار:', err.message);
  process.exit(1);
}
