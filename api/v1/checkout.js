'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const gccTaxEngine = require('../_lib/gcc-tax-engine');

/**
 * دالة التحقق وتنسيق رقم الجوال السعودي والخليجي المعتمد
 */
function normalizeGccPhone(raw, country = 'SA') {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-\(\)]/g, '');
  const c = String(country || 'SA').toUpperCase();

  if (c === 'SA') {
    if (p.startsWith('+966')) p = '0' + p.slice(4);
    else if (p.startsWith('00966')) p = '0' + p.slice(5);
    else if (p.startsWith('966')) p = '0' + p.slice(3);

    if (/^05\d{8}$/.test(p)) {
      return p;
    }
    return null;
  }

  // دعم بقية دول الخليج
  if (c === 'AE') {
    if (p.startsWith('+971')) return p;
    if (p.startsWith('00971')) return '+' + p.slice(2);
    if (p.startsWith('05')) return '+971' + p.slice(1);
    if (/^\d{9}$/.test(p)) return '+971' + p;
  } else if (c === 'KW') {
    if (p.startsWith('+965')) return p;
    if (p.startsWith('00965')) return '+' + p.slice(2);
    if (/^\d{8}$/.test(p)) return '+965' + p;
  } else if (c === 'BH') {
    if (p.startsWith('+973')) return p;
    if (p.startsWith('00973')) return '+' + p.slice(2);
    if (/^\d{8}$/.test(p)) return '+973' + p;
  } else if (c === 'QA') {
    if (p.startsWith('+974')) return p;
    if (p.startsWith('00974')) return '+' + p.slice(2);
    if (/^\d{8}$/.test(p)) return '+974' + p;
  } else if (c === 'OM') {
    if (p.startsWith('+968')) return p;
    if (p.startsWith('00968')) return '+' + p.slice(2);
    if (/^\d{8}$/.test(p)) return '+968' + p;
  }

  // التحقق العام من الأرقام الدولية لبقية دول الخليج
  if (/^\+?[0-9]{8,15}$/.test(p)) {
    return p.startsWith('+') ? p : '+' + p;
  }
  return null;
}

/**
 * دالة احتساب ضريبة القيمة المضافة 15% المعتمدة من ZATCA
 */
