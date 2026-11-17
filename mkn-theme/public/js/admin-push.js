/**
 * إعدادات Web Push في لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  var pushApi = window.MkenPushSubscribe;
  if (!store || !pushApi) return;

  var pushEnabled = document.getElementById('pushEnabled');
  var vapidPublicKeyInput = document.getElementById('vapidPublicKeyInput');
  var savePushBtn = document.getElementById('savePushSettingsBtn');
  var subscribePushBtn = document.getElementById('subscribePushBtn');
  var exportPushBtn = document.getElementById('exportPushSubsBtn');
  var testPushBtn = document.getElementById('testPushBtn');
  var pushStatus = document.getElementById('pushStatus');

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function loadPushSettings() {
    var cfg = store.loadConfig();
    var push = cfg.push || {};
    if (pushEnabled) pushEnabled.checked = !!push.enabled;
    if (vapidPublicKeyInput) vapidPublicKeyInput.value = push.vapidPublicKey || '';
    updatePushStatus(cfg);
  }

  function updatePushStatus(cfg) {
    if (!pushStatus) return;
    cfg = cfg || store.loadConfig();
    var subs = pushApi.getSubscriptions().length;
    if (!pushApi.isConfigured(cfg)) {
      pushStatus.textContent = 'فعّل Push وأدخل VAPID Public Key — أنشئ المفاتيح: npx web-push generate-vapid-keys';
      return;
    }
    pushStatus.textContent = subs
      ? subs + ' جهاز مشترك — يُزامَن تلقائياً مع السيرفر عند الاشتراك'
      : 'Push مفعّل — اضغط «اشتراك هذا الجهاز» ثم «اختبار Push»';
  }

  function savePushSettings() {
    var cfg = store.loadConfig();
    cfg.push = {
      enabled: pushEnabled ? pushEnabled.checked : false,
      vapidPublicKey: vapidPublicKeyInput ? vapidPublicKeyInput.value.trim() : '',
    };
    store.saveConfig(cfg);
    updatePushStatus(cfg);
    toast('تم حفظ إعدادات Push');
  }

  function bindEvents() {
    if (savePushBtn) savePushBtn.addEventListener('click', savePushSettings);
    if (subscribePushBtn) {
      subscribePushBtn.addEventListener('click', function () {
        var cfg = store.loadConfig();
        pushApi.subscribePush(cfg).then(function (sub) {
          updatePushStatus(cfg);
          if (sub && sub._serverSynced === false) {
            toast('تم الاشتراك محلياً — تعذّر المزامنة مع السيرفر (تحقق من Supabase)', 'error');
            return;
          }
          toast('تم الاشتراك في Push على هذا الجهاز');
        }).catch(function (err) {
          var msg = err && err.message;
          if (msg === 'push-not-configured') toast('فعّل Push وأدخل VAPID Public Key أولاً', 'error');
          else if (msg === 'permission-denied') toast('تم رفض الإشعارات', 'error');
          else if (msg === 'push-unsupported') toast('المتصفح لا يدعم Push', 'error');
          else toast('فشل الاشتراك في Push', 'error');
        });
      });
    }
    if (testPushBtn) {
      testPushBtn.addEventListener('click', function () {
        var cfg = store.loadConfig();
        if (!pushApi.isConfigured(cfg)) {
          toast('احفظ إعدادات Push أولاً', 'error');
          return;
        }
        testPushBtn.disabled = true;
        fetch('/api/v1/push-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: store.getCurrentTenantSlug ? store.getCurrentTenantSlug() : 'default',
          }),
        }).then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        }).then(function (result) {
          if (result.ok) {
            toast('تم إرسال إشعار الاختبار — تحقق من شريط الإشعارات');
            return;
          }
          var errMsg = (result.data && result.data.error) || 'فشل إرسال الاختبار';
          if (errMsg.indexOf('no-subscriptions') !== -1 || errMsg.indexOf('اشتراكات') !== -1) {
            toast('اشترك هذا الجهاز أولاً', 'error');
          } else if (errMsg.indexOf('VAPID') !== -1) {
            toast('أضف VAPID_PRIVATE_KEY في Vercel ثم أعد النشر', 'error');
          } else {
            toast(errMsg, 'error');
          }
        }).catch(function () {
          toast('فشل الاتصال بـ API', 'error');
        }).finally(function () {
          testPushBtn.disabled = false;
        });
      });
    }
    if (exportPushBtn) {
      exportPushBtn.addEventListener('click', function () {
        if (!pushApi.getSubscriptions().length) {
          toast('لا توجد اشتراكات — اشترك من هذا الجهاز أولاً', 'error');
          return;
        }
        pushApi.exportSubscriptionsFile();
        toast('تم تنزيل push-subscriptions.json');
      });
    }
  }

  store.init().then(function () {
    loadPushSettings();
    bindEvents();
  });
})();
