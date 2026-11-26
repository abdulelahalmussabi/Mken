'use strict';

function getCreateClient() {
  return require('@supabase/supabase-js').createClient;
}
function createClient(...args) {
  return getCreateClient()(...args);
}
const sbEnv = require('./_lib/supabase-env');
const { handleCors } = require('./_lib/cors');
const pushLib = require('./_lib/web-push');
const { isRateLimited } = require('./_lib/rate-limit');
const queueGuard = require('./_lib/queue-guard');
const queuePersist = require('./_lib/queue-persist');
const queueDay = require('./_lib/queue-day');
const queueGate = require('./_lib/queue-gate');
const onpremLicense = require('./_lib/onprem-license');
const crypto = require('crypto');

const MISSING_IP_LIMIT = queuePersist.MISSING_IP_LIMIT;
const STAFF_ONLY_ACTIONS = new Set([
  'save-config',
  'billing-summary',
  'purchase-extra-zones',
  'enable-on-premise-addon',
  'list-kiosks',
  'upsert-kiosk',
  'rotate-kiosk-token',
  'create-queue',
  'update-queue',
  'delete-queue',
  'staff-config',
  'staff-board',
  'add-counter',
  'update-counter',
  'delete-counter',
  'save-onboarding-compliance',
  'manual-ticket',
  'search-tickets',
  'list-tickets',
  'call-next',
  'dispatch-call',
  'transfer-ticket',
  'hold-ticket',
  'recall-ticket',
  'start-service',
  'complete-service',
  'snooze-no-show',
  'counter-status',
  'broadcast-notice',
  'check-long-transactions',
  'check-labor-compliance',
  'hot-swap-authenticate',
  'start-break',
  'end-break',
  'supervisor-force-signout',
  'supervisor-reassign-counter',
  'reception-shift-summary',
  'reception-handover',
  'cleanup-ghost-counters',
  'manual-override',
  'get-override-state',
  'restore-ticket'
]);

/**
 * ذاكرة احتياطية صريحة للتطوير والاختبار المحلي فقط.
 * عندما تُضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (أو QUEUE_DATABASE_URL)
 * تصبح Postgres مصدر الحقيقة. بدونها تُطبع تحذير ويبقى هذا المخزن داخل العملية.
 */
const RAW_DB = {
  queues: {},              // tenantSlug -> [queueObj]
  counters: {},            // tenantSlug -> [counterObj]
  tickets: {},             // tenantSlug -> [ticketObj]
  serviceLogs: {},         // tenantSlug -> [logObj]
  users: {},               // tenantSlug -> [userObj]
  settings: {},            // tenantSlug -> settingsObj
  sseClients: {},          // tenantSlug -> [res]  (process-local, not persisted)
  counterSessions: {},     // tenantSlug -> [sessionObj]
  agentBreaks: {},         // tenantSlug -> [breakObj]
  receptionHandovers: {},  // tenantSlug -> [handoverObj]
  overrides: {},           // tenantSlug -> overrideObj (Revision & Operational Overrides)
  auditLogs: {},           // tenantSlug -> [logEntry] (NCA/PDPL Immutable Audit Trail)
  idempotencyKeys: {},     // tenantSlug -> { idempotencyKey: { revision, override } }
  zones: {},
  kiosks: {},              // tenantSlug -> [kioskObj] (Self-service Kiosks)
  appointments: {},        // tenantSlug -> [appointmentObj] (HIS / EMR Appointments)
  dailyCounters: {},
  hallPolicies: {},
  displayPreviews: {},
  entitlements: {},        // tenantSlug -> entitlementObj (Quotas & On-Premise Lic)
  addonInvoices: {}        // tenantSlug -> [invoiceObj] (Add-on Billing Invoices)
};

const TENANT_COLLECTIONS = [
  'queues', 'counters', 'tickets', 'serviceLogs', 'users', 'settings',
  'counterSessions', 'agentBreaks', 'receptionHandovers', 'overrides',
  'auditLogs', 'idempotencyKeys', 'hallPolicies', 'zones', 'kiosks', 'appointments',
  'entitlements', 'addonInvoices'
];

function requestBucket(key) {
  const store = queuePersist.currentStore();
  if (!store) return null;
  if (!store.slice) store.slice = {};
  if (!store.slice[key]) store.slice[key] = {};
  return store.slice[key];
}

function collectionView(key) {
  return new Proxy(RAW_DB[key], {
    get: function (target, prop) {
      if (typeof prop !== 'string') return target[prop];
      // Memory mode keeps one shared object so staff tools and tests see the same rows.
      // Postgres gives each request its own clone so concurrent joins cannot detach arrays.
      if (queuePersist.mode() === 'memory') return target[prop];
      const bucket = requestBucket(key);
      if (!bucket) return target[prop];
      if (!Object.prototype.hasOwnProperty.call(bucket, prop)) {
        if (!Object.prototype.hasOwnProperty.call(target, prop)) return undefined;
        bucket[prop] = structuredClone(target[prop]);
      }
      return bucket[prop];
    },
    set: function (target, prop, value) {
      if (typeof prop !== 'string') return false;
      if (queuePersist.mode() === 'memory') {
        target[prop] = value;
        return true;
      }
      const bucket = requestBucket(key);
      if (!bucket) {
        target[prop] = value;
        return true;
      }
      bucket[prop] = value;
      return true;
    }
  });
}

const collectionProxies = {};
TENANT_COLLECTIONS.forEach(function (key) {
  collectionProxies[key] = collectionView(key);
});

const MEMORY_DB = new Proxy(RAW_DB, {
  get: function (target, prop, receiver) {
    if (typeof prop === 'string' && collectionProxies[prop]) return collectionProxies[prop];
    return Reflect.get(target, prop, receiver);
  }
});

function mergeRequestSlice(slug) {
  const store = queuePersist.currentStore();
  if (!store || !store.slice || !slug) return;
  TENANT_COLLECTIONS.forEach(function (key) {
    const bucket = store.slice[key];
    if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) return;
    RAW_DB[key][slug] = bucket[slug];
  });
  if (store.dailyCounters) RAW_DB.dailyCounters = store.dailyCounters;
}

queuePersist.setMemoryCommitHook(mergeRequestSlice);

function getOrCreateMemoryTenant(tenantSlug) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) {
    throw new Error('tenant slug required');
  }
  const servedToday = queueDay.currentPeriod({
    operating_mode: 'fixed_close',
    closing_time: '00:00',
    max_wait_hours: 6,
    reset_hour: 4
  }, queueDay.now(), 0);
  if (!MEMORY_DB.queues[slug]) {
    MEMORY_DB.queues[slug] = [
      {
        id: 'q-cs-' + slug,
        tenant_slug: slug,
        name: 'قسم الاستقبال وخدمة العملاء',
        code: 'A',
        target_service_minutes: 6,
        prefix: 'A',
        is_active: true
      },
      {
        id: 'q-contracts-' + slug,
        tenant_slug: slug,
        name: 'قسم العقود والتوثيق',
        code: 'B',
        target_service_minutes: 12,
        prefix: 'B',
        is_active: true
      },
      {
        id: 'q-cashier-' + slug,
        tenant_slug: slug,
        name: 'قسم المالية والمحاسبة',
        code: 'C',
        target_service_minutes: 5,
        prefix: 'C',
        is_active: true
      }
    ];
  }

  if (!MEMORY_DB.counters[slug]) {
    MEMORY_DB.counters[slug] = [
      {
        id: 'cnt-1-' + slug,
        tenant_slug: slug,
        counter_number: 1,
        name: 'كاونتر 1 (الاستقبال)',
        operator_name: 'د. أحمد',
        current_user_id: 'usr-c1-' + slug,
        assigned_queue_ids: ['q-cs-' + slug],
        status: 'active',
        current_ticket_id: null,
        current_session_started_at: null,
        ewma_service_seconds: 360,
        completed_today_count: 14,
        completed_today_service_date: servedToday,
        current_break_id: null
      },
      {
        id: 'cnt-2-' + slug,
        tenant_slug: slug,
        counter_number: 2,
        name: 'كاونتر 2 (العقود)',
        operator_name: 'سارة علي',
        current_user_id: 'usr-c2-' + slug,
        assigned_queue_ids: ['q-contracts-' + slug],
        status: 'active',
        current_ticket_id: null,
        current_session_started_at: null,
        ewma_service_seconds: 720,
        completed_today_count: 9,
        completed_today_service_date: servedToday,
        current_break_id: null
      },
      {
        id: 'cnt-3-' + slug,
        tenant_slug: slug,
        counter_number: 3,
        name: 'كاونتر 3 (المالية والصندوق)',
        operator_name: 'فهد ناصر',
        current_user_id: 'usr-c3-' + slug,
        assigned_queue_ids: ['q-cashier-' + slug],
        status: 'active',
        current_ticket_id: null,
        current_session_started_at: null,
        ewma_service_seconds: 300,
        completed_today_count: 22,
        completed_today_service_date: servedToday,
        current_break_id: null
      }
    ];
  }

  if (!MEMORY_DB.users[slug]) {
    MEMORY_DB.users[slug] = [
      { id: 'usr-rec-' + slug, full_name: 'موظف الاستقبال والمشرف', role: 'receptionist', pin_code: '1111', is_active: true },
      { id: 'usr-c1-' + slug, full_name: 'د. أحمد', role: 'counter_agent', counter_id: 'cnt-1-' + slug, pin_code: '1234', is_active: true },
      { id: 'usr-c2-' + slug, full_name: 'سارة علي', role: 'counter_agent', counter_id: 'cnt-2-' + slug, pin_code: '2345', is_active: true },
      { id: 'usr-c3-' + slug, full_name: 'فهد ناصر', role: 'counter_agent', counter_id: 'cnt-3-' + slug, pin_code: '3456', is_active: true },
      { id: 'usr-sub1-' + slug, full_name: 'خالد المنصور (موظف بديل)', role: 'counter_agent', pin_code: '9999', is_active: true },
      { id: 'usr-rec2-' + slug, full_name: 'نورة السالم (استقبال وردية ثانية)', role: 'receptionist', pin_code: '8888', is_active: true }
    ];
  }

  if (!MEMORY_DB.counterSessions[slug]) {
    MEMORY_DB.counterSessions[slug] = [
      {
        id: 'cs-cnt-1-' + slug,
        tenant_slug: slug,
        counter_id: 'cnt-1-' + slug,
        user_id: 'usr-c1-' + slug,
        operator_name: 'د. أحمد',
        started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        ended_at: null,
        total_served_tickets: 14,
        session_status: 'active',
        closed_by_user_id: null,
        handover_notes: null
      },
      {
        id: 'cs-cnt-2-' + slug,
        tenant_slug: slug,
        counter_id: 'cnt-2-' + slug,
        user_id: 'usr-c2-' + slug,
        operator_name: 'سارة علي',
        started_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        ended_at: null,
        total_served_tickets: 9,
        session_status: 'active',
        closed_by_user_id: null,
        handover_notes: null
      },
      {
        id: 'cs-cnt-3-' + slug,
        tenant_slug: slug,
        counter_id: 'cnt-3-' + slug,
        user_id: 'usr-c3-' + slug,
        operator_name: 'فهد ناصر',
        started_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        ended_at: null,
        total_served_tickets: 22,
        session_status: 'active',
        closed_by_user_id: null,
        handover_notes: null
      }
    ];
  }

  if (!MEMORY_DB.agentBreaks[slug]) MEMORY_DB.agentBreaks[slug] = [];
  if (!MEMORY_DB.receptionHandovers[slug]) MEMORY_DB.receptionHandovers[slug] = [];
  if (!MEMORY_DB.overrides[slug]) {
    MEMORY_DB.overrides[slug] = {
      state_revision: 1,
      capacity_override_delta: 0,
      extended_closing_minutes: 0,
      paused_until: null,
      is_force_locked_today: false,
      lock_reason: null,
      pause_reason: null,
      updated_at: new Date().toISOString()
    };
  }
  if (!MEMORY_DB.auditLogs[slug]) MEMORY_DB.auditLogs[slug] = [];
  if (!MEMORY_DB.idempotencyKeys[slug]) MEMORY_DB.idempotencyKeys[slug] = {};

  if (!MEMORY_DB.tickets[slug]) MEMORY_DB.tickets[slug] = [];
  if (!MEMORY_DB.serviceLogs[slug]) MEMORY_DB.serviceLogs[slug] = [];
  if (!MEMORY_DB.settings[slug]) {
    MEMORY_DB.settings[slug] = {
      tenant_slug: slug,
      is_enabled: true,
      service_mode: 'hybrid', // 'booking', 'queue', 'hybrid'
      alert_threshold: 2,
      safety_multiplier: 1.15,
      snooze_minutes: 5,
      ewma_alpha: 0.30,
      enable_web_push: true,
      enable_whatsapp_alerts: true,
      sound_notifications: true,

      // حزمة الامتثال والأنظمة السعودية (Saudi Compliance Pack)
      saudi_compliance_enabled: true,
      city: 'Riyadh',
      timezone: 'Asia/Riyadh',
      prayer_breaks: {
        enabled: true,
        auto_sync_umm_al_qura: true,
        break_duration_minutes: 20,
        friday_prayer_duration_minutes: 45,
        show_spiritual_display: true,
        custom_message_ar: 'تقبل الله طاعتكم — استراحة صلاة، نستأنف خدمتكم قريباً وتذكرتك محفوظة.'
      },
      labor_law_compliance: {
        max_continuous_work_hours: 5, // المادة 101: حظر تشغيل العامل أكثر من 5 ساعات متواصلة دون راحة
        mandatory_rest_minutes: 30,
        max_daily_shift_hours: 8,
        ramadan_mode: false,
        enforce_agent_rotation: true
      },
      display_mode: {
        freeze_ewma_during_breaks: true,
        notify_waiting_whatsapp: true,
        audio_chime_on_resume: true
      },
      operating_mode: 'fixed_close',
      closing_time: '00:00',
      max_wait_hours: 6,
      reset_hour: 4
    };
  }
  if (!MEMORY_DB.sseClients[slug]) MEMORY_DB.sseClients[slug] = [];
  if (!MEMORY_DB.zones[slug]) MEMORY_DB.zones[slug] = [];
  if (!MEMORY_DB.kiosks[slug]) MEMORY_DB.kiosks[slug] = [];
  if (!MEMORY_DB.appointments[slug]) MEMORY_DB.appointments[slug] = [];
  if (!MEMORY_DB.entitlements[slug]) {
    MEMORY_DB.entitlements[slug] = {
      tenant_slug: slug,
      plan_tier: 'starter',
      included_zones_quota: 1,
      extra_zones_purchased: 0,
      extra_zone_unit_price_sar: 149.00,
      on_premise_addon_enabled: false,
      on_premise_license_key: null,
      license_expires_at: null,
      hardware_fingerprint: null,
      updated_at: new Date().toISOString()
    };
  }
  if (!MEMORY_DB.addonInvoices[slug]) MEMORY_DB.addonInvoices[slug] = [];
  if (!MEMORY_DB.hallPolicies[slug]) {
    MEMORY_DB.hallPolicies[slug] = queueGate.defaultHallPolicy({
      city: (MEMORY_DB.settings[slug] && MEMORY_DB.settings[slug].city) || 'Riyadh'
    });
  }
  if (MEMORY_DB.displayPreviews[slug] === undefined) MEMORY_DB.displayPreviews[slug] = null;
  return slug;
}


function staffSecret() {
  return process.env.QUEUE_STAFF_SECRET || process.env.ADMIN_PIN || 'mken-queue-staff';
}

function signStaffToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', staffSecret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function readStaffToken(req) {
  const h = req.headers || {};
  const raw = String((h.authorization || '').replace(/^Bearer\s+/i, '') || h['x-queue-staff-token'] || '').trim();
  if (!raw || raw.indexOf('.') === -1) return null;
  const parts = raw.split('.');
  const body = parts[0];
  const sig = parts[1];
  const expect = crypto.createHmac('sha256', staffSecret()).update(body).digest('base64url');
  if (expect !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch (e) {
    return null;
  }
}

function requirePolicyStaff(req) {
  const tok = readStaffToken(req);
  if (tok && (tok.role === 'admin' || tok.role === 'receptionist')) return tok;
  return null;
}

function issuedTodayCount(slug) {
  const key = queueGate.ksaDateKey();
  return (MEMORY_DB.tickets[slug] || []).filter((t) => {
    const day = t.ticket_date || String(t.booked_at || '').slice(0, 10);
    return day === key && t.status !== 'cancelled';
  }).length;
}

function waitingNowCount(slug) {
  return (MEMORY_DB.tickets[slug] || []).filter(
    (t) => t.status === 'waiting' || t.status === 'bumped'
  ).length;
}

function resolveOperationalGate(slug, opts) {
  const preview = MEMORY_DB.displayPreviews[slug];
  if (opts && opts.allowPreview && preview && preview.until && new Date(preview.until) > new Date() && preview.gate) {
    return Object.assign({ preview: true }, preview.gate);
  }
  const settings = MEMORY_DB.settings[slug] || {};
  const prayer = checkPrayerStatus(settings.city || 'Riyadh');
  return queueGate.evaluateGate({
    policy: MEMORY_DB.hallPolicies[slug] || queueGate.defaultHallPolicy(),
    override: MEMORY_DB.overrides[slug] || {},
    prayer: prayer,
    issuedToday: issuedTodayCount(slug),
    waitingNow: waitingNowCount(slug),
    holidays: queueGate.KSA_OFFICIAL_HOLIDAYS
  });
}

function gateRejectBody(gate) {
  return {
    ok: false,
    error: gate.message_ar,
    gate_state: gate.gate_state,
    message_ar: gate.message_ar,
    next_open: gate.next_open || null,
    is_paused: gate.gate_state === 'paused',
    is_locked: gate.gate_state === 'force_locked'
  };
}

async function hydrateHallPolicy(slug, branchId) {
  const current = MEMORY_DB.hallPolicies[slug];
  if (current && current._persistedLoaded) return;
  try {
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseKey = sbEnv.getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      if (current) current._persistedLoaded = true;
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('branch_queue_policies')
      .select('*')
      .eq('tenant_slug', slug)
      .eq('branch_id', branchId || 'default')
      .maybeSingle();
    if (data) {
      MEMORY_DB.hallPolicies[slug] = queueGate.policyFromDbRow(data);
    }
  } catch (e) {}
  if (MEMORY_DB.hallPolicies[slug]) MEMORY_DB.hallPolicies[slug]._persistedLoaded = true;
}

async function persistHallPolicy(slug, policy, supervisorId, branchId) {
  try {
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseKey = sbEnv.getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('branch_queue_policies').upsert(
      queueGate.policyToDbRow(slug, policy, supervisorId, branchId || 'default'),
      { onConflict: 'tenant_slug,branch_id' }
    );
  } catch (e) {}
}

async function updatePosLinkStatus(slug, ticketId, linkStatus, extra = {}) {
  try {
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseKey = sbEnv.getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey || !ticketId) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase
      .from('queue_ticket_pos_link')
      .update({
        link_status: linkStatus,
        updated_at: new Date().toISOString(),
        ...extra
      })
      .eq('tenant_slug', slug)
      .eq('ticket_id', ticketId);
  } catch (e) {}
}

function resolveZone(slug, zoneIdOrCode) {
  if (!zoneIdOrCode) return null;
  const zones = MEMORY_DB.zones[slug] || [];
  const found = zones.find(z => z.id === zoneIdOrCode || (z.code && z.code.toLowerCase() === String(zoneIdOrCode).toLowerCase()));
  return found || null;
}

