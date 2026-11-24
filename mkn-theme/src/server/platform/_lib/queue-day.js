'use strict';

/**
 * Operating day for a branch queue. Asia/Riyadh is UTC+3 with no DST.
 * fixed_close (default, closing 00:00): open tickets from an earlier operating
 * day expire at closing. 00:00 means the calendar day ends at the next midnight.
 * always_open: tickets carry across midnight and expire only after max wait.
 * Display numbers restart at reset_hour and skip any number still open.
 */

const BOARD_STATUSES = ['waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch'];
const OPEN_STATUSES = BOARD_STATUSES.concat(['called', 'in_service']);
const REASON_DAY = 'انتهى اليوم التشغيلي';
const REASON_WAIT = 'تجاوز الحد الأقصى للانتظار';
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

let frozenNow = null;

function now() {
  return frozenNow ? new Date(frozenNow.getTime()) : new Date();
}

function setNowForTests(value) {
  if (value == null) {
    frozenNow = null;
    return;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('invalid queue clock');
  frozenNow = parsed;
}

function riyadhWall(date) {
  const shifted = new Date((date || now()).getTime() + RIYADH_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    dateKey: year + '-' + month + '-' + day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  };
}

function riyadhDateKey(date) {
  return riyadhWall(date || now()).dateKey;
}

function addDays(dateKey, days) {
  const parts = String(dateKey || '').split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return dt.getUTCFullYear() + '-' + month + '-' + day;
}

function closingMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeSettings(raw) {
  const src = raw || {};
  const mode = src.operating_mode === 'always_open' || src.operating_mode === '24h'
    ? 'always_open'
    : 'fixed_close';
  let closing = String(src.closing_time || '').trim();
  const minutes = closingMinutes(closing);
  if (minutes == null) closing = '00:00';
  else closing = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  let maxWait = Number(src.max_wait_hours);
  if (!Number.isFinite(maxWait) || maxWait <= 0) maxWait = 6;
  if (maxWait > 72) maxWait = 72;
  let resetHour = parseInt(src.reset_hour, 10);
  if (!Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23) resetHour = 4;
  return {
    operating_mode: mode,
    closing_time: closing,
    max_wait_hours: maxWait,
    reset_hour: resetHour,
    timezone: 'Asia/Riyadh'
  };
}

function currentPeriod(settings, at, extendedMinutes) {
  const cfg = normalizeSettings(settings);
  const wall = riyadhWall(at || now());
  if (cfg.operating_mode === 'always_open') {
    if (wall.hour < cfg.reset_hour) return addDays(wall.dateKey, -1);
    return wall.dateKey;
  }
  let closeAt = closingMinutes(cfg.closing_time);
  if (closeAt === 0) closeAt = 24 * 60;
  closeAt += Math.max(0, Number(extendedMinutes) || 0);
  if (wall.minutes >= closeAt) return addDays(wall.dateKey, 1);
  return wall.dateKey;
}

function parseInstant(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function arrivalMs(ticket) {
  if (!ticket) return null;
  return parseInstant(ticket.first_arrived_at) || parseInstant(ticket.booked_at) || parseInstant(ticket.created_at);
}

function ticketPeriod(ticket) {
  if (ticket && /^\d{4}-\d{2}-\d{2}$/.test(String(ticket.service_date || ''))) return ticket.service_date;
  const ms = arrivalMs(ticket);
  if (ms == null) return '1970-01-01';
  return riyadhDateKey(new Date(ms));
}

function shouldExpire(ticket, settings, at, extendedMinutes) {
  if (!ticket || OPEN_STATUSES.indexOf(ticket.status) === -1) return null;
  const cfg = normalizeSettings(settings);
  const moment = at || now();
  if (cfg.operating_mode === 'always_open') {
    if (BOARD_STATUSES.indexOf(ticket.status) === -1) return null;
    const anchor = parseInstant(ticket.restored_at) || arrivalMs(ticket);
    if (anchor == null) return REASON_WAIT;
    if (moment.getTime() - anchor > cfg.max_wait_hours * 60 * 60 * 1000) return REASON_WAIT;
    return null;
  }
  if (ticketPeriod(ticket) < currentPeriod(cfg, moment, extendedMinutes)) return REASON_DAY;
  return null;
}

function isOnBoard(ticket, settings, at, extendedMinutes) {
  if (!ticket || BOARD_STATUSES.indexOf(ticket.status) === -1) return false;
  return shouldExpire(ticket, settings, at, extendedMinutes) == null;
}

function isCallable(ticket, settings, at, extendedMinutes, statuses) {
  if (!ticket || !statuses || statuses.indexOf(ticket.status) === -1) return false;
  return shouldExpire(ticket, settings, at, extendedMinutes) == null;
}

function sequenceOf(ticket) {
  const asNum = Number(ticket && ticket.daily_sequence);
  if (Number.isInteger(asNum) && asNum > 0) return asNum;
  const match = String((ticket && ticket.ticket_number) || '').match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return parsed > 0 ? parsed : null;
}

function openSequences(tickets, queueId) {
  const open = new Set();
  (tickets || []).forEach(function (ticket) {
    if (!ticket || ticket.queue_id !== queueId) return;
    if (OPEN_STATUSES.indexOf(ticket.status) === -1) return;
    const seq = sequenceOf(ticket);
    if (seq) open.add(seq);
  });
  return open;
}

function nextSequence(lastNumber, open) {
  let next = (Number(lastNumber) || 0) + 1;
  const taken = open || new Set();
  let guard = 0;
  while (taken.has(next)) {
    next += 1;
    guard += 1;
    if (guard > 10000) throw new Error('queue number space exhausted');
  }
  return next;
}

function formatTicketNumber(prefix, seq) {
  return String(prefix || 'A') + '-' + String(seq).padStart(2, '0');
}

function recentlyAutoClosed(tickets, queueId, at) {
  const cutoff = (at || now()).getTime() - (7 * 24 * 60 * 60 * 1000);
  return (tickets || []).filter(function (ticket) {
    if (!ticket || ticket.queue_id !== queueId) return false;
    if (ticket.status !== 'expired' || !ticket.auto_closed) return false;
    const closed = Date.parse(ticket.closed_at || '');
    return Number.isFinite(closed) && closed >= cutoff;
  }).slice(-40);
}

function applyRollover(db, slug) {
  const result = { changed: false, expiredIds: [], period: null, countersReset: 0 };
  if (!db || !slug || !db.settings || !db.settings[slug]) return result;
  const settings = db.settings[slug];
  const cfg = normalizeSettings(settings);
  ['operating_mode', 'closing_time', 'max_wait_hours', 'reset_hour', 'timezone'].forEach(function (key) {
    if (settings[key] !== cfg[key]) {
      settings[key] = cfg[key];
      result.changed = true;
    }
  });
  const extended = db.overrides && db.overrides[slug] ? Number(db.overrides[slug].extended_closing_minutes) || 0 : 0;
  const at = now();
  const period = currentPeriod(cfg, at, extended);
  result.period = period;
  const tickets = db.tickets[slug] || [];
  const reasons = [];
  tickets.forEach(function (ticket) {
    const reason = shouldExpire(ticket, cfg, at, extended);
    if (reason) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ticket.service_date || ''))) ticket.service_date = ticketPeriod(ticket);
      ticket.status = 'expired';
      ticket.close_reason = reason;
      ticket.auto_closed = true;
      ticket.closed_at = at.toISOString();
      result.expiredIds.push(ticket.id);
      if (reasons.indexOf(reason) === -1) reasons.push(reason);
      result.changed = true;
      return;
    }
    if (ticket && OPEN_STATUSES.indexOf(ticket.status) !== -1 && !/^\d{4}-\d{2}-\d{2}$/.test(String(ticket.service_date || ''))) {
      const derived = ticketPeriod(ticket);
      if (derived && derived !== '1970-01-01') {
        ticket.service_date = derived;
        result.changed = true;
      }
    }
  });
  (db.counters[slug] || []).forEach(function (counter) {
    if (counter.current_ticket_id && result.expiredIds.indexOf(counter.current_ticket_id) !== -1) {
      counter.current_ticket_id = null;
      counter.current_ticket_number = null;
      counter.current_session_started_at = null;
      result.changed = true;
    }
    if ((counter.completed_today_service_date || '') !== period) {
      counter.completed_today_count = 0;
      counter.completed_today_service_date = period;
      result.countersReset += 1;
      result.changed = true;
    }
  });
  if (result.expiredIds.length) {
    if (!db.auditLogs[slug]) db.auditLogs[slug] = [];
    db.auditLogs[slug].push({
      id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      tenant_slug: slug,
      action_type: 'QUEUE_DAY_CLOSE',
      delta_value: result.expiredIds.length,
      reason: reasons.join('؛ ') || REASON_DAY,
      ticket_ids: result.expiredIds.slice(),
      performed_by_user_id: 'system',
      performed_by_name: 'النظام',
      user_ip_address: 'system',
      created_at: at.toISOString()
    });
  }
  return result;
}

module.exports = {
  BOARD_STATUSES: BOARD_STATUSES,
  OPEN_STATUSES: OPEN_STATUSES,
  REASON_DAY: REASON_DAY,
  REASON_WAIT: REASON_WAIT,
  now: now,
  setNowForTests: setNowForTests,
  riyadhWall: riyadhWall,
  riyadhDateKey: riyadhDateKey,
  normalizeSettings: normalizeSettings,
  currentPeriod: currentPeriod,
  ticketPeriod: ticketPeriod,
  shouldExpire: shouldExpire,
  isOnBoard: isOnBoard,
  isCallable: isCallable,
  sequenceOf: sequenceOf,
  openSequences: openSequences,
  nextSequence: nextSequence,
  formatTicketNumber: formatTicketNumber,
  recentlyAutoClosed: recentlyAutoClosed,
  applyRollover: applyRollover
};
