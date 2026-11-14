/**
 * js/pwa.js — منسق PWA المقاوم لانقطاع الشبكة والمزامنة التفاعلية (E3.2)
 * منصة مكّن — متوافق مع Safari iOS و Chrome Android والأنظمة السعودية
 */
(function () {
  'use strict';

  var deferredPrompt = null;
  var banner = null;
  var offlineBanner = null;
  var isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // =========================================================================
  // 1. شريط إشعار حالة عدم الاتصال (Offline Notification Banner)
  // =========================================================================
  function renderOfflineTopBanner(show, text) {
    if (typeof document === 'undefined') return;

    if (!offlineBanner) {
      offlineBanner = document.createElement('div');
      offlineBanner.id = 'mkenConnectivityBanner';
      offlineBanner.style.cssText =
        'position: fixed; top: 0; left: 0; right: 0; z-index: 99999; ' +
        'padding: 8px 16px; text-align: center; font-size: 0.85rem; font-weight: 600; ' +
        'background: #f59e0b; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.15); ' +
        'transition: transform 0.3s ease; transform: translateY(-100%); direction: rtl;';
      document.body.appendChild(offlineBanner);
    }
    offlineBanner.textContent = text || 'أنت تتصفح في وضع عدم الاتصال — سيتم حفظ أي موعد أو طلب كمسودة محلية تلقائياً.';
    offlineBanner.style.transform = show ? 'translateY(0)' : 'translateY(-100%)';
  }

  // =========================================================================
  // 2. التحقق من وجود اتصال حقيقي بالإنترنت (Heartbeat Ping)
  // =========================================================================
  async function verifyRealInternet() {
    try {
      var res = await fetch('/api/v1/auth?type=ping', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit'
      });
      return res.ok || res.status === 400 || res.status === 200;
    } catch (e) {
      return false;
    }
  }

  // =========================================================================
  // 3. مراقب الاتصال الهجين وإعادة إرسال المسودات (Hybrid Online Watcher)
  // =========================================================================
  async function handleNetworkChange() {
    var rawOnline = navigator.onLine;

    if (!rawOnline) {
      isCurrentlyOnline = false;
      renderOfflineTopBanner(true, '⚠️ انقطع الاتصال بالإنترنت — وضع التصفح وحفظ المسودات دون اتصال مفعّل.');
      return;
    }

    var realOnline = await verifyRealInternet();
    if (realOnline) {
      isCurrentlyOnline = true;
      renderOfflineTopBanner(true, '⚡ عاد الاتصال بالإنترنت! جاري مزامنة مسوداتك المحفوظة...');
      await replayPendingIntents();
      setTimeout(function () { renderOfflineTopBanner(false); }, 3500);
    } else {
      isCurrentlyOnline = false;
      renderOfflineTopBanner(true, '⚠️ اتصال الشبكة ضعيف أو وهمي (Captive Portal) — استمرار العمل دون اتصال.');
    }
  }

  // =========================================================================
  // 4. خوارزمية مزامنة المسودات التلقائية وفض النزاعات (Conflict Resolution)
  // =========================================================================
  async function replayPendingIntents() {
    if (!window.MkenOfflineStore) return;
    var store = window.MkenServicesStore;
    var tenant = store ? store.getCurrentTenantSlug() : 'default';
    var intents = await window.MkenOfflineStore.getPendingIntents(tenant);

    if (!intents || !intents.length) return;

    for (var i = 0; i < intents.length; i++) {
      var intent = intents[i];
      try {
        if (intent.type === 'booking') {
          var res = await fetch('/api/v1/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intent.payload)
          });
          var data = await res.json().catch(function () { return {}; });

          if (res.status === 200 || res.status === 201) {
            await window.MkenOfflineStore.removeIntent(intent.localId);
            showNotificationToast('✅ تم تأكيد موعدك بنجاح برقم: ' + (data.id || data.appointmentId || intent.localId));
          } else if (res.status === 409) {
            promptSlotConflictModal(intent, data.suggestedSlots || []);
            break;
          }
        } else if (intent.type === 'order') {
          var ordRes = await fetch('/api/v1/checkout?action=create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intent.payload)
          });
          if (ordRes.ok) {
            await window.MkenOfflineStore.removeIntent(intent.localId);
            showNotificationToast('✅ تم إرسال مسودة طلبك بنجاح!');
          }
        }
      } catch (err) {
        console.warn('[PWA Sync] Pending retry for intent:', intent.localId, err);
      }
    }
  }

  // =========================================================================
  // 5. نافذة الحل التفاعلي لتعارض المواعيد (Slot Contention Resolution Modal)
  // =========================================================================
  function promptSlotConflictModal(intent, suggestions) {
    if (typeof document === 'undefined') return;

    var overlay = document.createElement('div');
    overlay.className = 'booking-modal-overlay';
    overlay.style.cssText =
      'position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999; ' +
      'display: flex; align-items: center; justify-content: center; padding: 20px;';

    var buttonsHtml = (suggestions && suggestions.length)
      ? suggestions.map(function (s) {
          return '<button type="button" class="btn btn--outline btn--sm" data-slot="' + s + '" style="margin: 4px;">' + s + '</button>';
        }).join('')
      : '<p style="color: #64748b; font-size: 0.9rem;">لا تتوفر أوقات بديلة لنفس اليوم. يمكنك اختيار يوم آخر من صفحة الحجز.</p>';

    overlay.innerHTML =
      '<div style="background: #ffffff; padding: 24px; border-radius: 16px; max-width: 420px; width: 100%; text-align: center; direction: rtl; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">' +
      '<div style="font-size: 2.5rem; margin-bottom: 8px;">⏳</div>' +
      '<h3 style="color: #e11d48; margin-top: 0; font-size: 1.2rem;">تنبيه: تعارض في الموعد المختار</h3>' +
      '<p style="font-size: 0.9rem; color: #475569; line-height: 1.5;">الوقت الذي اخترته أثناء انقطاع الاتصال تم حجزه من عميل آخر. اختر أقرب موعد بديل لتثبيته فوراً:</p>' +
      '<div style="margin: 16px 0; display: flex; flex-wrap: wrap; justify-content: center;">' + buttonsHtml + '</div>' +
      '<button type="button" id="btnCancelIntent" class="btn btn--text" style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">إلغاء المسودة</button>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', async function (e) {
      var slotBtn = e.target.closest('[data-slot]');
      if (slotBtn) {
        var newSlot = slotBtn.getAttribute('data-slot');
        intent.payload.time = newSlot;
        overlay.remove();
        await window.MkenOfflineStore.removeIntent(intent.localId);

        fetch('/api/v1/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intent.payload)
        }).then(function () {
          showNotificationToast('✅ تم تأكيد حجزك في الموعد البديل: ' + newSlot);
        });
      } else if (e.target.id === 'btnCancelIntent') {
        await window.MkenOfflineStore.removeIntent(intent.localId);
        overlay.remove();
      }
    });
  }

  function showNotificationToast(msg) {
    if (window.MkenPwa && window.MkenPwa.showLocalNotification) {
      window.MkenPwa.showLocalNotification('منصة مكّن', msg);
    } else {
      alert(msg);
    }
  }

  // =========================================================================
  // 6. تسجيل Service Worker الإنتاجي (Modern Registration)
  // =========================================================================
  function registerModernServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (reg) {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch(function (err) {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // =========================================================================
  // 7. إدارة تثبيت التطبيق وتجربة العميل غير المزعجة (Non-Intrusive PWA UX)
  // =========================================================================
  var PWA_SNOOZE_KEY = 'mken_pwa_install_snoozed_until';
  var PWA_VIEWS_KEY = 'mken_pwa_page_views';
  var DEFAULT_SNOOZE_DAYS = 14;

  function trackPageView() {
    try {
      if (typeof localStorage === 'undefined') return;
      var count = parseInt(localStorage.getItem(PWA_VIEWS_KEY) || '0', 10);
      localStorage.setItem(PWA_VIEWS_KEY, (count + 1).toString());
    } catch (e) { /* ignore private mode restrictions */ }
  }

  function isInstallSnoozed() {
    try {
      if (typeof localStorage === 'undefined') return false;
      var snoozedUntil = localStorage.getItem(PWA_SNOOZE_KEY);
      if (!snoozedUntil) return false;
      return Date.now() < parseInt(snoozedUntil, 10);
    } catch (e) {
      return false;
    }
  }

  function snoozeInstallPrompt(days) {
    var numDays = typeof days === 'number' ? days : DEFAULT_SNOOZE_DAYS;
    try {
      if (typeof localStorage !== 'undefined') {
        var expiry = Date.now() + (numDays * 24 * 60 * 60 * 1000);
        localStorage.setItem(PWA_SNOOZE_KEY, expiry.toString());
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('pwa_banner_dismissed', '1');
      }
    } catch (e) { /* ignore */ }
  }

  function createBanner() {
    if (banner || document.getElementById('pwaInstallBanner')) return;
    banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-banner';
    banner.hidden = true;
    banner.innerHTML =
      '<p><strong>ثبّت التطبيق</strong> — تصفح أسرع وإمكانية الاستخدام دون إنترنت</p>' +
      '<div class="pwa-banner__actions">' +
      '<button type="button" class="btn btn--primary btn--sm" id="pwaInstallBtn">تثبيت</button>' +
      '<button type="button" class="btn btn--outline btn--sm" id="pwaDismissBtn">لاحقاً (إخفاء 14 يوماً)</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('pwaInstallBtn').addEventListener('click', function () {
      promptInstall();
    });
    document.getElementById('pwaDismissBtn').addEventListener('click', function () {
      if (banner) banner.hidden = true;
      snoozeInstallPrompt(DEFAULT_SNOOZE_DAYS);
    });
  }

  function promptInstall() {
    if (!deferredPrompt) {
      return Promise.resolve({ outcome: 'unavailable', message: 'التطبيق مثبت بالفعل أو المتصفح لا يدعم التثبيت المباشر' });
    }
    deferredPrompt.prompt();
    return deferredPrompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === 'accepted') {
        deferredPrompt = null;
        if (banner) banner.hidden = true;
      }
      return choice;
    }).catch(function (err) {
      console.warn('[PWA] Prompt error:', err);
      return { outcome: 'dismissed', error: err };
    });
  }

  function maybeShowBanner(force) {
    if (!deferredPrompt) return;
    if (!force) {
      // 1. فحص فترة التهدئة المؤقتة (14 يوماً بعد الرفض)
      if (isInstallSnoozed()) return;

      // 2. التحقق من مؤشر التفاعل الحقيقي (عدم إزعاج الزائر في الزيارة الأولى)
      try {
        if (typeof localStorage !== 'undefined') {
          var views = parseInt(localStorage.getItem(PWA_VIEWS_KEY) || '0', 10);
          if (views < 2) return;
        }
      } catch (e) {
        return;
      }
    }
    createBanner();
    if (banner) banner.hidden = false;
  }

  function bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      maybeShowBanner();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      if (banner) banner.hidden = true;
    });
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
  }

  // بدء تشغيل النظام وتسجيل مؤشر التفاعل
  trackPageView();
  registerModernServiceWorker();
  bindInstallPrompt();

  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);
  window.addEventListener('load', function () {
    if (!navigator.onLine) {
      renderOfflineTopBanner(true);
    }
  });

  var pwaApi = {
    requestNotificationPermission: requestNotificationPermission,
    isOnline: function () { return isCurrentlyOnline; },
    verifyRealInternet: verifyRealInternet,
    replayPendingIntents: replayPendingIntents,
    promptInstall: promptInstall,
    maybeShowBanner: maybeShowBanner,
    snoozeInstallPrompt: snoozeInstallPrompt,
    isInstallSnoozed: isInstallSnoozed,
    trackPageView: trackPageView,
    canInstall: function () { return !!deferredPrompt; },
    getPageViewCount: function () {
      try {
        return parseInt(localStorage.getItem(PWA_VIEWS_KEY) || '0', 10);
      } catch (e) { return 0; }
    },
    showLocalNotification: function (title, body, tag) {
      if (!('Notification' in window) || Notification.permission !== 'granted') return false;
      try {
        var n = new Notification(title, {
          body: body,
          icon: '/assets/logo.svg',
          tag: tag || 'mken-local',
          dir: 'rtl',
          lang: 'ar',
        });
        n.onclick = function () {
          window.focus();
          n.close();
        };
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  window.MkenPwa = pwaApi;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = pwaApi;
  }
})();
