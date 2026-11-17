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

function bindRequest() {
  als.enterWith({ events: [], loadedIds: new Set() });
}

function noteEvent(name, payload) {
  const store = als.getStore();
  if (!store || mode() === 'memory') return;
  store.events.push({ name: name, payload: payload });
}

function migrationSql() {
  return fs.readFileSync(
    path.join(__dirname, '../../db/migrations/2026-11-17-queue-postgres-runtime.sql'),
    'utf8'
  );
}

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.QUEUE_DATABASE_URL,
      max: 8,
      allowExitOnIdle: true
    });
  }
  return pool;
}

async function ensureSchema() {
  if (mode() !== 'pg') return;
  if (!schemaReady) {
    schemaReady = (async function () {
      const client = await getPool().connect();
      try {
        await client.query('SELECT pg_advisory_lock(8675309)');
        await client.query(migrationSql());
        await client.query('SELECT pg_advisory_unlock(8675309)');
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
  (db.counterSessions[slug] || []).forEach(function (row) { push('session', row.id, row); });
  (db.agentBreaks[slug] || []).forEach(function (row) { push('break', row.id, row); });
  (db.receptionHandovers[slug] || []).forEach(function (row) { push('handover', row.id, row); });
  (db.serviceLogs[slug] || []).forEach(function (row) { push('log', row.id, row); });
  (db.auditLogs[slug] || []).forEach(function (row) { push('audit', row.id, row); });
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
  db.counterSessions[slug] = list('session');
  db.agentBreaks[slug] = list('break');
  db.receptionHandovers[slug] = list('handover');
  db.serviceLogs[slug] = list('log');
  db.auditLogs[slug] = list('audit');
  if (byKind.settings && byKind.settings[0]) db.settings[slug] = byKind.settings[0].payload;
  if (byKind.override && byKind.override[0]) db.overrides[slug] = byKind.override[0].payload;
  db.idempotencyKeys[slug] = byKind.idempotency && byKind.idempotency[0]
    ? byKind.idempotency[0].payload
    : {};
}

async function loadRows(slug) {
  if (mode() === 'pg') {
    const result = await getPool().query(
      'SELECT id, kind, payload FROM public.queue_runtime_records WHERE tenant_slug = $1',
      [slug]
    );
    return result.rows;
  }
  const { data, error } = await supabase()
    .from('queue_runtime_records')
    .select('id,kind,payload')
    .eq('tenant_slug', slug);
  if (error) throw new Error(error.message);
  return data || [];
}

async function commit(slug, rows, events, deleted) {
  const eventRows = events || [];
  const deleteIds = deleted || [];
  if (mode() === 'pg') {
    await getPool().query(
      'SELECT public.queue_commit($1, $2::jsonb, $3::jsonb, $4::text[])',
      [slug, JSON.stringify(rows), JSON.stringify(eventRows), deleteIds]
    );
    return;
  }
  const { error } = await supabase().rpc('queue_commit', {
    p_tenant: slug,
    p_records: rows,
    p_events: eventRows,
    p_delete_ids: deleteIds
  });
  if (error) throw new Error(error.message);
}

async function prepare(slug, db) {
  if (mode() === 'memory') {
    warnMemory();
    return;
  }
  await ensureSchema();
  const rows = await loadRows(slug);
  const store = als.getStore();
  if (store) store.loadedIds = new Set(rows.map(function (row) { return row.id; }));
  if (rows.length) applyRows(slug, db, rows);
}

async function finish(slug, db, beforeFp) {
  if (mode() === 'memory') return;
  const rows = serialize(slug, db);
  const store = als.getStore() || { events: [], loadedIds: new Set() };
  const events = store.events || [];
  if (JSON.stringify(rows) === beforeFp && !events.length) return;
  const current = new Set(rows.map(function (row) { return row.id; }));
  const deleted = [];
  (store.loadedIds || new Set()).forEach(function (id) {
    if (!current.has(id)) deleted.push(id);
  });
  await commit(slug, rows, events, deleted);
  store.events = [];
  store.loadedIds = current;
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

module.exports = {
  MISSING_IP_LIMIT: MISSING_IP_LIMIT,
  mode: mode,
  bindRequest: bindRequest,
  noteEvent: noteEvent,
  prepare: prepare,
  finish: finish,
  fingerprint: fingerprint,
  allocate: allocate,
  latestEventId: latestEventId,
  pollEvents: pollEvents,
  ensureSchema: ensureSchema,
  riyadhDay: riyadhDay
};
