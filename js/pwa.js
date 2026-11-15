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
  var isInstallInProgress = false;

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

  function isMobileOrTabletDevice() {
    if (typeof window === 'undefined') return false;
    var nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : (typeof navigator !== 'undefined' ? navigator : {});
    var isMobileUA = false;
    if (nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') {
      isMobileUA = nav.userAgentData.mobile;
    } else if (nav.userAgent) {
      isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(nav.userAgent);
    }

    var hasTouch = (nav.maxTouchPoints && nav.maxTouchPoints > 0);
    var hasCoarse = false;
    if (window.matchMedia) {
      try {
        hasCoarse = window.matchMedia('(pointer: coarse)').matches;
      } catch (e) { /* ignore */ }
    }

    var isNarrow = (typeof window.innerWidth === 'number' && window.innerWidth > 0 && window.innerWidth <= 1024);
    return isMobileUA || (hasTouch && isNarrow) || (hasCoarse && isNarrow);
  }

  function isDesktopTargetedApp() {
    if (typeof window === 'undefined') return false;
    if (window.MkenConfig && window.MkenConfig.pwa && typeof window.MkenConfig.pwa.desktopOnly === 'boolean') {
      return window.MkenConfig.pwa.desktopOnly;
    }
    var path = (window.location && window.location.pathname) || '';
    if (path.indexOf('/admin') !== -1 || path.indexOf('admin.html') !== -1) {
      return true;
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      var target = document.documentElement.getAttribute('data-target-platform') || document.documentElement.getAttribute('data-app');
      if (target === 'desktop') return true;
    }
    return true; // التطبيق المكتبي الافتراضي
  }

  function dismissBannerPermanently(days) {
    if (banner) {
      banner.hidden = true;
      if (typeof banner.remove === 'function') {
        banner.remove();
      }
      banner = null;
    }
    var domBanner = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('pwaInstallBanner') : null;
    if (domBanner && typeof domBanner.remove === 'function') {
      domBanner.remove();
    }
    snoozeInstallPrompt(typeof days === 'number' ? days : DEFAULT_SNOOZE_DAYS);
  }

  function showPwaToast(message) {
    if (typeof document === 'undefined') return;
    var toast = document.createElement('div');
    toast.className = 'pwa-status-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast) {
        toast.style.opacity = '0';
        setTimeout(function () {
          if (typeof toast.remove === 'function') toast.remove();
        }, 400);
      }
    }, 3500);
  }

  function triggerDirectDesktopDownload() {
    showPwaToast('⚡ جاري بدء تنزيل برنامج الكمبيوتر...');
    dismissBannerPermanently(30);

    if (typeof document === 'undefined') return;
    try {
      var a = document.createElement('a');
      a.href = '/download/mken-desktop-setup.exe';
      a.setAttribute('download', 'mken-desktop-setup.exe');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (typeof a.remove === 'function') a.remove();
      }, 1000);
    } catch (e) {
      console.log('[PWA] Direct desktop download triggered');
    }
  }

  function createBanner() {
    if (banner || (typeof document !== 'undefined' && document.getElementById('pwaInstallBanner'))) return;
    if (typeof document === 'undefined') return;

    banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-banner';
    banner.hidden = true;
    banner.innerHTML =
      '<p><strong>برنامج الكمبيوتر</strong> — تثبيت التطبيق أو التنزيل المباشر لجهازك</p>' +
      '<div class="pwa-banner__actions">' +
      '<button type="button" class="btn btn--primary btn--sm" id="pwaInstallBtn">تثبيت / تنزيل</button>' +
      '<button type="button" class="btn btn--outline btn--sm" id="pwaDismissBtn">لاحقاً</button>' +
      '</div>';
    document.body.appendChild(banner);

    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        promptInstall();
      });
    }

    var dismissBtn = document.getElementById('pwaDismissBtn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        dismissBannerPermanently(DEFAULT_SNOOZE_DAYS);
      });
    }
  }

  async function promptInstall() {
    if (isInstallInProgress) return Promise.resolve({ outcome: 'busy' });

    var installBtn = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('pwaInstallBtn') : null;
    var originalBtnText = installBtn ? installBtn.textContent : 'تثبيت / تنزيل';

    isInstallInProgress = true;
    if (installBtn) {
      installBtn.disabled = true;
      installBtn.textContent = 'جاري التجهيز...';
    }

    // مؤقت أمان لضمان عدم بقاء الزر معطلاً إطلاقاً
    var safetyTimer = setTimeout(function () {
      if (installBtn) {
        installBtn.disabled = false;
        installBtn.textContent = originalBtnText;
      }
      isInstallInProgress = false;
      dismissBannerPermanently(14);
    }, 4000);

    try {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        var choice = await Promise.race([
          deferredPrompt.userChoice,
          new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('timeout')); }, 3500);
          })
        ]);

        if (choice && choice.outcome === 'accepted') {
          showPwaToast('✅ تم تثبيت التطبيق بنجاح على جهازك!');
          deferredPrompt = null;
          dismissBannerPermanently(30);
          return { outcome: 'accepted' };
        } else {
          showPwaToast('تم إلغاء التثبيت. يمكنك إضافته لاحقاً من شريط المتصفح.');
          dismissBannerPermanently(14);
          return { outcome: 'dismissed' };
        }
      }

      // المسار البديل عند تعذر التثبيت التلقائي: التنزيل المباشر لبرنامج الكمبيوتر
      triggerDirectDesktopDownload();
      return { outcome: 'direct_download' };

    } catch (err) {
      console.warn('[PWA] Prompt fallback to direct download:', err);
      triggerDirectDesktopDownload();
      return { outcome: 'fallback', error: err };
    } finally {
      clearTimeout(safetyTimer);
      if (installBtn) {
        installBtn.disabled = false;
        installBtn.textContent = originalBtnText;
      }
      isInstallInProgress = false;
      dismissBannerPermanently(14);
    }
  }

  function maybeShowBanner(force) {
    // 1. فحص الجوال: كبح البانر فوراً على شاشات الجوال للتطبيقات الموجهة للكمبيوتر
    if (isMobileOrTabletDevice() && isDesktopTargetedApp()) {
      dismissBannerPermanently(30);
      return;
    }

    if (!deferredPrompt && !force) return;

    if (!force) {
      // 2. فحص فترة التهدئة المؤقتة (14 يوماً بعد الرفض)
      if (isInstallSnoozed()) return;

      // 3. التحقق من مؤشر التفاعل الحقيقي (عدم إزعاج الزائر في الزيارة الأولى)
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
      dismissBannerPermanently(30);
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
    dismissBannerPermanently: dismissBannerPermanently,
    isMobileOrTabletDevice: isMobileOrTabletDevice,
    triggerDirectDesktopDownload: triggerDirectDesktopDownload,
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
