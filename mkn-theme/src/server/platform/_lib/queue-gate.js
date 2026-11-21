'use strict';

/**
 * بوابة سياسة الصالة: دوام، طاقة، صلاة، مناسبات رسمية.
 * لا تستدعي جوجل. المصدر: سياسة الفرع المعتمدة + إحداثيات/مدينة محفوظة.
 */

const DEFAULT_MESSAGES = {
  after_hours: 'انتهى الاستقبال اليوم — نراكم في موعد الفتح التالي.',
  capacity_full: 'اكتمل العدد اليوم. شكراً لتفهمكم.',
  paused: 'تم تعليق إصدار التذاكر مؤقتاً. دورك الحالي محفوظ إن كان لديك رقم.',
  prayer_soon: 'اقترب موعد الصلاة — دورك محفوظ.',
  prayer_now: 'تقبل الله طاعتكم — استراحة صلاة، نستأنف خدمتكم قريباً وتذكرتك محفوظة.',
  official_holiday: 'إجازة رسمية — نعود بعد المناسبة.',
  force_locked: 'عفواً، تم إغلاق استقبال التذاكر لهذا اليوم.'
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ksaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  }).formatToParts(date);
  const get = (type) => {
    const row = parts.find((p) => p.type === type);
    return row ? row.value : '';
  };
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10) || 0,
    weekday: weekdayMap[get('weekday')] != null ? weekdayMap[get('weekday')] : 0
  };
}

