'use strict';

/**
 * منصة مكّن (mken.live) — موديول إدارة المشتريات وتكاليف الإنزال (Procurement & Inbound Supply)
 * دورة متكاملة: موردين -> أوامر شراء PO -> استلام GRN -> تكاليف إنزال Landed Costs -> تحديث متوسط التكلفة MAC
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../../api/_lib/supabase-env');
const { handleCors } = require('../../api/_lib/cors');
const erpEngine = require('../../api/_lib/erp-inventory-engine');

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  const url = new URL(req.url, 'http://localhost');
  const action = req.query.action || url.searchParams.get('action') || (req.body && req.body.action) || 'list-pos';
  const tenantSlug = req.query.tenant_slug || (req.body && req.body.tenant_slug) || 'default';

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();
  const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    // =========================================================================
    // 1. استعراض أو إضافة الموردين (Suppliers Management)
    // =========================================================================
    if (action === 'list-suppliers') {
      if (!supabase) return res.status(200).json({ success: true, suppliers: [] });
      const { data, error } = await supabase
        .from('mken_suppliers')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, suppliers: data || [] });
    }

    if (action === 'create-supplier') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const { name, vatNumber, crNumber, contactName, phone, email, address, paymentTerms } = req.body || {};

      if (!name) {
        return res.status(400).json({ success: false, error: 'اسم المورد حقل إلزامي.' });
      }

      // التحقق من صحة الرقم الضريبي لزاتكا إن وُجد (15 رقم يبدأ بـ 3 وينتهي بـ 3)
      if (vatNumber && !/^3\d{13}3$/.test(String(vatNumber).trim())) {
        return res.status(400).json({ success: false, error: 'الرقم الضريبي للمورد يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3 وفق اشتراطات هيئة الزكاة والضريبة والجمارك.' });
      }

      if (!supabase) {
        return res.status(201).json({ success: true, message: 'Supplier created (mock)' });
      }

      const { data, error } = await supabase
        .from('mken_suppliers')
        .insert({
          tenant_slug: tenantSlug,
          name: name.trim(),
          vat_number: vatNumber ? String(vatNumber).trim() : null,
          cr_number: crNumber ? String(crNumber).trim() : null,
          contact_name: contactName,
          phone,
          email,
          address,
          payment_terms: paymentTerms || 'net_30'
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, supplier: data });
    }

    // =========================================================================
    // 2. إنشاء واستعراض أوامر الشراء (Purchase Orders Lifecycle)
    // =========================================================================
    if (action === 'list-pos') {
      if (!supabase) return res.status(200).json({ success: true, purchaseOrders: [] });

      const { data, error } = await supabase
        .from('mken_purchase_orders')
        .select(`
          *,
          supplier:mken_suppliers(name, vat_number, phone),
          items:mken_purchase_order_items(*)
        `)
        .eq('tenant_slug', tenantSlug)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, purchaseOrders: data || [] });
    }

    if (action === 'create-po') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const { supplierId, items, notes, expectedDelivery } = req.body || {};

      if (!supplierId || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'يجب تحديد المورد وبنود الشراء.' });
      }

      const poNumber = 'PO-' + Date.now().toString(36).toUpperCase();
      let subtotal = 0;
      let taxAmount = 0;

      const formattedItems = items.map(it => {
        const qty = Math.max(1, parseInt(it.orderedQty || it.quantity, 10) || 1);
        const unitPrice = Math.max(0, parseFloat(it.unitPurchasePrice || it.unitPrice) || 0);
        const lineTotal = Math.round(qty * unitPrice * 100) / 100;
        const lineTax = Math.round(lineTotal * 0.15 * 100) / 100;

        subtotal += lineTotal;
        taxAmount += lineTax;

        return {
          itemId: it.itemId || it.id,
          orderedQty: qty,
          unitPurchasePrice: unitPrice,
          taxRate: 15.00,
          lineTotal
        };
      });

      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      if (!supabase) {
        return res.status(201).json({
          success: true,
          poNumber,
          subtotal,
          taxAmount,
          totalAmount
        });
      }

      // إدراج أمر الشراء الرئيسي
      const { data: po, error: poErr } = await supabase
        .from('mken_purchase_orders')
        .insert({
          tenant_slug: tenantSlug,
          po_number: poNumber,
          supplier_id: supplierId,
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'SAR',
          notes,
          expected_delivery: expectedDelivery
        })
        .select()
        .single();

      if (poErr) throw poErr;

      // إدراج البنود
      const itemsToInsert = formattedItems.map(it => ({
        tenant_slug: tenantSlug,
        purchase_order_id: po.id,
        item_id: it.itemId,
        ordered_qty: it.orderedQty,
        unit_purchase_price: it.unitPurchasePrice,
        tax_rate: 15.00,
        line_total: it.lineTotal
      }));

      const { error: itemsErr } = await supabase
        .from('mken_purchase_order_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      return res.status(201).json({
        success: true,
        purchaseOrder: po,
        itemsCount: itemsToInsert.length
      });
    }

    // =========================================================================
    // 3. استلام البضائع في المستودع وتطبيق تكاليف الإنزال (GRN & Landed Costs)
    // =========================================================================
    if (action === 'receive-goods') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      const { purchaseOrderId, receiverName, receivedItems, landedCosts = [] } = req.body || {};

      if (!purchaseOrderId || !Array.isArray(receivedItems) || receivedItems.length === 0) {
        return res.status(400).json({ success: false, error: 'بيانات استلام الشحنة غير مكتملة.' });
      }

      const grnNumber = 'GRN-' + Date.now().toString(36).toUpperCase();

      if (!supabase) {
        return res.status(200).json({
          success: true,
          grnNumber,
          message: 'Goods received successfully (mock)'
        });
      }

      // إنشاء إشعار الاستلام GRN
      const { data: grn, error: grnErr } = await supabase
        .from('mken_goods_receipt_notes')
        .insert({
          tenant_slug: tenantSlug,
          grn_number: grnNumber,
          purchase_order_id: purchaseOrderId,
          receiver_name: receiverName || 'أمين المستودع',
          status: 'completed'
        })
        .select()
        .single();

      if (grnErr) throw grnErr;

      // إدراج بنود الاستلام
      const grnItemsToInsert = receivedItems.map(it => ({
        tenant_slug: tenantSlug,
        grn_id: grn.id,
        po_item_id: it.poItemId,
        item_id: it.itemId,
        received_qty: Math.max(1, parseInt(it.receivedQty, 10) || 1)
      }));

      const { error: griErr } = await supabase
        .from('mken_goods_receipt_items')
        .insert(grnItemsToInsert);

      if (griErr) throw griErr;

      // إدراج تكاليف الإنزال الملحقة إن وجدت (شحن، تخليص جمركي، رسوم ميناء)
      if (Array.isArray(landedCosts) && landedCosts.length > 0) {
        const landedToInsert = landedCosts.map(lc => ({
          tenant_slug: tenantSlug,
          grn_id: grn.id,
          cost_type: lc.costType || 'freight',
          amount: Math.max(0, parseFloat(lc.amount) || 0),
          currency: 'SAR',
          allocation_method: lc.allocationMethod || 'by_value',
          notes: lc.notes
        }));

        await supabase.from('mken_landed_costs').insert(landedToInsert);
      }

      // تشغيل الإجراء المخزن لحساب التكلفة المرجحة وتحديث المخزون
      const { data: processResult, error: procErr } = await supabase.rpc('mken_fn_process_goods_receipt', {
        p_tenant_slug: tenantSlug,
        p_grn_id: grn.id
      });

      if (procErr) throw procErr;

      return res.status(200).json({
        success: true,
        grnNumber,
        grnId: grn.id,
        processResult
      });
    }

    // =========================================================================
    // 4. استعراض حالة المخزون الشاملة (Inventory Multi-Tier View)
    // =========================================================================
    if (action === 'list-inventory') {
      if (!supabase) return res.status(200).json({ success: true, items: [] });

      const { data, error } = await supabase
        .from('mken_inventory_items')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .order('name');

      if (error) throw error;

      const itemsWithAtp = (data || []).map(item => {
        const atp = Math.max(0, item.physical_qty - (item.reserved_qty + item.allocated_qty));
        return {
          ...item,
          atp_qty: atp,
          is_low_stock: atp <= item.reorder_point,
          total_cost_valuation: Math.round(item.physical_qty * item.moving_average_cost * 100) / 100,
          potential_sales_valuation: Math.round(item.physical_qty * item.sell_price * 100) / 100
        };
      });

      return res.status(200).json({
        success: true,
        items: itemsWithAtp
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Procurement API error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};
