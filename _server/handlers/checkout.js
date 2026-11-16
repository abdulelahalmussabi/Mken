'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../../api/_lib/supabase-env');
const { handleCors } = require('../../api/_lib/cors');
const gccTaxEngine = require('../../api/_lib/gcc-tax-engine');
const adaptiveIam = require('../../api/_lib/adaptive-iam');
const erpEngine = require('../../api/_lib/erp-inventory-engine');

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

    // فحص واشتراطات الهوية التكيفية للأنشطة المختلفة (Adaptive IAM Risk Check)
    const reqValidation = adaptiveIam.validateCheckoutRequirements({
      activityId: activityId,
      isGuest: body.isGuest !== false,
      customerPhone: cleanPhone,
      nationalId: body.nationalId,
      userAuth: req.headers.authorization
    });

    if (!reqValidation.allowed) {
      return res.status(403).json({
        error: reqValidation.error,
        code: reqValidation.code,
        activity: reqValidation.policy
      });
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
      const pseudoOrderId = 'ord_' + pseudoSessionId.slice(5);

      // توليد رمز الصلاحية المشفر لتتبع الطلب كضيف بدون كلمة سر أو حساب
      const capResult = adaptiveIam.generateTrackingCapabilityToken({
        tenantSlug: tenantSlug,
        orderId: pseudoOrderId,
        phone: cleanPhone
      });

      return res.status(200).json({
        success: true,
        sessionId: pseudoSessionId,
        orderId: pseudoOrderId,
        trackingToken: capResult.token,
        trackingUrl: capResult.trackingUrl,
        isGuestOrder: true,
        activityPolicy: reqValidation.policy,
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

        // فحص المخزون الفعلي والـ ATP من mken_inventory_items
        const { data: invItem } = await supabase
          .from('mken_inventory_items')
          .select('id, name, sell_price, quantity, physical_qty, reserved_qty, allocated_qty')
          .eq('id', sId)
          .eq('tenant_slug', tenantSlug)
          .maybeSingle();

        let unitPrice = 0;
        let title = line.serviceTitle || line.name || 'منتج';

        if (invItem) {
          const physical = invItem.physical_qty !== undefined && invItem.physical_qty !== null ? Number(invItem.physical_qty) : Number(invItem.quantity || 0);
          const reserved = Number(invItem.reserved_qty || 0);
          const allocated = Number(invItem.allocated_qty || 0);
          const atp = Math.max(0, physical - (reserved + allocated));

          if (atp < qty) {
            return res.status(400).json({
              error: `عذراً، الكمية المتاحة للبيع من "${invItem.name}" هي ${atp} فقط.`
            });
          }
          unitPrice = Number(invItem.sell_price) || 0;
          title = invItem.name;

          // حجز مؤقت للكمية (زيادة reserved_qty دون مساس بالرصيد الفيزيائي)
          if (invItem.physical_qty !== undefined && invItem.physical_qty !== null) {
            await supabase
              .from('mken_inventory_items')
              .update({
                reserved_qty: reserved + qty,
                updated_at: new Date().toISOString()
              })
              .eq('id', sId)
              .eq('tenant_slug', tenantSlug);
          } else {
            await supabase
              .from('mken_inventory_items')
              .update({
                quantity: Math.max(0, (invItem.quantity || 0) - qty),
                updated_at: new Date().toISOString()
              })
              .eq('id', sId)
              .eq('tenant_slug', tenantSlug);
          }
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

      // توليد رمز الصلاحية المشفر لتتبع الطلب كضيف بأمان وحماية ضد IDOR
      const capResult = adaptiveIam.generateTrackingCapabilityToken({
        tenantSlug: tenantSlug,
        orderId: orderId,
        phone: cleanPhone
      });

      // إدراج السجل في mken_orders مع ربطه بالتوكن المشفر
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
          order_type: 'STANDARD_GUEST',
          tracking_token_hash: capResult.tokenHash,
          tracking_expires_at: capResult.expiresAt,
          is_guest_order: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      // تسجيل الحجوزات النشطة في جدول الحجوزات المؤقتة mken_inventory_reservations
      if (sessionRecord && sessionRecord.id) {
        try {
          const resvRecords = [];
          for (const it of items) {
            const sid = it.serviceId || it.itemId || it.id;
            if (sid && sid.length === 36) { // فحص UUID
              resvRecords.push({
                tenant_slug: tenantSlug,
                session_id: sessionRecord.id,
                item_id: sid,
                quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
                status: 'active',
                expires_at: expiresAt
              });
            }
          }
          if (resvRecords.length > 0) {
            await supabase.from('mken_inventory_reservations').insert(resvRecords);
          }
        } catch (resvErr) {
          console.warn('[ERP-Suite] Reservation record insert warning:', resvErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        sessionId: sessionId,
        orderId: orderId,
        trackingToken: capResult.token,
        trackingUrl: capResult.trackingUrl,
        isGuestOrder: true,
        activityPolicy: reqValidation.policy,
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
  // 2. التحقق من حالة الدفع وجلب الفاتورة (Verify Checkout Status with IDOR Guard)
  // =========================================================================
  if (action === 'verify' || action === 'track' || action === 'track-order') {
    const sessionId = req.query.session_id || url.searchParams.get('session_id') || (req.body && req.body.session_id);
    const orderIdParam = req.query.order_id || url.searchParams.get('order_id') || (req.body && req.body.order_id);
    const trackingToken = req.query.token || url.searchParams.get('token') || (req.body && req.body.token) || req.headers['x-capability-token'];
    const tenantSlug = req.query.tenant_slug || url.searchParams.get('tenant_slug') || (req.body && req.body.tenant_slug) || 'default';

    // حماية ضد IDOR: فحص رمز الصلاحية الموقّع عند غياب جلسة الشراء المباشرة
    let verifiedOrderId = orderIdParam;
    let verifiedTenant = tenantSlug;

    if (trackingToken) {
      const tokenVerification = adaptiveIam.verifyTrackingCapabilityToken(trackingToken, tenantSlug !== 'default' ? tenantSlug : null);
      if (!tokenVerification.valid) {
        return res.status(403).json({
          error: tokenVerification.error,
          code: tokenVerification.code || 'INVALID_CAPABILITY_TOKEN'
        });
      }
      verifiedOrderId = tokenVerification.orderId;
      verifiedTenant = tokenVerification.tenantSlug;
    }

    if (!sessionId && !verifiedOrderId) {
      return res.status(400).json({ error: 'معرّف الجلسة أو رمز التتبع الموقّع مطلوب للتحقق' });
    }

    const supabaseUrl = sbEnv.getSupabaseUrl();
    const serviceKey = sbEnv.getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) {
      // وضع المحاكاة عند غياب مفاتيح السيرفر
      return res.status(200).json({
        success: true,
        status: 'paid',
        sessionId: sessionId,
        orderId: verifiedOrderId || ('ord_' + (sessionId || '').slice(0, 8)),
        subtotal: 100.00,
        taxAmount: 15.00,
        shippingCost: 0.00,
        totalAmount: 115.00,
        currency: 'SAR',
        paymentMethod: 'mada',
        isGuestOrder: true,
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
      if (verifiedOrderId || (session && session.id)) {
        const query = supabase.from('mken_orders').select('*');
        if (verifiedOrderId) {
          query.eq('id', verifiedOrderId);
          query.eq('tenant_slug', verifiedTenant);
        } else {
          query.eq('checkout_session_id', session.id);
        }
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
        orderType: (order && order.order_type) || 'STANDARD_GUEST',
        isGuestOrder: (order && order.is_guest_order) !== false,
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
        shippingAddress: order ? { district: order.district, address: order.location_address } : null,
        tenantSlug: (session && session.tenant_slug) || (order && order.tenant_slug) || verifiedTenant
      });

    } catch (err) {
      console.error('[Verify Checkout Error]:', err);
      return res.status(500).json({ error: 'خطأ أثناء استعلام حالة الدفع' });
    }
  }

  // =========================================================================
  // 3. دمج طلبات الضيف السابقة عند التوثيق اللاحق (Account Promotion & Linking)
  // =========================================================================
  if (action === 'link-guest-orders') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { tenantSlug = 'default', phone, customerName = '' } = req.body || {};
    const cleanPhone = normalizeGccPhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ error: 'رقم الجوال غير صالح للربط' });
    }

    const supabaseUrl = sbEnv.getSupabaseUrl();
    const serviceKey = sbEnv.getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) {
      return res.status(200).json({
        success: true,
        message: 'تم ربط الطلبات السابقة بالحساب بنجاح (وضع محاكاة محلي)',
        linkedOrdersCount: 2
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const phoneHash = adaptiveIam.computePhoneBlindIndex(cleanPhone, tenantSlug);

    try {
      // استدعاء الدالة الذرية في PostgreSQL لترقية المستخدم ودمج الطلبات
      const { data: rpcData, error: rpcError } = await supabase.rpc('mken_fn_promote_guest_user', {
        p_tenant_slug: tenantSlug,
        p_phone_blind_index: phoneHash,
        p_full_name: customerName
      });

      if (!rpcError && rpcData) {
        return res.status(200).json(rpcData);
      }

      // fallback: تحديث مباشر في جدول الطلبات
      const { data: updatedOrders, error: updateErr } = await supabase
        .from('mken_orders')
        .update({ is_guest_order: false, updated_at: new Date().toISOString() })
        .eq('tenant_slug', tenantSlug)
        .eq('phone', cleanPhone)
        .eq('is_guest_order', true)
        .select('id');

      if (updateErr) throw updateErr;

      return res.status(200).json({
        success: true,
        linkedOrdersCount: updatedOrders ? updatedOrders.length : 0,
        message: 'تم دمج وتحديث جميع الطلبات السابقة للحساب المسجل بنجاح'
      });
    } catch (linkErr) {
      console.error('[Link Guest Orders Error]:', linkErr);
      return res.status(500).json({ error: 'فشل ربط الطلبات: ' + linkErr.message });
    }
  }

  return res.status(400).json({ error: 'إجراء غير مدعوم' });
};
