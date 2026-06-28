'use strict';

/**
 * مكن — بوابة دفع اشتراكات Mken Lite (Moyasar)
 *
 *   GET /api/license-checkout/config              → المفتاح المنشور + الباقات والأسعار
 *   GET /api/license-checkout/status?paymentId=.. → حالة الإصدار بعد الدفع (يعيد المفتاح عند النجاح)
 *
 * إصدار الترخيص الفعلي يتم في webhook الدفع (api/moyasar-webhook.js) بعد تأكيد Moyasar،
 * لمنع التلاعب من جهة العميل.
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');
const { handleCors } = require('./_lib/cors');
const licenseIssue = require('./_lib/license-issue');

function getAction(req) {
  if (req.query && req.query.action) return String(req.query.action);
  const m = (req.url || '').match(/\/api\/license-checkout\/([a-zA-Z]+)/);
  return m ? m[1] : '';
}

function publicPlans() {
  return Object.keys(licenseIssue.PLANS).map(function (key) {
    const p = licenseIssue.PLANS[key];
    return {
      key: key, label: p.label,
      annual: p.annual, perpetual: p.perpetual,
      maxDevices: p.maxDevices
    };
  });
}

async function doConfig(req, res) {
  return res.status(200).json({
    publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY || '',
    currency: '\u20C1',
    plans: publicPlans()
  });
}

async function doStatus(req, res) {
  const paymentId = (req.query.paymentId || req.query.payment_id || '').trim();
  if (!paymentId) return res.status(400).json({ error: 'paymentId مطلوب' });

  const secret = process.env.MOYASAR_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'مفتاح Moyasar غير مهيّأ' });

  // تأكيد الدفع من Moyasar
  let payment;
  try {
    const auth = Buffer.from(secret + ':').toString('base64');
    const r = await fetch('https://api.moyasar.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { Authorization: 'Basic ' + auth }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    payment = await r.json();
  } catch (e) {
    return res.status(400).json({ error: 'تعذّر التحقق من الدفعة: ' + e.message });
  }

  const paid = payment.status === 'paid' || payment.status === 'captured';
  if (!paid) {
    return res.status(200).json({ paid: false, status: payment.status || 'unknown' });
  }

  // ابحث عن الترخيص الصادر بهذه الدفعة (قد يتأخر إصداره من الـ webhook)
  const supabase = createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey());
  const { data: lic } = await supabase
    .from('mken_licenses').select('license_key, plan, expires_at, max_devices')
    .eq('payment_id', paymentId).maybeSingle();

  if (!lic) {
    return res.status(200).json({ paid: true, issued: false, message: 'تم الدفع — جارٍ إصدار الترخيص، حدّث بعد لحظات.' });
  }

  return res.status(200).json({
    paid: true, issued: true,
    licenseKey: lic.license_key, plan: lic.plan,
    expiresAt: lic.expires_at, maxDevices: lic.max_devices
  });
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res, 'GET,OPTIONS')) return;
  try {
    const action = getAction(req);
    if (action === 'config') return await doConfig(req, res);
    if (action === 'status') return await doStatus(req, res);
    return res.status(400).json({ error: 'إجراء غير معروف (config|status)' });
  } catch (err) {
    console.error('[License Checkout] Error:', err);
    return res.status(500).json({ error: err.message || 'خطأ داخلي' });
  }
};