function broadcastSSE(tenantSlug, event, data, filterOpts) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  if (!slug) return;
  const clients = MEMORY_DB.sseClients[slug] || [];
  if (!clients.length) return;
  let body = data && typeof data === 'object' ? Object.assign({}, data) : data;
  if (body && typeof body === 'object') {
    if (!body.state_revision && MEMORY_DB.overrides && MEMORY_DB.overrides[slug]) {
      body.state_revision = MEMORY_DB.overrides[slug].state_revision;
    }
    body = queueGuard.redactPublicEvent(body);
    queuePersist.noteEvent(event, body);
  }
  const payload = `event: ${event}\ndata: ${JSON.stringify(body)}\n\n`;

  // استخراج معايير التصفية للقنوات المحددة النطاق (Scoped Channels)
  const targetZoneId = (filterOpts && filterOpts.zoneId) ||
    (data && data.ticket && data.ticket.zone_id) ||
    (data && data.counter && data.counter.zone_id) ||
    null;
  const oldZoneId = (filterOpts && filterOpts.oldZoneId) || null;
  const targetSessionToken = (filterOpts && filterOpts.sessionToken) ||
    (data && data.ticket && data.ticket.session_token) ||
    (data && data.sessionToken) ||
    null;
  const targetBranchId = (filterOpts && filterOpts.branchId) ||
    (data && data.ticket && data.ticket.branch_id) ||
    (data && data.counter && data.counter.branch_id) ||
    null;

  const isGlobalEvent = ['config_updated', 'override_applied', 'system_notice', 'reception_handover'].includes(event);

  for (let i = clients.length - 1; i >= 0; i--) {
    const client = clients[i];
    try {
      const meta = client._meta || {};

      // 1. عزل الفروع: إذا حدد كلاهما فرعاً وكان مختلفاً، لا يُرسل
      if (targetBranchId && meta.branchId && meta.branchId !== 'default' && targetBranchId !== 'default' && meta.branchId !== targetBranchId) {
        continue;
      }

      let shouldSend = false;

      // 2. قناة التذكرة الفردية للمريض (${tenantSlug}:ticket:${sessionToken})
      if (meta.sessionToken) {
        if (targetSessionToken && meta.sessionToken === targetSessionToken) {
          shouldSend = true;
        }
      }
      // 3. قناة شاشة/استقبال المنطقة (${tenantSlug}:branch:${branchId}:zone:${zoneId})
      else if (meta.zoneId) {
        if (isGlobalEvent) {
          shouldSend = true;
        } else if (targetZoneId && meta.zoneId === targetZoneId) {
          shouldSend = true;
        } else if (oldZoneId && meta.zoneId === oldZoneId) {
          shouldSend = true;
        } else if (!targetZoneId && !oldZoneId) {
          shouldSend = true;
        }
      }
      // 4. قناة المشرف العام والاشتراك الشامل (${tenantSlug}:branch:${branchId}:all)
      else {
        shouldSend = true;
      }

      if (shouldSend) {
        client.write(payload);
      }
    } catch (e) {
      clients.splice(i, 1);
    }
  }
}

// ====================================================================
// 2. المحرك الحسابي الزمني الذكي (Dynamic Time Engine)
// ====================================================================

function calculateOutlierBounds(durations) {
  if (!durations || durations.length < 4) return null;
  const n = durations.length;
  const mean = durations.reduce((a, b) => a + b, 0) / n;
  const variance = durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    mean,
    stdDev,
    min: Math.max(30, mean - 2 * stdDev),
    max: mean + 2 * stdDev
  };
}

function updateEWMA(currentEWMA, sampleSeconds, alpha = 0.30, isOutlier = false) {
  if (isOutlier) return currentEWMA;
  if (!currentEWMA || currentEWMA <= 0) return sampleSeconds;
  return Math.round((alpha * sampleSeconds) + ((1 - alpha) * currentEWMA));
}

function calculateQueueThroughput(activeCounters, defaultTargetMinutes) {
  if (!activeCounters || !activeCounters.length) {
    return 1 / (defaultTargetMinutes || 10);
  }
  let totalThroughputPerMinute = 0;
  for (const counter of activeCounters) {
    const ewmaMinutes = (counter.ewma_service_seconds ? counter.ewma_service_seconds / 60 : defaultTargetMinutes) || defaultTargetMinutes;
    totalThroughputPerMinute += (1 / Math.max(1, ewmaMinutes));
  }
  return totalThroughputPerMinute > 0 ? totalThroughputPerMinute : (1 / (defaultTargetMinutes || 10));
}

function calculateETW(positionInQueue, throughput, safetyMultiplier = 1.15) {
  if (positionInQueue <= 0) return 0;
  const rawMinutes = positionInQueue / throughput;
  const etw = Math.ceil(rawMinutes * (safetyMultiplier || 1.15));
  return Math.max(1, etw);
}

// ====================================================================
// مواقيت الصلاة ونظام العمل السعودي (Saudi Prayer & Labor Law Engine)
// ====================================================================

const PRAYER_SCHEDULES = {
  Riyadh: [
    { name: 'الظهر', startMinutes: 705, endMinutes: 725, timeStr: '11:45' },
    { name: 'العصر', startMinutes: 905, endMinutes: 925, timeStr: '15:05' },
    { name: 'المغرب', startMinutes: 1035, endMinutes: 1055, timeStr: '17:15' },
    { name: 'العشاء', startMinutes: 1125, endMinutes: 1145, timeStr: '18:45' }
  ],
  Jeddah: [
    { name: 'الظهر', startMinutes: 735, endMinutes: 755, timeStr: '12:15' },
    { name: 'العصر', startMinutes: 935, endMinutes: 955, timeStr: '15:35' },
    { name: 'المغرب', startMinutes: 1065, endMinutes: 1085, timeStr: '17:45' },
    { name: 'العشاء', startMinutes: 1155, endMinutes: 1175, timeStr: '19:15' }
  ],
  Makkah: [
    { name: 'الظهر', startMinutes: 733, endMinutes: 753, timeStr: '12:13' },
    { name: 'العصر', startMinutes: 933, endMinutes: 953, timeStr: '15:33' },
    { name: 'المغرب', startMinutes: 1063, endMinutes: 1083, timeStr: '17:43' },
    { name: 'العشاء', startMinutes: 1153, endMinutes: 1173, timeStr: '19:13' }
  ],
  Dammam: [
    { name: 'الظهر', startMinutes: 690, endMinutes: 710, timeStr: '11:30' },
    { name: 'العصر', startMinutes: 890, endMinutes: 910, timeStr: '14:50' },
    { name: 'المغرب', startMinutes: 1020, endMinutes: 1040, timeStr: '17:00' },
    { name: 'العشاء', startMinutes: 1110, endMinutes: 1130, timeStr: '18:30' }
  ]
};

function getSaudiCurrentMinuteOfDay() {
  const d = new Date();
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  const ksaHours = (utcHours + 3) % 24;
  return (ksaHours * 60) + utcMinutes;
}

function checkPrayerStatus(cityName, minuteOfDay, isFriday = false) {
  const schedule = PRAYER_SCHEDULES[cityName] || PRAYER_SCHEDULES.Riyadh;
  const currentMin = minuteOfDay !== undefined ? minuteOfDay : getSaudiCurrentMinuteOfDay();

  for (const prayer of schedule) {
    const endMin = (isFriday && prayer.name === 'الظهر') ? (prayer.startMinutes + 45) : prayer.endMinutes;
    if (currentMin >= prayer.startMinutes && currentMin <= endMin) {
      return {
        in_prayer_break: true,
        current_prayer: prayer.name,
        prayer_time: prayer.timeStr,
        resume_minutes_remaining: endMin - currentMin,
        resume_time_str: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        spiritual_message_ar: 'تقبل الله طاعتكم — استراحة صلاة، نستأنف خدمتكم قريباً وتذكرتك محفوظة.'
      };
    }
  }

  const nextPrayer = schedule.find(p => p.startMinutes > currentMin);
  return {
    in_prayer_break: false,
    next_prayer: nextPrayer ? nextPrayer.name : 'الفجر',
    next_prayer_time: nextPrayer ? nextPrayer.timeStr : '04:45',
    minutes_until_next_prayer: nextPrayer ? (nextPrayer.startMinutes - currentMin) : null
  };
}

// ====================================================================
// 3. خوارزمية فرز وترتيب الطوابير وفق مصفوفة الأولويات الذكية
// ====================================================================

/**
 * فرز التذاكر وفق 3 مستويات للأولوية:
 * 1. Immediate Next (أولوية فورية): يوضع على رأس الطابور مباشرة.
 * 2. Fair FIFO (أسبقية زمنية عادلة): تعتمد وقت الوصول الأصلي للمنشأة (first_arrived_at).
 * 3. Standard (ذيل الطابور): تعتمد وقت الوصول أو التحويل للقسم الحالي (transferred_at || booked_at).
 */
function hashNationalId(raw) {
  const clean = String(raw || '').trim().replace(/\D/g, '');
  if (!clean) return null;
  const secret = process.env.NATIONAL_ID_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mken-national-id-pdpl-hmac-2026';
  return crypto.createHmac('sha256', secret).update(clean).digest('hex');
}

function hashKioskToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '').trim()).digest('hex');
}

/**
 * خوارزمية فرز وترتيب الطوابير الذكية وفق 4 مستويات للأولوية مع منع التجويع (Starvation Prevention):
 * 1. Immediate Next (أولوية فورية): الحالات الطارئة والمحولة فوراً على رأس الطابور.
 * 2. Scheduled Appointment (المواعيد المجدولة المؤكدة): مرتبة تصاعدياً حسب scheduled_time.
 * 3. Fair FIFO (أسبقية عادلة): المحولون بين الأقسام لحفظ وقت وصولهم الأصلي first_arrived_at.
 * 4. Standard (الحضور المباشر): بحسب وقت الوصول booked_at.
 * - يتم تطبيق appointment_interleave_ratio (افتراضياً 3 مواعيد ثم 1 انتظار مباشر) لمنع تجويع المرضى بدون موعد.
 */
function queueClock(slug) {
  const settings = (MEMORY_DB.settings && MEMORY_DB.settings[slug]) || {};
  const override = MEMORY_DB.overrides && MEMORY_DB.overrides[slug];
  return {
    settings: settings,
    extended: override ? Number(override.extended_closing_minutes) || 0 : 0,
    now: queueDay.now()
  };
}

function sortEligibleTickets(ticketsList, hallPolicy, counterState) {
  if (!ticketsList || !ticketsList.length) return [];

  const immediateTickets = [];
  const appointmentTickets = [];
  const walkinTickets = [];

  for (let i = 0; i < ticketsList.length; i++) {
    const t = ticketsList[i];
    const isImm = t.priority_level === 'immediate_next' || t.is_immediate_next || t.is_bumped;
    if (isImm) {
      immediateTickets.push(t);
    } else if (t.priority_level === 'scheduled_appointment') {
      appointmentTickets.push(t);
    } else {
      walkinTickets.push(t);
    }
  }

  // فرز الفوري: الأقدم استدعاءً أو تحويلاً
  immediateTickets.sort((a, b) => {
    const aTime = new Date(a.transferred_at || a.called_at || a.booked_at).getTime();
    const bTime = new Date(b.transferred_at || b.called_at || b.booked_at).getTime();
    return aTime - bTime;
  });

  // فرز المواعيد: تصاعدياً حسب الوقت المجدول (scheduled_time)
  appointmentTickets.sort((a, b) => {
    const aSched = a.scheduled_time ? new Date(a.scheduled_time).getTime() : new Date(a.first_arrived_at || a.booked_at).getTime();
    const bSched = b.scheduled_time ? new Date(b.scheduled_time).getTime() : new Date(b.first_arrived_at || b.booked_at).getTime();
    if (aSched !== bSched) return aSched - bSched;
    const aArr = new Date(a.first_arrived_at || a.booked_at).getTime();
    const bArr = new Date(b.first_arrived_at || b.booked_at).getTime();
    return aArr - bArr;
  });

  // فرز الحضور المباشر والمحولين (fair_fifo أولاً ثم standard)
  walkinTickets.sort((a, b) => {
    const aFair = a.priority_level === 'fair_fifo';
    const bFair = b.priority_level === 'fair_fifo';
    if (aFair && !bFair) return -1;
    if (!aFair && bFair) return 1;

    const aEffectiveDate = (aFair && a.first_arrived_at)
      ? new Date(a.first_arrived_at).getTime()
      : new Date(a.transferred_at || a.booked_at).getTime();
    const bEffectiveDate = (bFair && b.first_arrived_at)
      ? new Date(b.first_arrived_at).getTime()
      : new Date(b.transferred_at || b.booked_at).getTime();
    return aEffectiveDate - bEffectiveDate;
  });

  // نسبة التمرير التبادلي لمنع التجويع
  const ratio = (hallPolicy && typeof hallPolicy.appointment_interleave_ratio === 'number')
    ? hallPolicy.appointment_interleave_ratio
    : 3;

  if (appointmentTickets.length === 0) {
    return immediateTickets.concat(walkinTickets);
  }
  if (walkinTickets.length === 0 || ratio <= 0) {
    return immediateTickets.concat(appointmentTickets, walkinTickets);
  }

  // إذا وصل الكاونتر إلى الحد الأقصى للمواعيد المتتالية، يُمنح الدور لمراجع الحضور المباشر
  const consecutiveServed = (counterState && typeof counterState.consecutive_appointments_served === 'number')
    ? counterState.consecutive_appointments_served
    : 0;

  if (consecutiveServed >= ratio && walkinTickets.length > 0) {
    const priorityWalkin = walkinTickets[0];
    const restWalkin = walkinTickets.slice(1);
    return immediateTickets.concat([priorityWalkin], appointmentTickets, restWalkin);
  }

  const merged = [];
  let aIdx = 0;
  let wIdx = 0;

  while (aIdx < appointmentTickets.length || wIdx < walkinTickets.length) {
    for (let r = 0; r < ratio && aIdx < appointmentTickets.length; r++) {
      merged.push(appointmentTickets[aIdx++]);
    }
    if (wIdx < walkinTickets.length) {
      merged.push(walkinTickets[wIdx++]);
    }
  }

  return immediateTickets.concat(merged);
}

function optionalCustomerName(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const name = String(value).trim();
  if (!name || name === 'undefined' || name === 'null') return '';
  return name.slice(0, 120);
}

function optionalCustomerPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const raw = String(value).trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';
  return raw.replace(/\D/g, '');
}

function isCustomerInServiceElsewhere(slug, customerPhone, sessionToken, excludeQueueId) {
  const tickets = MEMORY_DB.tickets[slug] || [];
  return tickets.find(t => 
    ['in_service', 'called'].includes(t.status) &&
    t.queue_id !== excludeQueueId &&
    ((sessionToken && t.session_token === sessionToken) || (customerPhone && t.customer_phone === customerPhone))
  );
}

async function notifyCustomer(slug, ticket, title, message, url) {
  try {
    if (!ticket || !ticket.push_subscription) return;
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseKey = sbEnv.getSupabaseServiceKey();
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      try {
        await pushLib.sendPushToTenant(supabase, slug, title, message, url || `/queue.html?token=${ticket.session_token}`);
      } catch (e) {
        console.warn('[Queue Push Warning]', e.message);
      }
    }
  } catch (err) {
    console.warn('[Notify Error]', err.message);
  }
}

