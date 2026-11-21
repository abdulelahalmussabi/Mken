'use strict';

/**
 * منصة مكّن (mken.live) — واجهة إنهاء خدمة التذكرة وإصدار الفاتورة الضريبية ZATCA
 * POST /api/v1/pos/complete-service
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const zatcaEngine = require('../_lib/zatca-engine');
const notifyWhatsapp = require('../queue/notify-whatsapp');
const loyaltyEngine = require('./loyalty');

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'طريقة غير مسموح بها. استخدم POST.' });
  }

  const body = req.body || {};
  const tenantSlug = String(body.tenant || body.tenantSlug || 'default').trim().toLowerCase();
  const ticketId = body.ticket_id || body.ticketId;
  const ticketNumber = body.ticket_number || body.ticketNumber;
  const paymentMethod = String(body.payment_method || body.paymentMethod || 'cash').trim().toLowerCase();
  const paymentRef = body.payment_ref || body.paymentRef || null;
  const sellerName = body.seller_name || body.sellerName || 'منشأة مكّن التجارية';
  const vatNumber = body.vat_number || body.vatNumber || '300000000000003';

  if (!ticketId && !ticketNumber) {
    return res.status(400).json({ error: 'يلزم تزويد ticket_id أو ticket_number لإنهاء المعاملة وإصدار الفاتورة.' });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();

  let linkRecord = null;
  let ticketRecord = null;

  // 1. استخراج السجل من قاعدة البيانات إن كانت متاحة
  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      let linkQuery = sb.from('queue_ticket_pos_link').select('*').eq('tenant_slug', tenantSlug);
      if (ticketId) {
        linkQuery = linkQuery.eq('ticket_id', ticketId);
      } else if (ticketNumber) {
        linkQuery = linkQuery.eq('ticket_number', ticketNumber).eq('ticket_date', new Date().toISOString().slice(0, 10));
      }
      const { data: linkData } = await linkQuery.maybeSingle();
      if (linkData) linkRecord = linkData;

      let ticketQuery = sb.from('queue_runtime_tickets').select('*').eq('tenant_slug', tenantSlug);
      if (ticketId) {
        ticketQuery = ticketQuery.eq('id', ticketId);
      } else if (linkRecord && linkRecord.ticket_id) {
        ticketQuery = ticketQuery.eq('id', linkRecord.ticket_id);
      }
      const { data: tData } = await ticketQuery.maybeSingle();
      if (tData) ticketRecord = tData;
    } catch (e) {
      console.warn('[Complete Service DB Fetch Warning]', e.message);
    }
  }

  // 2. معالجة البيانات المالية
  const resolvedTicketId = ticketId || (linkRecord && linkRecord.ticket_id) || `tkt-${ticketNumber}`;
  const resolvedTicketNumber = ticketNumber || (linkRecord && linkRecord.ticket_number) || 'C-001';
  const totalAmount = Math.max(0, parseFloat(body.amount || (linkRecord && linkRecord.total_amount) || (ticketRecord?.payload?.total) || 0));
  const subtotal = Math.round((totalAmount / 1.15) * 100) / 100;
  const taxAmount = Math.round((totalAmount - subtotal) * 100) / 100;

  // 3. توليد رقم مرجعي رسمي للفاتورة ZATCA
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const invoiceRef = body.invoice_ref || `INV-${dateStr}-${resolvedTicketNumber}`;

  // 4. توليد رمز الاستجابة السريعة القياسي لـ ZATCA (TLV QR Base64)
  const nowIso = new Date().toISOString();
  let zatcaQrBase64 = '';
  try {
    zatcaQrBase64 = zatcaEngine.generateZatcaTlvQr(
      sellerName,
      vatNumber,
      nowIso,
      totalAmount,
      taxAmount
    );
  } catch (qrErr) {
    console.warn('[ZATCA QR Generation Warning]', qrErr.message);
  }

  // 5. التنفيذ الذري لحفظ الفاتورة وتحديث الجداول
  let finalizedResult = null;
  if (supabaseUrl && serviceKey && linkRecord) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error } = await sb.rpc('sp_finalize_ticket_payment', {
        p_tenant: tenantSlug,
        p_ticket_id: resolvedTicketId,
        p_payment_method: paymentMethod,
        p_payment_ref: paymentRef,
        p_zatca_qr: zatcaQrBase64,
        p_invoice_ref: invoiceRef,
        p_paid_amount: totalAmount
      });

      if (!error && data) {
        finalizedResult = data;
      }
    } catch (dbErr) {
      console.warn('[ZATCA RPC Error]', dbErr.message);
    }
  }

  if (!finalizedResult) {
    finalizedResult = {
      success: true,
      ticket_id: resolvedTicketId,
      ticket_number: resolvedTicketNumber,
      order_id: linkRecord?.order_id || 'ord-local',
      invoice_ref: invoiceRef,
      paid_amount: totalAmount,
      payment_method: paymentMethod,
      zatca_qr_code: zatcaQrBase64,
      is_local_failover: true
    };
  }

  // 6. معالجة برنامج الولاء ومنح النقاط فور الدفع
  const customerPhone = body.phone || linkRecord?.order_summary?.phone || ticketRecord?.payload?.phone;
  const customerName = body.customer_name || linkRecord?.order_summary?.customer_name || ticketRecord?.payload?.customer_name || '';
  let loyaltyResult = null;

  if (customerPhone) {
    try {
      loyaltyResult = await loyaltyEngine.earnCustomerLoyalty(
        tenantSlug,
        customerPhone,
        customerName,
        totalAmount,
        resolvedTicketId
      );

      // تحديث حقل loyalty_points_earned في جدول الربط إن أمكن
      if (supabaseUrl && serviceKey && linkRecord && loyaltyResult?.points_earned) {
        const sb = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        await sb.from('queue_ticket_pos_link')
          .update({ loyalty_points_earned: loyaltyResult.points_earned })
          .eq('ticket_id', resolvedTicketId);
      }
    } catch (loyaltyErr) {
      console.warn('[Loyalty Earn Warning]', loyaltyErr.message);
    }
  }

  // 7. إرسال إشعار الفاتورة الإلكترونية عبر واتساب إذا توفر جوال العميل
  if (customerPhone) {
    const invoiceUrl = `https://mken.live/invoice-print.html?invoice_ref=${encodeURIComponent(invoiceRef)}&ticket_number=${encodeURIComponent(resolvedTicketNumber)}&total=${totalAmount}`;
    let loyaltyText = '';
    if (loyaltyResult && loyaltyResult.points_earned > 0) {
      loyaltyText = `\n⭐ *نقاط الولاء المكتسبة:* +${loyaltyResult.points_earned} نقطة (رصيدك الحالي: ${loyaltyResult.current_balance} نقطة)`;
    }

    const invoiceMsg = `🧾 *فاتورة ضريبية مبسطة (ZATCA)*\n\n` +
      `شكراً لزيارتكم!\n` +
      `• *رقم الفاتورة:* ${invoiceRef}\n` +
      `• *رقم الطلب:* ${resolvedTicketNumber}\n` +
      `• *المبلغ الإجمالي:* ${totalAmount.toFixed(2)} ر.س (شامل الضريبة 15%)\n` +
      `• *طريقة الدفع:* ${paymentMethod === 'cash' ? 'نقداً (Cash)' : (paymentMethod === 'card' ? 'بطاقة مدى / اائتمان' : paymentMethod)}` +
      loyaltyText + `\n\n` +
      `🔗 *عرض وتحميل الفاتورة الضريبية:*\n${invoiceUrl}`;

    notifyWhatsapp.sendQueueWhatsAppNotification(tenantSlug, customerPhone, 'invoice_sent', {
      ticket_number: resolvedTicketNumber,
      message: invoiceMsg
    }).catch(e => console.warn('[Invoice WhatsApp Dispatch Warning]', e.message));
  }

  // 8. تجهيز بيانات الطباعة الحرارية للفاتورة
  const invoicePrintPayload = {
    seller_name: sellerName,
    vat_number: vatNumber,
    invoice_ref: invoiceRef,
    ticket_number: resolvedTicketNumber,
    items: linkRecord?.order_summary || ticketRecord?.payload?.items || [],
    subtotal: subtotal,
    tax: taxAmount,
    total: totalAmount,
    payment_method: paymentMethod,
    zatca_qr: zatcaQrBase64,
    loyalty: loyaltyResult,
    timestamp: nowIso
  };

  return res.status(200).json({
    ok: true,
    success: true,
    invoice_ref: invoiceRef,
    ticket_id: resolvedTicketId,
    ticket_number: resolvedTicketNumber,
    order_id: finalizedResult.order_id,
    subtotal: subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    zatca_qr_code: zatcaQrBase64,
    loyalty: loyaltyResult,
    print_payload: invoicePrintPayload,
    is_local_failover: !!finalizedResult.is_local_failover
  });
};
