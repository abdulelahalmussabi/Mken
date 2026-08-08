'use strict';

/**
 * مكن — خادم المزامنة السحابية الاختيارية لـ Mken Lite (المرحلة 5)
 *
 * يعمل أوف لاين أولاً؛ المزامنة اختيارية وتُشغَّل عند توفر الإنترنت.
 * كل البيانات مرتبطة بمفتاح الترخيص (الحساب) ومحميّة بربط الجهاز.
 *
 * نقاط الوصول:
 *   POST /api/lite-sync/push  { licenseKey, machineId, changes:[{store,id,updatedAt,data,deleted}] }
 *        → يرفع التغييرات المحلية (upsert) ويعيد serverTime
 *   POST /api/lite-sync/pull  { licenseKey, machineId, since, limit }
 *        → يعيد السجلات التي تغيّرت منذ since (للمزامنة بين الأجهزة/الفروع)
 *
 * المصادقة: مفتاح ترخيص فعّال + جهاز مربوط مسبقاً (عبر /api/license/activate).
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');
const { handleCors } = require('./_lib/cors');
const { isRateLimited } = require('./_lib/rate-limit');

const ALLOWED_STORES = { branches: 1, products: 1, customers: 1, invoices: 1, shifts: 1 };
const MAX_CHANGES = 1000;       // حد أقصى للتغييرات في الطلب الواحد
const DEFAULT_PULL_LIMIT = 500; // حد أقصى للسجلات المُعادة

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function getSupabase(res) {
  const url = sbEnv.getSupabaseUrl();
  const key = sbEnv.getSupabaseServiceKey();
  if (!url || !key) {
    res.status(500).json({ error: 'Supabase غير مهيّأ في البيئة' });
    return null;
  }
  return createClient(url, key);
}

function getAction(req) {
  if (req.query && req.query.action) return String(req.query.action);
  const url = req.url || '';
  const m = url.match(/\/api\/lite-sync\/([a-zA-Z]+)/);
  return m ? m[1] : '';
}

// التحقق من الترخيص + ربط الجهاز قبل أي مزامنة
async function authorize(req, res, supabase) {
  const body = req.body || {};
  const licenseKey = (body.licenseKey || '').trim().toUpperCase();
  const machineId = (body.machineId || '').trim();
  if (!licenseKey || !machineId) {
    res.status(400).json({ error: 'licenseKey و machineId مطلوبان' });
    return null;
  }

  const { data: lic, error } = await supabase
    .from('mken_licenses').select('license_key,status,expires_at').eq('license_key', licenseKey).maybeSingle();
  if (error) throw error;
  if (!lic) { res.status(404).json({ error: 'مفتاح ترخيص غير صحيح' }); return null; }
  if (lic.status !== 'active') { res.status(403).json({ error: 'الترخيص غير فعّال' }); return null; }
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    res.status(403).json({ error: 'انتهت صلاحية الترخيص' }); return null;
  }

  const { data: device } = await supabase.from('mken_license_devices')
    .select('id').eq('license_key', licenseKey).eq('machine_id', machineId).maybeSingle();
  if (!device) {
    res.status(403).json({ error: 'الجهاز غير مفعّل لهذا الترخيص. فعّل الترخيص أولاً.', code: 'DEVICE_NOT_BOUND' });
    return null;
  }

  // تحديث آخر ظهور للجهاز (لا تُفشل العملية إن تعذّر)
  supabase.from('mken_license_devices')
    .update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)
    .then(function () {}, function () {});

  return { licenseKey: licenseKey, machineId: machineId };
}

// رفع التغييرات المحلية إلى السحابة
async function doPush(req, res, supabase, ctx) {
  const body = req.body || {};
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > MAX_CHANGES) {
    return res.status(413).json({ error: 'عدد التغييرات كبير جداً، قسّم الدُفعة (الحد ' + MAX_CHANGES + ')' });
  }

  const now = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i] || {};
    if (!c.store || !ALLOWED_STORES[c.store] || !c.id) continue;
    rows.push({
      license_key: ctx.licenseKey,
      store: String(c.store),
      record_id: String(c.id),
      data: c.data || {},
      updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : now,
      device_id: ctx.machineId,
      deleted: !!c.deleted
    });
  }

  let upserted = 0;
  if (rows.length) {
    // upsert على المفتاح المركّب (license_key, store, record_id)
    const { error } = await supabase
      .from('mken_lite_records')
      .upsert(rows, { onConflict: 'license_key,store,record_id' });
    if (error) throw error;
    upserted = rows.length;
  }

  return res.status(200).json({ success: true, upserted: upserted, serverTime: now });
}

// سحب التغييرات من السحابة (منذ since)
async function doPull(req, res, supabase, ctx) {
  const body = req.body || {};
  const since = body.since ? new Date(body.since).toISOString() : new Date(0).toISOString();
  let limit = parseInt(body.limit, 10);
  if (!limit || limit < 1 || limit > DEFAULT_PULL_LIMIT) limit = DEFAULT_PULL_LIMIT;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('mken_lite_records')
    .select('store,record_id,data,updated_at,deleted')
    .eq('license_key', ctx.licenseKey)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const records = (data || []).map(function (r) {
    return { store: r.store, id: r.record_id, updatedAt: r.updated_at, data: r.data, deleted: r.deleted };
  });

  // إن بلغنا الحد، فهناك المزيد؛ يستخدم العميل آخر updatedAt للمتابعة
  const hasMore = records.length >= limit;
  const cursor = records.length ? records[records.length - 1].updatedAt : since;

  return res.status(200).json({
    records: records,
    serverTime: now,
    hasMore: hasMore,
    cursor: cursor
  });
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST فقط' });

  const ip = getClientIp(req);
  const rl = isRateLimited('lite_sync_' + ip, 120, 60 * 1000);
  if (rl.limited) return res.status(429).json({ error: 'طلبات كثيرة، حاول لاحقاً', retryAfter: rl.retryAfterSec });

  const supabase = getSupabase(res);
  if (!supabase) return;

  const action = getAction(req);

  try {
    const ctx = await authorize(req, res, supabase);
    if (!ctx) return; // تم إرسال الرد داخل authorize

    switch (action) {
      case 'push': return await doPush(req, res, supabase, ctx);
      case 'pull': return await doPull(req, res, supabase, ctx);
      default:
        return res.status(400).json({ error: 'إجراء غير معروف. استخدم action=push|pull' });
    }
  } catch (err) {
    console.error('[Lite Sync] Error:', err);
    return res.status(500).json({ error: err.message || 'خطأ داخلي' });
  }
};