function ksaDateKey(date = new Date()) {
  const p = ksaParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function ksaMinuteOfDay(date = new Date()) {
  const p = ksaParts(date);
  return p.hour * 60 + p.minute;
}

function ksaWeekdaySunday0(date = new Date()) {
  return ksaParts(date).weekday;
}

function parseHmToMinutes(hm) {
  if (!hm || typeof hm !== 'string') return null;
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesToHm(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function defaultWeeklyHours() {
  const openDay = { open: '00:00', close: '23:59', closed: false };
  const hours = {};
  for (let d = 0; d < 7; d++) hours[String(d)] = Object.assign({}, openDay);
  return hours;
}

function defaultHallPolicy(overrides) {
  return Object.assign({
    timezone: 'Asia/Riyadh',
    city: 'Riyadh',
    weekly_hours: defaultWeeklyHours(),
    ramadan_mode: false,
    ramadan_hours: null,
    daily_issue_cap: null,
    max_waiting: null,
    messages: Object.assign({}, DEFAULT_MESSAGES),
    prayer_source: 'estimated',
    prayer_manual: null,
    prayer_lead_minutes: 10,
    friday_prayer_extra_minutes: 25,
    announce_prayer_on_display: true,
    pause_new_issues_during_prayer: false,
    pause_calls_on_prayer_soon: false,
    apply_national_holidays: true,
    google_place_id: null,
    gbp_location_id: null,
    lat: null,
    lng: null,
    maps_url: null,
    hours_source: null,
    suggested_weekly_hours: null,
    suggested_special_closes: null,
    hours_imported_at: null
  }, overrides || {});
}

/** تقويم مناسبات 2026–2027 (تُحدَّث مركزياً؛ ليست من Maps) */
const KSA_OFFICIAL_HOLIDAYS = [
  { date: '2026-02-22', name_ar: 'يوم التأسيس', type: 'national' },
  { date: '2026-03-20', name_ar: 'عيد الفطر', type: 'eid' },
  { date: '2026-03-21', name_ar: 'عيد الفطر', type: 'eid' },
  { date: '2026-03-22', name_ar: 'عيد الفطر', type: 'eid' },
  { date: '2026-05-27', name_ar: 'عيد الأضحى', type: 'eid' },
  { date: '2026-05-28', name_ar: 'عيد الأضحى', type: 'eid' },
  { date: '2026-05-29', name_ar: 'عيد الأضحى', type: 'eid' },
  { date: '2026-09-23', name_ar: 'اليوم الوطني', type: 'national' },
  { date: '2027-02-22', name_ar: 'يوم التأسيس', type: 'national' },
  { date: '2027-09-23', name_ar: 'اليوم الوطني', type: 'national' }
];

const GOOGLE_DAY_INDEX = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

function clampMessage(text, maxLen) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.slice(0, maxLen);
}

function sanitizeMessages(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = Object.assign({}, DEFAULT_MESSAGES);
  Object.keys(DEFAULT_MESSAGES).forEach((k) => {
    if (src[k]) out[k] = clampMessage(src[k], k === 'prayer_now' || k === 'official_holiday' ? 240 : 140);
  });
  return out;
}

function holidayOn(dateKey, holidays) {
  const list = Array.isArray(holidays) ? holidays : KSA_OFFICIAL_HOLIDAYS;
  return list.find((h) => h.date === dateKey) || null;
}

function resolveHoursMap(policy, date) {
  if (policy.ramadan_mode && policy.ramadan_hours && typeof policy.ramadan_hours === 'object') {
    return policy.ramadan_hours;
  }
  return policy.weekly_hours || defaultWeeklyHours();
}

function todayHours(policy, date = new Date()) {
  const map = resolveHoursMap(policy, date);
  const key = String(ksaWeekdaySunday0(date));
  return map[key] || map[ksaWeekdaySunday0(date)] || { open: '00:00', close: '23:59', closed: false };
}

function nextOpenHint(policy, date = new Date()) {
  for (let i = 0; i < 8; i++) {
    const probe = new Date(date.getTime() + i * 86400000);
    const hrs = todayHours(policy, i === 0 ? date : probe);
    if (hrs.closed) continue;
    const openMin = parseHmToMinutes(hrs.open);
    if (openMin == null) continue;
    if (i === 0 && ksaMinuteOfDay(date) < openMin) return hrs.open;
    if (i > 0) return hrs.open;
  }
  return null;
}

function isWithinHours(policy, date = new Date(), extraClosingMinutes = 0) {
  const hrs = todayHours(policy, date);
  if (hrs.closed) return false;
  const openMin = parseHmToMinutes(hrs.open);
  let closeMin = parseHmToMinutes(hrs.close);
  if (openMin == null || closeMin == null) return true;
  closeMin += extraClosingMinutes || 0;
  const nowMin = ksaMinuteOfDay(date);
  if (closeMin >= 24 * 60) closeMin = 24 * 60 - 1;
  if (closeMin >= openMin) return nowMin >= openMin && nowMin <= closeMin;
  return nowMin >= openMin || nowMin <= closeMin;
}

function googlePeriodsToWeeklyHours(periods) {
  const hours = defaultWeeklyHours();
  Object.keys(hours).forEach((k) => {
    hours[k] = { open: '09:00', close: '17:00', closed: true };
  });
  if (!Array.isArray(periods)) return hours;
  periods.forEach((p) => {
    const dayRaw = p.openDay != null ? p.openDay
      : p.open_day != null ? p.open_day
        : (p.open && p.open.day != null) ? p.open.day
          : p.day;
    const idx = GOOGLE_DAY_INDEX[dayRaw];
    if (idx === undefined) return;
    const openTime = p.openTime || p.open_time || (p.open && p.open.time != null ? p.open.time : p.open);
    const closeTime = p.closeTime || p.close_time || (p.close && p.close.time != null ? p.close.time : p.close);
    const openHm = formatGoogleTime(openTime);
    const closeHm = formatGoogleTime(closeTime);
    if (!openHm || !closeHm) return;
    const key = String(idx);
    if (hours[key].closed) {
      hours[key] = { open: openHm, close: closeHm, closed: false };
    }
  });
  return hours;
}

function formatGoogleTime(t) {
  if (t == null) return null;
  if (typeof t === 'string') {
    if (/^\d{1,2}:\d{2}$/.test(t)) return t.length === 4 ? '0' + t : t;
    if (/^\d{3,4}$/.test(t)) {
      const padded = t.padStart(4, '0');
      return `${padded.slice(0, 2)}:${padded.slice(2)}`;
    }
    return null;
  }
  if (typeof t === 'object') {
    const h = Number(t.hours != null ? t.hours : t.hour);
    const m = Number(t.minutes != null ? t.minutes : t.minute || 0);
    if (Number.isNaN(h)) return null;
    return `${pad2(h)}:${pad2(m)}`;
  }
  return null;
}

function policyFromDbRow(row) {
  if (!row) return null;
  return defaultHallPolicy({
    city: row.city,
    timezone: row.timezone,
    weekly_hours: row.weekly_hours,
    ramadan_mode: row.ramadan_mode,
    ramadan_hours: row.ramadan_hours,
    daily_issue_cap: row.daily_issue_cap,
    max_waiting: row.max_waiting,
    messages: row.messages,
    prayer_source: row.prayer_source,
    prayer_manual: row.prayer_manual,
    prayer_lead_minutes: row.prayer_lead_minutes,
    friday_prayer_extra_minutes: row.friday_prayer_extra_minutes,
    announce_prayer_on_display: row.announce_prayer_on_display,
    apply_national_holidays: row.apply_national_holidays,
    google_place_id: row.google_place_id,
    gbp_location_id: row.gbp_location_id,
    lat: row.lat,
    lng: row.lng,
    maps_url: row.maps_url,
    hours_source: row.hours_source,
    suggested_weekly_hours: row.suggested_weekly_hours,
    suggested_special_closes: row.suggested_special_closes,
    hours_imported_at: row.hours_imported_at,
    updated_at: row.updated_at,
    updated_by_user_id: row.updated_by_user_id
  });
}

function policyToDbRow(slug, policy, supervisorId) {
  return {
    tenant_slug: slug,
    branch_id: 'default',
    timezone: policy.timezone || 'Asia/Riyadh',
    city: policy.city || 'Riyadh',
    weekly_hours: policy.weekly_hours || defaultWeeklyHours(),
    ramadan_mode: !!policy.ramadan_mode,
    ramadan_hours: policy.ramadan_hours || null,
    daily_issue_cap: policy.daily_issue_cap,
    max_waiting: policy.max_waiting,
    messages: policy.messages || DEFAULT_MESSAGES,
    prayer_source: policy.prayer_source || 'estimated',
    prayer_manual: policy.prayer_manual || null,
    prayer_lead_minutes: policy.prayer_lead_minutes || 10,
    friday_prayer_extra_minutes: policy.friday_prayer_extra_minutes || 25,
    announce_prayer_on_display: policy.announce_prayer_on_display !== false,
    pause_new_issues_during_prayer: false,
    pause_calls_on_prayer_soon: false,
    apply_national_holidays: policy.apply_national_holidays !== false,
    google_place_id: policy.google_place_id || null,
    gbp_location_id: policy.gbp_location_id || null,
    lat: policy.lat != null ? policy.lat : null,
    lng: policy.lng != null ? policy.lng : null,
    maps_url: policy.maps_url || null,
    hours_source: policy.hours_source || null,
    suggested_weekly_hours: policy.suggested_weekly_hours || null,
    suggested_special_closes: policy.suggested_special_closes || null,
    hours_imported_at: policy.hours_imported_at || null,
    updated_at: new Date().toISOString(),
    updated_by_user_id: supervisorId || null
  };
}

async function fetchPlaceSnapshotFromGoogle(placeId, mapsUrl) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY || '';
  if (!key || typeof fetch !== 'function') return null;
  let id = (placeId || '').trim() || extractPlaceIdFromMapsUrl(mapsUrl || '');
  if (!id && mapsUrl && /maps\.google|goo\.gl|maps\.app\.goo\.gl/i.test(mapsUrl)) {
    const findUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' +
      new URLSearchParams({
        input: mapsUrl,
        inputtype: 'textquery',
        fields: 'place_id',
        language: 'ar',
        key
      }).toString();
    try {
      const findRes = await fetch(findUrl);
      const findJson = await findRes.json();
      id = (findJson.candidates && findJson.candidates[0] && findJson.candidates[0].place_id) || '';
    } catch (e) {
      id = '';
    }
  }
  if (!id) return null;
  const detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json?' +
    new URLSearchParams({
      place_id: id,
      fields: 'place_id,name,formatted_address,geometry,opening_hours,address_component',
      language: 'ar',
      key
    }).toString();
  const res = await fetch(detailsUrl);
  if (!res.ok) return null;
  const json = await res.json();
  const result = json && json.result;
  if (!result) return null;
  const loc = result.geometry && result.geometry.location ? result.geometry.location : {};
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const locality = components.find((c) => (c.types || []).indexOf('locality') !== -1);
  const admin1 = components.find((c) => (c.types || []).indexOf('administrative_area_level_1') !== -1);
  const city = (locality && locality.long_name) || (admin1 && admin1.long_name) || '';
  const periods = result.opening_hours && Array.isArray(result.opening_hours.periods)
    ? result.opening_hours.periods
    : [];
  return {
    placeId: result.place_id || id,
    name: result.name || '',
    city: city,
    lat: loc.lat != null ? loc.lat : null,
    lng: loc.lng != null ? loc.lng : null,
    maps_url: mapsUrlFromPlaceId(result.place_id || id),
    periods: periods,
    suggested_weekly_hours: periods.length ? googlePeriodsToWeeklyHours(periods) : null
  };
}

function mapsUrlFromPlaceId(placeId) {
  if (!placeId) return null;
  return 'https://www.google.com/maps/search/?api=1&query=place_id:' + encodeURIComponent(placeId);
}

function extractPlaceIdFromMapsUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const placeId = trimmed.match(/place_id:([^&\s]+)/i) || trimmed.match(/[?&]query_place_id=([^&\s]+)/i);
  if (placeId) return decodeURIComponent(placeId[1]);
  const q = trimmed.match(/[?&]q=place_id:([^&\s]+)/i);
  if (q) return decodeURIComponent(q[1]);
  return null;
}