function calculateZatcaTax(subtotal) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const tax = Math.round(sub * 0.15 * 100) / 100;
  return tax;
}

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  const url = new URL(req.url, 'http://localhost');
  const action = req.query.action || url.searchParams.get('action') || (req.body && req.body.action) || 'create-session';

  // =========================================================================
  // 1. إنشاء جلسة الشراء الآمنة (Create Checkout Session)
  // =========================================================================
  if (action === 'create-session') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const {
      tenantSlug = 'default',
      customerName,
      customerPhone,
      shippingAddress = {},
      items = [],
      shippingCost = 0.00,
      activityId = 'commerce',
      currency = 'SAR',
      customerCountry = 'SA',
      supplierCountry = 'SA',
      isB2B = false,
      customerGccTrn = null
    } = body;

    // فحص إلزامي للمدخلات الأساسية
    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({ error: 'الاسم الكامل مطلوب لإتمام عملية الشراء' });
    }

    const cleanPhone = normalizeGccPhone(customerPhone, customerCountry);
    if (!cleanPhone) {
      return res.status(400).json({ error: 'يرجى إدخال رقم جوال صالح' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'السلة فارغة. يرجى إضافة منتجات قبل المتابعة' });
    }

    const supabaseUrl = sbEnv.getSupabaseUrl();
    const serviceKey = sbEnv.getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) {
      // وضع العمل المحلي الآمن إذا لم تكن متغيرات Supabase متوفرة
      let subtotal = 0;
      const resolvedItems = items.map(function (it) {
        const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
        const price = Math.max(0, parseFloat(it.unitPrice || it.price) || 0);
        subtotal += price * qty;
        return {
          serviceId: it.serviceId || 'srv_default',
          serviceTitle: it.serviceTitle || it.name || 'منتج',
          quantity: qty,
          unitPrice: price,
          lineTotal: price * qty
        };
      });

      const shipping = Math.max(0, Number(shippingCost) || 0);
      const subtotalCalc = gccTaxEngine.calculateGccTransaction({
        amount: subtotal,
        currency: currency,
        supplierCountry: supplierCountry,
        customerCountry: customerCountry,
        isB2B: isB2B,
        customerGccTrn: customerGccTrn
      });

      const totalTaxCalc = gccTaxEngine.calculateGccTransaction({
        amount: subtotal + shipping,
        currency: currency,
        supplierCountry: supplierCountry,
        customerCountry: customerCountry,
        isB2B: isB2B,
        customerGccTrn: customerGccTrn
      });

      const pseudoSessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

      return res.status(200).json({
        success: true,
        sessionId: pseudoSessionId,
        orderId: 'ord_' + pseudoSessionId.slice(5),
        subtotal: subtotalCalc.transaction.subtotal,
        taxAmount: totalTaxCalc.transaction.taxAmount,
        shippingCost: shipping,
        totalAmount: totalTaxCalc.transaction.totalAmount,
        totalMinor: totalTaxCalc.transaction.totalMinor,
        currency: totalTaxCalc.transaction.currency,
        currencySymbol: totalTaxCalc.transaction.symbol,
        decimals: totalTaxCalc.transaction.decimals,
        taxRules: totalTaxCalc.taxRules,
        samaFx: totalTaxCalc.samaFx,
        compliance: totalTaxCalc.compliance,
        totalHalalas: totalTaxCalc.samaFx.sarTotalHalalas,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
      // محاولة استدعاء الدالة الذرية في PostgreSQL إن وجدت
      const { data: rpcData, error: rpcError } = await supabase.rpc('mken_fn_create_checkout_session', {
        p_tenant_slug: tenantSlug,
        p_customer_name: String(customerName).trim(),
        p_customer_phone: cleanPhone,
        p_shipping_address: shippingAddress,
        p_cart_items: items,
        p_shipping_cost: Number(shippingCost) || 0.00,
        p_activity_id: activityId
      });

      if (!rpcError && rpcData && rpcData.success) {
        return res.status(200).json(rpcData);
      }

      // إذا لم تكن الدالة مثبتة في قاعدة البيانات بعد، ننفذ العملية الذرية مباشرة من السيرفر
      let subtotal = 0;
      const resolvedItems = [];

      for (const line of items) {
        const sId = line.serviceId;
        const qty = Math.max(1, parseInt(line.quantity, 10) || 1);

        // فحص المخزون الفعلي من mken_inventory_items
        const { data: invItem } = await supabase
          .from('mken_inventory_items')
          .select('id, name, sell_price, quantity')
          .eq('id', sId)
          .eq('tenant_slug', tenantSlug)
          .maybeSingle();

        let unitPrice = 0;
        let title = line.serviceTitle || line.name || 'منتج';

        if (invItem) {
          if (invItem.quantity < qty) {
            return res.status(400).json({
              error: `عذراً، الكمية المتوفرة من "${invItem.name}" هي ${invItem.quantity} فقط.`
            });
          }
          unitPrice = Number(invItem.sell_price) || 0;
          title = invItem.name;

          // خصم مؤقت للمخزون
          await supabase
            .from('mken_inventory_items')
            .update({
              quantity: invItem.quantity - qty,
              updated_at: new Date().toISOString()
            })
            .eq('id', sId)
            .eq('tenant_slug', tenantSlug);
        } else {
          unitPrice = Math.max(0, parseFloat(line.unitPrice || line.price) || 0);
        }

        subtotal += unitPrice * qty;
        resolvedItems.push({
          serviceId: sId,
          serviceTitle: title,
          name: title,
          quantity: qty,
          unitPrice: unitPrice,
          lineTotal: unitPrice * qty
        });
      }

      const shipping = Math.max(0, Number(shippingCost) || 0);
      const subtotalCalc = gccTaxEngine.calculateGccTransaction({
        amount: subtotal,
        currency: currency,
        supplierCountry: supplierCountry,
        customerCountry: customerCountry,
        isB2B: isB2B,
        customerGccTrn: customerGccTrn
      });

      const totalTaxCalc = gccTaxEngine.calculateGccTransaction({
        amount: subtotal + shipping,
        currency: currency,
        supplierCountry: supplierCountry,
        customerCountry: customerCountry,
        isB2B: isB2B,
        customerGccTrn: customerGccTrn
      });

      const finalSubtotal = subtotalCalc.transaction.subtotal;
      const finalTaxAmount = totalTaxCalc.transaction.taxAmount;
      const finalTotalAmount = totalTaxCalc.transaction.totalAmount;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // إدراج سجل الجلسة
      const { data: sessionRecord, error: sessionErr } = await supabase
        .from('mken_checkout_sessions')
        .insert({
          tenant_slug: tenantSlug,
          customer_name: String(customerName).trim(),
          customer_phone: cleanPhone,
          shipping_address: shippingAddress,
          items: resolvedItems,
          subtotal: finalSubtotal,
          tax_amount: finalTaxAmount,
          shipping_cost: shipping,
          total_amount: finalTotalAmount,
          currency: totalTaxCalc.transaction.currency,
          currency_rate: totalTaxCalc.samaFx.exchangeRate,
          sar_total: totalTaxCalc.samaFx.sarTotalAmount,
          customer_country: customerCountry,
          vat_rate: totalTaxCalc.taxRules.vatRatePct,
          is_reverse_charge: totalTaxCalc.taxRules.isReverseCharge,
          customer_gcc_trn: customerGccTrn,
          tax_exemption_reason: totalTaxCalc.taxRules.taxExemptionReason,
          status: 'pending_payment',
          expires_at: expiresAt
        })
        .select()
        .single();

      const sessionId = sessionRecord ? sessionRecord.id : ('sess_' + Date.now().toString(36));
      const orderId = 'ord_' + sessionId.toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);

      // إدراج السجل في mken_orders
      await supabase
        .from('mken_orders')
        .insert({
          id: orderId,
          tenant_slug: tenantSlug,
          activity_id: activityId,
          activity_title: 'متجر المنتجات',
          items: resolvedItems,
          customer_name: String(customerName).trim(),
          phone: cleanPhone,
          district: shippingAddress.district || '',
          location_address: shippingAddress.address || '',
          notes: shippingAddress.notes || '',
          status: 'pending',
          payment_status: 'unpaid',
          payment_amount: finalTotalAmount,
          subtotal: finalSubtotal,
          tax_amount: finalTaxAmount,
          shipping_cost: shipping,
          total_amount: finalTotalAmount,
          currency: totalTaxCalc.transaction.currency,
          currency_rate: totalTaxCalc.samaFx.exchangeRate,
          sar_total: totalTaxCalc.samaFx.sarTotalAmount,
          customer_country: customerCountry,
          checkout_session_id: sessionRecord ? sessionRecord.id : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      return res.status(200).json({
        success: true,
        sessionId: sessionId,
        orderId: orderId,
        subtotal: finalSubtotal,
        taxAmount: finalTaxAmount,
        shippingCost: shipping,
        totalAmount: finalTotalAmount,
        totalMinor: totalTaxCalc.transaction.totalMinor,
        currency: totalTaxCalc.transaction.currency,
        currencySymbol: totalTaxCalc.transaction.symbol,
        decimals: totalTaxCalc.transaction.decimals,
        taxRules: totalTaxCalc.taxRules,
        samaFx: totalTaxCalc.samaFx,
        compliance: totalTaxCalc.compliance,
        totalHalalas: totalTaxCalc.samaFx.sarTotalHalalas,
        expiresAt: expiresAt
      });

    } catch (err) {
      console.error('[Create Session Error]:', err);
      return res.status(500).json({ error: 'فشل معالجة الطلب على السيرفر: ' + err.message });
    }
  }

  // =========================================================================
  // 2. التحقق من حالة الدفع وجلب الفاتورة (Verify Checkout Status)
  // =========================================================================
  if (action === 'verify') {
    const sessionId = req.query.session_id || url.searchParams.get('session_id') || (req.body && req.body.session_id);
    const orderId = req.query.order_id || url.searchParams.get('order_id') || (req.body && req.body.order_id);

    if (!sessionId && !orderId) {
      return res.status(400).json({ error: 'معرّف الجلسة أو الطلب مطلوب للتحقق' });
    }

    const supabaseUrl = sbEnv.getSupabaseUrl();
    const serviceKey = sbEnv.getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) {
      // وضع المحاكاة عند غياب مفاتيح السيرفر
      return res.status(200).json({
        success: true,
        status: 'paid',
        sessionId: sessionId,
        orderId: orderId || ('ord_' + (sessionId || '').slice(0, 8)),
        subtotal: 100.00,
        taxAmount: 15.00,
        shippingCost: 0.00,
        totalAmount: 115.00,
        currency: 'SAR',
        paymentMethod: 'mada',
        zatcaQr: 'AQZNa2VuAA8zMDAwMDAwMDAwMDAwMDMCFDIwMjYtMTEtMTNUMjA6MDA6MDBaBAYxMTUuMDACBDE1LjAw'
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
      let session = null;
      if (sessionId) {
        const { data } = await supabase
          .from('mken_checkout_sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();
        session = data;
      }

      let order = null;
      if (orderId || (session && session.id)) {
        const query = supabase.from('mken_orders').select('*');
        if (orderId) query.eq('id', orderId);
        else query.eq('checkout_session_id', session.id);
        const { data } = await query.maybeSingle();
        order = data;
      }

      if (!session && !order) {
        return res.status(404).json({ error: 'لم يتم العثور على الجلسة أو الطلب' });
      }

      const isPaid = (session && session.status === 'paid') || (order && order.payment_status === 'paid');
      const resolvedOrderId = (order && order.id) || (session && ('ord_' + session.id.toString().slice(0, 8)));

      return res.status(200).json({
        success: true,
        status: isPaid ? 'paid' : (session ? session.status : 'pending'),
        sessionId: session ? session.id : null,
        orderId: resolvedOrderId,
        subtotal: (session && session.subtotal) || (order && order.subtotal) || 0,
        taxAmount: (session && session.tax_amount) || (order && order.tax_amount) || 0,
        shippingCost: (session && session.shipping_cost) || (order && order.shipping_cost) || 0,
        totalAmount: (session && session.total_amount) || (order && order.total_amount) || 0,
        currency: (session && session.currency) || (order && order.currency) || 'SAR',
        currencyRate: (session && session.currency_rate) || (order && order.currency_rate) || 1.0,
        sarTotal: (session && session.sar_total) || (order && order.sar_total) || null,
        paymentId: (session && session.payment_id) || (order && order.payment_id) || null,
        paymentMethod: (session && session.payment_method) || (order && order.payment_method) || null,
        zatcaQr: (session && session.zatca_qr_code) || (order && order.zatca_qr_code) || null,
        tenantSlug: (session && session.tenant_slug) || (order && order.tenant_slug) || 'default'
      });

    } catch (err) {
      console.error('[Verify Checkout Error]:', err);
      return res.status(500).json({ error: 'خطأ أثناء استعلام حالة الدفع' });
    }
  }

  return res.status(400).json({ error: 'إجراء غير مدعوم' });
};
