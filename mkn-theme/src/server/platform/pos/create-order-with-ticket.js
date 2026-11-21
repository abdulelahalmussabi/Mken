'use strict';

/**
 * منصة مكّن (mken.live) — واجهة إنشاء الطلب وتذكرة الطابور الذرية بنقاط البيع
 * POST /api/v1/pos/create-order-with-ticket
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const queueResolver = require('../_lib/queue-resolver');

// مخزن تشغيلي محلي للطوارئ في حال انقطاع السحابة (Local Failover Cache)
const MEMORY_FALLBACK_STORE = {
  sequences: {}, // tenant_date_queue -> number
  orders: {},
  tickets: {},
  links: {}
};

function getLocalSequence(tenant, branch, queueId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${tenant}_${branch}_${today}_${queueId}`;
  MEMORY_FALLBACK_STORE.sequences[key] = (MEMORY_FALLBACK_STORE.sequences[key] || 0) + 1;
  return MEMORY_FALLBACK_STORE.sequences[key];
}

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'طريقة الطلب غير مسموح بها. استخدم POST' });
  }

  const body = req.body || {};
  const tenantSlug = String(body.tenant || body.tenantSlug || 'default').trim().toLowerCase();
  const branchId = String(body.branch_id || body.branchId || 'default').trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const customerName = String(body.customer_name || body.customerName || 'عميل مكّن').trim();
  const customerPhone = body.phone || body.customer_phone || body.customerPhone || null;
  const serviceType = String(body.service_type || body.serviceType || 'takeaway').trim().toLowerCase();
  const tableNumber = body.table_number || body.tableNumber || null;
  const notes = body.notes ? String(body.notes).trim() : null;
  const orderChannel = String(body.order_channel || body.orderChannel || 'pos').trim().toLowerCase();

  if (!items.length) {
    return res.status(400).json({ error: 'يجب تزويد بنود الطلب (items) لإصدار التذكرة والفاتورة.' });
  }

  // 1. تحديد الطابور وتفاصيل البنود
  const queueId = body.queue_id || body.queueId || queueResolver.resolveQueueId(items, serviceType);
  const queueMeta = queueResolver.getQueueMeta(queueId);

  // احتساب الإجمالي
  let subtotal = 0;
  const cleanItems = items.map(function (it) {
    const qty = Math.max(1, parseInt(it.qty || it.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(it.price || it.sell_price || 0));
    subtotal += (price * qty);
    return {
      name: it.name || it.title || 'صنف',
      qty: qty,
      price: price,
      category: it.category || it.type || ''
    };
  });

  const totalAmount = Math.round(subtotal * 100) / 100;
  const taxAmount = Math.round((totalAmount * 0.15 / 1.15) * 100) / 100;

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();

  let resultData = null;

  // 2. التنفيذ السحابي الذري عبر Stored Procedure عند توفر Supabase
  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error } = await sb.rpc('pos_create_order_and_ticket', {
        p_tenant: tenantSlug,
        p_branch: branchId,
        p_items: cleanItems,
        p_customer_name: customerName,
        p_phone: customerPhone,
        p_service_type: serviceType,
        p_table_number: tableNumber,
        p_queue_id: queueId,
        p_notes: notes,
        p_channel: orderChannel
      });

      if (!error && data) {
        resultData = data;
      } else if (error) {
        console.warn('[POS Queue API] Stored Procedure fallback needed:', error.message);
      }
    } catch (dbErr) {
      console.warn('[POS Queue API] Database execution error:', dbErr.message);
    }
  }

  // 3. نمط العمل المحلي عالي التوافر (High-Availability Failover)
  if (!resultData) {
    const seq = getLocalSequence(tenantSlug, branchId, queueId);
    const ticketNumber = queueResolver.formatTicketNumber(queueId, seq);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketId = `${tenantSlug}-${branchId}-${todayStr}-${ticketNumber}`;
    const orderId = 'ord-' + Math.random().toString(36).substring(2, 10);
    const linkId = 'lnk-' + Math.random().toString(36).substring(2, 10);
    const sessionToken = 'tok-' + Math.random().toString(36).substring(2, 15);

    resultData = {
      success: true,
      ticket_number: ticketNumber,
      ticket_id: ticketId,
      order_id: orderId,
      link_id: linkId,
      queue_id: queueId,
      total: totalAmount,
      order_summary: cleanItems,
      session_token: sessionToken,
      is_local_failover: true
    };

    // حفظ في ذاكرة الطوارئ
    MEMORY_FALLBACK_STORE.tickets[ticketId] = resultData;
    MEMORY_FALLBACK_STORE.orders[orderId] = resultData;
    MEMORY_FALLBACK_STORE.links[linkId] = resultData;
  }

  // 4. احتساب زمن الانتظار المتوقع (ETA)
  let queueDepth = 0;
  let avgSec = queueMeta.targetMinutes * 60;

  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { count } = await sb
        .from('queue_runtime_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_slug', tenantSlug)
        .eq('queue_id', queueId)
        .in('status', ['waiting', 'bumped']);
      
      if (typeof count === 'number') {
        queueDepth = count;
      }
    } catch (e) {
      // ignore
    }
  }

  const etaMinutes = queueResolver.computeETA(queueDepth, avgSec, 1);

  // 4.5 إرسال إشعار واتساب الترحيبي عند توفر رقم الجوال
  if (customerPhone) {
    try {
      const notifyWhatsapp = require('../queue/notify-whatsapp');
      const itemsSummaryText = cleanItems.map(function (it) {
        return `• ${it.name} × ${it.qty} (${(it.price * it.qty).toFixed(2)} ر.س)`;
      }).join('\n');

      notifyWhatsapp.sendQueueWhatsAppNotification(tenantSlug, customerPhone, 'ticket_issued', {
        ticket_number: resultData.ticket_number,
        queue_name: queueMeta.nameAr,
        customer_name: customerName,
        total: totalAmount,
        eta_minutes: etaMinutes,
        items_summary: itemsSummaryText,
        session_url: `https://mken.live/q/${resultData.ticket_number}?t=${resultData.session_token}`
      }).catch(function (err) {
        console.warn('[Queue Ticket WhatsApp Warning]', err.message);
      });
    } catch (notifyErr) {
      console.warn('[Queue Ticket WhatsApp Module Error]', notifyErr.message);
    }
  }

  // 5. تجهيز حمولة الطباعة الحرارية الجاهزة (Print Payload)
  const printPayload = {
    branch_name: branchId === 'default' ? 'الفرع الرئيسي' : branchId,
    ticket_number: resultData.ticket_number,
    queue_name: queueMeta.nameAr,
    customer_name: customerName,
    items: cleanItems,
    total: totalAmount,
    tax: taxAmount,
    eta_minutes: etaMinutes,
    table_number: tableNumber,
    service_type: serviceType,
    order_id: resultData.order_id,
    session_token: resultData.session_token,
    timestamp: new Date().toISOString()
  };

  return res.status(201).json({
    ok: true,
    ticket_number: resultData.ticket_number,
    ticket_id: resultData.ticket_id,
    order_id: resultData.order_id,
    link_id: resultData.link_id,
    queue_id: queueId,
    queue_meta: queueMeta,
    total: totalAmount,
    tax: taxAmount,
    order_summary: cleanItems,
    eta_minutes: etaMinutes,
    table_number: tableNumber,
    service_type: serviceType,
    session_token: resultData.session_token,
    print_payload: printPayload,
    is_local_failover: !!resultData.is_local_failover
  });
};
