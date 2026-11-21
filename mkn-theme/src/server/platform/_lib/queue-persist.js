'use strict';

const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const sbEnv = require('./supabase-env');

/**
 * Postgres is the source of truth when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are set, or when QUEUE_DATABASE_URL points at a Postgres (local tests).
 * MEMORY_DB is only the explicit fallback for local dev and the in-memory tests.
 */

const als = new AsyncLocalStorage();
const MISSING_IP_LIMIT = 5;
let warnedMemory = false;
let pool = null;
let schemaReady = null;

function mode() {
  if (process.env.QUEUE_DATABASE_URL) return 'pg';
  if (sbEnv.hasSupabaseServerConfig()) return 'supabase';
  return 'memory';
}

function warnMemory() {
  if (warnedMemory || mode() !== 'memory') return;
  warnedMemory = true;
  console.warn(
    '[queue] MEMORY_DB fallback: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are missing. ' +
      'Tickets stay in this process only, reset on restart, and are not shared across instances.'
  );
}

function riyadhDay(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date || new Date());
}

function freshStore() {
  return {
    events: [],
    loadedIds: new Set(),
    slice: {},
    baseline: new Map()
  };
}

function bindRequest() {
  if (als.getStore()) return;
  als.enterWith(freshStore());
}

function runRequest(fn) {
  return als.run(freshStore(), fn);
}

function currentStore() {
  return als.getStore() || null;
}

function clearEvents() {
  const store = als.getStore();
  if (store) store.events = [];
}

function isConflict(err) {
  const message = String((err && (err.message || err)) || '');
  return message.indexOf('queue_version_conflict') !== -1 || (err && err.code === '40001');
}

let memoryCommitHook = null;
function setMemoryCommitHook(fn) {
  memoryCommitHook = fn;
}

function noteEvent(name, payload) {
  const store = als.getStore();
  if (!store || mode() === 'memory') return;
  store.events.push({ name: name, payload: payload });
}

function migrationSql() {
  const dir = path.join(__dirname, '../../../../../db/migrations');
  return [
    '2026-11-17-queue-postgres-runtime.sql',
    '2026-11-17-queue-delta-commit.sql',
    '2026-11-22-queue-multi-zone.sql',
    '2026-11-23-queue-appointments-kiosk.sql',
    '2026-11-24-enterprise-licensing-zones.sql'
  ].map(function (name) {
    return fs.readFileSync(path.join(dir, name), 'utf8');
  }).join('\n');
}

function stableStringify(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return stableStringify(item); }).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map(function (key) {
    if (value[key] === undefined) return '';
    return JSON.stringify(key) + ':' + stableStringify(value[key]);
  }).filter(Boolean).join(',') + '}';
}

function getPool() {
  if (!pool) {
    const { Pool } = eval("require")('pg');
    pool = new Pool({
      connectionString: process.env.QUEUE_DATABASE_URL,
      max: 24,
      allowExitOnIdle: true
    });
  }
  return pool;
}

async function deltaReady(client) {
  const found = await client.query(
    "SELECT to_regprocedure('public.queue_commit_delta(text,jsonb,jsonb,text[])') IS NOT NULL" +
      " AND to_regprocedure('public.queue_call_next(text,text,text,text[])') IS NOT NULL AS ok"
  );
  return Boolean(found.rows[0] && found.rows[0].ok);
}

