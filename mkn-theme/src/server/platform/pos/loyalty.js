// api/v1/pos/loyalty.js
// محرك برنامج الولاء لنقاط البيع ونظام الطابور الذكي في منصة مكّن
// يدعم احتساب النقاط التلقائي فور الدفع، والاستعلام، والاستبدال مع التوافق السحابي والمحلي.

const { createClient } = require('@supabase/supabase-js');

// ذاكرة تشغيلية محلية لحفظ أرصدة الولاء في حال انقطاع السحابة (Local Failover)
const localLoyaltyBalances = new Map();

/**
 * احتساب النقاط المكتسبة من إجمالي المبلغ
 * الافتراضي: نقطة واحدة لكل 10 ر.س
 */
function calculateEarnedPoints(amount, ratio = 0.1) {
  const numericAmount = Math.max(0, parseFloat(amount) || 0);
  return Math.floor(numericAmount * ratio);
}

/**
 * احتساب قيمة الخصم المستحقة من رصيد النقاط
 * الافتراضي: 10 نقاط = 1 ر.س خصم
 */
function calculateDiscount(points, sarPerPoint = 0.1) {
  const pts = Math.max(0, parseInt(points, 10) || 0);
  return Math.round(pts * sarPerPoint * 100) / 100;
}

/**
 * جلب رصيد الولاء الحالي للعميل
 */
async function getCustomerLoyalty(tenantSlug, phone) {
  if (!phone) return { points: 0, tier: 'BRONZE', total_spend: 0 };
  const cleanPhone = String(phone).replace(/\D/g, '');
  const key = `${tenantSlug || 'default'}:${cleanPhone}`;

  // 1. محاولة السحب من Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await sb
        .from('customer_loyalty_balances')
        .select('*')
        .eq('customer_phone', cleanPhone)
        .maybeSingle();

      if (!error && data) {
        return {
          phone: cleanPhone,
          name: data.customer_name || '',
          points: data.loyalty_points || 0,
          tier: data.tier_level || 'BRONZE',
          total_spend: data.total_spend_amount || 0,
          reward_vouchers_count: data.reward_vouchers_count || 0
        };
      }
    } catch (e) {
      console.warn('[Loyalty Fetch DB Warning]', e.message);
    }
  }

  // 2. استخدام الذاكرة التشغيلية المحلية (Failover)
  const local = localLoyaltyBalances.get(key) || {
    phone: cleanPhone,
    name: '',
    points: 0,
    tier: 'BRONZE',
    total_spend: 0
  };
  return local;
}

/**
 * تسجيل نقاط مكتسبة جديدة للعميل فور الدفع
 */
async function earnCustomerLoyalty(tenantSlug, phone, name = '', spendAmount = 0, ticketId = '') {
  if (!phone) return { points_earned: 0, current_balance: 0, tier: 'BRONZE' };
  const cleanPhone = String(phone).replace(/\D/g, '');
  const key = `${tenantSlug || 'default'}:${cleanPhone}`;
  const pointsEarned = calculateEarnedPoints(spendAmount);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let resultBalance = null;

  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      // استدعاء الدالة المخزنة في Postgres
      const { data, error } = await sb.rpc('process_customer_loyalty_points', {
        p_tenant_id: '00000000-0000-0000-0000-000000000001', // UUID الافتراضي أو tenant id
        p_customer_phone: cleanPhone,
        p_customer_name: name,
        p_spend_amount: spendAmount
      });

      if (!error && data && data.length > 0) {
        resultBalance = {
          points_earned: pointsEarned,
          current_balance: data[0].out_total_points,
          tier: data[0].out_tier_level,
          reward_earned: data[0].out_reward_earned,
          discount_code: data[0].out_discount_code
        };
      }
    } catch (dbErr) {
      console.warn('[Loyalty RPC Warning]', dbErr.message);
    }
  }

  if (!resultBalance) {
    // تحديث المحفظة المحلية
    const current = localLoyaltyBalances.get(key) || {
      phone: cleanPhone,
      name: name,
      points: 0,
      tier: 'BRONZE',
      total_spend: 0
    };
    current.points += pointsEarned;
    current.total_spend += spendAmount;
    if (name) current.name = name;

    if (current.points >= 1000) current.tier = 'PLATINUM';
    else if (current.points >= 500) current.tier = 'GOLD';
    else if (current.points >= 200) current.tier = 'SILVER';
    else current.tier = 'BRONZE';

    localLoyaltyBalances.set(key, current);
    resultBalance = {
      points_earned: pointsEarned,
      current_balance: current.points,
      tier: current.tier,
      is_local_failover: true
    };
  }

  return resultBalance;
}

/**
 * استرداد واستخدام نقاط الولاء لخصم من الفاتورة
 */
async function redeemCustomerLoyalty(tenantSlug, phone, pointsToRedeem = 0) {
  if (!phone || pointsToRedeem <= 0) {
    return { ok: false, error: 'invalid_points_or_phone' };
  }
  const cleanPhone = String(phone).replace(/\D/g, '');
  const key = `${tenantSlug || 'default'}:${cleanPhone}`;

  const current = await getCustomerLoyalty(tenantSlug, cleanPhone);
  if (current.points < pointsToRedeem) {
    return {
      ok: false,
      error: 'insufficient_points',
      message: `رصيد النقاط المتوفر (${current.points}) أقل من المطلوب استرداده (${pointsToRedeem})`
    };
  }

  const discountAmount = calculateDiscount(pointsToRedeem);
  const remainingPoints = current.points - pointsToRedeem;

  // تحديث محلي
  localLoyaltyBalances.set(key, {
    ...current,
    points: remainingPoints
  });

  return {
    ok: true,
    points_redeemed: pointsToRedeem,
    discount_amount: discountAmount,
    remaining_points: remainingPoints
  };
}

/**
 * API Handler لاستقبال طلبات الولاء من الكاونتر وشاشات الخدمة الذاتية
 */
module.exports = async function handler(req, res) {
  const method = req.method;
  const { action, tenant, phone, name, amount, points } = req.body || req.query || {};
  const tenantSlug = tenant || req.headers['x-tenant-slug'] || 'cafe-chain';

  try {
    if (action === 'get_balance') {
      const balance = await getCustomerLoyalty(tenantSlug, phone);
      const maxDiscount = calculateDiscount(balance.points);
      return res.status(200).json({
        ok: true,
        ...balance,
        max_discount_sar: maxDiscount
      });
    }

    if (action === 'redeem') {
      const redemption = await redeemCustomerLoyalty(tenantSlug, phone, parseInt(points, 10));
      if (!redemption.ok) {
        return res.status(400).json(redemption);
      }
      return res.status(200).json(redemption);
    }

    if (action === 'earn') {
      const earned = await earnCustomerLoyalty(tenantSlug, phone, name, parseFloat(amount || 0));
      return res.status(200).json({
        ok: true,
        ...earned
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'unknown_action',
      message: 'يرجى تحديد action: get_balance, earn, أو redeem'
    });
  } catch (err) {
    console.error('[Loyalty API Exception]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports.calculateEarnedPoints = calculateEarnedPoints;
module.exports.calculateDiscount = calculateDiscount;
module.exports.getCustomerLoyalty = getCustomerLoyalty;
module.exports.earnCustomerLoyalty = earnCustomerLoyalty;
module.exports.redeemCustomerLoyalty = redeemCustomerLoyalty;
module.exports.localLoyaltyBalances = localLoyaltyBalances;
