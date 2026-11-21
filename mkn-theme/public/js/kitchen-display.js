/**
 * منصة مكّن (mken.live) — وحدة التحكم بشاشة المطبخ الذكية (Kitchen Display System - KDS)
 * تدعم التحديث اللحظي، تنبيهات التأخير المتدرجة، والإشعار المباشر بجاهزية الوجبات
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MkenKitchenDisplay = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var activeOrders = [];
  var currentFilter = 'all'; // 'all', 'F', 'T', 'D'
  var tenantSlug = 'default';
  var branchId = 'default';
  var soundEnabled = true;
  var timerInterval = null;
  var pollInterval = null;

  // إعدادات التنبيه اللوني الزمني للمطبخ (بالدقائق)
  var ALERT_THRESHOLDS = {
    WARNING_MINUTES: 7,   // أصفر
    URGENT_MINUTES: 15    // أحمر وميض
  };

  /**
   * تشغيل نغمة تنبيه المطبخ عند دخول طلب جديد
   */
  function playKitchenChime() {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      var ctx = new AudioContext();
      var now = ctx.currentTime;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      // Audio not permitted without interaction
    }
  }

  /**
   * حساب الدقائق المنقضية منذ إنشاء الطلب
   */
  function calculateElapsedMinutes(arrivedAtIso) {
    if (!arrivedAtIso) return 0;
    var arrivedMs = new Date(arrivedAtIso).getTime();
    var nowMs = Date.now();
    return Math.max(0, Math.floor((nowMs - arrivedMs) / 60000));
  }

  /**
   * تحديد الحالة اللونية للطلب بناءً على وقت الانتظار
   */
  function getUrgencyLevel(elapsedMinutes) {
    if (elapsedMinutes >= ALERT_THRESHOLDS.URGENT_MINUTES) {
      return 'urgent'; // أحمر
    }
    if (elapsedMinutes >= ALERT_THRESHOLDS.WARNING_MINUTES) {
      return 'warning'; // أصفر
    }
    return 'normal'; // أخضر / هادئ
  }

  /**
   * فلترة التذاكر الخاصة بالمطبخ فقط (مأكولات، طاولات، استلام)
   */
  function isKitchenOrder(ticket) {
    if (!ticket) return false;
    var q = String(ticket.queue_id || '').toUpperCase();
    if (['F', 'T', 'D'].indexOf(q) !== -1) return true;

    // فحص بنود الطلب إذا احتوت على أصناف طعام
    var items = ticket.order_summary || (ticket.payload && ticket.payload.items) || ticket.items || [];
    if (Array.isArray(items)) {
      for (var i = 0; i < items.length; i++) {
        var cat = String(items[i].category || '').toLowerCase();
        if (['food', 'meal', 'kitchen', 'طعام', 'وجبات', 'مطبخ'].indexOf(cat) !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * جلب الطلبات النشطة للمطبخ من السحابة أو الذاكرة
   */
  function fetchActiveKitchenOrders(slug, branch) {
    tenantSlug = slug || tenantSlug;
    branchId = branch || branchId;

    var url = '/api/v1/queue?action=list-queues&tenant=' + encodeURIComponent(tenantSlug);
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !Array.isArray(data.queues)) return [];

        var gathered = [];
        data.queues.forEach(function (q) {
          if (Array.isArray(q.waitingTickets)) {
            q.waitingTickets.forEach(function (t) {
              if (isKitchenOrder(t)) {
                gathered.push({
                  id: t.id,
                  ticket_number: t.ticket_number,
                  queue_id: t.queue_id || q.prefix || 'F',
                  customer_name: t.customer_name || 'عميل',
                  phone: t.customer_phone || t.phone,
                  first_arrived_at: t.first_arrived_at || t.booked_at || new Date().toISOString(),
                  status: t.status || 'waiting',
                  table_number: t.table_number || (t.payload && t.payload.table_number),
                  service_type: t.service_type || (t.payload && t.payload.service_type) || 'dine_in',
                  notes: t.notes || (t.payload && t.payload.notes),
                  items: t.order_summary || (t.payload && t.payload.items) || [],
                  in_prep: !!(t.in_prep || (t.payload && t.payload.in_prep))
                });
              }
            });
          }
        });

        // رصد وصول طلبات جديدة لتشغيل الصوت
        if (gathered.length > activeOrders.length) {
          playKitchenChime();
        }

        activeOrders = gathered;
        return activeOrders;
      })
      .catch(function (err) {
        console.warn('[KDS Fetch Warning]', err.message);
        return activeOrders;
      });
  }

  /**
   * تمييز الطلب بأنه قيد التحضير (In Preparation)
   */
  function markOrderInPrep(ticketId) {
    var order = activeOrders.find(function (o) { return o.id === ticketId || o.ticket_number === ticketId; });
    if (order) {
      order.in_prep = true;
    }
  }

  /**
   * إنهاء تحضير الطلب وإرسال إشعار الجاهزية للعميل
   */
  function markOrderReady(ticketId, ticketNumber, phone, tableNumber) {
    // 1. إزالة الطلب من قائمة المطبخ النشطة
    activeOrders = activeOrders.filter(function (o) {
      return o.id !== ticketId && o.ticket_number !== ticketNumber;
    });

    // 2. إرسال إشعار واتساب للعميل
    return fetch('/api/v1/queue?action=notify-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: tenantSlug,
        customer_phone: phone,
        eventType: 'order_ready',
        ticket_number: ticketNumber,
        table_number: tableNumber
      })
    })
    .then(function (r) { return r.json(); })
    .catch(function (e) {
      console.warn('[KDS Ready Notification Warning]', e.message);
      return { ok: true, simulated: true };
    });
  }

  return {
    fetchActiveKitchenOrders: fetchActiveKitchenOrders,
    calculateElapsedMinutes: calculateElapsedMinutes,
    getUrgencyLevel: getUrgencyLevel,
    isKitchenOrder: isKitchenOrder,
    markOrderInPrep: markOrderInPrep,
    markOrderReady: markOrderReady,
    playKitchenChime: playKitchenChime,
    setSoundEnabled: function (val) { soundEnabled = !!val; },
    isSoundEnabled: function () { return soundEnabled; },
    getActiveOrders: function () { return activeOrders; },
    ALERT_THRESHOLDS: ALERT_THRESHOLDS
  };
});