async function ensureSchema() {
  if (mode() !== 'pg') return;
  if (!schemaReady) {
    schemaReady = (async function () {
      const client = await getPool().connect();
      try {
        if (await deltaReady(client)) return;
        await client.query('BEGIN');
        try {
          // Held until commit so a second process cannot write while CREATE INDEX takes AccessExclusiveLock.
          await client.query('SELECT pg_advisory_xact_lock(8675309)');
          if (!(await deltaReady(client))) await client.query(migrationSql());
          await client.query('COMMIT');
        } catch (err) {
          try { await client.query('ROLLBACK'); } catch (rollbackErr) { /* connection already closed */ }
          throw err;
        }
      } finally {
        client.release();
      }
    })().catch(function (err) {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function supabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function serialize(slug, db) {
  const rows = [];
  function push(kind, id, payload) {
    if (!id || payload == null) return;
    rows.push({
      id: slug + ':' + kind + ':' + id,
      kind: kind,
      payload: payload
    });
  }
  (db.queues[slug] || []).forEach(function (row) { push('queue', row.id, row); });
  (db.counters[slug] || []).forEach(function (row) { push('counter', row.id, row); });
  (db.tickets[slug] || []).forEach(function (row) { push('ticket', row.id, row); });
  (db.users[slug] || []).forEach(function (row) { push('user', row.id, row); });
  (db.zones && db.zones[slug] || []).forEach(function (row) { push('zone', row.id, row); });
  (db.kiosks && db.kiosks[slug] || []).forEach(function (row) { push('kiosk', row.id, row); });
  (db.appointments && db.appointments[slug] || []).forEach(function (row) { push('appointment', row.id, row); });
  (db.counterSessions[slug] || []).forEach(function (row) { push('session', row.id, row); });
  (db.agentBreaks[slug] || []).forEach(function (row) { push('break', row.id, row); });
  (db.receptionHandovers[slug] || []).forEach(function (row) { push('handover', row.id, row); });
  (db.serviceLogs[slug] || []).forEach(function (row) { push('log', row.id, row); });
  (db.auditLogs[slug] || []).forEach(function (row) { push('audit', row.id, row); });
  if (db.entitlements && db.entitlements[slug]) push('entitlement', 'singleton', db.entitlements[slug]);
  (db.addonInvoices && db.addonInvoices[slug] || []).forEach(function (row) { push('invoice', row.id, row); });
  if (db.settings[slug]) push('settings', 'singleton', db.settings[slug]);
  if (db.overrides[slug]) push('override', 'singleton', db.overrides[slug]);
  push('idempotency', 'singleton', db.idempotencyKeys[slug] || {});
  return rows;
}

function fingerprint(slug, db) {
  return JSON.stringify(serialize(slug, db));
}

function applyRows(slug, db, rows) {
  const byKind = {};
  rows.forEach(function (row) {
    if (!byKind[row.kind]) byKind[row.kind] = [];
    byKind[row.kind].push(row);
  });
  function list(kind) {
    return (byKind[kind] || []).map(function (row) { return row.payload; });
  }
  db.queues[slug] = list('queue');
  db.counters[slug] = list('counter');
  db.tickets[slug] = list('ticket');
  db.users[slug] = list('user');
  if (db.zones) db.zones[slug] = list('zone');
  if (db.kiosks) db.kiosks[slug] = list('kiosk');
  if (db.appointments) db.appointments[slug] = list('appointment');
  db.counterSessions[slug] = list('session');
  db.agentBreaks[slug] = list('break');
  db.receptionHandovers[slug] = list('handover');
  db.serviceLogs[slug] = list('log');
  db.auditLogs[slug] = list('audit');
  if (db.entitlements && byKind.entitlement && byKind.entitlement[0]) db.entitlements[slug] = byKind.entitlement[0].payload;
  if (db.addonInvoices) db.addonInvoices[slug] = list('invoice');
  if (byKind.settings && byKind.settings[0]) db.settings[slug] = byKind.settings[0].payload;
  if (byKind.override && byKind.override[0]) db.overrides[slug] = byKind.override[0].payload;
  db.idempotencyKeys[slug] = byKind.idempotency && byKind.idempotency[0]
    ? byKind.idempotency[0].payload
    : {};
}

async function loadRows(slug) {
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT id, kind, payload, version FROM public.queue_runtime_records WHERE tenant_slug = $1',
      [slug]
    );
    return result.rows;
  }
  const { data, error } = await supabase()
    .from('queue_runtime_records')
    .select('id,kind,payload,version')
    .eq('tenant_slug', slug);
  if (error) throw new Error(error.message);
  return data || [];
}

function snapshotBaseline(rows) {
  const store = als.getStore();
  if (!store) return;
  const map = new Map();
  (rows || []).forEach(function (row) {
    map.set(row.id, {
      kind: row.kind,
      payload: stableStringify(row.payload),
      version: Number(row.version || 1)
    });
  });
  store.baseline = map;
  store.loadedIds = new Set(map.keys());
}

function diffWorkingCopy(slug, db) {
  const store = als.getStore() || { baseline: new Map() };
  const baseline = store.baseline || new Map();
  const rows = serialize(slug, db);
  const current = new Map();
  const upserts = [];
  rows.forEach(function (row) {
    const encoded = stableStringify(row.payload);
    current.set(row.id, encoded);
    const prev = baseline.get(row.id);
    if (!prev || prev.payload !== encoded || prev.kind !== row.kind) {
      upserts.push({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        expected_version: prev ? prev.version : null
      });
    }
  });
  const deleted = [];
  baseline.forEach(function (_prev, id) {
    if (!current.has(id)) deleted.push(id);
  });
  return { upserts: upserts, deleted: deleted };
}

function adoptWritten(upserts, deleted) {
  const store = als.getStore();
  if (!store) return;
  if (!store.baseline) store.baseline = new Map();
  upserts.forEach(function (row) {
    const version = row.expected_version == null ? 1 : Number(row.expected_version) + 1;
    store.baseline.set(row.id, {
      kind: row.kind,
      payload: stableStringify(row.payload),
      version: version
    });
  });
  deleted.forEach(function (id) { store.baseline.delete(id); });
  store.loadedIds = new Set(store.baseline.keys());
  store.events = [];
}

async function commitDelta(slug, upserts, events, deleted) {
  const eventRows = events || [];
  const deleteIds = deleted || [];
  if (mode() === 'pg') {
    await getPool().query(
      'SELECT public.queue_commit_delta($1, $2::jsonb, $3::jsonb, $4::text[])',
      [slug, JSON.stringify(upserts), JSON.stringify(eventRows), deleteIds]
    );
    return;
  }
  const { error } = await supabase().rpc('queue_commit_delta', {
    p_tenant: slug,
    p_records: upserts,
    p_events: eventRows,
    p_delete_ids: deleteIds
  });
  if (error) throw new Error(error.message);
}

async function prepare(slug, db) {
  if (mode() === 'memory') {
    warnMemory();
    snapshotBaseline([]);
    return;
  }
  await ensureSchema();
  const rows = await loadRows(slug);
  if (rows.length) applyRows(slug, db, rows);
  snapshotBaseline(rows);
}

async function finish(slug, db) {
  if (mode() === 'memory') {
    if (memoryCommitHook) memoryCommitHook(slug);
    return;
  }
  const store = als.getStore() || { events: [], baseline: new Map() };
  const events = store.events || [];
  const delta = diffWorkingCopy(slug, db);
  if (!delta.upserts.length && !delta.deleted.length && !events.length) return;
  await commitDelta(slug, delta.upserts, events, delta.deleted);
  adoptWritten(delta.upserts, delta.deleted);
}

async function reload(slug, db) {
  if (mode() === 'memory') return;
  const rows = await loadRows(slug);
  if (rows.length) applyRows(slug, db, rows);
  snapshotBaseline(rows);
  clearEvents();
}

async function callNext(slug, counterId, ticketId, statuses) {
  if (mode() === 'memory') throw new Error('queue_call_next requires postgres');
  await ensureSchema();
  const allowed = statuses && statuses.length
    ? statuses
    : ['waiting', 'bumped', 'sync_watch'];
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT public.queue_call_next($1, $2, $3, $4::text[]) AS result',
      [slug, counterId, ticketId || null, allowed]
    );
    return result.rows[0].result;
  }
  const { data, error } = await supabase().rpc('queue_call_next', {
    p_tenant: slug,
    p_counter_id: counterId,
    p_ticket_id: ticketId || null,
    p_statuses: allowed
  });
  if (error) throw new Error(error.message);
  return data;
}

