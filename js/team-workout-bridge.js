/**
 * ربط تمارين الفريق (هوكي / كرة قدم) بنظام المواعيد والتذكيرات
 * كل بوابة تمرّر إعداداتها الرياضية — لا خلط بين الأنشطة
 */
(function () {
  'use strict';

  var AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDateISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function buildTimingLabel(dateStr, timeStr) {
    if (!dateStr || !timeStr) return '';
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
    var tp = timeStr.split(':');
    var h = parseInt(tp[0], 10);
    var m = tp[1] || '00';
    var suffix = h < 12 ? 'صباحاً' : 'مساءً';
    var h12 = h % 12 || 12;
    return AR_DAYS[d.getDay()] + ' — الساعة ' + h12 + ':' + m + ' ' + suffix;
  }

  function parseLabelToDateTime(label) {
    if (!label) return null;
    var timeMatch = label.match(/(\d{1,2})[:\.](\d{2})/);
    if (!timeMatch) return null;

    var h = parseInt(timeMatch[1], 10);
    var m = timeMatch[2];
    if (/مساء|مساءً|pm/i.test(label) && h < 12) h += 12;
    if (/صباح|صباحاً|am/i.test(label) && h === 12) h = 0;
    var time = pad(h) + ':' + m;

    var dayPatterns = [
      { re: /أحد|الأحد/, d: 0 },
      { re: /إثنين|اثنين|الإثنين|الاثنين/, d: 1 },
      { re: /ثلاثاء|الثلاثاء/, d: 2 },
      { re: /أربعاء|الأربعاء/, d: 3 },
      { re: /خميس|الخميس/, d: 4 },
      { re: /جمعة|الجمعة/, d: 5 },
      { re: /سبت|السبت/, d: 6 },
    ];

    var targetDay = null;
    dayPatterns.forEach(function (p) {
      if (p.re.test(label)) targetDay = p.d;
    });

    var now = new Date();
    var candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, parseInt(m, 10), 0, 0);

    if (targetDay !== null) {
      var diff = (targetDay - now.getDay() + 7) % 7;
      if (diff === 0 && candidate <= now) diff = 7;
      candidate.setDate(now.getDate() + diff);
    } else if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }

    return { date: formatDateISO(candidate), time: time };
  }

  function resolveWorkoutDateTime(workout, timeOpt) {
    var date = workout.date || (timeOpt && timeOpt.date) || '';
    var time = workout.time || (timeOpt && timeOpt.time) || '';
    if (date && time) return { date: date, time: time };
    return parseLabelToDateTime(workout.dateTime || (timeOpt && timeOpt.label) || '');
  }

  function findPlayerName(players, phone, normalizePhone) {
    var digits = normalizePhone(phone);
    var found = (players || []).find(function (p) {
      return normalizePhone(p.phone) === digits;
    });
    return found ? found.name : 'لاعب';
  }

  /**
   * @param {Object} opts
   * @param {Object} opts.workout — التمرين المعتمد
   * @param {Object} [opts.timeOpt] — خيار الوقت من التصويت
   * @param {string[]} opts.voters — أرقام المصوّتين
   * @param {Object[]} opts.players — قائمة اللاعبين
   * @param {Function} opts.normalizePhone
   * @param {Object} opts.sport — { activityId, serviceId, aptIdPrefix, workoutNote }
   */
  function syncWorkoutAppointments(opts) {
    var bookingStore = window.MkenBookingStore;
    if (!bookingStore || !bookingStore.upsertTeamWorkoutAppointments) {
      return Promise.resolve({ created: 0, skipped: 'no_booking_store' });
    }

    var workout = opts.workout || {};
    var dt = resolveWorkoutDateTime(workout, opts.timeOpt);
    if (!dt) {
      return Promise.resolve({ created: 0, skipped: 'no_datetime' });
    }

    workout.date = dt.date;
    workout.time = dt.time;

    var sport = opts.sport || {};
    var voters = opts.voters || [];
    var normalizePhone = opts.normalizePhone || function (p) { return String(p || '').replace(/\D/g, ''); };
    var appointments = [];

    voters.forEach(function (phone) {
      var digits = normalizePhone(phone);
      if (!digits) return;
      appointments.push({
        id: (sport.aptIdPrefix || 'tw-') + workout.id + '-' + digits.slice(-6),
        activityId: sport.activityId || '',
        serviceId: sport.serviceId || '',
        date: dt.date,
        time: dt.time,
        customerName: findPlayerName(opts.players, digits, normalizePhone),
        phone: digits,
        locationAddress: workout.locationName || '',
        notes: (sport.workoutNote || 'تمرين جماعي معتمد') + '\n🗺️ ' + (workout.mapUrl || ''),
        teamWorkoutId: workout.id,
        status: 'confirmed',
        remindersSent: [],
        createdAt: new Date().toISOString(),
      });
    });

    return Promise.resolve(bookingStore.upsertTeamWorkoutAppointments(workout.id, appointments))
      .then(function () {
        return { created: appointments.length, date: dt.date, time: dt.time };
      });
  }

  function startReminderPoller(config, intervalMs) {
    var wa = window.MkenWhatsappAutomation;
    var bs = window.MkenBookingStore;
    if (!wa || !wa.processQueue || !bs) return null;

    intervalMs = intervalMs || 5 * 60 * 1000;
    return bs.init().then(function () {
      wa.processQueue(config || {});
      return setInterval(function () {
        wa.processQueue(config || {});
      }, intervalMs);
    });
  }

  window.MkenTeamWorkoutBridge = {
    buildTimingLabel: buildTimingLabel,
    parseLabelToDateTime: parseLabelToDateTime,
    resolveWorkoutDateTime: resolveWorkoutDateTime,
    syncWorkoutAppointments: syncWorkoutAppointments,
    startReminderPoller: startReminderPoller,
  };
})();
