/**
 * منصة مكّن (mken.live) — محرك توجيه وحسابات الطابور لنقاط البيع (Queue Resolver Engine)
 * يدعم العمل في المتصفح وبيئة Node.js (Universal UMD Module)
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MkenQueueResolver = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QUEUE_DIRECTORY = {
    C: {
      code: 'C',
      nameAr: 'مشروبات وقهوة',
      nameEn: 'Coffee & Drinks',
      prefix: 'C',
      targetMinutes: 4,
      icon: '☕',
      color: '#0ea5e9'
    },
    F: {
      code: 'F',
      nameAr: 'مطبخ ووجبات',
      nameEn: 'Kitchen & Meals',
      prefix: 'F',
      targetMinutes: 10,
      icon: '🍳',
      color: '#f97316'
    },
    T: {
      code: 'T',
      nameAr: 'خدمة الطاولات',
      nameEn: 'Table Service',
      prefix: 'T',
      targetMinutes: 15,
      icon: '🪑',
      color: '#8b5cf6'
    },
    D: {
      code: 'D',
      nameAr: 'استلام التوصيل',
      nameEn: 'Delivery Pickup',
      prefix: 'D',
      targetMinutes: 5,
      icon: '🛵',
      color: '#10b981'
    },
    K: {
      code: 'K',
      nameAr: 'خدمة سريعة / كشك',
      nameEn: 'Express Kiosk',
      prefix: 'K',
      targetMinutes: 3,
      icon: '⚡',
      color: '#6366f1'
    }
  };

  var FOOD_CATEGORIES = [
    'food', 'meal', 'meals', 'kitchen', 'sandwich', 'burger', 'pizza', 'pasta',
    'salad', 'bakery', 'sweets', 'dessert', 'طعام', 'وجبة', 'وجبات', 'مطبخ',
    'ساندوتش', 'برجر', 'بيتزا', 'حلويات', 'معجنات', 'مخبوزات'
  ];

  var DRINK_CATEGORIES = [
    'drink', 'drinks', 'beverage', 'beverages', 'coffee', 'tea', 'latte', 'espresso',
    'juice', 'smoothie', 'water', 'مشروب', 'مشروبات', 'قهوة', 'شاي', 'لاتيه',
    'عصير', 'عصائر', 'ماء'
  ];

  /**
   * يحدد تلقائياً رمز الطابور المناسب بناء على بنود الطلب ونوع الخدمة
   * @param {Array} items - بنود الطلب
   * @param {string} serviceType - takeaway | dine_in | delivery_pickup
   * @returns {string} - رمز الطابور (C, F, T, D, K)
   */
  function resolveQueueId(items, serviceType) {
    var st = String(serviceType || 'takeaway').toLowerCase().trim();

    if (st === 'delivery_pickup' || st === 'delivery') {
      return 'D';
    }
    if (st === 'dine_in' || st === 'table') {
      return 'T';
    }

    var hasFood = false;
    var hasDrinks = false;

    if (Array.isArray(items)) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var cat = String(it.category || it.type || it.serviceType || '').toLowerCase().trim();
        var title = String(it.name || it.title || '').toLowerCase().trim();

        // مطابقة بالتصنيف أو الكلمات المفتاحية في العنوان
        for (var f = 0; f < FOOD_CATEGORIES.length; f++) {
          if (cat === FOOD_CATEGORIES[f] || title.indexOf(FOOD_CATEGORIES[f]) !== -1) {
            hasFood = true;
            break;
          }
        }
        for (var d = 0; d < DRINK_CATEGORIES.length; d++) {
          if (cat === DRINK_CATEGORIES[d] || title.indexOf(DRINK_CATEGORIES[d]) !== -1) {
            hasDrinks = true;
            break;
          }
        }
      }
    }

    // إذا احتوى على طعام، يتوجه للمطبخ أولاً لضمان سرعة التجهيز
    if (hasFood) {
      return 'F';
    }
    if (hasDrinks) {
      return 'C';
    }
    return 'K';
  }

  /**
   * جلب معلومات وتفاصيل الطابور
   * @param {string} queueId
   */
  function getQueueMeta(queueId) {
    var q = String(queueId || 'K').toUpperCase();
    return QUEUE_DIRECTORY[q] || {
      code: q,
      nameAr: 'خدمة عامة',
      nameEn: 'General Service',
      prefix: q,
      targetMinutes: 5,
      icon: '🎫',
      color: '#64748b'
    };
  }

  /**
   * حساب الوقت المتوقع للانتظار بالدقائق
   * @param {number} waitingCount - عدد العملاء قيد الانتظار في هذا الطابور
   * @param {number} avgServiceSeconds - متوسط زمن الخدمة بالثواني
   * @param {number} activeCounters - عدد الكاونترات الفعالة لخدمة هذا المسار
   */
  function computeETA(waitingCount, avgServiceSeconds, activeCounters) {
    var count = Math.max(0, parseInt(waitingCount, 10) || 0);
    var sec = Math.max(60, parseInt(avgServiceSeconds, 10) || 300);
    var counters = Math.max(1, parseInt(activeCounters, 10) || 1);

    if (count === 0) {
      return 1; // إذا لا يوجد أحد، دقيقة واحدة للوصول
    }

    var totalSeconds = (count * sec) / counters;
    var minutes = Math.ceil(totalSeconds / 60);
    return Math.max(1, minutes);
  }

  /**
   * تنسيق رقم التذكرة بصيغة موحدة
   * @param {string} prefix - الحرف (C, F, T...)
   * @param {number} seq - الرقم التسلسلي اليومي
   */
  function formatTicketNumber(prefix, seq) {
    var p = String(prefix || 'A').toUpperCase().charAt(0);
    var n = parseInt(seq, 10) || 1;
    var pad = n < 10 ? '00' + n : n < 100 ? '0' + n : String(n);
    return p + '-' + pad;
  }

  return {
    resolveQueueId: resolveQueueId,
    getQueueMeta: getQueueMeta,
    computeETA: computeETA,
    formatTicketNumber: formatTicketNumber,
    QUEUE_DIRECTORY: QUEUE_DIRECTORY
  };
});