function publicGatePayload(gate) {
  return {
    ok: true,
    gate_state: gate.gate_state,
    allows_issue: gate.allows_issue,
    allows_call_next: gate.allows_call_next,
    message_ar: gate.message_ar,
    next_open: gate.next_open,
    next_prayer: gate.next_prayer || null,
    next_prayer_time: gate.next_prayer_time || null,
    minutes_until_next_prayer: gate.minutes_until_next_prayer != null ? gate.minutes_until_next_prayer : null,
    current_prayer: gate.current_prayer || null,
    in_prayer: !!gate.in_prayer,
    prayer_source_label: gate.prayer_source_label || null,
    issued_today: gate.issued_today,
    waiting_now: gate.waiting_now,
    daily_issue_cap: gate.daily_issue_cap,
    max_waiting: gate.max_waiting,
    maps_url: gate.maps_url || null,
    holiday_name: gate.holiday_name || null
  };
}

/**
 * @param {object} opts
 * @param {object} opts.policy
 * @param {object} opts.override  paused_until, is_force_locked_today, lock_reason, extended_closing_minutes, capacity_override_delta
 * @param {object} opts.prayer    from checkPrayerStatus
 * @param {number} opts.issuedToday
 * @param {number} opts.waitingNow
 * @param {Date} [opts.now]
 * @param {Array} [opts.holidays]
 */
