'use strict';

/**
 * منصة مكّن (mken.live) — محرك المخزون الذري والمبيعات والمشتريات (ERP-Inventory Engine)
 * متوافق مع: ZATCA Fatoora Phase 2, SAMA Payments, MoC E-Commerce Rules
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');

function getSupabaseAdmin() {
  const url = sbEnv.getSupabaseUrl();
  const key = sbEnv.getSupabaseServiceKey();
  if (!url || !key) {
    throw new Error('Supabase admin credentials missing in environment.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/**
 * خوارزمية احتساب متوسط التكلفة المتحرك المرجح (Moving Average Cost)
 * MAC_new = ((Current_Physical * Current_MAC) + (Received_Qty * Received_Unit_Cost)) / (Current_Physical + Received_Qty)
 */
function calculateMovingAverageCost(currentPhysical, currentMac, receivedQty, receivedUnitCost) {
  const curQty = Math.max(0, Number(currentPhysical) || 0);
  const curCost = Math.max(0, Number(currentMac) || 0);
  const recQty = Math.max(0, Number(receivedQty) || 0);
  const recCost = Math.max(0, Number(receivedUnitCost) || 0);

  const totalQty = curQty + recQty;
  if (totalQty <= 0) return 0;

  const totalValue = (curQty * curCost) + (recQty * recCost);
  const newMac = totalValue / totalQty;
  return Math.round(newMac * 10000) / 10000;
}

/**
 * خوارزمية توزيع تكاليف الإنزال (Landed Costs Allocation)
 * توزع تكاليف الشحن والجمارك على الأصناف حسب القيمة أو الكمية
 */
function allocateLandedCosts(items, totalLandedCost, method = 'by_value') {
  const landed = Math.max(0, Number(totalLandedCost) || 0);
  if (!Array.isArray(items) || items.length === 0 || landed <= 0) {
    return items.map(item => ({ ...item, landedCostShare: 0, effectiveUnitCost: item.unitPurchasePrice }));
  }

  let totalBasis = 0;
  if (method === 'by_quantity') {
    totalBasis = items.reduce((acc, it) => acc + (Number(it.receivedQty) || 0), 0);
  } else {
    // الافتراضي: التوزيع حسب القيمة الإجمالية للبند
    totalBasis = items.reduce((acc, it) => acc + ((Number(it.receivedQty) || 0) * (Number(it.unitPurchasePrice) || 0)), 0);
  }

  if (totalBasis <= 0) {
    return items.map(item => ({ ...item, landedCostShare: 0, effectiveUnitCost: item.unitPurchasePrice }));
  }

  return items.map(item => {
    const qty = Number(item.receivedQty) || 0;
    const price = Number(item.unitPurchasePrice) || 0;
    const basis = method === 'by_quantity' ? qty : (qty * price);
    const itemShare = (basis / totalBasis) * landed;
    const perUnitShare = qty > 0 ? (itemShare / qty) : 0;
    const effectiveCost = price + perUnitShare;

    return {
      ...item,
      landedCostShare: Math.round(itemShare * 100) / 100,
      unitLandedShare: Math.round(perUnitShare * 10000) / 10000,
      effectiveUnitCost: Math.round(effectiveCost * 10000) / 10000
    };
  });
}

/**
 * 1. حجز المخزون الذري لسلة الشراء (Atomic Reservation with TTL)
 * يستدعي دالة قاعدة البيانات المخزنة mken_fn_reserve_cart_inventory
 */
async function reserveInventory(tenantSlug, sessionId, cartItems, ttlMinutes = 10, supabaseClient = null) {
  const sb = supabaseClient || getSupabaseAdmin();
  const slug = tenantSlug || 'default';

  if (!sessionId) {
    throw new Error('sessionId is required for reservation.');
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('cartItems must be a non-empty array.');
  }

  // تهيئة البنود بالمعرفات والكميات
  const formattedItems = cartItems.map(item => ({
    itemId: item.itemId || item.id || item.serviceId,
    quantity: Math.max(1, parseInt(item.quantity, 10) || 1)
  }));

  const { data, error } = await sb.rpc('mken_fn_reserve_cart_inventory', {
    p_tenant_slug: slug,
    p_session_id: sessionId,
    p_cart_items: formattedItems,
    p_ttl_minutes: ttlMinutes
  });

  if (error) {
    throw new Error(`Inventory reservation RPC failed: ${error.message}`);
  }

  return data;
}

/**
 * 2. تثبيت الحجز وخصم الرصيد بعد تأكيد الدفع من SAMA (Commit Reservation)
 * يستدعي دالة قاعدة البيانات المخزنة mken_fn_commit_cart_reservation
 */
async function commitReservation(tenantSlug, sessionId, orderId, supabaseClient = null) {
  const sb = supabaseClient || getSupabaseAdmin();
  const slug = tenantSlug || 'default';

  if (!sessionId || !orderId) {
    throw new Error('sessionId and orderId are required to commit reservation.');
  }

  const { data, error } = await sb.rpc('mken_fn_commit_cart_reservation', {
    p_tenant_slug: slug,
    p_session_id: sessionId,
    p_order_id: String(orderId)
  });

  if (error) {
    throw new Error(`Inventory commit RPC failed: ${error.message}`);
  }

  return data;
}

/**
 * 3. إلغاء حجز السلة يدوياً أو عند فشل الدفع (Cancel Reservation)
 */
async function cancelReservation(sessionId, supabaseClient = null) {
  const sb = supabaseClient || getSupabaseAdmin();
  if (!sessionId) return false;

  const { data, error } = await sb.rpc('mken_fn_cancel_cart_reservation', {
    p_session_id: sessionId
  });

  if (error) {
    console.error('Cancel reservation RPC error:', error.message);
    return false;
  }

  return Boolean(data);
}

/**
 * 4. تنظيف آلي لجميع الحجوزات المنتهية وإعادتها للـ ATP (Auto-Expiry Cleanup)
 */
async function releaseExpiredReservations(supabaseClient = null) {
  const sb = supabaseClient || getSupabaseAdmin();

  const { data, error } = await sb.rpc('mken_fn_release_expired_reservations');
  if (error) {
    console.error('Release expired reservations error:', error.message);
    return 0;
  }

  return Number(data) || 0;
}

/**
 * 5. فحص توفر الصنف وحساب ATP اللحظي
 */
async function getItemStockStatus(tenantSlug, itemId, supabaseClient = null) {
  const sb = supabaseClient || getSupabaseAdmin();
  const slug = tenantSlug || 'default';

  const { data, error } = await sb
    .from('mken_inventory_items')
    .select('id, sku, name, physical_qty, reserved_qty, allocated_qty, sell_price, moving_average_cost, reorder_point, is_active')
    .eq('tenant_slug', slug)
    .eq('id', itemId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const atp = Math.max(0, data.physical_qty - (data.reserved_qty + data.allocated_qty));
  return {
    ...data,
    atp_qty: atp,
    is_available: atp > 0 && data.is_active,
    is_low_stock: atp <= data.reorder_point
  };
}

module.exports = {
  calculateMovingAverageCost,
  allocateLandedCosts,
  reserveInventory,
  commitReservation,
  cancelReservation,
  releaseExpiredReservations,
  getItemStockStatus
};