function memoryAllocate(slug, queueId, prefix, db) {
  const day = riyadhDay();
  if (!db.dailyCounters) db.dailyCounters = {};
  if (!db.dailyCounters[slug]) db.dailyCounters[slug] = {};
  const key = queueId + '|' + day;
  const next = (db.dailyCounters[slug][key] || 0) + 1;
  db.dailyCounters[slug][key] = next;
  const queues = db.queues[slug] || [];
  const queue = queues.find(function (item) { return item.id === queueId; });
  if (queue) {
    queue.sequence_counter = next;
    queue.sequence_date = day;
  }
  return {
    sequence: next,
    ticket_number: String(prefix || 'A') + '-' + String(next).padStart(2, '0')
  };
}

async function allocate(slug, queueId, prefix, db) {
  const safePrefix = prefix || 'A';
  if (mode() === 'memory') return memoryAllocate(slug, queueId, safePrefix, db);
  await ensureSchema();
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT seq, ticket_number FROM public.queue_next_number($1, $2, $3)',
      [slug, queueId, safePrefix]
    );
    const row = result.rows[0];
    return { sequence: row.seq, ticket_number: row.ticket_number };
  }
  const { data, error } = await supabase().rpc('queue_next_number', {
    p_tenant: slug,
    p_queue: queueId,
    p_prefix: safePrefix
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.ticket_number) throw new Error('queue_next_number returned no ticket');
  return { sequence: row.seq, ticket_number: row.ticket_number };
}

