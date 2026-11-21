'use strict';

/**
 * منصة مكّن (mken.live) — واجهة استعلام تفاصيل التذكرة والطلب المرتبط
 * GET/POST /api/v1/pos/get-ticket-details
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const queueResolver = require('../_lib/queue-resolver');

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  const query = req.query || {};
  const body = req.body || {};

  const tenantSlug = String(query.tenant || body.tenant || query.tenantSlug || body.tenantSlug || 'default').trim().toLowerCase();
  const ticketId = query.ticket_id || body.ticket_id || null;
  const ticketNumber = query.ticket_number || body.ticket_number || null;
  const ticketDate = query.ticket_date || body.ticket_date || new Date().toISOString().slice(0, 10);
  const orderId = query.order_id || body.order_id || null;
  const sessionToken = query.session_token || body.session_token || query.token || body.token || null;

  if (!ticketId && !ticketNumber && !orderId && !sessionToken) {
    return res.status(400).json({ error: 'يلزم تزويد ticket_id أو ticket_number أو order_id أو session_token' });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();

  let linkRecord = null;
  let ticketRecord = null;
  let aheadCount = 0;

  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // 1. استعلام سجل الربط (queue_ticket_pos_link)
      let linkQuery = sb.from('queue_ticket_pos_link').select('*').eq('tenant_slug', tenantSlug);

      if (ticketId) {
        linkQuery = linkQuery.eq('ticket_id', ticketId);
      } else if (orderId) {
        linkQuery = linkQuery.eq('order_id', orderId);
      } else if (ticketNumber) {
        linkQuery = linkQuery.eq('ticket_number', ticketNumber).eq('ticket_date', ticketDate);
      }

      const { data: linkData } = await linkQuery.maybeSingle();
      if (linkData) linkRecord = linkData;

      // 2. استعلام التذكرة الحية من queue_runtime_tickets
      let tQuery = sb.from('queue_runtime_tickets').select('*').eq('tenant_slug', tenantSlug);

      if (ticketId) {
        tQuery = tQuery.eq('id', ticketId);
      } else if (sessionToken) {
        tQuery = tQuery.eq('session_token', sessionToken);
      } else if (ticketNumber) {
        tQuery = tQuery.eq('ticket_number', ticketNumber).eq('ticket_date', ticketDate);
      } else if (linkRecord && linkRecord.ticket_id) {
        tQuery = tQuery.eq('id', linkRecord.ticket_id);
      }

      const { data: tData } = await tQuery.maybeSingle();
      if (tData) {
        ticketRecord = tData;

        // حساب عدد المنتظرين قبل هذه التذكرة (ahead count)
        if (tData.status === 'waiting') {
          const { count } = await sb
            .from('queue_runtime_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_slug', tenantSlug)
            .eq('queue_id', tData.queue_id)
            .eq('status', 'waiting')
            .lt('first_arrived_at', tData.first_arrived_at);

          aheadCount = count || 0;
        }
      }
    } catch (err) {
      console.warn('[Get Ticket Details] DB error:', err.message);
    }
  }

  // إذا لم نجد سجلاً بقاعدة البيانات
  if (!linkRecord && !ticketRecord) {
    // محاكاة استرجاع من الذاكرة أو إرجاع استجابة فارغة
    return res.status(404).json({
      ok: false,
      error: 'لم يتم العثور على التذكرة المطلوبة.'
    });
  }

  const payload = (ticketRecord && ticketRecord.payload) || {};
  const queueId = (ticketRecord && ticketRecord.queue_id) || (linkRecord && linkRecord.queue_id) || 'C';
  const queueMeta = queueResolver.getQueueMeta(queueId);
  const etaMinutes = queueResolver.computeETA(aheadCount, queueMeta.targetMinutes * 60, 1);

  return res.status(200).json({
    ok: true,
    ticket_id: (ticketRecord && ticketRecord.id) || (linkRecord && linkRecord.ticket_id),
    ticket_number: (ticketRecord && ticketRecord.ticket_number) || (linkRecord && linkRecord.ticket_number),
    ticket_date: (ticketRecord && ticketRecord.ticket_date) || (linkRecord && linkRecord.ticket_date),
    queue_id: queueId,
    queue_meta: queueMeta,
    ticket_status: (ticketRecord && ticketRecord.status) || 'unknown',
    link_status: (linkRecord && linkRecord.link_status) || 'active',
    customer_name: payload.customer_name || 'عميل مكّن',
    phone: payload.phone || null,
    total_amount: (linkRecord && linkRecord.total_amount) || payload.total || 0,
    order_summary: (linkRecord && linkRecord.order_summary) || payload.items || [],
    service_type: payload.service_type || 'takeaway',
    table_number: payload.table_number || null,
    ahead_count: aheadCount,
    eta_minutes: etaMinutes,
    session_token: (ticketRecord && ticketRecord.session_token) || payload.session_token || null,
    called_at: linkRecord && linkRecord.called_at,
    service_started_at: linkRecord && linkRecord.service_started_at,
    service_ended_at: linkRecord && linkRecord.service_ended_at,
    zatca_qr_code: linkRecord && linkRecord.zatca_qr_code,
    invoice_ref: linkRecord && linkRecord.invoice_ref
  });
};
