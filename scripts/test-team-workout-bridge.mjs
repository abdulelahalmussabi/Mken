/**
 * اختبارات ربط تمارين الفريق بالمواعيد
 * node scripts/test-team-workout-bridge.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadScript(relativePath, context) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context);
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

  loadScript('js/booking-store.js', context);
  loadScript('js/team-workout-bridge.js', context);

  const bs = context.window.MkenBookingStore;
  const bridge = context.window.MkenTeamWorkoutBridge;
  assert(bs && bridge, 'modules failed to load');

  const label = bridge.buildTimingLabel('2026-06-25', '18:30');
  assert(label.indexOf('الساعة') !== -1, 'label should contain الساعة');
  assert(label.indexOf('18:30') !== -1 || label.indexOf('6:30') !== -1, 'label should contain time');

  const parsed = bridge.parseLabelToDateTime('الأحد — الساعة 06:00 مساءً');
  assert(parsed && parsed.date && parsed.time === '18:00', 'parse evening time');

  const workoutId = 'work-test-1';
  bs.upsertTeamWorkoutAppointments(workoutId, [
    {
      id: 'hockey-wk-' + workoutId + '-3333',
      activityId: 'hockey',
      serviceId: 'hockey-training',
      date: '2026-06-20',
      time: '18:00',
      customerName: 'أحمد',
      phone: '966501111111',
      locationAddress: 'ملعب الرياض',
      notes: '🏑 تمرين\n🗺️ https://maps.example.com',
      teamWorkoutId: workoutId,
      status: 'confirmed',
    },
    {
      id: 'hockey-wk-' + workoutId + '-4444',
      activityId: 'hockey',
      serviceId: 'hockey-training',
      date: '2026-06-20',
      time: '18:00',
      customerName: 'سلمان',
      phone: '966502222222',
      locationAddress: 'ملعب الرياض',
      teamWorkoutId: workoutId,
      status: 'confirmed',
    },
  ]);

  const all = bs.getAppointments();
  assert(all.length === 2, 'should create 2 appointments');
  assert(all.every((a) => a.teamWorkoutId === workoutId), 'teamWorkoutId set');
  assert(all[0].activityId === 'hockey', 'hockey activity');

  bs.upsertTeamWorkoutAppointments(workoutId, [
    {
      id: 'hockey-wk-' + workoutId + '-3333',
      activityId: 'hockey',
      serviceId: 'hockey-training',
      date: '2026-06-21',
      time: '19:00',
      customerName: 'أحمد',
      phone: '966501111111',
      locationAddress: 'ملعب الرياض',
      teamWorkoutId: workoutId,
      status: 'confirmed',
    },
  ]);
  const updated = bs.getAppointments().filter((a) => a.teamWorkoutId === workoutId);
  assert(updated.length === 1, 'upsert replaces old workout appointments');
  assert(updated[0].date === '2026-06-21', 'date updated');

  const cancelled = bs.cancelTeamWorkout(workoutId);
  const afterCancel = bs.getTeamWorkoutAppointments(workoutId).filter((a) => a.status !== 'cancelled');
  assert(afterCancel.length === 0, 'cancelTeamWorkout cancels all');

  const reminder = bs.buildReminderMessage('مكن', {
    date: '2026-06-21',
    time: '19:00',
    customerName: 'أحمد',
    phone: '966501111111',
    locationAddress: 'ملعب الرياض',
    teamWorkoutId: workoutId,
    notes: '🗺️ https://maps.example.com',
    stayBooking: false,
  }, 'تمرين جماعي', 'الهوكي', 24);
  assert(reminder.indexOf('ملعب') !== -1 || reminder.indexOf('📍') !== -1, 'reminder includes location');

  console.log('✅ اختبارات ربط تمارين الفريق نجحت');
}

try {
  run();
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
}
