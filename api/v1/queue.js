'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const pushLib = require('../_lib/web-push');

/**
 * الذاكرة التشغيلية المعزولة لكل مستأجر (In-Memory High-Performance Failover Store)
 * تضمن الاستمرارية التشغيلية 100% حتى في حال تعذر الاتصال بقاعدة البيانات الخارجية.
 */
const MEMORY_DB = {
  queues: {},              // tenantSlug -> [queueObj]
  counters: {},            // tenantSlug -> [counterObj]
  tickets: {},             // tenantSlug -> [ticketObj]
  serviceLogs: {},         // tenantSlug -> [logObj]
  users: {},               // tenantSlug -> [userObj]
  settings: {},            // tenantSlug -> settingsObj
  sseClients: {},          // tenantSlug -> [res]
  counterSessions: {},     // tenantSlug -> [sessionObj]
  agentBreaks: {},         // tenantSlug -> [breakObj]
  receptionHandovers: {}   // tenantSlug -> [handoverObj]
};

function getOrCreateMemoryTenant(tenantSlug) {
  const slug = (tenantSlug || 'default').toLowerCase();
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
      }
    };
  }
  if (!MEMORY_DB.sseClients[slug]) MEMORY_DB.sseClients[slug] = [];
  return slug;
}

function broadcastSSE(tenantSlug, event, data) {
  const slug = (tenantSlug || 'default').toLowerCase();
  const clients = MEMORY_DB.sseClients[slug] || [];
  if (!clients.length) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      clients[i].write(payload);
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
function sortEligibleTickets(ticketsList) {
  return ticketsList.sort((a, b) => {
    // 1. الأولوية الفورية تأتي أولاً على الإطلاق
    const aImmediate = a.priority_level === 'immediate_next' || a.is_immediate_next || a.is_bumped;
    const bImmediate = b.priority_level === 'immediate_next' || b.is_immediate_next || b.is_bumped;
    if (aImmediate && !bImmediate) return -1;
    if (!aImmediate && bImmediate) return 1;

    // 2. إذا كان كلاهما فوري، الأقدم تحويلاً يسبق
    if (aImmediate && bImmediate) {
      const aTime = new Date(a.transferred_at || a.called_at || a.booked_at).getTime();
      const bTime = new Date(b.transferred_at || b.called_at || b.booked_at).getTime();
      return aTime - bTime;
    }

    // 3. الأسبقية العادلة Fair FIFO: تعتمد وقت الدخول الأول للمنشأة (first_arrived_at)
    const aEffectiveDate = (a.priority_level === 'fair_fifo' && a.first_arrived_at) 
      ? new Date(a.first_arrived_at).getTime() 
      : new Date(a.transferred_at || a.booked_at).getTime();

    const bEffectiveDate = (b.priority_level === 'fair_fifo' && b.first_arrived_at) 
      ? new Date(b.first_arrived_at).getTime() 
      : new Date(b.transferred_at || b.booked_at).getTime();

    return aEffectiveDate - bEffectiveDate;
  });
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
module.exports = async function handler(req, res) {
  handleCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || (req.body && req.body.action) || 'list-queues';
  const tenantSlug = getOrCreateMemoryTenant(req.query.tenant || (req.body && req.body.tenantSlug) || 'default');

  try {
    // ---------------------------------------------------------------
    // 1. بث الأحداث اللحظية عبر Server-Sent Events (SSE)
    // ---------------------------------------------------------------
    if (action === 'events') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', tenant: tenantSlug })}\n\n`);
      MEMORY_DB.sseClients[tenantSlug].push(res);

      req.on('close', () => {
        const idx = MEMORY_DB.sseClients[tenantSlug].indexOf(res);
        if (idx !== -1) MEMORY_DB.sseClients[tenantSlug].splice(idx, 1);
      });
      return;
    }

    // ---------------------------------------------------------------
    // 2. جلب الإعدادات والمسارات والكاونترات الحالية
    // ---------------------------------------------------------------
    if (action === 'get-config') {
      const settings = MEMORY_DB.settings[tenantSlug];
      const queues = MEMORY_DB.queues[tenantSlug].filter(q => q.is_active);
      const counters = MEMORY_DB.counters[tenantSlug];
      const users = MEMORY_DB.users[tenantSlug];
      const counterSessions = MEMORY_DB.counterSessions[tenantSlug] || [];
      const agentBreaks = MEMORY_DB.agentBreaks[tenantSlug] || [];
      const receptionHandovers = MEMORY_DB.receptionHandovers[tenantSlug] || [];
      return res.status(200).json({ ok: true, settings, queues, counters, users, counterSessions, agentBreaks, receptionHandovers });
    }

    // ---------------------------------------------------------------
    // 3. حفظ الإعدادات وتحديث وضع الخدمة (Service Mode)
    // ---------------------------------------------------------------
    if (action === 'save-config') {
      const body = req.body || {};
      if (body.settings) {
        MEMORY_DB.settings[tenantSlug] = Object.assign(MEMORY_DB.settings[tenantSlug], body.settings);
      }
      if (Array.isArray(body.queues)) {
        MEMORY_DB.queues[tenantSlug] = body.queues;
      }
      if (Array.isArray(body.counters)) {
        MEMORY_DB.counters[tenantSlug] = body.counters;
      }
      broadcastSSE(tenantSlug, 'config_updated', { settings: MEMORY_DB.settings[tenantSlug] });
      return res.status(200).json({ ok: true, settings: MEMORY_DB.settings[tenantSlug] });
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
    if (action === 'list-queues') {
      const queues = MEMORY_DB.queues[tenantSlug].filter(q => q.is_active);
      const counters = MEMORY_DB.counters[tenantSlug];
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      const queueStats = queues.map(q => {
        const activeCountersForQueue = counters.filter(c => 
          c.status === 'active' && 
          Array.isArray(c.assigned_queue_ids) && 
          c.assigned_queue_ids.includes(q.id)
        );
        const waitingTickets = tickets.filter(t => 
          t.queue_id === q.id && 
          ['waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch'].includes(t.status)
        );

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
            first_arrived_at: t.first_arrived_at
          }))
        };
      });

      return res.status(200).json({ ok: true, queues: queueStats, settings });
    }

    // ---------------------------------------------------------------
    // 5. حجز تذكرة خالية من الاحتكاك (Zero-Friction Access)
    // ---------------------------------------------------------------
    if (action === 'join-queue') {
      const body = req.body || {};
      const queueIds = Array.isArray(body.queueIds) ? body.queueIds : (body.queueId ? [body.queueId] : []);
      const customerName = (body.customerName || 'عميل مَكَن').trim();
      const customerPhone = (body.customerPhone || '').replace(/\D/g, '');
      const pushSubscription = body.pushSubscription || null;

      if (!queueIds.length) {
        return res.status(400).json({ error: 'الرجاء اختيار مسار أو خدمة واحدة على الأقل للطابور.' });
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
        const waiting = tickets.filter(t => t.queue_id === qid && ['waiting', 'bumped'].includes(t.status));
        const throughput = calculateQueueThroughput(activeCounters, q?.target_service_minutes || 10);
        const etw = calculateETW(waiting.length + 1, throughput, settings.safety_multiplier);
        return { queueId: qid, queue: q, etw, waitingCount: waiting.length };
      });

      queueEstimates.sort((a, b) => a.etw - b.etw);
      const arrivalNow = new Date().toISOString();

      for (let i = 0; i < queueEstimates.length; i++) {
        const est = queueEstimates[i];
        const q = est.queue;
        const prefix = q ? q.prefix : 'A';

        const todayTickets = tickets.filter(t => t.queue_id === est.queueId);
        q.sequence_counter = (q.sequence_counter !== undefined ? q.sequence_counter : todayTickets.length) + 1;
        const seq = q.sequence_counter;
        const ticketNumber = `${prefix}-${seq < 10 ? '0' + seq : seq}`;
        const initialStatus = i === 0 ? 'waiting' : 'sync_watch';

        const newTicket = {
          id: 'tkt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          tenant_slug: tenantSlug,
          queue_id: est.queueId,
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
          notes: i > 0 ? 'مسار متزامن تحت مراقبة التزامن (Sync Watch)' : 'المسار الأساسي النشط'
        };

        tickets.push(newTicket);
        createdTickets.push(newTicket);
      }

      const ticketIds = createdTickets.map(t => t.id);
      createdTickets.forEach(t => {
        t.concurrent_ticket_ids = ticketIds.filter(id => id !== t.id);
      });

      broadcastSSE(tenantSlug, 'ticket_created', { tickets: createdTickets });

      return res.status(200).json({
        ok: true,
        sessionToken,
        tickets: createdTickets,
        message: 'تم حجز دورك بنجاح في نظام الطوابير الذكي.'
      });
    }

    // ---------------------------------------------------------------
    // 6. إصدار تذكرة يدوية عبر موظف الاستقبال (Manual Ticket Issuing)
    // ---------------------------------------------------------------
    if (action === 'manual-ticket') {
      const body = req.body || {};
      const queueId = body.queueId;
      const customerName = (body.customerName || 'مراجع صالة').trim();
      const customerPhone = (body.customerPhone || '').replace(/\D/g, '');
      const notes = body.notes || 'تذكرة يدوية صادرة من الاستقبال';

      const queues = MEMORY_DB.queues[tenantSlug];
      const tickets = MEMORY_DB.tickets[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const settings = MEMORY_DB.settings[tenantSlug];

      const q = queues.find(item => item.id === queueId) || queues[0];
      if (!q) return res.status(404).json({ error: 'القسم غير موجود.' });

      const todayTickets = tickets.filter(t => t.queue_id === q.id);
      q.sequence_counter = (q.sequence_counter !== undefined ? q.sequence_counter : todayTickets.length) + 1;
      const seq = q.sequence_counter;
      const ticketNumber = `${q.prefix}-${seq < 10 ? '0' + seq : seq}`;
      const sessionToken = 'mkn_tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const arrivalNow = new Date().toISOString();

      const activeCounters = counters.filter(c => c.status === 'active' && c.assigned_queue_ids?.includes(q.id));
      const waiting = tickets.filter(t => t.queue_id === q.id && ['waiting', 'bumped'].includes(t.status));
      const throughput = calculateQueueThroughput(activeCounters, q.target_service_minutes || 10);
      const etw = calculateETW(waiting.length + 1, throughput, settings.safety_multiplier);

      const manualTicket = {
        id: 'tkt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        tenant_slug: tenantSlug,
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
        notes: notes
      };

      tickets.push(manualTicket);
      broadcastSSE(tenantSlug, 'ticket_created', { tickets: [manualTicket] });

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
      const counterId = req.body?.counterId;
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
      const eligibleTicketsRaw = tickets.filter(t => 
        assignedQueues.includes(t.queue_id) && 
        ['waiting', 'bumped', 'sync_watch'].includes(t.status)
      );

      // فرز التذاكر وفق مصفوفة الأولوية الهرمية
      const eligibleTickets = sortEligibleTickets(eligibleTicketsRaw);

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
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);

      if (!counter) return res.status(404).json({ error: 'الكاونتر المحدد غير موجود.' });
      if (counter.status === 'on_break') return res.status(400).json({ error: 'الكاونتر في استراحة حالياً.' });

      const tickets = MEMORY_DB.tickets[tenantSlug];
      let ticketToCall = null;

      if (targetTicketId) {
        ticketToCall = tickets.find(t => t.id === targetTicketId);
      } else {
        const eligible = sortEligibleTickets(tickets.filter(t => 
          counter.assigned_queue_ids?.includes(t.queue_id) && 
          ['waiting', 'bumped', 'sync_watch', 'on_hold'].includes(t.status)
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
      const body = req.body || {};
      const ticketId = body.ticketId;
      const toQueueId = body.toQueueId;
      const priorityLevel = body.priorityLevel || 'standard'; // 'immediate_next', 'fair_fifo', 'standard'
      const transferNotes = (body.transferNotes || '').trim();
      const userRole = body.userRole || 'counter_agent'; // 'receptionist', 'admin', 'counter_agent'
      const counterId = body.counterId;

      const tickets = MEMORY_DB.tickets[tenantSlug];
      const queues = MEMORY_DB.queues[tenantSlug];
      const counters = MEMORY_DB.counters[tenantSlug];
      const logs = MEMORY_DB.serviceLogs[tenantSlug];

      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة.' });

      const targetQueue = queues.find(q => q.id === toQueueId);
      if (!targetQueue) return res.status(404).json({ error: 'القسم المستهدف غير موجود.' });

      const currentCounter = counterId ? counters.find(c => c.id === counterId) : null;

      // قيود الصلاحية: موظف الكاونتر محصور فقط بالعميل الحالي الجالس أمامه
      if (userRole === 'counter_agent') {
        if (!currentCounter || currentCounter.current_ticket_id !== ticket.id) {
          return res.status(403).json({ error: 'صلاحيتك مقيدة: يحق لك فقط تحويل العميل الحالي الجالس أمامك.' });
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

      ticket.last_service_name = previousQueue?.name || 'القسم السابق';
      ticket.queue_id = targetQueue.id;
      ticket.queue_name = targetQueue.name;
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

      // إشعار فوري للعميل برحلته الجديدة
      notifyCustomer(
        tenantSlug,
        ticket,
        '🔄 تم توجيهك إلى قسم جديد',
        `✓ تم الانتهاء من: ${ticket.last_service_name} | الوجهة الحالية: ${ticket.queue_name} (رقمك: ${ticket.ticket_number}) - الوقت التقديري: ~${newEtw} دقائق.`
      );

      broadcastSSE(tenantSlug, 'ticket_transferred', {
        ticket,
        previousServiceName: ticket.last_service_name,
        targetServiceName: ticket.queue_name,
        priorityLevel: priorityLevel,
        transferNotes: transferNotes,
        estimatedWaitMinutes: newEtw,
        currentCounter
      });

      return res.status(200).json({
        ok: true,
        ticket,
        message: `تم تحويل التذكرة بنجاح إلى (${targetQueue.name}) بمستوى أولوية [${priorityLevel}].`,
        estimatedWaitMinutes: newEtw
      });
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
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'لا توجد جلسة نشطة لإنهائها.' });
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (!ticket) {
        counter.current_ticket_id = null;
        return res.status(404).json({ error: 'التذكرة غير موجودة.' });
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

        notifyCustomer(
          tenantSlug,
          promotedTicket,
          '🚀 حان موعدك في المسار الثاني!',
          `أهلاً ${promotedTicket.customer_name}، لقد تم نقلك مباشرة إلى رأس طابور (${promotedTicket.queue_name})؛ تفضل بالاستعداد للنداء.`
        );
      }

      broadcastSSE(tenantSlug, 'service_completed', { 
        completedTicket: ticket, 
        counter, 
        promotedTicket,
        metrics: { ewma: counter.ewma_service_seconds, isOutlier, isLongException } 
      });

      return res.status(200).json({ 
        ok: true, 
        completedTicket: ticket, 
        counter, 
        promotedTicket, 
        isOutlier, 
        isLongException 
      });
    }

    // ---------------------------------------------------------------
    // 16. غياب العميل عند النداء (No-Show Snooze 5 Minutes)
    // ---------------------------------------------------------------
    if (action === 'snooze-no-show') {
      const counterId = req.body?.counterId;
      const counter = MEMORY_DB.counters[tenantSlug].find(c => c.id === counterId);
      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'لا توجد تذكرة مستدعاة لمعالجتها كغياب.' });
      }

      const ticket = MEMORY_DB.tickets[tenantSlug].find(t => t.id === counter.current_ticket_id);
      if (ticket) {
        const snoozeMinutes = MEMORY_DB.settings[tenantSlug]?.snooze_minutes || 5;
        ticket.status = 'snoozed';
        ticket.snoozed_until = new Date(Date.now() + (snoozeMinutes * 60 * 1000)).toISOString();
        ticket.notes = `تم تسجيل غياب العميل وتأجيله لمدة ${snoozeMinutes} دقائق، ثم يُلغى آلياً.`;

        counter.current_ticket_id = null;
        counter.current_ticket_number = null;
        counter.current_session_started_at = null;

        notifyCustomer(
          tenantSlug,
          ticket,
          '⏳ تم تأجيل دورك لعدم الحضور',
          `تذكرة ${ticket.ticket_number}: لم يتم الرد عند النداء. أمامك مهلة ${snoozeMinutes} دقائق للمراجعة قبل إلغاء التذكرة تلقائياً.`
        );

        broadcastSSE(tenantSlug, 'ticket_snoozed', { ticket, counter });
        return res.status(200).json({ ok: true, ticket, counter, message: 'تم نقل التذكرة للتأجيل واستدعاء التالي متاح.' });
      }
      return res.status(404).json({ error: 'التذكرة غير موجودة.' });
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
      const incomingUser = users.find(u => u.pin_code === incomingPin && u.is_active);
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
      const incomingUser = users.find(u => u.pin_code === incomingPin && ['receptionist', 'admin'].includes(u.role));

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

    return res.status(400).json({ error: 'إجراء غير معروف.' });
  } catch (error) {
    console.error('[Queue Engine Error]', error);
    return res.status(500).json({ error: error.message || 'خطأ داخلي في محرك الطوابير.' });
  }
};