async function latestEventId(slug) {
  if (mode() === 'memory') return 0;
  await ensureSchema();
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT COALESCE(MAX(id), 0)::bigint AS id FROM public.queue_runtime_events WHERE tenant_slug = $1',
      [slug]
    );
    return Number(result.rows[0].id || 0);
  }
  const { data, error } = await supabase()
    .from('queue_runtime_events')
    .select('id')
    .eq('tenant_slug', slug)
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data[0] ? Number(data[0].id) : 0;
}

async function pollEvents(slug, afterId) {
  if (mode() === 'memory') return [];
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT id, event_name, payload FROM public.queue_runtime_events WHERE tenant_slug = $1 AND id > $2 ORDER BY id ASC LIMIT 100',
      [slug, afterId || 0]
    );
    return result.rows;
  }
  const { data, error } = await supabase()
    .from('queue_runtime_events')
    .select('id,event_name,payload')
    .eq('tenant_slug', slug)
    .gt('id', afterId || 0)
    .order('id', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

function adoptClaim(slug, db, claimed) {
  if (!claimed || !db) return;
  const store = als.getStore();
  function replace(list, payload) {
    if (!payload || !payload.id) return;
    if (!Array.isArray(list)) return;
    const idx = list.findIndex(function (row) { return row.id === payload.id; });
    if (idx === -1) list.push(payload);
    else list[idx] = payload;
  }
  function touch(kind, payload) {
    if (!store || !store.baseline || !payload || !payload.id) return;
    const id = slug + ':' + kind + ':' + payload.id;
    const prev = store.baseline.get(id);
    store.baseline.set(id, {
      kind: kind,
      payload: stableStringify(payload),
      version: prev ? Number(prev.version) + 1 : 1
    });
  }
  (claimed.bumped || []).forEach(function (ticket) {
    replace(db.tickets[slug], ticket);
    touch('ticket', ticket);
  });
  if (claimed.code === 'called') {
    replace(db.tickets[slug], claimed.ticket);
    replace(db.counters[slug], claimed.counter);
    touch('ticket', claimed.ticket);
    touch('counter', claimed.counter);
  }
}

module.exports = {
  MISSING_IP_LIMIT: MISSING_IP_LIMIT,
  mode: mode,
  bindRequest: bindRequest,
  runRequest: runRequest,
  currentStore: currentStore,
  clearEvents: clearEvents,
  isConflict: isConflict,
  setMemoryCommitHook: setMemoryCommitHook,
  noteEvent: noteEvent,
  prepare: prepare,
  finish: finish,
  reload: reload,
  callNext: callNext,
  adoptClaim: adoptClaim,
  fingerprint: fingerprint,
  allocate: allocate,
  latestEventId: latestEventId,
  pollEvents: pollEvents,
  ensureSchema: ensureSchema,
  riyadhDay: riyadhDay
};
