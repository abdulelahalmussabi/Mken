/**
 * لوحة الإدارة — تمارين الفريق (هوكي / كرة قدم) كقسم منفصل
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  var bookingStore = window.MkenBookingStore;
  if (!store || !bookingStore) return;

  var container = document.getElementById('adminTeamWorkouts');
  var sportFilterEl = document.getElementById('teamWorkoutSportFilter');
  var whenFilterEl = document.getElementById('teamWorkoutWhenFilter');

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function extractMapUrl(notes) {
    var lines = String(notes || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('🗺️') !== -1) {
        return lines[i].replace(/^🗺️\s*/, '').trim();
      }
    }
    return '';
  }

  function groupTeamWorkouts(appointments) {
    var groups = {};
    (appointments || []).forEach(function (a) {
      if (!a.teamWorkoutId || a.status === 'cancelled') return;
      var id = a.teamWorkoutId;
      if (!groups[id]) {
        groups[id] = {
          id: id,
          activityId: a.activityId,
          serviceId: a.serviceId,
          date: a.date,
          time: a.time,
          locationName: a.locationAddress || '',
          mapUrl: extractMapUrl(a.notes),
          attendees: [],
        };
      }
      groups[id].attendees.push(a);
      if (a.locationAddress && !groups[id].locationName) {
        groups[id].locationName = a.locationAddress;
      }
      if (!groups[id].mapUrl) {
        groups[id].mapUrl = extractMapUrl(a.notes);
      }
    });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  function workoutDateTime(workout) {
    return new Date(workout.date + 'T' + (workout.time || '00:00') + ':00');
  }

  function isPastWorkout(workout) {
    return workoutDateTime(workout) < new Date();
  }

  function getActivityMeta(activityId) {
    var act = store.getResolvedActivity(activityId, store.loadConfig());
    return {
      title: act ? act.title : activityId,
      icon: act ? act.icon : '🏟️',
      shortTitle: act ? act.shortTitle : activityId,
      portalUrl: store.getActivityBookingPortalUrl(activityId, store.loadConfig()),
    };
  }

  function getServiceTitle(id) {
    var s = store.getServiceById(id);
    return s ? s.title : id;
  }

  function buildReminderUrl(apt) {
    var brandName = store.getBrand(store.loadConfig()).name;
    var actId = apt.activityId || '';
    var message = bookingStore.buildReminderMessage(
      brandName,
      apt,
      getServiceTitle(apt.serviceId),
      getActivityMeta(actId).title,
      24
    );
    return bookingStore.customerWhatsAppUrl(apt.phone, message);
  }

  function renderWorkoutCard(workout) {
    var meta = getActivityMeta(workout.activityId);
    var past = isPastWorkout(workout);
    var whenTag = past
      ? '<span class="admin-team-workout__tag admin-team-workout__tag--past">منتهٍ</span>'
      : '<span class="admin-team-workout__tag admin-team-workout__tag--upcoming">قادم</span>';

    var mapBtn = workout.mapUrl
      ? '<a href="' + esc(workout.mapUrl) + '" class="btn btn--outline btn--sm" target="_blank" rel="noopener">🗺️ الخريطة</a>'
      : '';

    var portalBtn = meta.portalUrl
      ? '<a href="' + esc(meta.portalUrl) + '" class="btn btn--outline btn--sm" target="_blank" rel="noopener">' + meta.icon + ' البوابة</a>'
      : '';

    var attendeesHtml = workout.attendees.map(function (a) {
      var waUrl = buildReminderUrl(a);
      var remindBtn = waUrl
        ? '<a href="' + esc(waUrl) + '" class="btn btn--primary btn--sm" target="_blank" rel="noopener">💬 تذكير</a>'
        : '';
      return (
        '<div class="admin-team-workout__attendee">' +
        '<span><strong>' + esc(a.customerName) + '</strong> · ' + esc(a.phone) + '</span>' +
        remindBtn +
        '</div>'
      );
    }).join('');

    return (
      '<article class="admin-team-workout' + (past ? ' admin-team-workout--past' : '') + '" data-workout-id="' + esc(workout.id) + '">' +
      '<div class="admin-team-workout__header">' +
      '<div class="admin-team-workout__title">' +
      '<span class="admin-team-workout__sport">' + meta.icon + ' ' + esc(meta.shortTitle) + '</span> ' +
      whenTag +
      '<h4>' + bookingStore.formatDateArabic(workout.date) + ' · ' + bookingStore.formatTimeArabic(workout.time) + '</h4>' +
      '<p class="admin-hint">📍 ' + esc(workout.locationName || '—') + ' · 👥 ' + workout.attendees.length + ' مشارك</p>' +
      '<p class="admin-hint">' + esc(getServiceTitle(workout.serviceId)) + '</p>' +
      '</div>' +
      '<div class="admin-team-workout__actions">' +
      mapBtn +
      portalBtn +
      '<button type="button" class="btn btn--outline btn--sm" data-remind-all="' + esc(workout.id) + '">تذكير الجميع</button>' +
      '<button type="button" class="btn btn--outline btn--sm admin-team-workout__cancel" data-cancel-workout="' + esc(workout.id) + '">إلغاء التمرين</button>' +
      '</div>' +
      '</div>' +
      '<details class="admin-team-workout__details">' +
      '<summary>المشاركون (' + workout.attendees.length + ')</summary>' +
      '<div class="admin-team-workout__attendees">' + attendeesHtml + '</div>' +
      '</details>' +
      '</article>'
    );
  }

  function render() {
    if (!container) return;

    var sportFilter = sportFilterEl ? sportFilterEl.value : 'all';
    var whenFilter = whenFilterEl ? whenFilterEl.value : 'upcoming';

    var grouped = groupTeamWorkouts(bookingStore.getAppointments());

    if (sportFilter !== 'all') {
      grouped = grouped.filter(function (w) { return w.activityId === sportFilter; });
    }

    if (whenFilter === 'upcoming') {
      grouped = grouped.filter(function (w) { return !isPastWorkout(w); });
    } else if (whenFilter === 'past') {
      grouped = grouped.filter(function (w) { return isPastWorkout(w); });
    }

    grouped.sort(function (a, b) {
      var da = workoutDateTime(a).getTime();
      var db = workoutDateTime(b).getTime();
      return whenFilter === 'past' ? db - da : da - db;
    });

    if (!grouped.length) {
      var emptyMsg = 'لا توجد تمارين جماعية';
      if (whenFilter === 'upcoming') emptyMsg += ' قادمة';
      else if (whenFilter === 'past') emptyMsg += ' سابقة';
      if (sportFilter === 'hockey') emptyMsg += ' للهوكي';
      else if (sportFilter === 'football') emptyMsg += ' لكرة القدم';
      emptyMsg += '. اعتمد تمريناً من بوابة النشاط ليظهر هنا.';
      container.innerHTML = '<p class="admin-hint">' + emptyMsg + '</p>';
      return;
    }

    container.innerHTML = grouped.map(renderWorkoutCard).join('');
    bindCardEvents();
  }

  function bindCardEvents() {
    if (!container) return;

    container.querySelectorAll('[data-cancel-workout]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cancel-workout');
        if (!id || !window.confirm('إلغاء التمرين وجميع مواعيد المشاركين في لوحة الإدارة؟')) return;
        Promise.resolve(bookingStore.cancelTeamWorkout(id)).then(function () {
          toast('تم إلغاء التمرين');
          render();
          if (window.MkenAdminBooking) window.MkenAdminBooking.refresh();
        });
      });
    });

    container.querySelectorAll('[data-remind-all]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remind-all');
        var list = bookingStore.getTeamWorkoutAppointments(id).filter(function (a) {
          return a.status === 'confirmed' || a.status === 'pending';
        });
        if (!list.length) {
          toast('لا يوجد مشاركون نشطون', 'error');
          return;
        }
        var opened = 0;
        list.forEach(function (apt) {
          var url = buildReminderUrl(apt);
          if (url) {
            window.open(url, '_blank', 'noopener');
            opened += 1;
          }
        });
        toast(opened ? 'تم فتح واتساب لـ ' + opened + ' مشارك' : 'تعذّر فتح واتساب', opened ? '' : 'error');
      });
    });
  }

  function bindFilters() {
    if (sportFilterEl) sportFilterEl.addEventListener('change', render);
    if (whenFilterEl) whenFilterEl.addEventListener('change', render);
  }

  window.MkenAdminTeamWorkouts = {
    render: render,
    refresh: render,
  };

  bindFilters();
})();