function evaluateGate(opts) {
  const policy = defaultHallPolicy(opts.policy || {});
  const override = opts.override || {};
  const prayer = opts.prayer || { in_prayer_break: false };
  const now = opts.now || new Date();
  const issuedToday = opts.issuedToday || 0;
  const waitingNow = opts.waitingNow || 0;
  const extraCap = override.capacity_override_delta || 0;
  const dailyCap = policy.daily_issue_cap == null ? null : policy.daily_issue_cap + extraCap;
  const maxWaiting = policy.max_waiting == null ? null : policy.max_waiting;

  const base = {
    issued_today: issuedToday,
    waiting_now: waitingNow,
    daily_issue_cap: dailyCap,
    max_waiting: maxWaiting,
    maps_url: policy.maps_url || null,
    next_open: nextOpenHint(policy, now),
    prayer_source_label: policy.prayer_source === 'umm_al_qura_live' ? 'أم القرى' : (policy.prayer_source === 'manual' ? 'يدوي للفرع' : 'تقديري')
  };

  function finish(state, extra) {
    const queueRunning = state === 'open' || state === 'prayer_soon' || state === 'prayer_now';
    const messageKey = state === 'after_hours' ? 'after_hours'
      : state === 'capacity_full' ? 'capacity_full'
        : state === 'paused' ? 'paused'
          : state === 'prayer_soon' ? 'prayer_soon'
            : state === 'prayer_now' ? 'prayer_now'
              : state === 'official_holiday' ? 'official_holiday'
                : state === 'force_locked' ? 'force_locked'
                  : null;
    const message_ar = extra && extra.message_ar
      ? extra.message_ar
      : (messageKey ? (policy.messages[messageKey] || DEFAULT_MESSAGES[messageKey]) : '');
    return Object.assign({}, base, extra || {}, {
      gate_state: state,
      allows_issue: queueRunning,
      allows_call_next: queueRunning,
      message_ar,
      in_prayer: state === 'prayer_now',
      next_prayer: prayer.next_prayer || extra && extra.next_prayer,
      next_prayer_time: prayer.next_prayer_time || extra && extra.next_prayer_time,
      minutes_until_next_prayer: prayer.minutes_until_next_prayer,
      current_prayer: prayer.current_prayer || extra && extra.current_prayer
    });
  }

  if (override.is_force_locked_today) {
    return finish('force_locked');
  }
  if (override.paused_until && new Date(override.paused_until) > now) {
    return finish('paused');
  }

  const dateKey = ksaDateKey(now);
  if (policy.apply_national_holidays) {
    const hol = holidayOn(dateKey, opts.holidays);
    if (hol) {
      return finish('official_holiday', {
        holiday_name: hol.name_ar,
        message_ar: (policy.messages.official_holiday || DEFAULT_MESSAGES.official_holiday) + ' (' + hol.name_ar + ')'
      });
    }
  }

  if (!isWithinHours(policy, now, override.extended_closing_minutes || 0)) {
    return finish('after_hours');
  }

  if (dailyCap != null && issuedToday >= dailyCap) return finish('capacity_full');
  if (maxWaiting != null && waitingNow >= maxWaiting) return finish('capacity_full');

  const lead = policy.prayer_lead_minutes || 10;
  if (policy.announce_prayer_on_display !== false) {
    if (prayer.in_prayer_break) {
      return finish('prayer_now', {
        current_prayer: prayer.current_prayer,
        next_prayer_time: prayer.prayer_time || prayer.resume_time_str
      });
    }
    if (prayer.minutes_until_next_prayer != null && prayer.minutes_until_next_prayer <= lead) {
      return finish('prayer_soon', {
        next_prayer: prayer.next_prayer,
        next_prayer_time: prayer.next_prayer_time
      });
    }
  }

  return finish('open');
}

