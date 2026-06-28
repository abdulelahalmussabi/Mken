'use strict';

/**
 * مكن — منطق التسعير وإصدار تراخيص Mken Lite (مشترك بين لوحة الإدارة وبوابة الدفع).
 */

const sign = require('./license-sign');

// باقات Mken Lite وأسعارها (بالريال السعودي)
const PLANS = {
  Lite:     { annual: 399,  perpetual: 750,  maxDevices: 1,  label: 'Lite' },
  Pro:      { annual: 899,  perpetual: 2200, maxDevices: 3,  label: 'Pro' },
  Business: { annual: 1800, perpetual: 5000, maxDevices: 25, label: 'Business' }
};

function getPlan(plan) {
  return PLANS[plan] || PLANS.Lite;
}

/** السعر المتوقع (ريال) لباقة + دورة فوترة */
function priceFor(plan, billingCycle) {
  const p = getPlan(plan);
  return billingCycle === 'perpetual' ? p.perpetual : p.annual;
}

/** أشهر الصلاحية حسب الدورة */
function monthsFor(billingCycle, months) {
  if (billingCycle === 'perpetual') return 1200; // ~دائم
  return Number(months) || 12;
}

/**
 * إصدار ترخيص جديد وحفظه.
 * @returns {Promise<Object>} صف الترخيص
 */
async function issueLicense(supabase, opts) {
  opts = opts || {};
  const planKey = PLANS[opts.plan] ? opts.plan : 'Lite';
  const planDef = getPlan(planKey);
  const billingCycle = opts.billingCycle || 'annual';
  const months = monthsFor(billingCycle, opts.months);
  const maxDevices = Math.max(1, Number(opts.maxDevices) || planDef.maxDevices);

  const now = new Date();
  const expiresAt = billingCycle === 'perpetual'
    ? null
    : new Date(now.getTime() + months * 30 * 86400000).toISOString();

  // توليد مفتاح فريد
  let licenseKey = sign.generateLicenseKey();
  for (let i = 0; i < 4; i++) {
    const { data: clash } = await supabase
      .from('mken_licenses').select('license_key').eq('license_key', licenseKey).maybeSingle();
    if (!clash) break;
    licenseKey = sign.generateLicenseKey();
  }

  const row = {
    license_key: licenseKey,
    plan: planKey,
    customer_name: opts.customerName || null,
    customer_phone: opts.phone || null,
    customer_email: opts.email || null,
    max_devices: maxDevices,
    status: 'active',
    billing_cycle: billingCycle,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    payment_id: opts.paymentId || null,
    source: opts.source || 'admin',
    notes: opts.notes || null,
    tax_number: opts.taxNumber || null,
    commercial_registry_number: opts.crNumber || null,
    updated_at: now.toISOString()
  };

  const { data, error } = await supabase.from('mken_licenses').insert(row).select().single();
  if (error) throw error;
  return data;
}

module.exports = { PLANS, getPlan, priceFor, monthsFor, issueLicense };