// ====================================================================
// معالج الطلبات الرئيسي (Vercel Serverless Function)
// ====================================================================
async function queueHandler(req, res) {
  const corsDone = await handleCors(req, res);
  if (corsDone) return;
  queuePersist.bindRequest();

  const urlPath = String(req.url || '').split('?')[0];
  let action = (req.query && req.query.action) || (req.body && req.body.action) || '';
  if (!action) {
    if (urlPath.endsWith('/api/queue/tickets')) {
      action = req.method === 'POST' ? 'manual-ticket' : 'list-tickets';
    } else if (urlPath.endsWith('/api/queue/intake/status')) {
      action = 'intake-status';
    } else {
      action = 'list-queues';
    }
  }

  // Host or verified session only. ?tenant= and body.tenantSlug are not a source of truth.
  const resolved = queueGuard.resolveQueueTenant(req);
  if (resolved.error) {
    return res.status(resolved.status).json({
      ok: false,
      error: resolved.error,
      code: resolved.code
    });
  }
  const tenantSlug = getOrCreateMemoryTenant(resolved.slug);
  await queuePersist.prepare(tenantSlug, MEMORY_DB);
  const memoryFp = queuePersist.fingerprint(tenantSlug, MEMORY_DB);
  const staffToken = readStaffToken(req);
  const staff = resolved.staff || Boolean(staffToken && (!staffToken.tenant_slug || staffToken.tenant_slug === resolved.slug));
  const queueRole = queueGuard.queueRoleFromSession(resolved.session);

  const kioskTokenHeader = req.headers['x-kiosk-token'] || (req.query && req.query.kioskToken) || (req.body && req.body.kioskToken) || null;
  let kioskContext = null;
  let isKiosk = false;

  if (kioskTokenHeader) {
    const rawTok = String(kioskTokenHeader).trim();
    const tokHash = hashKioskToken(rawTok);
    const kiosks = MEMORY_DB.kiosks[tenantSlug] || [];
    kioskContext = kiosks.find(k => (k.token_hash === tokHash || k.token === rawTok) && k.is_active !== false) || null;
    if (kioskContext) {
      isKiosk = true;
      kioskContext.last_heartbeat_at = new Date().toISOString();
    }
  }
  let reqBranchId = (req.query && (req.query.branchId || req.query.branch_id)) ||
    (req.body && (req.body.branchId || req.body.branch_id)) ||
    (resolved.session && (resolved.session.branchId || resolved.session.branch_id)) ||
    (kioskContext && kioskContext.branch_id) ||
    'default';
  let reqZoneId = (req.query && (req.query.zoneId || req.query.zone_id || req.query.zone)) ||
    (req.body && (req.body.zoneId || req.body.zone_id || req.body.zone)) ||
    (kioskContext && kioskContext.zone_id) ||
    null;
  const byTicketId = Boolean((req.query && req.query.ticket_id) || (req.body && req.body.ticket_id));
  const byToken = Boolean(
    (req.query && (req.query.session_token || req.query.token)) ||
    (req.body && (req.body.session_token || req.body.token))
  );

  if (typeof res.json === 'function') {
    const origJson = res.json.bind(res);
    res.json = function presentJson(data) {
      return Promise.resolve()
        .then(function () {
          return queuePersist.finish(tenantSlug, MEMORY_DB, memoryFp);
        })
        .then(function () {
          return origJson(queueGuard.present(data, {
            action: action,
            staff: staff,
            byTicketId: byTicketId,
            byToken: byToken
          }));
        });
    };
  }

  async function commitMutation(mutate) {
    if (queuePersist.mode() === 'memory') {
      const outcome = mutate();
      if (outcome && outcome.afterCommit) outcome.afterCommit();
      return outcome;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const outcome = mutate();
      if (!outcome || !outcome.persist) {
        if (outcome && outcome.afterCommit) outcome.afterCommit();
        return outcome;
      }
      try {
        await queuePersist.finish(tenantSlug, MEMORY_DB, memoryFp);
        if (outcome.afterCommit) outcome.afterCommit();
        return outcome;
      } catch (err) {
        queuePersist.clearEvents();
        if (!queuePersist.isConflict(err) || attempt === 5) throw err;
        await queuePersist.reload(tenantSlug, MEMORY_DB);
      }
    }
    throw new Error('queue_version_conflict');
  }

  function respond(outcome) {
    return res.status(outcome.status).json(outcome.body);
  }

  async function claimAndRespond(counterId, ticketId, statuses, messages) {
    const claimed = await queuePersist.callNext(tenantSlug, counterId, ticketId, statuses);
    if (!claimed || claimed.code === 'counter_missing') {
      return res.status(404).json({ error: messages.missingCounter });
    }
    if (claimed.code === 'on_break') {
      return res.status(400).json({ error: messages.onBreak });
    }
    if (claimed.code === 'empty' || claimed.code === 'missing' || claimed.code === 'taken') {
      return res.status(200).json({ ok: true, message: messages.empty, ticket: null });
    }
    queuePersist.adoptClaim(tenantSlug, MEMORY_DB, claimed);
    (claimed.bumped || []).forEach(function (bumped) {
      notifyCustomer(
        tenantSlug,
        bumped,
        '🛡️ تم تأمين موقعك في الطابور',
        'تم تأمين موقعك في طابور (' + (bumped.queue_name || '') + ')؛ سيتم طلبك فور فراغك من المعاملة الحالية دون فقدان دورك.'
      );
    });
    if (claimed.code === 'bumped_only') {
      return res.status(200).json({
        ok: true,
        message: 'العميل الحالي قيد الخدمة في مسار آخر وتم تأمين موقعه (+1 Bump). لا يوجد عملاء آخرين تالين حالياً.',
        ticket: null,
        bumpedTicket: (claimed.bumped && claimed.bumped[claimed.bumped.length - 1]) || null
      });
    }
    notifyCustomer(
      tenantSlug,
      claimed.ticket,
      messages.title,
      messages.detail(claimed.ticket, claimed.counter)
    );
    broadcastSSE(tenantSlug, 'ticket_called', Object.assign({
      ticket: claimed.ticket,
      counter: claimed.counter
    }, messages.extra || {}));
    return res.status(200).json({ ok: true, ticket: claimed.ticket, counter: claimed.counter });
  }

  try {
    const dayResult = await queuePersist.ensureRollover(tenantSlug, MEMORY_DB);
    if (dayResult && Array.isArray(dayResult.expiredIds) && dayResult.expiredIds.length) {
      broadcastSSE(tenantSlug, 'tickets_expired', {
        count: dayResult.expiredIds.length,
        period: dayResult.period
      });
    }
    if (STAFF_ONLY_ACTIONS.has(action) && !staff) {
      return res.status(401).json({
        ok: false,
        error: 'يلزم تسجيل دخول موظف هذه المنشأة.',
        code: 'AUTH_REQUIRED'
      });
    }
    if (action === 'get-ticket-status' && byTicketId && !byToken && !staff) {
      return res.status(401).json({
        ok: false,
        error: 'استعلام التذكرة بالمعرّف متاح لموظفي المنشأة فقط.',
        code: 'AUTH_REQUIRED'
      });
    }

    // ---------------------------------------------------------------
    // 1. بث الأحداث اللحظية عبر Server-Sent Events (SSE)
    // ---------------------------------------------------------------
    if (action === 'events') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const branchId = reqBranchId;
      const matchedZone = resolveZone(tenantSlug, reqZoneId);
      const zoneId = matchedZone ? matchedZone.id : (reqZoneId ? String(reqZoneId) : null);
      const sessionToken = (req.query && (req.query.sessionToken || req.query.session_token)) ||
        (req.body && (req.body.sessionToken || req.body.session_token)) ||
        null;

      res._meta = {
        tenantSlug,
        branchId,
        zoneId,
        sessionToken: sessionToken ? String(sessionToken) : null
      };

      res.write(`event: connected\ndata: ${JSON.stringify({
        status: 'connected',
        tenant: tenantSlug,
        branchId,
        zoneId,
        sessionToken
      })}\n\n`);
      MEMORY_DB.sseClients[tenantSlug].push(res);

      let closed = false;
      req.on('close', () => {
        closed = true;
        const idx = MEMORY_DB.sseClients[tenantSlug].indexOf(res);
        if (idx !== -1) MEMORY_DB.sseClients[tenantSlug].splice(idx, 1);
      });

      if (queuePersist.mode() !== 'memory') {
        let after = await queuePersist.latestEventId(tenantSlug);
        const timer = setInterval(function () {
          if (closed) {
            clearInterval(timer);
            return;
          }
          queuePersist.pollEvents(tenantSlug, after).then(function (rows) {
            rows.forEach(function (row) {
              after = Number(row.id);
              const safe = queueGuard.redactPublicEvent(row.payload);
              try {
                res.write('event: ' + row.event_name + '\ndata: ' + JSON.stringify(safe) + '\n\n');
              } catch (err) {
                closed = true;
                clearInterval(timer);
              }
            });
          }).catch(function (err) {
            console.warn('[Queue SSE poll]', err.message);
          });
        }, 1000);
        if (typeof timer.unref === 'function') timer.unref();
      }
      return;
    }

    // ---------------------------------------------------------------
    // 1.5 إدارة مناطق ومكاتب الاستقبال (Multi-Zone / Multi-Reception)
    // ---------------------------------------------------------------
    if (action === 'list-zones') {
      const branchId = reqBranchId;
      const zones = MEMORY_DB.zones[tenantSlug] || [];
      const filtered = zones.filter(z => {
        if (req.query?.all === 'true' || req.query?.include_inactive === 'true') {
          return !branchId || branchId === 'default' || z.branch_id === branchId;
        }
        return z.is_active !== false && (!branchId || branchId === 'default' || z.branch_id === branchId);
      });
      return res.status(200).json({ ok: true, zones: filtered });
    }

    if (action === 'upsert-zone') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف أو موظف الاستقبال.', code: 'AUTH_REQUIRED' });
      }
      const body = req.body || {};
      const zones = MEMORY_DB.zones[tenantSlug] || (MEMORY_DB.zones[tenantSlug] = []);
      const zoneId = body.id || body.zoneId || ('zone_' + Math.random().toString(36).substring(2, 9));
      const code = String(body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim();

      if (!code || !name) {
        return res.status(400).json({ ok: false, error: 'الاسم والرمز حقلان إلزاميان لمنطقة الاستقبال.' });
      }

      let existing = zones.find(z => z.id === zoneId || (z.code && z.code.toUpperCase() === code));

      const isActivating = !existing || (existing.is_active === false && body.is_active !== false);
      if (isActivating) {
        const activeZonesCount = zones.filter(z => z.is_active !== false).length;
        let maxAllowed = 1;
        let unitPrice = 149.00;

        if (onpremLicense.isDeploymentOnPremise()) {
          const onpremKey = process.env.ONPREM_LICENSE_KEY || (MEMORY_DB.entitlements[tenantSlug] && MEMORY_DB.entitlements[tenantSlug].on_premise_license_key);
          const check = onpremLicense.verifyLicenseKey(onpremKey, null, tenantSlug);
          if (!check.valid) {
            return res.status(403).json({
              ok: false,
              error: 'ONPREM_LICENSE_INVALID',
              code: check.error || 'LICENSE_INVALID',
              message: check.message || 'ترخيص التشغيل المحلي غير صالح.'
            });
          }
          maxAllowed = check.payload?.max_zones || 1;
        } else {
          const entitlement = MEMORY_DB.entitlements[tenantSlug] || { included_zones_quota: 1, extra_zones_purchased: 0, extra_zone_unit_price_sar: 149.00 };
          maxAllowed = (parseInt(entitlement.included_zones_quota, 10) || 1) + (parseInt(entitlement.extra_zones_purchased, 10) || 0);
          unitPrice = parseFloat(entitlement.extra_zone_unit_price_sar) || 149.00;
        }

        if (activeZonesCount >= maxAllowed) {
          return res.status(402).json({
            ok: false,
            error: 'ZONE_QUOTA_EXCEEDED',
            code: 'ZONE_QUOTA_EXCEEDED',
            message: `تم تجاوز الحد المسموح به لمكاتب الاستقبال في باقتك الحالية (${maxAllowed} مكتب/مكاتب). يرجى شراء مكتب استقبال إضافي (+${unitPrice} ر.س/شهرياً).`,
            current_zones: activeZonesCount,
            max_allowed: maxAllowed,
            extra_zone_price_sar: unitPrice,
            upgrade_required: true
          });
        }
      }

      if (existing) {
        existing.code = code;
        existing.name = name;
        if (body.floor_or_building !== undefined) existing.floor_or_building = body.floor_or_building;
        if (body.branch_id !== undefined) existing.branch_id = body.branch_id;
        if (body.settings !== undefined) existing.settings = body.settings;
        if (body.is_active !== undefined) existing.is_active = !!body.is_active;
        existing.updated_at = new Date().toISOString();
      } else {
        existing = {
          id: zoneId,
          tenant_slug: tenantSlug,
          branch_id: body.branch_id || reqBranchId || 'default',
          code: code,
          name: name,
          floor_or_building: body.floor_or_building || null,
          settings: body.settings || {},
          is_active: body.is_active !== false,
          created_at: new Date().toISOString()
        };
        zones.push(existing);
      }

      broadcastSSE(tenantSlug, 'config_updated', { zones, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, zone: existing, zones });
    }

    if (action === 'delete-zone') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const zoneId = (req.body && (req.body.zoneId || req.body.id)) || (req.query && (req.query.zoneId || req.query.id));
      const zones = MEMORY_DB.zones[tenantSlug] || [];
      const zone = zones.find(z => z.id === zoneId);
      if (!zone) {
        return res.status(404).json({ ok: false, error: 'منطقة الاستقبال غير موجودة.' });
      }
      zone.is_active = false;
      zone.updated_at = new Date().toISOString();
      broadcastSSE(tenantSlug, 'config_updated', { zones, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, message: 'تم تعطيل منطقة الاستقبال بنجاح.', zone });
    }

    // ---------------------------------------------------------------
    // 1.5 إدارة التراخيص ومكاتب الاستقبال الإضافية والتشغيل المحلي
    // (Billing Summary, Extra Zones Purchase & On-Premise Add-on)
    // ---------------------------------------------------------------
    if (action === 'billing-summary') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const entitlement = MEMORY_DB.entitlements[tenantSlug] || {
        tenant_slug: tenantSlug,
        plan_tier: 'starter',
        included_zones_quota: 1,
        extra_zones_purchased: 0,
        extra_zone_unit_price_sar: 149.00,
        on_premise_addon_enabled: false,
        on_premise_license_key: null,
        license_expires_at: null,
        hardware_fingerprint: null
      };

      const zones = MEMORY_DB.zones[tenantSlug] || [];
      const activeZonesCount = zones.filter(z => z.is_active !== false).length;
      let maxAllowed = (parseInt(entitlement.included_zones_quota, 10) || 1) + (parseInt(entitlement.extra_zones_purchased, 10) || 0);

      let onpremStatus = null;
      let onpremKey = entitlement.on_premise_license_key;
      if (process.env.DEPLOYMENT_MODE === 'on_premise' && process.env.ONPREM_LICENSE_KEY) {
        onpremKey = process.env.ONPREM_LICENSE_KEY;
      }

      if (onpremKey) {
        onpremStatus = onpremLicense.verifyLicenseKey(onpremKey, null, tenantSlug);
        if (onpremStatus && onpremStatus.valid && onpremStatus.payload && onpremStatus.payload.max_zones) {
          maxAllowed = onpremStatus.payload.max_zones;
        }
      }

      const unitPrice = parseFloat(entitlement.extra_zone_unit_price_sar) || 149.00;
      const extraCount = parseInt(entitlement.extra_zones_purchased, 10) || 0;
      const monthlyExtraSubtotal = Math.round(extraCount * unitPrice * 100) / 100;
      const monthlyExtraVat = Math.round(monthlyExtraSubtotal * 0.15 * 100) / 100;
      const monthlyExtraTotal = Math.round((monthlyExtraSubtotal + monthlyExtraVat) * 100) / 100;

      return res.status(200).json({
        ok: true,
        entitlement: {
          tenant_slug: tenantSlug,
          plan_tier: entitlement.plan_tier || 'starter',
          included_zones_quota: entitlement.included_zones_quota || 1,
          extra_zones_purchased: extraCount,
          max_allowed_zones: maxAllowed,
          active_zones_count: activeZonesCount,
          available_zones_remaining: Math.max(0, maxAllowed - activeZonesCount),
          extra_zone_unit_price_sar: unitPrice,
          monthly_extra_subtotal_sar: monthlyExtraSubtotal,
          monthly_extra_vat_sar: monthlyExtraVat,
          monthly_extra_total_sar: monthlyExtraTotal,
          on_premise_addon_enabled: !!(entitlement.on_premise_addon_enabled || (process.env.DEPLOYMENT_MODE === 'on_premise')),
          on_premise_license_key: onpremKey || entitlement.on_premise_license_key,
          license_expires_at: (onpremStatus && onpremStatus.payload && onpremStatus.payload.expires_at) || entitlement.license_expires_at,
          license_status: onpremStatus
        },
        invoices: (MEMORY_DB.addonInvoices[tenantSlug] || []).slice(-15)
      });
    }

    if (action === 'purchase-extra-zones') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const body = req.body || {};
      const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
      const entitlement = MEMORY_DB.entitlements[tenantSlug] || (MEMORY_DB.entitlements[tenantSlug] = {
        tenant_slug: tenantSlug,
        plan_tier: 'starter',
        included_zones_quota: 1,
        extra_zones_purchased: 0,
        extra_zone_unit_price_sar: 149.00,
        on_premise_addon_enabled: false,
        on_premise_license_key: null,
        license_expires_at: null,
        hardware_fingerprint: null
      });

      const unitPrice = parseFloat(entitlement.extra_zone_unit_price_sar) || 149.00;
      const subtotal = Math.round(quantity * unitPrice * 100) / 100;
      const vat = Math.round(subtotal * 0.15 * 100) / 100;
      const total = Math.round((subtotal + vat) * 100) / 100;

      const invoice = {
        id: 'inv_' + Math.random().toString(36).substring(2, 10),
        tenant_slug: tenantSlug,
        invoice_number: 'INV-ZONE-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
        addon_type: 'extra_zone',
        description: `ترقية سعة مكاتب الاستقبال (+${quantity} مكتب إضافي)`,
        quantity: quantity,
        unit_price_sar: unitPrice,
        subtotal_sar: subtotal,
        tax_rate: 0.15,
        tax_sar: vat,
        total_sar: total,
        status: 'paid',
        zatca_tax_rate: 0.15,
        zatca_qr_payload: 'ZATCA-QR-SIMULATED-' + Date.now(),
        created_at: new Date().toISOString()
      };

      if (!MEMORY_DB.addonInvoices[tenantSlug]) MEMORY_DB.addonInvoices[tenantSlug] = [];
      MEMORY_DB.addonInvoices[tenantSlug].push(invoice);

      entitlement.extra_zones_purchased = (parseInt(entitlement.extra_zones_purchased, 10) || 0) + quantity;
      entitlement.updated_at = new Date().toISOString();

      const newMaxAllowed = (parseInt(entitlement.included_zones_quota, 10) || 1) + entitlement.extra_zones_purchased;

      return res.status(200).json({
        ok: true,
        success: true,
        message: `تم شراء وتفعيل ${quantity} مكتب استقبال إضافي بنجاح. سعتك الحالية أصبحت ${newMaxAllowed} مكاتب استقبال.`,
        purchased_quantity: quantity,
        max_allowed_zones: newMaxAllowed,
        invoice: invoice
      });
    }

    if (action === 'enable-on-premise-addon') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const body = req.body || {};
      const entitlement = MEMORY_DB.entitlements[tenantSlug] || (MEMORY_DB.entitlements[tenantSlug] = {
        tenant_slug: tenantSlug,
        plan_tier: 'starter',
        included_zones_quota: 1,
        extra_zones_purchased: 0,
        extra_zone_unit_price_sar: 149.00,
        on_premise_addon_enabled: false,
        on_premise_license_key: null,
        license_expires_at: null,
        hardware_fingerprint: null
      });

      const maxZones = (parseInt(entitlement.included_zones_quota, 10) || 1) + (parseInt(entitlement.extra_zones_purchased, 10) || 0);
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const licenseKey = onpremLicense.generateLicenseKey({
        tenant_slug: tenantSlug,
        plan_tier: entitlement.plan_tier || 'enterprise',
        max_zones: maxZones,
        max_counters: 100,
        expires_at: expiresAt,
        hardware_fingerprint: body.hardwareFingerprint || null
      });

      entitlement.on_premise_addon_enabled = true;
      entitlement.on_premise_license_key = licenseKey;
      entitlement.license_expires_at = expiresAt;
      if (body.hardwareFingerprint) entitlement.hardware_fingerprint = body.hardwareFingerprint;
      entitlement.updated_at = new Date().toISOString();

      const packagePrice = 4999.00;
      const vat = Math.round(packagePrice * 0.15 * 100) / 100;
      const total = Math.round((packagePrice + vat) * 100) / 100;

      const invoice = {
        id: 'inv_' + Math.random().toString(36).substring(2, 10),
        tenant_slug: tenantSlug,
        invoice_number: 'INV-ONPREM-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
        addon_type: 'on_premise_package',
        description: 'حزمة التشغيل المحلي المستقل (Mken On-Premise Docker Enterprise License)',
        quantity: 1,
        unit_price_sar: packagePrice,
        subtotal_sar: packagePrice,
        tax_rate: 0.15,
        tax_sar: vat,
        total_sar: total,
        status: 'paid',
        zatca_tax_rate: 0.15,
        zatca_qr_payload: 'ZATCA-QR-ONPREM-' + Date.now(),
        created_at: new Date().toISOString()
      };

      if (!MEMORY_DB.addonInvoices[tenantSlug]) MEMORY_DB.addonInvoices[tenantSlug] = [];
      MEMORY_DB.addonInvoices[tenantSlug].push(invoice);

      return res.status(200).json({
        ok: true,
        success: true,
        message: 'تم تفعيل حزمة التشغيل المحلي وتوليد مفتاح الترخيص الرقمي بنجاح.',
        license_key: licenseKey,
        on_premise_license_key: licenseKey,
        license_expires_at: expiresAt,
        max_zones: maxZones,
        invoice: invoice
      });
    }

    // ---------------------------------------------------------------
    // 1.6 إدارة أجهزة الخدمة الذاتية (Self-Service Kiosks)
    // ---------------------------------------------------------------
    if (action === 'list-kiosks') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const kiosks = (MEMORY_DB.kiosks[tenantSlug] || []).map(k => {
        const copy = Object.assign({}, k);
        delete copy.token_hash;
        return copy;
      });
      return res.status(200).json({ ok: true, kiosks });
    }

    if (action === 'upsert-kiosk') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const body = req.body || {};
      const kioskCode = String(body.kiosk_code || body.code || '').trim().toUpperCase();
      const name = String(body.name || '').trim();
      if (!kioskCode || !name) {
        return res.status(400).json({ ok: false, error: 'رمز واسم الكشك حقلان إلزاميان.' });
      }

      const kiosks = MEMORY_DB.kiosks[tenantSlug] || (MEMORY_DB.kiosks[tenantSlug] = []);
      const kioskId = body.id || ('kiosk_' + Math.random().toString(36).substring(2, 9));
      let existing = kiosks.find(k => k.id === kioskId || k.kiosk_code === kioskCode);
      let rawToken = null;

      if (existing) {
        existing.name = name;
        existing.kiosk_code = kioskCode;
        if (body.zone_id !== undefined) existing.zone_id = body.zone_id;
        if (body.branch_id !== undefined) existing.branch_id = body.branch_id;
        if (body.allowed_service_ids !== undefined) existing.allowed_service_ids = body.allowed_service_ids;
        if (body.is_active !== undefined) existing.is_active = !!body.is_active;
        existing.updated_at = new Date().toISOString();
      } else {
        rawToken = 'msk_' + crypto.randomBytes(16).toString('hex');
        existing = {
          id: kioskId,
          tenant_slug: tenantSlug,
          branch_id: body.branch_id || reqBranchId || 'default',
          zone_id: body.zone_id || null,
          kiosk_code: kioskCode,
          name: name,
          token_hash: hashKioskToken(rawToken),
          allowed_service_ids: Array.isArray(body.allowed_service_ids) ? body.allowed_service_ids : [],
          is_active: body.is_active !== false,
          last_heartbeat_at: null,
          created_at: new Date().toISOString()
        };
        kiosks.push(existing);
      }

      return res.status(200).json({
        ok: true,
        kiosk: {
          id: existing.id,
          kiosk_code: existing.kiosk_code,
          name: existing.name,
          zone_id: existing.zone_id,
          branch_id: existing.branch_id,
          allowed_service_ids: existing.allowed_service_ids,
          is_active: existing.is_active
        },
        token: rawToken,
        rawToken: rawToken
      });
    }

    if (action === 'rotate-kiosk-token') {
      if (!staff) {
        return res.status(401).json({ ok: false, error: 'يتطلب صلاحيات المشرف.', code: 'AUTH_REQUIRED' });
      }
      const kioskId = req.body?.kioskId || req.body?.id || req.query?.kioskId;
      const kiosks = MEMORY_DB.kiosks[tenantSlug] || [];
      const kiosk = kiosks.find(k => k.id === kioskId || k.kiosk_code === kioskId);
      if (!kiosk) {
        return res.status(404).json({ ok: false, error: 'الكشك غير موجود.' });
      }

      const rawToken = 'msk_' + crypto.randomBytes(16).toString('hex');
      kiosk.token_hash = hashKioskToken(rawToken);
      kiosk.updated_at = new Date().toISOString();

      return res.status(200).json({
        ok: true,
        kiosk: { id: kiosk.id, kiosk_code: kiosk.kiosk_code, name: kiosk.name },
        token: rawToken,
        rawToken: rawToken
      });
    }

    // ---------------------------------------------------------------
    // 1.7 تسجيل وصول المواعيد (Appointment Self Check-in & HIS Webhook)
    // ---------------------------------------------------------------
    if (action === 'appointment-checkin') {
      const body = req.body || {};
      const appointmentCode = body.appointmentCode || body.barcode || body.appointment_id || body.code;
      const rawNationalId = body.nationalId || body.national_id || body.iqama;
      const rawPhone = body.phone || body.customerPhone || body.patient_phone;
      const deviceId = req.headers['x-device-id'] || body.deviceId || null;

      const nationalIdClean = rawNationalId ? String(rawNationalId).trim().replace(/\D/g, '') : null;
      const identityLast4 = nationalIdClean ? nationalIdClean.slice(-4) : null;
      const nationalIdHash = nationalIdClean ? hashNationalId(nationalIdClean) : null;
      const phoneClean = rawPhone ? String(rawPhone).trim().replace(/\D/g, '') : null;

      if (!appointmentCode && !nationalIdHash && !phoneClean) {
        return res.status(400).json({
          ok: false,
          error: 'يرجى إدخال رقم الهوية/الإقامة أو مسح باركود الموعد أو رقم الجوال.',
          code: 'CHECKIN_PARAMS_REQUIRED'
        });
      }

      const appointments = MEMORY_DB.appointments[tenantSlug] || [];
      const app = appointments.find(a => {
        if (appointmentCode && (a.code === appointmentCode || a.barcode === appointmentCode || a.id === appointmentCode)) {
          return true;
        }
        if (nationalIdHash && (a.national_id_hash === nationalIdHash || (a.national_id && hashNationalId(a.national_id) === nationalIdHash))) {
          return true;
        }
        if (phoneClean && a.patient_phone && a.patient_phone.replace(/\D/g, '') === phoneClean) {
          return true;
        }
        return false;
      });

      if (!app) {
        return res.status(404).json({
          ok: false,
          error: 'لم يتم العثور على موعد مجدول مطابق لبيانات التحقق المدخلة.',
          code: 'APPOINTMENT_NOT_FOUND'
        });
      }

      if (app.checkin_status === 'checked_in' && app.ticket_id) {
        const existingTicket = (MEMORY_DB.tickets[tenantSlug] || []).find(t => t.id === app.ticket_id);
        if (existingTicket && ['waiting', 'called', 'in_service', 'bumped'].includes(existingTicket.status)) {
          return res.status(200).json({
            ok: true,
            isExisting: true,
            ticket: existingTicket,
            message: 'تم تسجيل الوصول لهذا الموعد مسبقاً وتذكرتك فعالة.'
          });
        }
      }

      // التحقق من نافذة الحضور (Check-in Window)
      const scheduledTime = new Date(app.scheduled_time || Date.now());
      const hallPolicy = MEMORY_DB.hallPolicies[tenantSlug] || {};
      const beforeMins = hallPolicy.appointment_window_before_minutes != null ? hallPolicy.appointment_window_before_minutes : 45;
      const afterMins = hallPolicy.appointment_window_after_minutes != null ? hallPolicy.appointment_window_after_minutes : 15;
      const windowStart = new Date(scheduledTime.getTime() - beforeMins * 60000);
      const windowEnd = new Date(scheduledTime.getTime() + afterMins * 60000);
      const now = new Date();

      let assignedPriority = 'scheduled_appointment';
      let checkinNote = 'تأكيد حضور موعد مجدول في وقته';

      if (now < windowStart) {
        const timeStr = scheduledTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        const openStr = windowStart.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        return res.status(400).json({
          ok: false,
          code: 'CHECKIN_TOO_EARLY',
          error: 'تسجيل الوصول يفتح قبل الموعد بـ ' + beforeMins + ' دقيقة (الساعة ' + openStr + '). موعدك مجدول الساعة ' + timeStr + '.',
          scheduledTime: app.scheduled_time,
          checkinOpensAt: windowStart.toISOString()
        });
      } else if (now > windowEnd) {
        const lateAction = hallPolicy.late_appointment_action || 'convert_to_standard';
        if (lateAction === 'require_reception') {
          return res.status(400).json({
            ok: false,
            code: 'CHECKIN_EXPIRED',
            error: 'انتهت نافذة تسجيل الوصول التلقائي للموعد المجدول. يرجى مراجعة موظف الاستقبال لتجديد دورك.',
            scheduledTime: app.scheduled_time
          });
        }
        assignedPriority = 'standard';
        checkinNote = 'حضور متأخر عن نافذة الموعد - تم التحويل لطابور الانتظار العام';
      }

      const queues = MEMORY_DB.queues[tenantSlug] || [];
      const targetQueue = queues.find(q => q.id === app.queue_id || q.id === app.service_id) || queues[0];
      const prefix = targetQueue ? (targetQueue.prefix || targetQueue.code || 'A') : 'A';

      const allocated = await queuePersist.allocate(tenantSlug, targetQueue ? targetQueue.id : 'q-default', prefix, MEMORY_DB);
      const seq = allocated.sequence;
      const ticketNumber = allocated.ticket_number;
      const sessionToken = 'mkn_tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const arrivalNow = new Date().toISOString();

      const newTicket = {
        id: 'tkt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        tenant_slug: tenantSlug,
        branch_id: app.branch_id || (targetQueue && targetQueue.branch_id) || reqBranchId || 'default',
        zone_id: app.zone_id || (targetQueue && targetQueue.zone_id) || (resolveZone(tenantSlug, reqZoneId)?.id) || null,
        queue_id: targetQueue ? targetQueue.id : 'q-default',
        queue_name: targetQueue ? targetQueue.name : 'العيادة',
        ticket_number: ticketNumber,
        daily_sequence: seq,
        customer_name: optionalCustomerName(app.patient_name || body.customerName || 'مراجع بموعد'),
        customer_phone: optionalCustomerPhone(app.patient_phone || rawPhone),
        session_token: sessionToken,
        status: 'waiting',
        priority_level: assignedPriority,
        scheduled_time: app.scheduled_time || null,
        appointment_id: String(app.id || app.code || appointmentCode),
        national_id_hash: nationalIdHash,
        identity_last4: identityLast4,
        device_id: deviceId || null,
        source_channel: isKiosk ? 'kiosk' : (staff ? 'reception' : 'web'),
        first_arrived_at: arrivalNow,
        transferred_at: null,
        transfer_notes: checkinNote,
        last_service_name: null,
        position: 1,
        etw_minutes: targetQueue?.target_service_minutes || 10,
        counter_id: null,
        called_counter_number: null,
        booked_at: arrivalNow,
        notes: checkinNote
      };

      (MEMORY_DB.tickets[tenantSlug] || (MEMORY_DB.tickets[tenantSlug] = [])).push(newTicket);
      app.checkin_status = 'checked_in';
      app.ticket_id = newTicket.id;
      app.checked_in_at = arrivalNow;

      broadcastSSE(tenantSlug, 'ticket_created', { ticket: newTicket, tickets: [newTicket] }, {
        zoneId: newTicket.zone_id,
        sessionToken: newTicket.session_token,
        branchId: newTicket.branch_id
      });

      return res.status(200).json({
        ok: true,
        warning: assignedPriority === 'standard',
        message: checkinNote,
        ticket: newTicket,
        appointment: {
          id: app.id,
          code: app.code,
          scheduled_time: app.scheduled_time,
          patient_name: app.patient_name
        },
        printPayload: {
          brand: tenantSlug,
          ticketNumber: newTicket.ticket_number,
          serviceName: newTicket.queue_name,
          issuedAt: arrivalNow,
          scheduledTime: app.scheduled_time,
          priorityLevel: newTicket.priority_level,
          identityLast4: identityLast4,
          channel: newTicket.source_channel
        }
      });
    }

    if (action === 'his-appointment-sync') {
      const apiKey = req.headers['x-his-api-key'] || req.headers['x-api-key'] || req.query?.apiKey;
      const expectedKey = process.env.HIS_WEBHOOK_API_KEY || 'mken-his-webhook-sync-key';
      if (!staff && apiKey !== expectedKey) {
        return res.status(401).json({ ok: false, error: 'غير مصرح: مفتاح API غير صالح لمزامنة المواعيد.', code: 'AUTH_REQUIRED' });
      }

      const body = req.body || {};
      const incomingList = Array.isArray(body.appointments) ? body.appointments : (body.appointment ? [body.appointment] : []);
      const appointments = MEMORY_DB.appointments[tenantSlug] || (MEMORY_DB.appointments[tenantSlug] = []);
      const synced = [];

      for (const item of incomingList) {
        const code = String(item.code || item.appointmentCode || item.appointment_id || item.id || '').trim();
        if (!code) continue;

        const rawNatId = item.nationalId || item.national_id || item.iqama;
        const cleanNat = rawNatId ? String(rawNatId).replace(/\D/g, '') : null;
        const natHash = cleanNat ? hashNationalId(cleanNat) : (item.national_id_hash || null);
        const last4 = cleanNat ? cleanNat.slice(-4) : (item.identity_last4 || null);

        let existing = appointments.find(a => a.id === item.id || a.id === item.appointment_id || a.code === code);
        if (existing) {
          Object.assign(existing, {
            patient_name: item.patient_name || item.patientName || existing.patient_name,
            patient_phone: item.patient_phone || item.phone || existing.patient_phone,
            scheduled_time: item.scheduled_time || item.scheduledTime || existing.scheduled_time,
            service_id: item.service_id || item.queue_id || existing.service_id,
            queue_id: item.queue_id || item.service_id || existing.queue_id,
            doctor_name: item.doctor_name || existing.doctor_name,
            clinic_name: item.clinic_name || existing.clinic_name,
            national_id_hash: natHash || existing.national_id_hash,
            identity_last4: last4 || existing.identity_last4,
            updated_at: new Date().toISOString()
          });
          synced.push(existing);
        } else {
          const newApp = {
            id: item.appointment_id || item.id || ('app_' + Math.random().toString(36).substring(2, 9)),
            tenant_slug: tenantSlug,
            branch_id: item.branch_id || reqBranchId || 'default',
            zone_id: item.zone_id || null,
            code: code,
            barcode: item.barcode || code,
            patient_name: item.patient_name || item.patientName || 'مريض',
            patient_phone: item.patient_phone || item.phone || null,
            national_id_hash: natHash,
            identity_last4: last4,
            scheduled_time: item.scheduled_time || item.scheduledTime || new Date().toISOString(),
            service_id: item.service_id || item.queue_id || (MEMORY_DB.queues[tenantSlug]?.[0]?.id),
            queue_id: item.queue_id || item.service_id || (MEMORY_DB.queues[tenantSlug]?.[0]?.id),
            doctor_name: item.doctor_name || null,
            clinic_name: item.clinic_name || null,
            checkin_status: 'scheduled',
            created_at: new Date().toISOString()
          };
          appointments.push(newApp);
          synced.push(newApp);
        }
      }

      return res.status(200).json({ ok: true, count: synced.length, syncedCount: synced.length, appointments: synced });
    }

    // ---------------------------------------------------------------
    // 2. جلب الإعدادات والمسارات والكاونترات الحالية
    // ---------------------------------------------------------------
    if (action === 'get-config' || action === 'staff-config') {
      const settings = MEMORY_DB.settings[tenantSlug];
      const allQueues = (MEMORY_DB.queues[tenantSlug] || []).filter(q => q.is_active);
      const allCounters = MEMORY_DB.counters[tenantSlug] || [];
      const allUsers = MEMORY_DB.users[tenantSlug] || [];
      const allZones = (MEMORY_DB.zones[tenantSlug] || []).filter(z => z.is_active !== false);

      const targetZone = resolveZone(tenantSlug, reqZoneId);
      const activeZoneId = targetZone ? targetZone.id : reqZoneId;

      let queues = allQueues;
      let counters = allCounters;

      if (activeZoneId) {
        queues = allQueues.filter(q => !q.zone_id || q.zone_id === activeZoneId);
        const queueIds = new Set(queues.map(q => q.id));
        counters = allCounters.filter(c => {
          if (c.zone_id) return c.zone_id === activeZoneId;
          if (Array.isArray(c.assigned_queue_ids)) {
            return c.assigned_queue_ids.some(qid => queueIds.has(qid));
          }
          return true;
        });
      }

      const counterSessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const agentBreaks = MEMORY_DB.agentBreaks[tenantSlug] || [];
      const receptionHandovers = MEMORY_DB.receptionHandovers[tenantSlug] || [];
      return res.status(200).json({
        ok: true,
        settings,
        queues,
        counters,
        users: allUsers,
        zones: allZones,
        zone: targetZone || null,
        counterSessions,
        agentBreaks,
        receptionHandovers,
        hallPolicy: MEMORY_DB.hallPolicies[tenantSlug]
      });
    }

    // ---------------------------------------------------------------
    // 3. حفظ الإعدادات وتحديث وضع الخدمة (Service Mode)
    // ---------------------------------------------------------------
    if (action === 'save-config') {
      const body = req.body || {};
      if (body.settings) {
        const merged = Object.assign({}, MEMORY_DB.settings[tenantSlug], body.settings);
        MEMORY_DB.settings[tenantSlug] = Object.assign(merged, queueDay.normalizeSettings(merged));
      }
      if (Array.isArray(body.queues)) {
        MEMORY_DB.queues[tenantSlug] = body.queues;
      }
      if (Array.isArray(body.counters)) {
        MEMORY_DB.counters[tenantSlug] = body.counters;
      }
      broadcastSSE(tenantSlug, 'config_updated', { settings: MEMORY_DB.settings[tenantSlug], counters: MEMORY_DB.counters[tenantSlug] });
      return res.status(200).json({ ok: true, settings: MEMORY_DB.settings[tenantSlug], counters: MEMORY_DB.counters[tenantSlug] });
    }

    // ---------------------------------------------------------------
    // 3.01 إضافة كاونتر جديد ديناميكياً (Add New Counter)
    // ---------------------------------------------------------------
    if (action === 'add-counter') {
      const body = req.body || {};
      const name = (body.name || '').trim();
      const assignedQueueIds = Array.isArray(body.assignedQueueIds) 
        ? body.assignedQueueIds 
        : (Array.isArray(body.service_ids) ? body.service_ids : (Array.isArray(body.serviceIds) ? body.serviceIds : []));
      const counters = MEMORY_DB.counters[tenantSlug] || [];
      const counterNumber = parseInt(body.counterNumber, 10) || (counters.length + 1);

      if (!name) {
        return res.status(400).json({ error: 'الرجاء إدخال اسم الكاونتر بشكل صحيح.' });
      }

      const matchedZone = resolveZone(tenantSlug, body.zoneId || body.zone_id);
      const assignedZoneId = matchedZone ? matchedZone.id : (body.zoneId || body.zone_id || null);

      const newCounter = {
        id: body.id || ('cnt-' + Math.random().toString(36).substring(2, 9) + '-' + tenantSlug),
        tenant_slug: tenantSlug,
        branch_id: body.branchId || body.branch_id || reqBranchId || 'default',
        zone_id: assignedZoneId,
        counter_number: counterNumber,
        name: name,
        operator_name: body.operatorName || 'موظف متاح',
        current_user_id: body.userId || null,
        assigned_queue_ids: assignedQueueIds.length ? assignedQueueIds : (MEMORY_DB.queues[tenantSlug] || []).map(q => q.id),
        status: 'active',
        current_ticket_id: null,
        current_ticket_number: null,
        current_session_started_at: null,
        ewma_service_seconds: 300,
        completed_today_count: 0,
        current_break_id: null
      };

      counters.push(newCounter);
      broadcastSSE(tenantSlug, 'config_updated', { counters, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(201).json({ ok: true, counter: newCounter, counters, message: 'تمت إضافة الكاونتر بنجاح.' });
    }

    // ---------------------------------------------------------------
    // 3.02 تعديل اسم وإعدادات الكاونتر (Update Counter Name & Settings)
    // ---------------------------------------------------------------
    if (action === 'update-counter') {
      const body = req.body || {};
      const counterId = body.counterId;
      const newName = (body.name || '').trim();
      const assignedQueueIds = body.assignedQueueIds;
      const counterNumber = body.counterNumber;

      const counters = MEMORY_DB.counters[tenantSlug] || [];
      const counter = counters.find(c => c.id === counterId);
      if (!counter) {
        return res.status(404).json({ error: 'الكاونتر المطلوب غير موجود.' });
      }

      if (newName) counter.name = newName;
      if (Array.isArray(assignedQueueIds)) counter.assigned_queue_ids = assignedQueueIds;
      if (counterNumber !== undefined) counter.counter_number = parseInt(counterNumber, 10);
      if (body.operatorName) counter.operator_name = body.operatorName;
      if (body.userId) counter.current_user_id = body.userId;
      if (body.status && ['active', 'on_break', 'offline'].includes(body.status)) counter.status = body.status;
      if (body.zoneId !== undefined || body.zone_id !== undefined) {
        const mz = resolveZone(tenantSlug, body.zoneId || body.zone_id);
        counter.zone_id = mz ? mz.id : (body.zoneId || body.zone_id || null);
      }
      if (body.branchId || body.branch_id) {
        counter.branch_id = body.branchId || body.branch_id;
      }

      counter.last_status_change = new Date().toISOString();
      broadcastSSE(tenantSlug, 'config_updated', { counters, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, counter, counters, message: 'تم تحديث بيانات الكاونتر بنجاح.' });
    }

    // ---------------------------------------------------------------
    // 3.03 حذف أو تعطيل الكاونتر بأمان (Delete / Archive Counter)
    // ---------------------------------------------------------------
    if (action === 'delete-counter') {
      const counterId = req.body?.counterId || req.query.counterId;
      const counters = MEMORY_DB.counters[tenantSlug] || [];
      const idx = counters.findIndex(c => c.id === counterId);

      if (idx === -1) {
        return res.status(404).json({ error: 'الكاونتر المطلوب غير موجود.' });
      }

      const counter = counters[idx];
      if (counter.current_ticket_id) {
        return res.status(400).json({
          error: 'لا يمكن حذف الكاونتر أثناء وجود عميل مستدعى أو قيد الخدمة. يرجى إنهاء المعاملة أولاً.'
        });
      }

      counters.splice(idx, 1);
      broadcastSSE(tenantSlug, 'config_updated', { counters, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, counters, message: 'تم حذف الكاونتر بنجاح.' });
    }

    // ---------------------------------------------------------------
    // 3.04 إنشاء طابور / قسم جديد (Create Queue)
    // ---------------------------------------------------------------
    if (action === 'create-queue') {
      const body = req.body || {};
      const name = (body.name || '').trim();
      const codeStr = (body.code || body.prefix || 'Q').trim().toUpperCase().slice(0, 4);
      const targetServiceMinutes = parseInt(body.targetServiceMinutes || '6', 10);
      const maxDailyCapacity = parseInt(body.maxDailyCapacity || '100', 10);
      const queues = MEMORY_DB.queues[tenantSlug] || [];

      if (!name) {
        return res.status(400).json({ error: 'الرجاء إدخال اسم الطابور / القسم بشكل صحيح.' });
      }

      const qMatchedZone = resolveZone(tenantSlug, body.zoneId || body.zone_id);
      const qAssignedZoneId = qMatchedZone ? qMatchedZone.id : (body.zoneId || body.zone_id || null);

      const newQueue = {
        id: 'q-' + codeStr.toLowerCase() + '-' + Math.random().toString(36).substring(2, 6) + '-' + tenantSlug,
        tenant_slug: tenantSlug,
        branch_id: body.branchId || body.branch_id || reqBranchId || 'default',
        zone_id: qAssignedZoneId,
        name: name,
        code: codeStr,
        prefix: codeStr,
        target_service_minutes: targetServiceMinutes,
        max_daily_capacity: maxDailyCapacity,
        is_active: true
      };

      queues.push(newQueue);
      broadcastSSE(tenantSlug, 'config_updated', { queues, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(201).json({ ok: true, queue: newQueue, queues, message: 'تم إنشاء الطابور الجديد بنجاح.' });
    }

    if (action === 'update-queue') {
      const body = req.body || {};
      const queueId = body.queueId || body.id;
      const queues = MEMORY_DB.queues[tenantSlug] || [];
      const queue = queues.find(q => q.id === queueId);

      if (!queue) {
        return res.status(404).json({ error: 'الطابور / القسم المطلوب غير موجود.' });
      }

      if (body.name) queue.name = (body.name || '').trim();
      if (body.code) {
        queue.code = body.code.trim().toUpperCase().slice(0, 4);
        queue.prefix = queue.code;
      }
      if (body.targetServiceMinutes !== undefined) queue.target_service_minutes = parseInt(body.targetServiceMinutes, 10);
      if (body.maxDailyCapacity !== undefined) queue.max_daily_capacity = parseInt(body.maxDailyCapacity, 10);
      if (body.isActive !== undefined) queue.is_active = Boolean(body.isActive);
      if (body.zoneId !== undefined || body.zone_id !== undefined) {
        const qz = resolveZone(tenantSlug, body.zoneId || body.zone_id);
        queue.zone_id = qz ? qz.id : (body.zoneId || body.zone_id || null);
      }
      if (body.branchId || body.branch_id) {
        queue.branch_id = body.branchId || body.branch_id;
      }

      broadcastSSE(tenantSlug, 'config_updated', { queues, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, queue, queues, message: 'تم تحديث بيانات الطابور بنجاح.' });
    }

    if (action === 'delete-queue') {
      const queueId = req.body?.queueId || req.query.queueId;
      const queues = MEMORY_DB.queues[tenantSlug] || [];
      const idx = queues.findIndex(q => q.id === queueId);

      if (idx === -1) {
        return res.status(404).json({ error: 'الطابور / القسم المطلوب غير موجود.' });
      }

      const tickets = MEMORY_DB.tickets[tenantSlug] || [];
      const activeTicketsInQueue = tickets.some(t => t.queue_id === queueId && ['waiting', 'in_service', 'called'].includes(t.status));
      if (activeTicketsInQueue) {
        return res.status(400).json({ error: 'لا يمكن حذف الطابور لوجود مراجعين في الانتظار أو قيد الخدمة حالياً.' });
      }

      queues.splice(idx, 1);
      broadcastSSE(tenantSlug, 'config_updated', { queues, settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, queues, message: 'تم حذف الطابور بنجاح.' });
    }

    if (action === 'staff-login') {
      const pin = String(req.body?.pin || req.query.pin || '').trim();
      const users = MEMORY_DB.users[tenantSlug] || [];
      const user = users.find(u => u.pin_code === pin && u.is_active !== false);
      if (!user) {
        return res.status(401).json({ error: 'رمز الدخول PIN غير صحيح.' });
      }
      const token = signStaffToken({
        id: user.id,
        role: user.role,
        name: user.full_name,
        tenant_slug: tenantSlug,
        exp: Date.now() + 86400000
      });
      return res.status(200).json({
        ok: true,
        token,
        user: { id: user.id, name: user.full_name, role: user.role }
      });
    }

    if (action === 'public-gate') {
      await hydrateHallPolicy(tenantSlug);
      const gate = resolveOperationalGate(tenantSlug, { allowPreview: true });
      return res.status(200).json(queueGate.publicGatePayload(gate));
    }

    if (action === 'get-hall-policy') {
      if (!requirePolicyStaff(req)) {
        return res.status(401).json({ error: 'يلزم جلسة مشرف (staff-login). لا تُقبل ترويسة الإدارة وحدها.' });
      }
      await hydrateHallPolicy(tenantSlug);
      const policy = MEMORY_DB.hallPolicies[tenantSlug];
      const gate = resolveOperationalGate(tenantSlug);
      return res.status(200).json({
        ok: true,
        policy,
        gate: queueGate.publicGatePayload(gate),
        holidays: queueGate.KSA_OFFICIAL_HOLIDAYS,
        open_warnings: queueGate.warnLongOpenDay(policy.weekly_hours)
      });
    }

    if (action === 'save-hall-policy') {
      const supervisor = requirePolicyStaff(req);
      if (!supervisor) return res.status(401).json({ error: 'يلزم جلسة مشرف لاعتماد سياسة الصالة. لا تُقبل ترويسة الإدارة وحدها.' });
      const body = req.body || {};
      const reason = String(body.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'سبب الاعتماد إلزامي لسجل التدقيق.' });
      await hydrateHallPolicy(tenantSlug);
      const merged = queueGate.mergeHallPolicy(MEMORY_DB.hallPolicies[tenantSlug], body.policy || body);
      merged.updated_at = new Date().toISOString();
      merged.updated_by_user_id = supervisor.id || 'supervisor';
      MEMORY_DB.hallPolicies[tenantSlug] = merged;
      merged._persistedLoaded = true;
      await persistHallPolicy(tenantSlug, merged, supervisor.id);
      const gate = resolveOperationalGate(tenantSlug);
      broadcastSSE(tenantSlug, 'config_updated', {
        policy: merged,
        gate: queueGate.publicGatePayload(gate),
        settings: MEMORY_DB.settings[tenantSlug]
      });
      return res.status(200).json({
        ok: true,
        policy: merged,
        gate: queueGate.publicGatePayload(gate),
        message: 'تم حفظ واعتماد سياسة الصالة بنجاح.'
      });
    }

    if (action === 'preview-display') {
      const supervisor = requirePolicyStaff(req);
      if (!supervisor) return res.status(401).json({ error: 'يلزم جلسة مشرف لمعاينة الشاشة.' });
      const state = String((req.body && req.body.gate_state) || req.query.state || 'prayer_now');
      const previewMinutes = Math.min(60, Math.max(1, parseInt((req.body && req.body.minutes) || '5', 10)));
      await hydrateHallPolicy(tenantSlug);
      const fakeGate = queueGate.evaluateGate({
        policy: MEMORY_DB.hallPolicies[tenantSlug],
        override: {},
        prayer: currentPrayerStatus(tenantSlug),
        issuedToday: 1,
        waitingNow: 1,
        forcedState: state
      });
      MEMORY_DB.displayPreviews[tenantSlug] = {
        until: new Date(Date.now() + previewMinutes * 60000).toISOString(),
        gate: fakeGate
      };
      broadcastSSE(tenantSlug, 'config_updated', { gate: fakeGate });
      return res.status(200).json({ ok: true, preview: MEMORY_DB.displayPreviews[tenantSlug] });
    }

    if (action === 'bind-place') {
      if (!requirePolicyStaff(req)) {
        return res.status(401).json({ error: 'يلزم جلسة مشرف لربط المكان. لا تُقبل ترويسة الإدارة وحدها.' });
      }
      const body = req.body || {};
      const mapsUrl = (body.mapsUrl || body.maps_url || '').trim();
      let placeId = (body.placeId || body.google_place_id || '').trim() || queueGate.extractPlaceIdFromMapsUrl(mapsUrl);
      let periods = body.openingPeriods || (body.regularHours && body.regularHours.periods) || body.periods || [];
      let snapshot = null;
      if (!periods.length) {
        snapshot = await queueGate.fetchPlaceSnapshotFromGoogle(placeId, mapsUrl);
        if (snapshot) {
          placeId = snapshot.placeId || placeId;
          periods = snapshot.periods || [];
          if (!body.city && snapshot.city) body.city = snapshot.city;
          if (body.lat == null && snapshot.lat != null) body.lat = snapshot.lat;
          if (body.lng == null && snapshot.lng != null) body.lng = snapshot.lng;
          if (!mapsUrl && snapshot.maps_url) body.mapsUrl = snapshot.maps_url;
        }
      }
      const suggested = periods.length ? queueGate.googlePeriodsToWeeklyHours(periods) : (snapshot && snapshot.suggested_weekly_hours) || null;
      await hydrateHallPolicy(tenantSlug);
      const policy = MEMORY_DB.hallPolicies[tenantSlug];
      policy.google_place_id = placeId || policy.google_place_id;
      policy.gbp_location_id = body.gbpLocationId || body.gbp_location_id || policy.gbp_location_id;
      policy.lat = body.lat != null ? body.lat : policy.lat;
      policy.lng = body.lng != null ? body.lng : policy.lng;
      if (body.city) policy.city = body.city;
      policy.maps_url = mapsUrl || body.mapsUrl || queueGate.mapsUrlFromPlaceId(placeId) || policy.maps_url;
      policy.hours_source = body.hoursSource || (body.gbpLocationId ? 'gbp' : 'places');
      policy.hours_imported_at = new Date().toISOString();
      if (suggested) policy.suggested_weekly_hours = suggested;
      if (body.specialCloses) policy.suggested_special_closes = body.specialCloses;
      const apply = body.apply === true;
      const warnings = suggested ? queueGate.warnLongOpenDay(suggested) : [];
      if (apply) {
        if (!String(body.reason || '').trim()) {
          return res.status(400).json({ error: 'اعتماد ساعات جوجل يتطلب سبباً. لا تُكتب فوق السياسة صامتة.' });
        }
        if (suggested) policy.weekly_hours = suggested;
      }
      MEMORY_DB.hallPolicies[tenantSlug] = policy;
      policy._persistedLoaded = true;
      await persistHallPolicy(tenantSlug, policy, (requirePolicyStaff(req) || {}).id);
      broadcastSSE(tenantSlug, 'config_updated', { hallPolicy: policy });
      return res.status(200).json({
        ok: true,
        policy,
        suggested_weekly_hours: suggested,
        applied: apply,
        open_warnings: warnings,
        message: apply
          ? 'تم اعتماد ساعات الملف على سياسة الصالة.'
          : 'تم حفظ هوية المكان ومسودة الساعات دون تعديل البوابة المعتمدة.'
      });
    }

    // ---------------------------------------------------------------
    // 6.5 نقاط البيع وواتساب والولاء و PDPL
    // ---------------------------------------------------------------
    if (action === 'create-order-with-ticket' || action === 'pos-ticket' || action === 'create-pos-order') {
      const posCreateHandler = require('./pos/create-order-with-ticket');
      return posCreateHandler(req, res);
    }

    if (action === 'get-pos-ticket-details' || action === 'pos-ticket-details') {
      const posDetailsHandler = require('./pos/get-ticket-details');
      return posDetailsHandler(req, res);
    }

    if (action === 'notify-whatsapp') {
      const notifyHandler = require('./queue/notify-whatsapp');
      return notifyHandler(req, res);
    }

    if (action === 'pos-complete-service' || action === 'complete-pos-order' || action === 'finalize-pos-invoice') {
      const posCompleteHandler = require('./pos/complete-service');
      return posCompleteHandler(req, res);
    }

    if (action === 'loyalty-balance' || action === 'loyalty-redeem' || action === 'loyalty-earn' || action === 'loyalty') {
      const loyaltyHandler = require('./pos/loyalty');
      return loyaltyHandler(req, res);
    }

    if (action === 'pdpl-anonymize' || action === 'pdpl-audit') {
      const pdplCronHandler = require('./cron-queue-pdpl');
      return pdplCronHandler(req, res);
    }

    // ---------------------------------------------------------------
    // 3.1 حفظ إعدادات معالج الامتثال السعودي الأولي (Onboarding Compliance)
    // ---------------------------------------------------------------
    if (action === 'save-onboarding-compliance') {
      const body = req.body || {};
      const settings = MEMORY_DB.settings[tenantSlug];
      settings.saudi_compliance_enabled = body.enabled !== false;
      if (body.city) settings.city = body.city;
      if (body.prayer_breaks) {
        settings.prayer_breaks = Object.assign(settings.prayer_breaks || {}, body.prayer_breaks);
      }
      if (body.labor_law_compliance) {
        settings.labor_law_compliance = Object.assign(settings.labor_law_compliance || {}, body.labor_law_compliance);
      }
      broadcastSSE(tenantSlug, 'config_updated', { settings });
      return res.status(200).json({
        ok: true,
        message: 'تم حفظ وتفعيل حزمة الامتثال السعودي بنجاح!',
        settings
      });
    }

    // ---------------------------------------------------------------
    // 3.2 فحص حالة الصلاة اللحظية (Live Prayer Status)
    // ---------------------------------------------------------------
    if (action === 'get-prayer-status') {
      const settings = MEMORY_DB.settings[tenantSlug];
      const city = req.query.city || settings.city || 'Riyadh';
      const nowMin = req.query.minuteOfDay !== undefined ? parseInt(req.query.minuteOfDay, 10) : getSaudiCurrentMinuteOfDay();
      const isFriday = req.query.isFriday === 'true';
      const status = checkPrayerStatus(city, nowMin, isFriday);

      // إذا كانت الصلاة قائمة وتم تفعيل التجميد، نبلغ الشاشات
      return res.status(200).json({
        ok: true,
        city,
        ...status,
        freeze_ewma: settings.display_mode ? settings.display_mode.freeze_ewma_during_breaks : true
      });
    }

    // ---------------------------------------------------------------
    // 3.3 فحص امتثال نظام العمل السعودي للورديات (Labor Law Compliance Guard)
    // ---------------------------------------------------------------
    if (action === 'check-labor-compliance') {
      const settings = MEMORY_DB.settings[tenantSlug];
      const sessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const counters = MEMORY_DB.counters[tenantSlug] || [];
      const maxHours = settings.labor_law_compliance ? settings.labor_law_compliance.max_continuous_work_hours : 5;

      const violations = [];
      const now = Date.now();

      for (const s of sessions) {
        if (s.session_status === 'active' && s.started_at) {
          const durationHours = (now - new Date(s.started_at).getTime()) / 3600000;
          if (durationHours >= maxHours) {
            violations.push({
              counter_id: s.counter_id,
              operator_name: s.operator_name,
              session_hours: Math.round(durationHours * 10) / 10,
              article_violated: 'المادة 101 من نظام العمل السعودي',
              warning: `الموظف [${s.operator_name}] يعمل منذ ${Math.round(durationHours)} ساعات متواصلة ويجب أخذ استراحة راحة إلزامية 30 دقيقة.`
            });
          }
        }
      }

      return res.status(200).json({
        ok: true,
        max_continuous_work_hours: maxHours,
        active_violations_count: violations.length,
        violations
      });
    }

    // ---------------------------------------------------------------
    // 4. عرض المسارات المتاحة مع الإحصائيات الفورية وقوائم الانتظار
    // ---------------------------------------------------------------
    if (action === 'list-queues' || action === 'staff-board') {
      const allQueues = (MEMORY_DB.queues[tenantSlug] || []).filter(q => q.is_active);
      const targetZone = resolveZone(tenantSlug, reqZoneId);
      const activeZoneId = targetZone ? targetZone.id : reqZoneId;
      const queues = activeZoneId ? allQueues.filter(q => !q.zone_id || q.zone_id === activeZoneId) : allQueues;
      const counters = MEMORY_DB.counters[tenantSlug];
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      const queueStats = queues.map(q => {
        const activeCountersForQueue = counters.filter(c => 
          c.status === 'active' && 
          Array.isArray(c.assigned_queue_ids) && 
          c.assigned_queue_ids.includes(q.id)
        );
        const clock = queueClock(tenantSlug);
        const waitingTickets = tickets.filter(t => t.queue_id === q.id && queueDay.isOnBoard(t, clock.settings, clock.now, clock.extended));
        const expiredTickets = queueDay.recentlyAutoClosed(tickets, q.id, clock.now);

        const throughput = calculateQueueThroughput(activeCountersForQueue, q.target_service_minutes);
        const etwMinutes = calculateETW(waitingTickets.length + 1, throughput, settings.safety_multiplier);

        return {
          ...q,
          activeCountersCount: activeCountersForQueue.length,
          waitingCount: waitingTickets.length,
          estimatedWaitMinutes: etwMinutes,
          waitingTickets: waitingTickets.map(t => ({
            id: t.id,
            ticket_number: t.ticket_number,
            status: t.status,
            priority_level: t.priority_level,
            first_arrived_at: t.first_arrived_at,
            called_counter_number: t.called_counter_number || null,
            customer_name: t.customer_name,
            customer_phone: t.customer_phone
          })),
          expiredTickets: expiredTickets.map(function (t) {
            return {
              id: t.id,
              ticket_number: t.ticket_number,
              status: t.status,
              close_reason: t.close_reason,
              auto_closed: true,
              closed_at: t.closed_at,
              service_date: t.service_date,
              customer_name: t.customer_name || '',
              customer_phone: t.customer_phone || '',
              first_arrived_at: t.first_arrived_at,
              queue_id: t.queue_id
            };
          })
        };
      });

      return res.status(200).json({
        ok: true,
        queues: queueStats,
        settings,
        override: MEMORY_DB.overrides[tenantSlug],
        state_revision: MEMORY_DB.overrides[tenantSlug] ? MEMORY_DB.overrides[tenantSlug].state_revision : 1,
        gate: queueGate.publicGatePayload(resolveOperationalGate(tenantSlug))
      });
    }

    // ---------------------------------------------------------------
    // 5. حجز تذكرة خالية من الاحتكاك (Zero-Friction Access)
    // ---------------------------------------------------------------
    if (action === 'join-queue') {
      const ip = queueGuard.clientIp(req);
      const deviceId = req.headers['x-device-id'] || (req.body && req.body.deviceId) || (req.query && req.query.deviceId) || null;
      const ua = req.headers['user-agent'] || '';
      const uaHash = crypto.createHash('md5').update(ua).digest('hex').slice(0, 8);

      if (!isKiosk && !staff) {
        const rateKey = 'queue-join:' + tenantSlug + ':' + (ip || 'no-ip') + ':' + (deviceId || uaHash);
        const limit = ip ? 8 : MISSING_IP_LIMIT;
        const rate = isRateLimited(rateKey, limit, 60 * 1000, true);
        if (rate.limited) {
          res.setHeader('Retry-After', String(rate.retryAfterSec));
          return res.status(429).json({
            ok: false,
            error: 'تم تجاوز الحد المسموح به لإصدار التذاكر مؤقتاً. يرجى الانتظار دقيقة واحدة.',
            code: 'RATE_LIMITED',
            retryAfterSec: rate.retryAfterSec
          });
        }

        // منع التذاكر المكررة لنفس الجهاز والمراجع النشط
        if (deviceId) {
          const reqQueueIds = Array.isArray(req.body?.queueIds) ? req.body.queueIds : (req.body?.queueId ? [req.body.queueId] : []);
          const existingActive = (MEMORY_DB.tickets[tenantSlug] || []).find(t =>
            t.device_id &&
            t.device_id === deviceId &&
            reqQueueIds.includes(t.queue_id) &&
            ['waiting', 'called', 'in_service', 'bumped'].includes(t.status)
          );
          if (existingActive) {
            return res.status(200).json({
              ok: true,
              isExisting: true,
              sessionToken: existingActive.session_token,
              tickets: [existingActive],
              ticket: existingActive,
              message: 'لديك تذكرة نشطة بالفعل لنفس الخدمة.'
            });
          }
        }
      }
      const body = req.body || {};
      const queueIds = Array.isArray(body.queueIds) ? body.queueIds : (body.queueId ? [body.queueId] : []);
      const customerName = optionalCustomerName(body.customerName);
      const customerPhone = optionalCustomerPhone(body.customerPhone);
      const pushSubscription = body.pushSubscription || null;

      if (!queueIds.length) {
        return res.status(400).json({ error: 'الرجاء اختيار مسار أو خدمة واحدة على الأقل للطابور.' });
      }

      // فحص التدخل البشري السريع (Manual Override Guard)
      const currentOverride = MEMORY_DB.overrides[tenantSlug];
      if (currentOverride && currentOverride.is_force_locked_today) {
        return res.status(423).json({
          error: 'عفواً، تم إغلاق استقبال التذاكر لهذا اليوم بقرار إداري استثنائي.',
          is_locked: true,
          lock_reason: currentOverride.lock_reason || 'اكتمال الطاقة الاستيعابية اليومية'
        });
      }
      if (currentOverride && currentOverride.paused_until && new Date(currentOverride.paused_until) > new Date()) {
        const remainingMins = Math.ceil((new Date(currentOverride.paused_until) - new Date()) / 60000);
        return res.status(423).json({
          error: `عفواً، تم تعليق إصدار التذاكر مؤقتاً لمدة ${remainingMins} دقيقة لتهدئة الصالة، يرجى المحاولة بعد قليل.`,
          is_paused: true,
          paused_until: currentOverride.paused_until
        });
      }

      const issueGate = resolveOperationalGate(tenantSlug);
      if (!issueGate.allows_issue) {
        return res.status(409).json(gateRejectBody(issueGate));
      }

      const sessionToken = (body.sessionToken && body.sessionToken.length > 8)
        ? body.sessionToken
        : ('mkn_tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36));

      const createdTickets = [];
      const queues = MEMORY_DB.queues[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      const queueEstimates = queueIds.map(qid => {
        const q = queues.find(item => item.id === qid);
        const activeCounters = counters.filter(c => c.status === 'active' && c.assigned_queue_ids?.includes(qid));
        const clock = queueClock(tenantSlug);
        const waiting = tickets.filter(t => t.queue_id === qid && queueDay.isCallable(t, clock.settings, clock.now, clock.extended, ['waiting', 'bumped']));
        const throughput = calculateQueueThroughput(activeCounters, q?.target_service_minutes || 10);
        const etw = calculateETW(waiting.length + 1, throughput, settings.safety_multiplier);
        return { queueId: qid, queue: q, etw, waitingCount: waiting.length };
      });

      queueEstimates.sort((a, b) => a.etw - b.etw);
      const arrivalNow = queueDay.now().toISOString();

      for (let i = 0; i < queueEstimates.length; i++) {
        const est = queueEstimates[i];
        const q = est.queue;
        const prefix = q ? q.prefix : 'A';

        const allocated = await queuePersist.allocate(tenantSlug, est.queueId, prefix, MEMORY_DB);
        const seq = allocated.sequence;
        const ticketNumber = allocated.ticket_number;
        const initialStatus = i === 0 ? 'waiting' : 'sync_watch';

        const newTicket = {
          id: 'tkt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          tenant_slug: tenantSlug,
          branch_id: q?.branch_id || body.branchId || reqBranchId || 'default',
          zone_id: q?.zone_id || (resolveZone(tenantSlug, body.zoneId || reqZoneId)?.id) || null,
          queue_id: est.queueId,
          device_id: deviceId || null,
          source_channel: isKiosk ? 'kiosk' : (staff ? 'reception' : 'web'),
          appointment_id: null,
          scheduled_time: null,
          national_id_hash: null,
          identity_last4: null,
          queue_name: q?.name || 'خدمة',
          ticket_number: ticketNumber,
          daily_sequence: seq,
          customer_name: customerName,
          customer_phone: customerPhone,
          session_token: sessionToken,
          status: initialStatus,
          priority_level: 'standard',
          first_arrived_at: arrivalNow,
          transferred_at: null,
          transfer_notes: null,
          last_service_name: null,
          position: est.waitingCount + 1,
          etw_minutes: est.etw,
          counter_id: null,
          called_counter_number: null,
          push_subscription: pushSubscription,
          is_bumped: false,
          bump_count: 0,
          booked_at: arrivalNow,
          called_at: null,
          service_started_at: null,
          service_completed_at: null,
          notes: i > 0 ? 'مسار متزامن تحت مراقبة التزامن (Sync Watch)' : 'المسار الأساسي النشط',
          service_date: queueDay.currentPeriod(settings, queueDay.now(), queueClock(tenantSlug).extended)
        };

        tickets.push(newTicket);
        createdTickets.push(newTicket);
      }

      const ticketIds = createdTickets.map(t => t.id);
      createdTickets.forEach(t => {
        t.concurrent_ticket_ids = ticketIds.filter(id => id !== t.id);
      });

      broadcastSSE(tenantSlug, 'ticket_created', { tickets: createdTickets, ticket: createdTickets[0] }, { zoneId: createdTickets[0]?.zone_id, sessionToken: sessionToken, branchId: createdTickets[0]?.branch_id });

      return res.status(200).json({
        ok: true,
        sessionToken,
        tickets: createdTickets,
        ticket: createdTickets[0] || null,
        message: 'تم حجز دورك بنجاح في نظام الطوابير الذكي.'
      });
    }

    // ---------------------------------------------------------------
    // 6. إصدار تذكرة يدوية عبر موظف الاستقبال (Manual Ticket Issuing)
    // ---------------------------------------------------------------
    if (action === 'manual-ticket') {
      const issueGate = resolveOperationalGate(tenantSlug);
      if (!issueGate.allows_issue) {
        return res.status(409).json(gateRejectBody(issueGate));
      }
      const body = req.body || {};
      const queueId = body.queueId;
      const customerName = optionalCustomerName(body.customerName);
      const customerPhone = optionalCustomerPhone(body.customerPhone);
      const notes = body.notes || 'تذكرة يدوية صادرة من الاستقبال';

      const queues = MEMORY_DB.queues[tenantSlug];
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      const q = queues.find(item => item.id === queueId) || queues[0];
      if (!q) return res.status(404).json({ error: 'القسم غير موجود.' });

      const allocated = await queuePersist.allocate(tenantSlug, q.id, q.prefix || 'A', MEMORY_DB);
      const seq = allocated.sequence;
      const ticketNumber = allocated.ticket_number;
      const sessionToken = 'mkn_tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const arrivalNow = queueDay.now().toISOString();

      const activeCounters = counters.filter(c => c.status === 'active' && c.assigned_queue_ids?.includes(q.id));
      const clock = queueClock(tenantSlug);
      const waiting = tickets.filter(t => t.queue_id === q.id && queueDay.isCallable(t, clock.settings, clock.now, clock.extended, ['waiting', 'bumped']));
      const throughput = calculateQueueThroughput(activeCounters, q.target_service_minutes || 10);
      const etw = calculateETW(waiting.length + 1, throughput, settings.safety_multiplier);

      const manualTicket = {
        id: 'tkt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        tenant_slug: tenantSlug,
        branch_id: q?.branch_id || body.branchId || reqBranchId || 'default',
        zone_id: q?.zone_id || (resolveZone(tenantSlug, body.zoneId || reqZoneId)?.id) || null,
        queue_id: q.id,
        queue_name: q.name,
        ticket_number: ticketNumber,
        daily_sequence: seq,
        customer_name: customerName,
        customer_phone: customerPhone,
        session_token: sessionToken,
        status: 'waiting',
        priority_level: 'standard',
        first_arrived_at: arrivalNow,
        transferred_at: null,
        transfer_notes: notes,
        last_service_name: null,
        position: waiting.length + 1,
        etw_minutes: etw,
        counter_id: null,
        called_counter_number: null,
        is_manual: true,
        booked_at: arrivalNow,
        notes: notes,
        service_date: queueDay.currentPeriod(settings, queueDay.now(), queueClock(tenantSlug).extended)
      };

      tickets.push(manualTicket);
      broadcastSSE(tenantSlug, 'ticket_created', { ticket: manualTicket, tickets: [manualTicket] }, {
        zoneId: manualTicket.zone_id,
        sessionToken: manualTicket.session_token,
        branchId: manualTicket.branch_id
      });

      return res.status(200).json({
        ok: true,
        ticket: manualTicket,
        printPayload: {
          brand: tenantSlug,
          ticketNumber: manualTicket.ticket_number,
          serviceName: manualTicket.queue_name,
          issuedAt: arrivalNow,
          etwMinutes: manualTicket.etw_minutes,
          aheadCount: waiting.length,
          trackingUrl: `/queue.html?token=${sessionToken}`
        }
      });
    }

    // ---------------------------------------------------------------
    // 7. البحث السريع عن التذاكر (Omni-Search by Receptionist)
    // ---------------------------------------------------------------
    if (action === 'search-tickets') {
      const query = (req.query.q || req.body?.q || '').trim().toLowerCase();
      const tickets = MEMORY_DB.tickets[tenantSlug] || [];

      if (!query) {
        return res.status(200).json({ ok: true, tickets: [] });
      }

      const results = tickets.filter(t => 
        t.ticket_number.toLowerCase().includes(query) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(query)) ||
        (t.customer_phone && t.customer_phone.includes(query))
      );

      return res.status(200).json({ ok: true, tickets: results.slice(0, 15) });
    }

    if (action === 'list-tickets') {
      let tickets = MEMORY_DB.tickets[tenantSlug] || [];
      const targetZone = resolveZone(tenantSlug, reqZoneId);
      const activeZoneId = targetZone ? targetZone.id : reqZoneId;
      if (activeZoneId) {
        tickets = tickets.filter(t => t.zone_id === activeZoneId);
      }
      return res.status(200).json({
        ok: true,
        tenant: tenantSlug,
        tickets: tickets
      });
    }

    if (action === 'intake-status') {
      const ip = queueGuard.clientIp(req);
      const rate = isRateLimited('queue-status:' + tenantSlug + ':' + (ip || 'no-ip'), ip ? 40 : MISSING_IP_LIMIT, 60 * 1000, true);
      if (rate.limited) {
        res.setHeader('Retry-After', String(rate.retryAfterSec));
        return res.status(429).json({
          ok: false,
          error: 'طلبات كثيرة. حاول بعد قليل.',
          code: 'RATE_LIMITED',
          retryAfterSec: rate.retryAfterSec
        });
      }
      const token = (req.query && (req.query.session_token || req.query.token)) || (req.body && (req.body.session_token || req.body.token));
      const number = String((req.query && (req.query.ticket_number || req.query.ticket)) || (req.body && req.body.ticket_number) || '').trim();
      const tickets = MEMORY_DB.tickets[tenantSlug] || [];
      let matches = [];
      if (token) {
        matches = tickets.filter(function (ticket) { return ticket.session_token === token; });
      } else if (number) {
        matches = tickets.filter(function (ticket) {
          return String(ticket.ticket_number).toLowerCase() === number.toLowerCase();
        });
      } else {
        return res.status(400).json({ ok: false, error: 'يلزم رمز الجلسة أو رقم التذكرة.' });
      }
      if (!matches.length) {
        return res.status(404).json({ ok: false, error: 'لم يتم العثور على تذكرة نشطة.' });
      }
      return res.status(200).json({
        ok: true,
        tickets: matches.map(queueGuard.minimalTicket)
      });
    }

    // ---------------------------------------------------------------
    // 8. استرجاع حالة التذكرة وسياق رحلة التحويل (State Recovery)
    // ---------------------------------------------------------------
    if (action === 'get-ticket-status') {
      const sessionToken = req.query.session_token || req.body?.session_token;
      const ticketId = req.query.ticket_id || req.body?.ticket_id;
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const queues = MEMORY_DB.queues[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      let matchingTickets = [];
      if (sessionToken) {
        matchingTickets = tickets.filter(t => t.session_token === sessionToken);
      } else if (ticketId) {
        const found = tickets.find(t => t.id === ticketId);
        if (found) matchingTickets = [found];
      }

      if (!matchingTickets.length) {
        return res.status(404).json({ ok: false, error: 'لم يتم العثور على تذكرة نشطة.' });
      }

      // فحص وجود عملية تسليم وردية نشطة أو حديثة (خلال آخر 15 دقيقة)
      const recentHandover = (MEMORY_DB.receptionHandovers[tenantSlug] || []).find(h => {
        const diffMins = (Date.now() - new Date(h.handover_at).getTime()) / 60000;
        return diffMins >= 0 && diffMins <= 15;
      });
      const shiftNotice = recentHandover 
        ? 'تنويه: تجري الآن عملية تبديل وردية العمل، قد يطرأ تعديل طفيف على دقة التوقيت.'
        : null;

      const enriched = matchingTickets.map(ticket => {
        const q = queues.find(item => item.id === ticket.queue_id);
        const activeCounters = counters.filter(c => c.status === 'active' && c.assigned_queue_ids?.includes(ticket.queue_id));
        const waitingAhead = tickets.filter(t => 
          t.queue_id === ticket.queue_id && 
          ['waiting', 'bumped'].includes(t.status) &&
          new Date(t.booked_at) < new Date(ticket.booked_at)
        );

        const throughput = calculateQueueThroughput(activeCounters, q?.target_service_minutes || 10);
        const currentPos = ticket.status === 'in_service' ? 0 : (ticket.status === 'called' ? 0 : waitingAhead.length + 1);
        const liveETW = calculateETW(currentPos, throughput, settings.safety_multiplier);

        return {
          ...ticket,
          queue_name: q?.name || ticket.queue_name,
          currentPosition: currentPos,
          liveETW: ticket.status === 'in_service' ? 0 : liveETW,
          activeCountersCount: activeCounters.length,
          isTransferred: !!ticket.last_service_name,
          journeyText: ticket.last_service_name 
            ? `✓ تم الانتهاء من: ${ticket.last_service_name} | الوجهة الحالية: ${q?.name || ticket.queue_name}`
            : null,
          shift_handover_notice: shiftNotice
        };
      });

      return res.status(200).json({ ok: true, tickets: enriched });
    }

    // ---------------------------------------------------------------
    // 9. استدعاء العميل التالي (Call Next) بنظام الأولويات الهرمي
    // ---------------------------------------------------------------
    if (action === 'call-next') {
      const callGate = resolveOperationalGate(tenantSlug);
      if (!callGate.allows_call_next) {
        return res.status(409).json(gateRejectBody(callGate));
      }
      const counterId = req.body?.counterId;
      if (queuePersist.mode() !== 'memory') {
        return claimAndRespond(counterId, null, null, {
          missingCounter: 'الكاونتر غير موجود.',
          onBreak: 'الكاونتر في وضع استراحة حالياً. يرجى تفعيل الحالة أولاً.',
          empty: 'لا يوجد عملاء منتظرين في هذا المسار حالياً.',
          title: '🔔 حان دورك الآن!',
          detail: function (ticket, counter) {
            return 'تذكرة رقم ' + ticket.ticket_number + ': تفضل إلى ' + (counter.name || '') + '.';
          }
        });
      }
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter) {
        return res.status(404).json({ error: 'الكاونتر غير موجود.' });
      }

      const tickets = MEMORY_DB.tickets[tenantSlug];
      const assignedQueues = counter.assigned_queue_ids || [];

      if (counter.status === 'on_break') {
        return res.status(400).json({ error: 'الكاونتر في وضع استراحة حالياً. يرجى تفعيل الحالة أولاً.' });
      }

      // تصفية التذاكر المؤهلة
      const clock = queueClock(tenantSlug);
      const eligibleTicketsRaw = tickets.filter(t =>
        assignedQueues.includes(t.queue_id) &&
        queueDay.isCallable(t, clock.settings, clock.now, clock.extended, ['waiting', 'bumped', 'sync_watch'])
      );

      // فرز التذاكر وفق مصفوفة الأولوية الهرمية مع منع التجويع
      const hallPolicy = MEMORY_DB.hallPolicies[tenantSlug] || {};
      const eligibleTickets = sortEligibleTickets(eligibleTicketsRaw, hallPolicy, counter);

      if (!eligibleTickets.length) {
        return res.status(200).json({ ok: true, message: 'لا يوجد عملاء منتظرين في هذا المسار حالياً.', ticket: null });
      }

      let selectedTicket = null;
      let bumpedCandidate = null;

      for (let i = 0; i < eligibleTickets.length; i++) {
        const candidate = eligibleTickets[i];
        const inServiceElsewhere = isCustomerInServiceElsewhere(tenantSlug, candidate.customer_phone, candidate.session_token, candidate.queue_id);

        if (inServiceElsewhere) {
          candidate.is_bumped = true;
          candidate.bump_count = (candidate.bump_count || 0) + 1;
          candidate.status = 'bumped';
          candidate.notes = 'تم تأمين موقعك ذكياً (+1 Bump)؛ نظراً لوجودك عند كاونتر الخدمة الأخرى.';
          bumpedCandidate = candidate;

          notifyCustomer(
            tenantSlug, 
            candidate, 
            '🛡️ تم تأمين موقعك في الطابور', 
            `تم تأمين موقعك في طابور (${candidate.queue_name})؛ سيتم طلبك فور فراغك من المعاملة الحالية دون فقدان دورك.`
          );
          continue;
        } else {
          selectedTicket = candidate;
          break;
        }
      }

      if (!selectedTicket && bumpedCandidate) {
        return res.status(200).json({
          ok: true,
          message: 'العميل الحالي قيد الخدمة في مسار آخر وتم تأمين موقعه (+1 Bump). لا يوجد عملاء آخرين تالين حالياً.',
          ticket: null,
          bumpedTicket: bumpedCandidate
        });
      }

      if (selectedTicket) {
        selectedTicket.status = 'called';
        selectedTicket.counter_id = counter.id;
        selectedTicket.called_counter_number = counter.counter_number;
        selectedTicket.called_at = new Date().toISOString();
        counter.current_ticket_id = selectedTicket.id;
        counter.current_ticket_number = selectedTicket.ticket_number;
        counter.current_session_started_at = null;

        // تحديث عداد منع التجويع للمواعيد المتتالية
        if (selectedTicket.priority_level === 'scheduled_appointment') {
          counter.consecutive_appointments_served = (counter.consecutive_appointments_served || 0) + 1;
        } else if (selectedTicket.priority_level !== 'immediate_next') {
          counter.consecutive_appointments_served = 0;
        }

        notifyCustomer(
          tenantSlug,
          selectedTicket,
          '🔔 حان دورك الآن!',
          `تذكرة رقم ${selectedTicket.ticket_number}: تفضل إلى ${counter.name}.`
        );

        broadcastSSE(tenantSlug, 'ticket_called', { ticket: selectedTicket, counter });
        return res.status(200).json({ ok: true, ticket: selectedTicket, counter });
      }

      return res.status(200).json({ ok: true, ticket: null });
    }

    // ---------------------------------------------------------------
    // 10. النداء المركزي الموجه لكاونتر محدد (Force-Call / Dispatch)
    // ---------------------------------------------------------------
    if (action === 'dispatch-call') {
      const counterId = req.body?.counterId;
      const targetTicketId = req.body?.ticketId;
      if (queuePersist.mode() !== 'memory') {
        return claimAndRespond(
          counterId,
          targetTicketId || null,
          ['waiting', 'bumped', 'sync_watch', 'on_hold'],
          {
            missingCounter: 'الكاونتر المحدد غير موجود.',
            onBreak: 'الكاونتر في استراحة حالياً.',
            empty: 'لا توجد تذاكر متاحة للنداء.',
            title: '🔔 حان دورك الآن!',
            extra: { dispatchedBy: 'reception' },
            detail: function (ticket, counter) {
              return 'تذكرة رقم ' + ticket.ticket_number + ': تفضل فوراً إلى ' + (counter.name || '') + '.';
            }
          }
        );
      }
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);

      if (!counter) return res.status(404).json({ error: 'الكاونتر المحدد غير موجود.' });
      if (counter.status === 'on_break') return res.status(400).json({ error: 'الكاونتر في استراحة حالياً.' });

      const tickets = MEMORY_DB.tickets[tenantSlug];
      let ticketToCall = null;

      const clock = queueClock(tenantSlug);
      if (targetTicketId) {
        ticketToCall = tickets.find(t => t.id === targetTicketId);
        if (ticketToCall && (ticketToCall.status === 'expired' || queueDay.shouldExpire(ticketToCall, clock.settings, clock.now, clock.extended))) {
          ticketToCall = null;
        }
      } else {
        const eligible = sortEligibleTickets(tickets.filter(t =>
          counter.assigned_queue_ids?.includes(t.queue_id) &&
          queueDay.isCallable(t, clock.settings, clock.now, clock.extended, ['waiting', 'bumped', 'sync_watch', 'on_hold'])
        ));
        ticketToCall = eligible[0];
      }

      if (!ticketToCall) {
        return res.status(200).json({ ok: true, message: 'لا توجد تذاكر متاحة للنداء.', ticket: null });
      }

      ticketToCall.status = 'called';
      ticketToCall.counter_id = counter.id;
      ticketToCall.called_counter_number = counter.counter_number;
      ticketToCall.called_at = new Date().toISOString();
      counter.current_ticket_id = ticketToCall.id;
      counter.current_ticket_number = ticketToCall.ticket_number;
      counter.current_session_started_at = null;

      notifyCustomer(
        tenantSlug,
        ticketToCall,
        '🔔 حان دورك الآن!',
        `تذكرة رقم ${ticketToCall.ticket_number}: تفضل فوراً إلى ${counter.name}.`
      );

      broadcastSSE(tenantSlug, 'ticket_called', { ticket: ticketToCall, counter, dispatchedBy: 'reception' });
      return res.status(200).json({ ok: true, ticket: ticketToCall, counter });
    }

    // ---------------------------------------------------------------
    // 11. محرك التحويل الذكي بين الطوابير (Smart Transfer Routing)
    // ---------------------------------------------------------------
    if (action === 'transfer-ticket') {
      const outcome = await commitMutation(function () {
      const body = req.body || {};
      const ticketId = body.ticketId;
      const toQueueId = body.toQueueId;
      const priorityLevel = body.priorityLevel || 'standard'; // 'immediate_next', 'fair_fifo', 'standard'
      const transferNotes = (body.transferNotes || '').trim();
      const userRole = queueRole || 'counter_agent';
      const counterId = body.counterId;

      const tickets = MEMORY_DB.tickets[tenantSlug];
      const queues = MEMORY_DB.queues[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const logs = MEMORY_DB.serviceLogs[tenantSlug];

      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return { persist: false, status: 404, body: { error: 'التذكرة غير موجودة.' } };

      const targetQueue = queues.find(q => q.id === toQueueId);
      if (!targetQueue) return { persist: false, status: 404, body: { error: 'القسم المستهدف غير موجود.' } };

      const currentCounter = counterId ? counters.find(c => c.id === counterId) : null;

      // قيود الصلاحية: موظف الكاونتر محصور فقط بالعميل الحالي الجالس أمامه
      if (userRole === 'counter_agent') {
        if (!currentCounter || currentCounter.current_ticket_id !== ticket.id) {
          return { persist: false, status: 403, body: { error: 'صلاحيتك مقيدة: يحق لك فقط تحويل العميل الحالي الجالس أمامك.' } };
        }
      }

      // 1. إغلاق دورة الكاونتر الأول بدقة (Closing 1st Counter Cycle)
      let firstStageDuration = 0;
      if (currentCounter && currentCounter.current_ticket_id === ticket.id) {
        const finishTime = new Date();
        const startTime = ticket.service_started_at ? new Date(ticket.service_started_at) : new Date(ticket.called_at || finishTime);
        firstStageDuration = Math.max(10, Math.round((finishTime - startTime) / 1000));

        // تسجيل إنجاز الموظف الأول في سجل الكفاءة
        currentCounter.ewma_service_seconds = updateEWMA(currentCounter.ewma_service_seconds, firstStageDuration, 0.30, false);
        currentCounter.completed_today_count = (currentCounter.completed_today_count || 0) + 1;
        currentCounter.current_ticket_id = null;
        currentCounter.current_ticket_number = null;
        currentCounter.current_session_started_at = null;

        logs.push({
          id: 'log_' + Math.random().toString(36).substring(2, 9),
          tenant_slug: tenantSlug,
          queue_id: ticket.queue_id,
          counter_id: currentCounter.id,
          ticket_id: ticket.id,
          operator_name: currentCounter.operator_name,
          service_duration_seconds: firstStageDuration,
          action: 'transferred',
          notes: transferNotes,
          recorded_at: finishTime.toISOString()
        });
      }

      // 2. تحديث التذكرة وسياق العميل (Context Handover & Identity Persistence)
      const previousQueue = queues.find(q => q.id === ticket.queue_id);
      const transferTimestamp = new Date().toISOString();
      const oldZoneId = ticket.zone_id || null;

      ticket.last_service_name = previousQueue?.name || 'القسم السابق';
      ticket.queue_id = targetQueue.id;
      ticket.queue_name = targetQueue.name;
      if (targetQueue.zone_id !== undefined) {
        ticket.zone_id = targetQueue.zone_id;
      } else if (body.toZoneId || body.to_zone_id) {
        const tz = resolveZone(tenantSlug, body.toZoneId || body.to_zone_id);
        ticket.zone_id = tz ? tz.id : (body.toZoneId || body.to_zone_id);
      }
      if (targetQueue.branch_id) {
        ticket.branch_id = targetQueue.branch_id;
      }
      ticket.status = 'waiting';
      ticket.priority_level = priorityLevel;
      ticket.transferred_at = transferTimestamp;
      ticket.transfer_notes = transferNotes;
      ticket.is_immediate_next = priorityLevel === 'immediate_next';
      ticket.counter_id = null;
      ticket.called_at = null;
      ticket.service_started_at = null;

      // 3. حساب وتصحيح الـ Throughput والوقت المتوقع في الطابور الجديد
      const activeTargetCounters = counters.filter(c => c.status === 'active' && c.assigned_queue_ids?.includes(targetQueue.id));
      const waitingInTarget = tickets.filter(t => t.queue_id === targetQueue.id && ['waiting', 'bumped'].includes(t.status));
      const targetThroughput = calculateQueueThroughput(activeTargetCounters, targetQueue.target_service_minutes || 10);
      const newEtw = calculateETW(waitingInTarget.length, targetThroughput, MEMORY_DB.settings[tenantSlug].safety_multiplier);

      return {
        persist: true,
        status: 200,
        body: {
          ok: true,
          ticket: ticket,
          message: 'تم تحويل التذكرة بنجاح إلى (' + targetQueue.name + ') بمستوى أولوية [' + priorityLevel + '].',
          estimatedWaitMinutes: newEtw
        },
        afterCommit: function () {
          notifyCustomer(
            tenantSlug,
            ticket,
            '🔄 تم توجيهك إلى قسم جديد',
            '✓ تم الانتهاء من: ' + ticket.last_service_name + ' | الوجهة الحالية: ' + ticket.queue_name + ' (رقمك: ' + ticket.ticket_number + ') - الوقت التقديري: ~' + newEtw + ' دقائق.'
          );
          broadcastSSE(tenantSlug, 'ticket_transferred', {
            ticket: ticket,
            previousServiceName: ticket.last_service_name,
            targetServiceName: ticket.queue_name,
            priorityLevel: priorityLevel,
            transferNotes: transferNotes,
            estimatedWaitMinutes: newEtw,
            currentCounter: currentCounter
          }, {
            zoneId: ticket.zone_id,
            oldZoneId: oldZoneId,
            sessionToken: ticket.session_token,
            branchId: ticket.branch_id
          });
        }
      };
      });
      return respond(outcome);
    }

    // ---------------------------------------------------------------
    // 12. تعليق مؤقت للعميل الحالي (Put On Hold)
    // ---------------------------------------------------------------
    if (action === 'hold-ticket') {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'لا توجد جلسة نشطة لتعليقها.' });
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (ticket) {
        ticket.status = 'on_hold';
        ticket.notes = 'تم تعليق المعاملة مؤقتاً (بانتظار استكمال أوراق أو دفع).';
        counter.current_ticket_id = null;
        counter.current_ticket_number = null;
        counter.current_session_started_at = null;

        broadcastSSE(tenantSlug, 'ticket_held', { ticket, counter });
        return res.status(200).json({ ok: true, ticket, counter, message: 'تم تعليق التذكرة مؤقتاً والكاونتر جاهز لطلب التالي.' });
      }
      return res.status(404).json({ error: 'التذكرة غير موجودة.' });
    }

    // ---------------------------------------------------------------
    // 13. إعادة النداء اللحظي وتكرار الصوت والاهتزاز (Recall Ticket)
    // ---------------------------------------------------------------
    if (action === 'recall-ticket') {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'لا توجد تذكرة لإعادة ندائها.' });
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (ticket) {
        notifyCustomer(
          tenantSlug,
          ticket,
          '📢 نداء متكرر!',
          `تذكرة رقم ${ticket.ticket_number}: يرجى التوجه فوراً إلى ${counter.name}.`
        );

        broadcastSSE(tenantSlug, 'ticket_called', { ticket, counter, isRecall: true });
        return res.status(200).json({ ok: true, ticket, counter, message: 'تم إعادة إطلاق النداء الصوتي والإشعار.' });
      }
      return res.status(404).json({ error: 'التذكرة غير موجودة.' });
    }

    // ---------------------------------------------------------------
    // 14. بدء المعاملة في الكاونتر (Start Service)
    // ---------------------------------------------------------------
    if (action === 'start-service') {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'لا توجد تذكرة مستدعاة حالياً على هذا الكاونتر.' });
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (ticket) {
        ticket.status = 'in_service';
        ticket.service_started_at = new Date().toISOString();
        counter.current_session_started_at = ticket.service_started_at;

        broadcastSSE(tenantSlug, 'ticket_in_service', { ticket, counter });
        return res.status(200).json({ ok: true, ticket, counter });
      }
      return res.status(404).json({ error: 'التذكرة غير موجودة.' });
    }

    // ---------------------------------------------------------------
    // 15. إنهاء المعاملة وحساب EWMA وترقية الطوابير المتزامنة
    // ---------------------------------------------------------------
    if (action === 'complete-service') {
      const outcome = await commitMutation(function () {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return { persist: false, status: 400, body: { error: 'لا توجد جلسة نشطة لإنهائها.' } };
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (!ticket) {
        counter.current_ticket_id = null;
        return { persist: true, status: 404, body: { error: 'التذكرة غير موجودة.' } };
      }

      const finishTime = new Date();
      const startTime = ticket.service_started_at ? new Date(ticket.service_started_at) : new Date(ticket.called_at || finishTime);
      const durationSeconds = Math.max(10, Math.round((finishTime - startTime) / 1000));
      const queue = MEMORY_DB.queues[tenantSlug].find(q => q.id === ticket.queue_id);
      const targetSeconds = (queue?.target_service_minutes || 10) * 60;

      const isLongException = durationSeconds > (targetSeconds * 2);
      const logs = MEMORY_DB.serviceLogs[tenantSlug] || [];
      const pastDurations = logs.map(l => l.service_duration_seconds);
      const bounds = calculateOutlierBounds(pastDurations);
      const isOutlier = bounds ? (durationSeconds < bounds.min || durationSeconds > bounds.max) : false;

      if (!isOutlier && !isLongException) {
        counter.ewma_service_seconds = updateEWMA(counter.ewma_service_seconds, durationSeconds, 0.30, false);
      }

      ticket.status = 'completed';
      ticket.service_completed_at = finishTime.toISOString();
      counter.completed_today_count = (counter.completed_today_count || 0) + 1;

      const activeSession = (MEMORY_DB.counterSessions[tenantSlug] || []).find(s => s.counter_id === counter.id && s.session_status === 'active');
      if (activeSession) {
        activeSession.total_served_tickets = (activeSession.total_served_tickets || 0) + 1;
      }

      logs.push({
        id: 'log_' + Math.random().toString(36).substring(2, 9),
        tenant_slug: tenantSlug,
        queue_id: ticket.queue_id,
        counter_id: counter.id,
        ticket_id: ticket.id,
        operator_name: counter.operator_name,
        service_duration_seconds: durationSeconds,
        target_seconds: targetSeconds,
        is_outlier: isOutlier,
        is_long_exception: isLongException,
        action: 'completed',
        recorded_at: finishTime.toISOString()
      });

      counter.current_ticket_id = null;
      counter.current_ticket_number = null;
      counter.current_session_started_at = null;

      // فحص الترقية التلقائية للمسار الثاني في الطوابير المتزامنة
      let promotedTicket = null;
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const otherTickets = tickets.filter(t => 
        t.session_token === ticket.session_token &&
        t.id !== ticket.id &&
        ['bumped', 'sync_watch'].includes(t.status)
      );

      if (otherTickets.length > 0) {
        promotedTicket = otherTickets[0];
        promotedTicket.status = 'waiting';
        promotedTicket.is_bumped = true;
        promotedTicket.priority_level = 'immediate_next';
        promotedTicket.notes = 'قفز آلي لرأس الطابور بعد إنجاز الخدمة الأولى.';

      }

      return {
        persist: true,
        status: 200,
        body: {
          ok: true,
          completedTicket: ticket,
          counter: counter,
          promotedTicket: promotedTicket,
          isOutlier: isOutlier,
          isLongException: isLongException
        },
        afterCommit: function () {
          if (promotedTicket) {
            const promotedName = optionalCustomerName(promotedTicket.customer_name);
            notifyCustomer(
              tenantSlug,
              promotedTicket,
              '🚀 حان موعدك في المسار الثاني!',
              (promotedName ? 'أهلاً ' + promotedName + '، ' : '') +
              'لقد تم نقلك مباشرة إلى رأس طابور (' + promotedTicket.queue_name + ')؛ تفضل بالاستعداد للنداء.'
            );
          }
          broadcastSSE(tenantSlug, 'service_completed', {
            completedTicket: ticket,
            counter: counter,
            promotedTicket: promotedTicket,
            metrics: { ewma: counter.ewma_service_seconds, isOutlier: isOutlier, isLongException: isLongException }
          });
        }
      };
      });
      return respond(outcome);
    }

    // ---------------------------------------------------------------
    // 16. غياب العميل عند النداء (No-Show Snooze 5 Minutes)
    // ---------------------------------------------------------------
    if (action === 'snooze-no-show') {
      const outcome = await commitMutation(function () {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return { persist: false, status: 400, body: { error: 'لا توجد تذكرة مستدعاة لمعالجتها كغياب.' } };
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (!ticket) return { persist: false, status: 404, body: { error: 'التذكرة غير موجودة.' } };

      const snoozeMinutes = MEMORY_DB.settings[tenantSlug]?.snooze_minutes || 5;
      ticket.status = 'snoozed';
      ticket.snoozed_until = new Date(Date.now() + (snoozeMinutes * 60 * 1000)).toISOString();
      ticket.notes = 'تم تسجيل غياب العميل وتأجيله لمدة ' + snoozeMinutes + ' دقائق، ثم يُلغى آلياً.';

      counter.current_ticket_id = null;
      counter.current_ticket_number = null;
      counter.current_session_started_at = null;

      return {
        persist: true,
        status: 200,
        body: { ok: true, ticket: ticket, counter: counter, message: 'تم نقل التذكرة للتأجيل واستدعاء التالي متاح.' },
        afterCommit: function () {
          notifyCustomer(
            tenantSlug,
            ticket,
            '⏳ تم تأجيل دورك لعدم الحضور',
            'تذكرة ' + ticket.ticket_number + ': لم يتم الرد عند النداء. أمامك مهلة ' + snoozeMinutes + ' دقائق للمراجعة قبل إلغاء التذكرة تلقائياً.'
          );
          broadcastSSE(tenantSlug, 'ticket_snoozed', { ticket: ticket, counter: counter });
        }
      };
      });
      return respond(outcome);
    }

    // ---------------------------------------------------------------
    // 17. تبديل حالة الكاونتر (Active / On Break / Offline)
    // ---------------------------------------------------------------
    if (action === 'counter-status') {
      const counterId = req.body?.counterId || req.query.counterId;
      const newStatus = req.body?.status || req.query.status;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter) {
        return res.status(404).json({ error: 'الكاونتر غير موجود.' });
      }

      if (!['active', 'on_break', 'offline'].includes(newStatus)) {
        return res.status(400).json({ error: 'الحالة غير صالحة.' });
      }

      counter.status = newStatus;
      counter.last_status_change = new Date().toISOString();

      broadcastSSE(tenantSlug, 'counter_status_changed', { counter, status: newStatus });
      return res.status(200).json({ ok: true, counter });
    }

    // ---------------------------------------------------------------
    // 18. إرسال إشعار عام / طارئ لصالة الانتظار والشاشات المركزية
    // ---------------------------------------------------------------
    if (action === 'broadcast-notice') {
      const message = (req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'الرجاء إدخال نص الإشعار.' });

      broadcastSSE(tenantSlug, 'system_notice', { message });
      return res.status(200).json({ ok: true, message: 'تم بث الإشعار بنجاح لجميع شاشات الصالة والمراجعين.' });
    }

    // ---------------------------------------------------------------
    // 19. فحص المعاملات الاستثنائية الطويلة
    // ---------------------------------------------------------------
    if (action === 'check-long-transactions') {
      const counters = MEMORY_DB.counters[tenantSlug];
      const queues = MEMORY_DB.queues[tenantSlug];
      const alerts = [];

      for (const c of counters) {
        if (c.status === 'active' && c.current_ticket_id && c.current_session_started_at) {
          const elapsed = (Date.now() - new Date(c.current_session_started_at).getTime()) / 1000;
          const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === c.current_ticket_id);
          const queue = queues.find(q => q.id === ticket?.queue_id);
          const targetSeconds = (queue?.target_service_minutes || 10) * 60;

          if (elapsed > (targetSeconds * 2)) {
            alerts.push({
              counterName: c.name,
              ticketNumber: ticket?.ticket_number,
              elapsedMinutes: Math.round(elapsed / 60)
            });
            broadcastSSE(tenantSlug, 'system_notice', {
              message: 'نظام الخدمة يواجه تدقيقاً إضافياً، تم تعديل موعدك المتوقع.'
            });
          }
        }
      }

      return res.status(200).json({ ok: true, alerts });
    }

    // ---------------------------------------------------------------
    // 20. تسليم الوردية السريع / التبديل الفوري (Hot Swap Authentication)
    // ---------------------------------------------------------------
    if (action === 'hot-swap-authenticate') {
      const body = req.body || {};
      const counterId = body.counterId;
      const incomingPin = (body.incomingPin || '').trim();
      const handoverOption = body.handoverOption || 'handover_active'; // 'complete_first' | 'handover_active'
      const handoverNotes = (body.handoverNotes || '').trim();

      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter) return res.status(404).json({ error: 'الكاونتر غير موجود.' });

      const users = MEMORY_DB.users[tenantSlug] || [];
      let incomingUser = null;
      if (queueRole === 'admin') {
        incomingUser = {
          id: 'usr-admin-' + tenantSlug,
          full_name: (body.adminName || '').trim() || (resolved.session && resolved.session.email) || 'مدير النظام (Admin)',
          role: 'admin',
          is_active: true
        };
      } else {
        incomingUser = users.find(u => u.pin_code === incomingPin && u.is_active);
      }
      if (!incomingUser) {
        return res.status(401).json({ error: 'رمز الدخول السريع (PIN) غير صحيح.' });
      }

      // إذا كان هناك عميل قيد الخدمة وخيار الموظف إنهاء المعاملة أولاً
      if (counter.current_ticket_id && handoverOption === 'complete_first') {
        return res.status(400).json({ error: 'يرجى إنهاء المعاملة الحالية أولاً قبل تسليم الوردية.' });
      }

      const sessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const activeSession = sessions.find(s => s.counter_id === counter.id && s.session_status === 'active');
      const outgoingOperatorName = counter.operator_name;

      // 1. إذا كان هناك عميل قيد الخدمة مع تسليم المعاملة للبديل:
      if (counter.current_ticket_id && handoverOption === 'handover_active') {
        const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
        if (ticket) {
          ticket.served_by_user_id = incomingUser.id;
          const noteText = `[تسليم الوردية من ${outgoingOperatorName} إلى ${incomingUser.full_name}] ${handoverNotes}`;
          ticket.transfer_notes = ticket.transfer_notes ? `${ticket.transfer_notes} | ${noteText}` : noteText;
        }
      }

      // 2. إغلاق الجلسة الحالية
      if (activeSession) {
        activeSession.ended_at = new Date().toISOString();
        activeSession.session_status = 'closed';
        activeSession.closed_by_user_id = incomingUser.id;
        activeSession.handover_notes = handoverNotes;
      }

      // 3. فتح جلسة عمل جديدة للموظف البديل
      const newSession = {
        id: 'cs_' + Math.random().toString(36).substring(2, 9),
        tenant_slug: tenantSlug,
        counter_id: counter.id,
        user_id: incomingUser.id,
        operator_name: incomingUser.full_name,
        started_at: new Date().toISOString(),
        ended_at: null,
        total_served_tickets: 0,
        session_status: 'active',
        closed_by_user_id: null,
        handover_notes: null
      };
      sessions.push(newSession);

      // 4. تحديث الكاونتر فوراً دون انقطاع ثانية واحدة
      counter.operator_name = incomingUser.full_name;
      counter.current_user_id = incomingUser.id;
      counter.status = 'active';

      broadcastSSE(tenantSlug, 'counter_swapped', {
        counter,
        session: newSession,
        outgoingOperatorName,
        incomingOperatorName: incomingUser.full_name,
        handoverNotes
      });

      return res.status(200).json({
        ok: true,
        counter,
        session: newSession,
        newAgent: { id: incomingUser.id, full_name: incomingUser.full_name, role: incomingUser.role }
      });
    }

    // ---------------------------------------------------------------
    // 21. بدء استراحة الموظف دون بديل (Start Break)
    // ---------------------------------------------------------------
    if (action === 'start-break') {
      const body = req.body || {};
      const counterId = body.counterId;
      const reason = body.reason || 'rest'; // 'prayer', 'lunch', 'rest', 'emergency'
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);

      if (!counter) return res.status(404).json({ error: 'الكاونتر غير موجود.' });

      if (counter.current_ticket_id) {
        return res.status(400).json({
          error: 'لا يمكن بدء الاستراحة أثناء وجود عميل مستدعى أو قيد الخدمة. يرجى إنهاء المعاملة أو تحويل العميل أولاً.'
        });
      }

      const sessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const activeSession = sessions.find(s => s.counter_id === counter.id && s.session_status === 'active');

      const breakRecord = {
        id: 'brk_' + Math.random().toString(36).substring(2, 9),
        tenant_slug: tenantSlug,
        counter_session_id: activeSession?.id || null,
        counter_id: counter.id,
        user_id: counter.current_user_id || activeSession?.user_id || 'usr-unknown',
        operator_name: counter.operator_name,
        reason: reason,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null
      };

      MEMORY_DB.agentBreaks[tenantSlug].push(breakRecord);
      counter.status = 'on_break';
      counter.current_break_id = breakRecord.id;
      counter.last_status_change = breakRecord.started_at;

      // سحب الكاونتر من معادلة الطاقة الاستيعابية الكلية وإشعار الجميع
      broadcastSSE(tenantSlug, 'agent_break_started', { counter, breakRecord });
      broadcastSSE(tenantSlug, 'counter_status_changed', { counter, status: 'on_break' });

      return res.status(200).json({ ok: true, counter, breakRecord });
    }

    // ---------------------------------------------------------------
    // 22. إنهاء الاستراحة والعودة للعمل (End Break)
    // ---------------------------------------------------------------
    if (action === 'end-break') {
      const body = req.body || {};
      const counterId = body.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);

      if (!counter) return res.status(404).json({ error: 'الكاونتر غير موجود.' });

      const breaks = MEMORY_DB.agentBreaks[tenantSlug] || [];
      const activeBreak = breaks.find(b => b.counter_id === counter.id && !b.ended_at);

      if (activeBreak) {
        const endedAt = new Date();
        activeBreak.ended_at = endedAt.toISOString();
        activeBreak.duration_seconds = Math.max(1, Math.round((endedAt - new Date(activeBreak.started_at)) / 1000));
      }

      counter.status = 'active';
      counter.current_break_id = null;
      counter.last_status_change = new Date().toISOString();

      broadcastSSE(tenantSlug, 'agent_break_ended', { counter, breakRecord: activeBreak });
      broadcastSSE(tenantSlug, 'counter_status_changed', { counter, status: 'active' });

      return res.status(200).json({ ok: true, counter, breakRecord: activeBreak });
    }

    // ---------------------------------------------------------------
    // 23. إنهاء جلسة كاونتر عن بُعد أو تحويله لاستراحة قسرياً (Supervisor Force Sign-Out)
    // ---------------------------------------------------------------
    if (action === 'supervisor-force-signout') {
      const body = req.body || {};
      const counterId = body.counterId;
      const supervisorId = body.supervisorId || 'usr-rec-' + tenantSlug;
      const targetStatus = body.targetStatus || 'offline'; // 'offline' | 'on_break'

      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter) return res.status(404).json({ error: 'الكاونتر غير موجود.' });

      const sessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const activeSession = sessions.find(s => s.counter_id === counter.id && s.session_status === 'active');

      if (activeSession) {
        activeSession.ended_at = new Date().toISOString();
        activeSession.session_status = 'forced_closed';
        activeSession.closed_by_user_id = supervisorId;
      }

      counter.status = targetStatus;
      counter.current_ticket_id = null;
      counter.current_ticket_number = null;
      counter.current_session_started_at = null;
      counter.last_status_change = new Date().toISOString();

      broadcastSSE(tenantSlug, 'counter_forced_signout', { counter, supervisorId, targetStatus });
      broadcastSSE(tenantSlug, 'counter_status_changed', { counter, status: targetStatus });

      return res.status(200).json({ ok: true, counter, message: 'تم إيقاف جلسة الكاونتر قسرياً بنجاح.' });
    }

    // ---------------------------------------------------------------
    // 24. إعادة تعيين مسارات الكاونتر أو الموظف (Supervisor Reassign Counter)
    // ---------------------------------------------------------------
    if (action === 'supervisor-reassign-counter') {
      const body = req.body || {};
      const counterId = body.counterId;
      const newQueueIds = body.newQueueIds; // e.g. ['q-contracts-...']
      const newUserId = body.newUserId;
      const supervisorId = body.supervisorId;

      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter) return res.status(404).json({ error: 'الكاونتر غير موجود.' });

      if (Array.isArray(newQueueIds) && newQueueIds.length) {
        counter.assigned_queue_ids = newQueueIds;
      }

      if (newUserId) {
        const user = (MEMORY_DB.users[tenantSlug] || []).find(u => u.id === newUserId);
        if (user) {
          counter.current_user_id = user.id;
          counter.operator_name = user.full_name;
        }
      }

      counter.last_status_change = new Date().toISOString();

      broadcastSSE(tenantSlug, 'counter_reassigned', { counter, supervisorId });
      return res.status(200).json({ ok: true, counter, message: 'تم إعادة توجيه وتعيين الكاونتر بنجاح.' });
    }

    // ---------------------------------------------------------------
    // 25. جلب ملخص وردية الاستقبال (Reception Shift Summary)
    // ---------------------------------------------------------------
    if (action === 'reception-shift-summary') {
      const tickets = MEMORY_DB.tickets[tenantSlug] || [];
      const queues = MEMORY_DB.queues[tenantSlug] || [];
      const counters = MEMORY_DB.counters[tenantSlug] || [];

      const waitingTickets = tickets.filter(t => ['waiting', 'bumped', 'sync_watch'].includes(t.status));
      const overdueTickets = waitingTickets.filter(t => {
        const q = queues.find(item => item.id === t.queue_id);
        const targetMins = q?.target_service_minutes || 10;
        const elapsedMins = (Date.now() - new Date(t.first_arrived_at || t.booked_at).getTime()) / 60000;
        return elapsedMins > (targetMins * 1.5);
      });

      const totalServedToday = counters.reduce((sum, c) => sum + (c.completed_today_count || 0), 0);
      const activeCountersCount = counters.filter(c => c.status === 'active').length;
      const onBreakCountersCount = counters.filter(c => c.status === 'on_break').length;

      return res.status(200).json({
        ok: true,
        summary: {
          waitingTicketsCount: waitingTickets.length,
          overdueTicketsCount: overdueTickets.length,
          totalServedToday,
          activeCountersCount,
          onBreakCountersCount,
          totalCountersCount: counters.length,
          generatedAt: new Date().toISOString()
        }
      });
    }

    // ---------------------------------------------------------------
    // 26. تسليم وردية الاستقبال وشاشة القيادة (Reception Shift Handover)
    // ---------------------------------------------------------------
    if (action === 'reception-handover') {
      const body = req.body || {};
      const outgoingUserId = body.outgoingUserId;
      const incomingPin = (body.incomingPin || '').trim();
      const handoverNotes = (body.handoverNotes || '').trim();

      const users = MEMORY_DB.users[tenantSlug] || [];
      let incomingUser = null;
      if (queueRole === 'admin') {
        incomingUser = {
          id: 'usr-admin-' + tenantSlug,
          full_name: (body.adminName || '').trim() || (resolved.session && resolved.session.email) || 'مدير النظام (Admin)',
          role: 'admin',
          is_active: true
        };
      } else {
        incomingUser = users.find(u => u.pin_code === incomingPin && ['receptionist', 'admin'].includes(u.role));
      }

      if (!incomingUser) {
        return res.status(401).json({ error: 'رمز الدخول السريع (PIN) غير صحيح لموظف الاستقبال.' });
      }

      const tickets = MEMORY_DB.tickets[tenantSlug] || [];
      const queues = MEMORY_DB.queues[tenantSlug] || [];
      const counters = MEMORY_DB.counters[tenantSlug] || [];

      const waitingCount = tickets.filter(t => ['waiting', 'bumped', 'sync_watch'].includes(t.status)).length;
      const overdueCount = tickets.filter(t => {
        const q = queues.find(item => item.id === t.queue_id);
        const targetMins = q?.target_service_minutes || 10;
        const elapsedMins = (Date.now() - new Date(t.first_arrived_at || t.booked_at).getTime()) / 60000;
        return elapsedMins > (targetMins * 1.5);
      }).length;
      const servedToday = counters.reduce((sum, c) => sum + (c.completed_today_count || 0), 0);

      const handoverRecord = {
        id: 'rec_ho_' + Math.random().toString(36).substring(2, 9),
        tenant_slug: tenantSlug,
        outgoing_user_id: outgoingUserId,
        incoming_user_id: incomingUser.id,
        incoming_name: incomingUser.full_name,
        waiting_tickets_count: waitingCount,
        overdue_tickets_count: overdueCount,
        served_today_count: servedToday,
        handover_notes: handoverNotes,
        handover_at: new Date().toISOString()
      };

      MEMORY_DB.receptionHandovers[tenantSlug].push(handoverRecord);

      broadcastSSE(tenantSlug, 'reception_handover', {
        handover: handoverRecord,
        incomingUser: { id: incomingUser.id, full_name: incomingUser.full_name }
      });

      // بث تنبيه تبديل الوردية لعملاء الصالة في هواتفهم
      broadcastSSE(tenantSlug, 'system_notice', {
        message: 'تنويه: تجري الآن عملية تبديل وردية العمل، قد يطرأ تعديل طفيف على دقة التوقيت.'
      });

      return res.status(200).json({
        ok: true,
        handover: handoverRecord,
        incomingUser: { id: incomingUser.id, full_name: incomingUser.full_name, role: incomingUser.role }
      });
    }

    // ---------------------------------------------------------------
    // 27. تنظيف وفحص الجلسات والكاونترات المتروكة (Ghost Counter Cleanup)
    // ---------------------------------------------------------------
    if (action === 'cleanup-ghost-counters') {
      const maxIdleMinutes = parseInt(req.query.max_idle_minutes || req.body?.max_idle_minutes || '120', 10);
      const counters = MEMORY_DB.counters[tenantSlug] || [];
      const sessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const now = Date.now();
      const cleaned = [];

      for (const c of counters) {
        if (c.status === 'active' && !c.current_ticket_id) {
          const lastActiveTime = new Date(c.last_status_change || c.created_at || now).getTime();
          const idleMins = (now - lastActiveTime) / 60000;
          if (idleMins >= maxIdleMinutes) {
            c.status = 'offline';
            c.last_status_change = new Date().toISOString();

            const activeSession = sessions.find(s => s.counter_id === c.id && s.session_status === 'active');
            if (activeSession) {
              activeSession.ended_at = c.last_status_change;
              activeSession.session_status = 'forced_closed';
              activeSession.closed_by_user_id = 'system-ghost-cleanup';
            }

            cleaned.push({ counterId: c.id, counterName: c.name, idleMinutes: Math.round(idleMins) });
            broadcastSSE(tenantSlug, 'counter_status_changed', { counter: c, status: 'offline', reason: 'ghost_cleanup' });
          }
        }
      }

      return res.status(200).json({ ok: true, cleanedCount: cleaned.length, cleaned });
    }

    // ---------------------------------------------------------------
    // 28. إجراءات التدخل البشري السريع (Manual Override & Operational Mutex)
    // ---------------------------------------------------------------
    if (action === 'manual-override') {
      const body = req.body || {};
      const actionType = body.action_type || body.actionType;
      const deltaValue = parseInt(body.delta_value || body.deltaValue || '0', 10);
      const reason = (body.reason || 'تدخل يدوي من الاستقبال').trim();
      const userId = body.user_id || body.userId || 'admin-rec';
      const userName = body.user_name || body.userName || 'مشرف الاستقبال';
      const idempotencyKey = body.idempotency_key || body.idempotencyKey;
      const userIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

      if (!actionType) {
        return res.status(400).json({ error: 'نوع التدخل البشري (action_type) مطلوب.' });
      }

      if (!MEMORY_DB.overrides[tenantSlug]) {
        MEMORY_DB.overrides[tenantSlug] = {
          state_revision: 1,
          capacity_override_delta: 0,
          extended_closing_minutes: 0,
          paused_until: null,
          is_force_locked_today: false,
          lock_reason: null,
          pause_reason: null,
          updated_at: new Date().toISOString()
        };
      }
      if (!MEMORY_DB.auditLogs[tenantSlug]) MEMORY_DB.auditLogs[tenantSlug] = [];
      if (!MEMORY_DB.idempotencyKeys[tenantSlug]) MEMORY_DB.idempotencyKeys[tenantSlug] = {};

      const override = MEMORY_DB.overrides[tenantSlug];

      // فحص عدم التكرار (Idempotency Key Check)
      if (idempotencyKey && MEMORY_DB.idempotencyKeys[tenantSlug][idempotencyKey]) {
        return res.status(200).json({
          ok: true,
          success: true,
          idempotent_replay: true,
          revision: override.state_revision,
          override: override,
          message: 'تم استرجاع نتيجة الإجراء المنفذ مسبقاً بنجاح (Idempotent).'
        });
      }

      // زيادة الإصدار المتصاعد حتماً (Monotonic State Revision)
      override.state_revision = (override.state_revision || 1) + 1;
      override.updated_at = new Date().toISOString();

      switch (actionType) {
        case 'ADD_CAPACITY':
          const addedCap = deltaValue > 0 ? deltaValue : 10;
          override.capacity_override_delta = (override.capacity_override_delta || 0) + addedCap;
          break;

        case 'EXTEND_TIME':
          const addedMins = deltaValue > 0 ? deltaValue : 30;
          override.extended_closing_minutes = (override.extended_closing_minutes || 0) + addedMins;
          break;

        case 'PAUSE_QUEUE':
          const pauseMins = deltaValue > 0 ? deltaValue : 15;
          override.paused_until = new Date(Date.now() + pauseMins * 60000).toISOString();
          override.pause_reason = reason;
          break;

        case 'FORCE_LOCK':
          override.is_force_locked_today = true;
          override.lock_reason = reason;
          break;

        case 'RESUME_OR_UNLOCK':
          override.is_force_locked_today = false;
          override.paused_until = null;
          override.lock_reason = null;
          override.pause_reason = null;
          break;

        default:
          return res.status(400).json({ error: `نوع الإجراء ${actionType} غير مدعوم.` });
      }

      // تسجيل الحدث في سجل التدقيق الأمني والامتثال (NCA & PDPL Audit Trail)
      const auditEntry = {
        id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        tenant_slug: tenantSlug,
        action_type: actionType,
        delta_value: deltaValue,
        reason: reason,
        performed_by_user_id: userId,
        performed_by_name: userName,
        user_ip_address: userIp,
        state_revision_after: override.state_revision,
        idempotency_key: idempotencyKey || ('gen_' + Date.now()),
        created_at: new Date().toISOString()
      };
      MEMORY_DB.auditLogs[tenantSlug].push(auditEntry);

      if (idempotencyKey) {
        MEMORY_DB.idempotencyKeys[tenantSlug][idempotencyKey] = {
          revision: override.state_revision,
          override: { ...override }
        };
      }

      // محاولة المزامنة المستمرة مع Supabase إن كانت متاحة
      const supabaseUrl = sbEnv.getSupabaseUrl();
      const supabaseKey = sbEnv.getSupabaseServiceKey();
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          supabase.from('queue_audit_logs').insert([{
            tenant_slug: tenantSlug,
            queue_id: 'all',
            action_type: actionType,
            delta_value: String(deltaValue),
            performed_by_user_id: userId,
            performed_by_name: userName,
            user_ip_address: userIp,
            reason: reason,
            state_revision_after: override.state_revision,
            idempotency_key: idempotencyKey || auditEntry.id,
            created_at: auditEntry.created_at
          }]).then(() => {}).catch(e => console.warn('[Supabase Audit Log non-blocking]', e.message));
        } catch (e) {
          console.warn('[Supabase Client Error]', e.message);
        }
      }

      // بث الحدث عبر SSE لجميع الشاشات والصالات
      broadcastSSE(tenantSlug, 'override_applied', {
        state_revision: override.state_revision,
        action_type: actionType,
        override: override,
        performed_by: userName,
        created_at: auditEntry.created_at
      });

      return res.status(200).json({
        ok: true,
        success: true,
        revision: override.state_revision,
        override: override,
        audit_log: auditEntry
      });
    }

    // ---------------------------------------------------------------
    // 29. استرجاع حالة التدخل البشري وسجل التدقيق (Get Override State)
    // ---------------------------------------------------------------
    if (action === 'restore-ticket') {
      const body = req.body || {};
      const ticketId = body.ticketId || body.ticket_id;
      if (!ticketId) return res.status(400).json({ error: 'معرّف التذكرة مطلوب.' });
      for (let attempt = 0; attempt < 6; attempt++) {
        const tickets = MEMORY_DB.tickets[tenantSlug] || [];
        const ticket = tickets.find(function (item) { return item.id === ticketId; });
        if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة.' });
        if (ticket.status !== 'expired' || !ticket.auto_closed) {
          return res.status(409).json({ error: 'لا يمكن إعادة تذكرة ليست مغلقة تلقائياً.' });
        }
        const clock = queueClock(tenantSlug);
        const period = queueDay.currentPeriod(clock.settings, clock.now, clock.extended);
        const seq = queueDay.sequenceOf(ticket);
        const open = queueDay.openSequences(tickets, ticket.queue_id);
        if (seq && open.has(seq)) {
          const q = (MEMORY_DB.queues[tenantSlug] || []).find(function (item) { return item.id === ticket.queue_id; });
          const allocated = await queuePersist.allocate(tenantSlug, ticket.queue_id, (q && q.prefix) || 'A', MEMORY_DB);
          ticket.ticket_number = allocated.ticket_number;
          ticket.daily_sequence = allocated.sequence;
        }
        const actor = (resolved.session && resolved.session.email) || 'staff';
        ticket.status = 'waiting';
        ticket.service_date = period;
        ticket.restored_at = clock.now.toISOString();
        ticket.auto_closed = false;
        ticket.restored_by = actor;
        if (!MEMORY_DB.auditLogs[tenantSlug]) MEMORY_DB.auditLogs[tenantSlug] = [];
        MEMORY_DB.auditLogs[tenantSlug].push({
          id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          tenant_slug: tenantSlug,
          action_type: 'QUEUE_TICKET_RESTORE',
          delta_value: 1,
          reason: 'إعادة تذكرة أُغلقت تلقائياً إلى الطابور',
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          performed_by_user_id: actor,
          performed_by_name: actor,
          user_ip_address: queueGuard.clientIp(req) || 'staff',
          created_at: clock.now.toISOString()
        });
        broadcastSSE(tenantSlug, 'ticket_restored', { ticketId: ticket.id, ticket_number: ticket.ticket_number });
        if (queuePersist.mode() === 'memory') {
          return res.status(200).json({ ok: true, ticket: ticket });
        }
        try {
          await queuePersist.finish(tenantSlug, MEMORY_DB);
          return res.status(200).json({ ok: true, ticket: ticket });
        } catch (err) {
          queuePersist.clearEvents();
          if (!queuePersist.isConflict(err) || attempt === 5) throw err;
          await queuePersist.reload(tenantSlug, MEMORY_DB);
        }
      }
    }

    if (action === 'get-override-state') {
      if (!MEMORY_DB.overrides[tenantSlug]) {
        MEMORY_DB.overrides[tenantSlug] = {
          state_revision: 1,
          capacity_override_delta: 0,
          extended_closing_minutes: 0,
          paused_until: null,
          is_force_locked_today: false,
          lock_reason: null,
          pause_reason: null,
          updated_at: new Date().toISOString()
        };
      }
      return res.status(200).json({
        ok: true,
        revision: MEMORY_DB.overrides[tenantSlug].state_revision,
        override: MEMORY_DB.overrides[tenantSlug],
        recent_audit_logs: (MEMORY_DB.auditLogs[tenantSlug] || []).slice(-10)
      });
    }

    return res.status(400).json({ error: 'إجراء غير معروف.' });
  } catch (error) {
    console.error('[Queue Engine Error]', error);
    return res.status(500).json({ error: error.message || 'خطأ داخلي في محرك الطوابير.' });
  }
};

function wrappedQueueHandler(req, res) {
  return queuePersist.runRequest(function () {
    return queueHandler(req, res);
  });
}

wrappedQueueHandler._memory = MEMORY_DB;
module.exports = wrappedQueueHandler;