function mergeHallPolicy(current, patch) {
  const base = defaultHallPolicy(current);
  if (!patch || typeof patch !== 'object') return base;
  const next = Object.assign({}, base, patch);
  if (patch.messages) next.messages = sanitizeMessages(Object.assign({}, base.messages, patch.messages));
  if (patch.weekly_hours) next.weekly_hours = patch.weekly_hours;
  if (patch.prayer_lead_minutes != null) {
    const n = parseInt(patch.prayer_lead_minutes, 10);
    next.prayer_lead_minutes = Number.isNaN(n) ? 10 : Math.min(30, Math.max(3, n));
  }
  if (patch.daily_issue_cap === '' || patch.daily_issue_cap === undefined) {
    /* keep */
  }
  if (patch.daily_issue_cap === null) next.daily_issue_cap = null;
  if (typeof patch.daily_issue_cap === 'number') next.daily_issue_cap = patch.daily_issue_cap >= 0 ? patch.daily_issue_cap : null;
  if (patch.max_waiting === null) next.max_waiting = null;
  if (typeof patch.max_waiting === 'number') next.max_waiting = patch.max_waiting >= 0 ? patch.max_waiting : null;
  next.pause_new_issues_during_prayer = false;
  next.pause_calls_on_prayer_soon = false;
  return next;
}

function warnLongOpenDay(weeklyHours) {
  const warnings = [];
  const map = weeklyHours || {};
  Object.keys(map).forEach((k) => {
    const d = map[k];
    if (!d || d.closed) return;
    const o = parseHmToMinutes(d.open);
    const c = parseHmToMinutes(d.close);
    if (o == null || c == null) return;
    let dur = c >= o ? c - o : (24 * 60 - o + c);
    if (dur > 16 * 60) warnings.push({ weekday: k, hours: Math.round(dur / 60) });
  });
  return warnings;
}

module.exports = {
  DEFAULT_MESSAGES,
  KSA_OFFICIAL_HOLIDAYS,
  defaultHallPolicy,
  defaultWeeklyHours,
  evaluateGate,
  publicGatePayload,
  mergeHallPolicy,
  googlePeriodsToWeeklyHours,
  mapsUrlFromPlaceId,
  extractPlaceIdFromMapsUrl,
  sanitizeMessages,
  ksaDateKey,
  ksaMinuteOfDay,
  ksaWeekdaySunday0,
  warnLongOpenDay,
  holidayOn,
  policyFromDbRow,
  policyToDbRow,
  fetchPlaceSnapshotFromGoogle
};
