'use strict';

/**
 * منصة مكّن (mken.live) — معالج الإشعارات التنبيهية الذكية للطوابير (Almost-Called Queue Cron)
 * يفحص التذاكر التي اقترب دورها (المتبقي عميل أو عميلان) ويرسل تنبيهاً استباقياً عبر واتساب
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');
const notifyWhatsapp = require('./queue/notify-whatsapp');

module.exports = async function handler(req, res) {
  // اختياري: التحقق من سرية الكرون
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();

  const results = {
    checkedAt: new Date().toISOString(),
    notifiedTickets: [],
    skippedCount: 0
  };

  if (!supabaseUrl || !serviceKey) {
    return res.status(200).json({
      ok: true,
      message: 'Supabase credentials not configured. Cron ran in local skip mode.',
      results
    });
  }

  try {
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 1. جلب التذاكر قيد الانتظار مرتبة بحسب وقت الوصول
    const { data: waitingTickets, error } = await sb
      .from('queue_runtime_tickets')
      .select('*')
      .eq('status', 'waiting')
      .order('first_arrived_at', { ascending: true })
      .limit(100);

    if (error || !Array.isArray(waitingTickets) || waitingTickets.length === 0) {
      return res.status(200).json({ ok: true, message: 'لا توجد تذاكر انتظار تحتاج تنبيهاً.', results });
    }

    // تجميع التذاكر بحسب (tenant_slug, queue_id)
    const grouped = {};
    waitingTickets.forEach(t => {
      const key = `${t.tenant_slug}__${t.queue_id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    for (const key of Object.keys(grouped)) {
      const queueList = grouped[key];
      // التذكرة في الترتيب رقم 2 (أي يوجد عميل واحد أمامها يخدم أو سينادى عليه)
      for (let pos = 0; pos < queueList.length; pos++) {
        const ticket = queueList[pos];
        const aheadCount = pos; // 0 يعني هو الأول، 1 يعني الثاني...
        
        // نرسل تنبيه اقتراب الدور فقط للعميل الثاني والثالث (aheadCount = 1 أو 2)
        if (aheadCount >= 1 && aheadCount <= 2) {
          const payload = ticket.payload || {};
          const phone = payload.phone || ticket.order_summary?.phone;

          // إذا لم يسبق إرسال إشعار اقتراب الدور
          if (phone && !payload.almost_notified) {
            try {
              const notifyRes = await notifyWhatsapp.sendQueueWhatsAppNotification(
                ticket.tenant_slug,
                phone,
                'almost_called',
                {
                  ticket_number: ticket.ticket_number,
                  queue_name: payload.queue_name || ticket.queue_id,
                  customer_name: payload.customer_name,
                  ahead_count: aheadCount
                }
              );

              if (notifyRes.ok) {
                // تحديث الـ payload لوسم almost_notified = true
                payload.almost_notified = true;
                payload.almost_notified_at = new Date().toISOString();

                await sb
                  .from('queue_runtime_tickets')
                  .update({ payload: payload, updated_at: new Date().toISOString() })
                  .eq('id', ticket.id);

                results.notifiedTickets.push({
                  id: ticket.id,
                  ticket_number: ticket.ticket_number,
                  phone: phone,
                  aheadCount: aheadCount
                });
              }
            } catch (notifyErr) {
              console.warn('[Queue Almost Notify Error]', ticket.id, notifyErr.message);
            }
          } else {
            results.skippedCount++;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('[Queue Cron Error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
