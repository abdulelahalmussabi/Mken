/**
 * الفوترة وتكامل المطورين (Public API & SaaS Billing) — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var apiKeysList = document.getElementById('apiKeysList');
  var generateApiKeyBtn = document.getElementById('generateApiKeyBtn');
  var saasInvoicesList = document.getElementById('saasInvoicesList');
  var renewSubMoyasarBtn = document.getElementById('renewSubMoyasarBtn');
  var renewSubManualBtn = document.getElementById('renewSubManualBtn');
  var cancelSaasPaymentBtn = document.getElementById('cancelSaasPaymentBtn');
  var saasPaymentBlock = document.getElementById('saasPaymentBlock');

  // Google Business DOM elements
  var googleBusinessLoading = document.getElementById('googleBusinessLoading');
  var googleBusinessDisconnected = document.getElementById('googleBusinessDisconnected');
  var googleBusinessConnected = document.getElementById('googleBusinessConnected');
  var googleBusinessConnectBtn = document.getElementById('googleBusinessConnectBtn');
  var googleBusinessLocationSelect = document.getElementById('googleBusinessLocationSelect');
  var googleBusinessUrlPreviewBlock = document.getElementById('googleBusinessUrlPreviewBlock');
  var googleBusinessUrlPreview = document.getElementById('googleBusinessUrlPreview');
  var googleBusinessUpdateBtn = document.getElementById('googleBusinessUpdateBtn');
  var googleBusinessSyncServicesBtn = document.getElementById('googleBusinessSyncServicesBtn');
  var googleBusinessDisconnectBtn = document.getElementById('googleBusinessDisconnectBtn');

  var _apiKeys = [];
  var _invoices = [];

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('ar-SA');
    } catch (e) {
      return isoString;
    }
  }

  // --- API Key Management ---
  function generateRandomApiKey() {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var rand = '';
    for (var i = 0; i < 32; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'mken_live_' + rand;
  }

  function loadApiKeys() {
    if (apiKeysList) apiKeysList.innerHTML = '<p class="admin-hint">جاري تحميل المفاتيح...</p>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchApiKeys(tenantSlug)
        .then(function (keys) {
          _apiKeys = keys;
          renderApiKeys();
        })
        .catch(function (err) {
          console.warn('Failed to load api keys from Supabase', err);
          loadLocalApiKeys();
        });
    } else {
      loadLocalApiKeys();
    }
  }

  function loadLocalApiKeys() {
    try {
      var raw = localStorage.getItem('mken_mken_apikeys');
      _apiKeys = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _apiKeys = [];
    }
    renderApiKeys();
  }

  function renderApiKeys() {
    if (!apiKeysList) return;
    if (!_apiKeys.length) {
      apiKeysList.innerHTML = '<p class="admin-hint" style="padding:10px 0;">لا توجد مفاتيح نشطة. قم بتوليد مفتاح للربط.</p>';
      return;
    }

    var html = _apiKeys.map(function (k) {
      var masked = k.apiKey.slice(0, 14) + '...' + k.apiKey.slice(-6);
      return (
        '<div style="display:flex; justify-content:space-between; align-items:center; background:#faf8f5; border:1px solid var(--color-border); padding:10px 12px; border-radius:4px; margin-bottom:8px;">' +
        '  <div>' +
        '    <strong>' + esc(k.keyName) + '</strong><br>' +
        '    <code style="font-size:0.82rem; color:var(--color-primary); font-family:monospace; font-weight:bold;">' + esc(masked) + '</code>' +
        '    <button type="button" class="btn btn--outline btn--sm" data-copy-key="' + esc(k.apiKey) + '" style="padding:1px 6px; font-size:0.75rem; margin-right:8px;">نسخ</button>' +
        '  </div>' +
        '  <button type="button" class="btn btn--outline btn--sm" data-revoke-key="' + k.id + '" style="color:#c0392b; border-color:#c0392b15; padding:4px 8px;">إلغاء المفتاح</button>' +
        '</div>'
      );
    }).join('');

    apiKeysList.innerHTML = html;

    // Copy actions
    apiKeysList.querySelectorAll('[data-copy-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-copy-key');
        navigator.clipboard.writeText(key).then(function () {
          btn.textContent = 'تم النسخ';
          setTimeout(function () { btn.textContent = 'نسخ'; }, 1500);
        });
      });
    });

    // Revoke actions
    apiKeysList.querySelectorAll('[data-revoke-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-revoke-key');
        if (confirm('هل أنت متأكد من إلغاء/حذف مفتاح الـ API هذا؟ لن تتمكن التطبيقات الخارجية المتصلة به من الوصول للمنصة.')) {
          revokeApiKey(id);
        }
      });
    });
  }

  function generateApiKey() {
    var name = prompt('أدخل اسماً توضيحياً للمفتاح الجديد (مثال: نظام الكاشير أو موقع الووردبريس):');
    if (!name) return;
    name = name.trim();

    var keyVal = generateRandomApiKey();
    var keyObj = {
      id: 'key_' + Date.now().toString(36),
      keyName: name,
      apiKey: keyVal,
      tenantSlug: store.getCurrentTenantSlug() || 'default',
      createdAt: new Date().toISOString()
    };

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.saveApiKey(keyObj, tenantSlug)
        .then(function () {
          toast('تم توليد مفتاح الـ API بنجاح سحابياً');
          loadApiKeys();
        })
        .catch(function (err) {
          toast('فشل حفظ مفتاح الـ API سحابياً: ' + err.message, 'error');
        });
    } else {
      _apiKeys.push(keyObj);
      localStorage.setItem('mken_mken_apikeys', JSON.stringify(_apiKeys));
      toast('تم التوليد والحفظ محلياً بنجاح');
      renderApiKeys();
    }
  }

  function revokeApiKey(id) {
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      window.MkenSupabaseDb.deleteApiKey(id)
        .then(function () {
          toast('تم إلغاء مفتاح الـ API بنجاح');
          loadApiKeys();
        })
        .catch(function (err) {
          toast('فشل إلغاء المفتاح سحابياً: ' + err.message, 'error');
        });
    } else {
      _apiKeys = _apiKeys.filter(function (k) { return k.id !== id; });
      localStorage.setItem('mken_mken_apikeys', JSON.stringify(_apiKeys));
      toast('تم الإلغاء محلياً');
      renderApiKeys();
    }
  }

  // --- SaaS Invoices & Billing ---
  function loadInvoices() {
    if (saasInvoicesList) {
      saasInvoicesList.innerHTML = '<tr><td colspan="5" class="admin-hint" style="text-align:center; padding:15px;">جاري تحميل سجل الفواتير...</td></tr>';
    }

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchInvoices(tenantSlug)
        .then(function (invoices) {
          _invoices = invoices;
          localStorage.setItem('mken_mken_invoices', JSON.stringify(invoices));
          renderInvoices();
        })
        .catch(function (err) {
          console.warn('Failed to load invoices from Supabase', err);
          loadLocalInvoices();
        });
    } else {
      loadLocalInvoices();
    }
  }

  function loadLocalInvoices() {
    try {
      var raw = localStorage.getItem('mken_mken_invoices');
      _invoices = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _invoices = [];
    }
    renderInvoices();
  }

  function renderInvoices() {
    if (!saasInvoicesList) return;
    if (!_invoices.length) {
      saasInvoicesList.innerHTML = '<tr><td colspan="5" class="admin-hint" style="text-align:center; padding:15px;">لا توجد فواتير سابقة.</td></tr>';
      return;
    }

    var html = _invoices.map(function (inv) {
      var statusColor = '#777';
      var statusText = 'غير مدفوعة';
      if (inv.status === 'paid') { statusColor = '#2e7d32'; statusText = 'مدفوعة'; }
      else if (inv.status === 'failed') { statusColor = '#c0392b'; statusText = 'فشلت'; }

      var pMethod = inv.paymentMethod ? ' (' + inv.paymentMethod + ')' : '';

      return (
        '<tr style="border-bottom:1px solid var(--color-border);">' +
        '  <td style="padding:10px; font-family:monospace; font-weight:bold;">' + esc(inv.paymentId || inv.id) + pMethod + '</td>' +
        '  <td style="padding:10px; font-weight:bold;">' + inv.amount + ' ريال</td>' +
        '  <td style="padding:10px;">' + inv.months + ' أشهر</td>' +
        '  <td style="padding:10px;"><span style="color:' + statusColor + '; font-weight:bold;">' + statusText + '</span></td>' +
        '  <td style="padding:10px; direction:ltr;">' + formatDate(inv.createdAt) + '</td>' +
        '</tr>'
      );
    }).join('');

    saasInvoicesList.innerHTML = html;
  }

  function getSaaSPrice(months) {
    if (months === 1) return 99;
    if (months === 3) return 249;
    if (months === 6) return 449;
    return 799; // 12 months default
  }

  // --- SaaS Online Payment via Moyasar ---
  function initSaaSPayment() {
    var select = document.getElementById('renewMonthsSelect');
    var months = select ? parseInt(select.value, 10) : 12;
    var tenantSlug = store.getCurrentTenantSlug();

    if (!tenantSlug) {
      toast('يرجى تسجيل الدخول كمستأجر سحابي أولاً للتجديد.', 'error');
      return;
    }

    var amount = getSaaSPrice(months);

    // Retrieve master publishable key from default tenant config if possible
    var masterPublishableKey = '';
    try {
      // Moyasar key is loaded from MkenServicesStore configurations
      var raw = localStorage.getItem('mken_platform_config');
      if (raw) {
        var parsed = JSON.parse(raw);
        // Fallback to local storage config or use the public publishable key configured in database
        masterPublishableKey = (parsed.payment && parsed.payment.publishableKey) || '';
      }
    } catch (e) { /* ignore */ }

    if (!masterPublishableKey && window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      // Fetch default config dynamically
      window.MkenSupabaseDb.fetchConfig('default')
        .then(function (defConfig) {
          var pKey = defConfig && defConfig.payment && defConfig.payment.publishableKey;
          if (pKey) {
            setupMoyasarSaaS(pKey, amount, months, tenantSlug);
          } else {
            // If master key is not defined, offer dummy success for test
            toast('مفتاح الدفع غير مهيأ للموقع الرئيسي. سيتم الدفع التجريبي والتجديد المباشر.', 'warning');
            processManualRenewal(months);
          }
        })
        .catch(function () {
          processManualRenewal(months);
        });
    } else if (masterPublishableKey) {
      setupMoyasarSaaS(masterPublishableKey, amount, months, tenantSlug);
    } else {
      processManualRenewal(months);
    }
  }

  function setupMoyasarSaaS(publishableKey, amount, months, tenantSlug) {
    if (!window.Moyasar) {
      toast('بوابة الدفع Moyasar غير محملة حالياً.', 'error');
      return;
    }

    if (saasPaymentBlock) saasPaymentBlock.hidden = false;

    var amtLabel = document.getElementById('saasPaymentAmountLabel');
    if (amtLabel) {
      amtLabel.textContent = 'إجمالي تكلفة تجديد الاشتراك المستحقة: ' + amount + ' SAR';
    }

    var callbackUrl = window.location.origin + window.location.pathname + 
                      '?saas_callback=1&tenant=' + encodeURIComponent(tenantSlug) + 
                      '&months=' + months;

    var formContainer = document.getElementById('saasMoyasarForm');
    if (formContainer) formContainer.innerHTML = '';

    window.Moyasar.init({
      element: '#saasMoyasarForm',
      amount: Math.round(amount * 100),
      currency: 'SAR',
      description: 'تجديد اشتراك منصة مكِّن: ' + tenantSlug + ' - ' + months + ' شهر',
      publishable_api_key: publishableKey,
      callback_url: callbackUrl,
      methods: ['creditcard', 'mada', 'applepay'],
      metadata: {
        type: 'saas_billing',
        tenant_slug: tenantSlug,
        months: months
      },
      on_completed: function (payment) {
        // Fallback local verify if redirection doesn't trigger
        handleSaaSPaymentSuccess(tenantSlug, months, payment);
      }
    });
  }

  function handleSaaSPaymentSuccess(tenantSlug, months, payment) {
    var invId = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    var invoice = {
      id: invId,
      tenantSlug: tenantSlug,
      amount: payment.amount ? (payment.amount / 100) : getSaaSPrice(months),
      months: months,
      status: 'paid',
      paymentId: payment.id,
      paymentMethod: payment.source ? (payment.source.company || payment.source.type) : 'online',
      createdAt: new Date().toISOString()
    };

    // Save invoice
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      window.MkenSupabaseDb.saveInvoice(invoice, tenantSlug)
        .then(function () {
          // Renew subscription in Database
          return store.renewSubscription(tenantSlug, months);
        })
        .then(function () {
          toast('تم سداد الفاتورة وتمديد اشتراكك بنجاح! 🎉');
          if (saasPaymentBlock) saasPaymentBlock.hidden = true;
          loadInvoices();
          // Reload page without query params
          setTimeout(function () {
            window.location.href = window.location.pathname;
          }, 2000);
        })
        .catch(function (err) {
          toast('فشل تحديث الاشتراك السحابي: ' + err.message, 'error');
        });
    } else {
      // Local fallback
      _invoices.unshift(invoice);
      localStorage.setItem('mken_mken_invoices', JSON.stringify(_invoices));
      store.renewSubscription(tenantSlug, months)
        .then(function () {
          toast('تم الدفع والتجديد محلياً بنجاح!');
          if (saasPaymentBlock) saasPaymentBlock.hidden = true;
          renderInvoices();
        });
    }
  }

  function processManualRenewal(months) {
    var tenantSlug = store.getCurrentTenantSlug();
    if (!tenantSlug) {
      toast('يرجى تسجيل الدخول كمستأجر أولاً للتجديد.', 'error');
      return;
    }

    var isSuperAdmin = !tenantSlug || tenantSlug === 'default';
    if (!isSuperAdmin) {
      toast('التجديد اليدوي غير متاح لحسابات العملاء. يرجى الدفع عبر نظام سداد Moyasar.', 'error');
      return;
    }

    var renewBtn = document.getElementById('renewSubManualBtn');
    if (renewBtn) {
      renewBtn.disabled = true;
      renewBtn.textContent = 'جاري التجديد...';
    }

    store.renewSubscription(tenantSlug, months)
      .then(function () {
        if (renewBtn) {
          renewBtn.disabled = false;
          renewBtn.textContent = '🔄 تجديد يدوي (للتجربة)';
        }

        // Log manual invoice
        var invId = 'inv_man_' + Date.now().toString(36);
        var invoice = {
          id: invId,
          tenantSlug: tenantSlug,
          amount: 0,
          months: months,
          status: 'paid',
          paymentId: invId,
          paymentMethod: 'manual_free',
          createdAt: new Date().toISOString()
        };

        if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
          window.MkenSupabaseDb.saveInvoice(invoice, tenantSlug).then(loadInvoices);
        } else {
          _invoices.unshift(invoice);
          localStorage.setItem('mken_mken_invoices', JSON.stringify(_invoices));
          renderInvoices();
        }

        toast('تم تجديد الاشتراك يدوياً وبالمجان بنجاح! 🎉');
        // Trigger render panel to reload subscription status label
        if (window.MkenAdminPanelReload) window.MkenAdminPanelReload();
      })
      .catch(function (err) {
        if (renewBtn) {
          renewBtn.disabled = false;
          renewBtn.textContent = '🔄 تجديد يدوي (للتجربة)';
        }
        toast('فشل التجديد اليدوي: ' + err.message, 'error');
      });
  }

  // --- Google Business Profile Integration ---
  function getGoogleBusinessTenantSlug() {
    return store.getCurrentTenantSlug() || 'default';
  }

  function getBrandName() {
    var cfg = store.loadConfig() || {};
    return (cfg.brand && cfg.brand.name) || 'نشاطنا التجاري';
  }

  function getGbpAiAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    var pin = sessionStorage.getItem('mken_admin_pin');
    if (pin) {
      headers['X-Admin-Pin'] = pin;
      return Promise.resolve(headers);
    }
    var db = window.MkenSupabaseDb;
    if (db && db.isConfigured && db.isConfigured()) {
      var client = db.getClient();
      if (client && client.auth && client.auth.getSession) {
        return client.auth.getSession().then(function (result) {
          var session = result.data && result.data.session;
          if (session && session.access_token) {
            headers['Authorization'] = 'Bearer ' + session.access_token;
          }
          return headers;
        });
      }
    }
    return Promise.resolve(headers);
  }

  function handleGbpAiAuthFailure(err) {
    if (err && err.status === 401) {
      sessionStorage.removeItem('mken_admin_pin');
      toast('انتهت صلاحية الدخول — أعد تسجيل الدخول للوحة الإدارة', 'error');
      return;
    }
    if (err && err.status === 429) {
      toast(err.message || 'تم تجاوز حد طلبات الذكاء الاصطناعي. حاول لاحقاً.', 'warning');
      return;
    }
    toast('خطأ في التوليد: ' + (err.message || String(err)), 'error');
  }

  function parseGbpAiResponse(res) {
    return res.json().then(function (data) {
      if (!res.ok) {
        var err = new Error(data.error || 'فشل التوليد');
        err.status = res.status;
        throw err;
      }
      return data;
    });
  }

  function showGbpAiSection() {
    var aiSection = document.getElementById('googleBusinessAiSection');
    if (aiSection) aiSection.hidden = false;
    populateAiServicesDropdown();
  }

  function updateReviewLinkDisplay(reviewUrl) {
    var reviewUrlBlock = document.getElementById('googleBusinessReviewUrlBlock');
    var reviewUrlInput = document.getElementById('googleBusinessReviewUrl');
    
    var url = reviewUrl;
    if (!url) {
      var cfg = store.loadConfig() || {};
      url = cfg.googleBusiness && cfg.googleBusiness.reviewUrl;
    }
    
    if (url) {
      if (reviewUrlInput) reviewUrlInput.value = url;
      if (reviewUrlBlock) reviewUrlBlock.hidden = false;
    } else {
      if (reviewUrlBlock) reviewUrlBlock.hidden = true;
    }
  }

  function checkGoogleBusinessStatus() {
    var tenantSlug = getGoogleBusinessTenantSlug();

    if (googleBusinessLoading) {
      googleBusinessLoading.textContent = 'جاري التحقق من حالة الربط...';
      googleBusinessLoading.hidden = false;
    }
    if (googleBusinessDisconnected) googleBusinessDisconnected.hidden = true;
    if (googleBusinessConnected) googleBusinessConnected.hidden = true;

    fetch('/api/google-business/locations?tenant=' + encodeURIComponent(tenantSlug))
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات الربط');
          return data;
        });
      })
      .then(function (data) {
        if (googleBusinessLoading) googleBusinessLoading.hidden = true;

        if (data.connected === false) {
          if (googleBusinessDisconnected) googleBusinessDisconnected.hidden = false;
        } else if (data.connected === true) {
          if (googleBusinessConnected) googleBusinessConnected.hidden = false;

          // Populate select
          if (googleBusinessLocationSelect) {
            googleBusinessLocationSelect.innerHTML = '<option value="">-- اختر الفرع لربطه --</option>';
            data.locations.forEach(function (loc) {
              var opt = document.createElement('option');
              opt.value = loc.id;
              opt.textContent = loc.title + ' (' + (loc.websiteUri || 'لا يوجد رابط موقع') + ')';
              opt.setAttribute('data-review-url', loc.newReviewUrl || '');
              opt.setAttribute('data-maps-uri', loc.mapsUri || '');
              opt.setAttribute('data-place-id', loc.placeId || '');
              opt.setAttribute('data-lat', loc.lat || '');
              opt.setAttribute('data-lng', loc.lng || '');
              opt.setAttribute('data-city', loc.city || '');
              if (data.selectedLocationId === loc.id) {
                opt.selected = true;
              }
              googleBusinessLocationSelect.appendChild(opt);
            });
          }

          // Render website preview url
          var activeSiteUrl = store.buildTenantSiteUrl(tenantSlug);
          if (googleBusinessUrlPreview) {
            googleBusinessUrlPreview.textContent = activeSiteUrl;
          }
          if (googleBusinessUrlPreviewBlock) {
            googleBusinessUrlPreviewBlock.hidden = false;
          }

          updateReviewLinkDisplay();
        }

        showGbpAiSection();
      })
      .catch(function (err) {
        console.error(err);
        if (googleBusinessLoading) googleBusinessLoading.hidden = true;
        if (googleBusinessDisconnected) googleBusinessDisconnected.hidden = false;
        showGbpAiSection();
        if (googleBusinessLoading) {
          googleBusinessLoading.textContent = 'تعذّر فحص الربط — AI Copilot متاح بدون ربط جوجل.';
        }
      });
  }

  function connectGoogleBusiness() {
    var tenantSlug = getGoogleBusinessTenantSlug();

    if (googleBusinessConnectBtn) {
      googleBusinessConnectBtn.disabled = true;
      googleBusinessConnectBtn.textContent = 'جاري توليد الرابط...';
    }

    fetch('/api/google-business/auth-url?tenant=' + encodeURIComponent(tenantSlug))
      .then(function (res) {
        if (!res.ok) throw new Error('فشل توليد رابط الربط');
        return res.json();
      })
      .then(function (data) {
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('لم يتم استلام رابط صالح');
        }
      })
      .catch(function (err) {
        if (googleBusinessConnectBtn) {
          googleBusinessConnectBtn.disabled = false;
          googleBusinessConnectBtn.textContent = '🔗 ربط بحساب جوجل (Connect Google Account)';
        }
        toast(err.message, 'error');
      });
  }

  function updateGoogleBusinessWebsite() {
    var tenantSlug = getGoogleBusinessTenantSlug();
    if (!googleBusinessLocationSelect) return;

    var locId = googleBusinessLocationSelect.value;
    if (!locId) {
      toast('يرجى اختيار فرع/نشاط أولاً من القائمة', 'warning');
      return;
    }

    var websiteUrl = store.buildTenantSiteUrl(tenantSlug);

    if (googleBusinessUpdateBtn) {
      googleBusinessUpdateBtn.disabled = true;
      googleBusinessUpdateBtn.textContent = 'جاري التحديث...';
    }

    fetch('/api/google-business/update-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenantSlug,
        locationId: locId,
        websiteUrl: websiteUrl
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'فشل التحديث');
          return data;
        });
      })
      .then(function () {
        toast('تم تحديث رابط موقعك بنجاح على خرائط جوجل!', 'success');
        checkGoogleBusinessStatus();
      })
      .catch(function (err) {
        toast('فشل التحديث: ' + err.message, 'error');
      })
      .finally(function () {
        if (googleBusinessUpdateBtn) {
          googleBusinessUpdateBtn.disabled = false;
          googleBusinessUpdateBtn.textContent = '🔄 تحديث رابط الموقع على خرائط جوجل';
        }
      });
  }

  function disconnectGoogleBusiness() {
    var tenantSlug = getGoogleBusinessTenantSlug();

    if (!confirm('هل أنت متأكد من رغبتك في إلغاء ربط حساب جوجل بيزنس بالكامل؟')) return;

    if (googleBusinessDisconnectBtn) {
      googleBusinessDisconnectBtn.disabled = true;
      googleBusinessDisconnectBtn.textContent = 'جاري إلغاء الربط...';
    }

    fetch('/api/google-business/update-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenantSlug,
        action: 'disconnect'
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('فشل إلغاء الربط');
        return res.json();
      })
      .then(function () {
        toast('تم إلغاء ربط حساب جوجل بيزنس بنجاح!', 'success');
        checkGoogleBusinessStatus();
      })
      .catch(function (err) {
        toast(err.message, 'error');
      })
      .finally(function () {
        if (googleBusinessDisconnectBtn) {
          googleBusinessDisconnectBtn.disabled = false;
          googleBusinessDisconnectBtn.textContent = 'إلغاء الربط';
        }
      });
  }

  function syncGoogleBusinessServices() {
    var tenantSlug = getGoogleBusinessTenantSlug();
    if (!googleBusinessLocationSelect) return;

    var locId = googleBusinessLocationSelect.value;
    if (!locId) {
      toast('يرجى اختيار فرع/نشاط أولاً من القائمة', 'warning');
      return;
    }

    var enabledServices = store.getEnabledServices();
    if (!enabledServices || enabledServices.length === 0) {
      toast('لا توجد أي خدمات مفعّلة حالياً على منصة مكّن لمزامنتها!', 'warning');
      return;
    }

    // Format services payload for the backend API
    var servicesPayload = enabledServices.map(function (svc) {
      return {
        title: svc.title || '',
        description: svc.description || ''
      };
    });

    if (googleBusinessSyncServicesBtn) {
      googleBusinessSyncServicesBtn.disabled = true;
      googleBusinessSyncServicesBtn.textContent = 'جاري المزامنة...';
    }

    fetch('/api/google-business/sync-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenantSlug,
        locationId: locId,
        services: servicesPayload
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'فشل مزامنة الخدمات');
          return data;
        });
      })
      .then(function () {
        toast('تمت مزامنة قائمة خدماتك بنجاح على بروفايل جوجل!', 'success');
      })
      .catch(function (err) {
        toast('فشل المزامنة: ' + err.message, 'error');
      })
      .finally(function () {
        if (googleBusinessSyncServicesBtn) {
          googleBusinessSyncServicesBtn.disabled = false;
          googleBusinessSyncServicesBtn.textContent = '💼 مزامنة الخدمات مع جوجل';
        }
      });
  }

  function handleLocationSelectChange() {
    var tenantSlug = getGoogleBusinessTenantSlug();
    if (!googleBusinessLocationSelect) return;
    
    var idx = googleBusinessLocationSelect.selectedIndex;
    if (idx < 0) return;
    var opt = googleBusinessLocationSelect.options[idx];
    var locId = googleBusinessLocationSelect.value;
    
    if (!locId) {
      updateReviewLinkDisplay('');
      return;
    }

    var reviewUrl = opt.getAttribute('data-review-url') || '';
    var mapsUri = opt.getAttribute('data-maps-uri') || '';
    var placeId = opt.getAttribute('data-place-id') || '';
    var lat = opt.getAttribute('data-lat') || '';
    var lng = opt.getAttribute('data-lng') || '';
    var city = opt.getAttribute('data-city') || '';

    var cfg = store.loadConfig() || {};
    if (!cfg.googleBusiness) cfg.googleBusiness = {};
    cfg.googleBusiness.locationId = locId;
    cfg.googleBusiness.reviewUrl = reviewUrl;
    cfg.googleBusiness.mapsUri = mapsUri;
    cfg.googleBusiness.placeId = placeId;

    if (!cfg.serviceArea) cfg.serviceArea = {};
    cfg.serviceArea.enabled = true;
    cfg.serviceArea.displayOnHomepage = true;

    if (mapsUri) {
      cfg.serviceArea.googleMapsUrl = mapsUri;
      var mapsUrlInput = document.getElementById('mapsListingUrl');
      if (mapsUrlInput) mapsUrlInput.value = mapsUri;
    }

    if (city) {
      cfg.serviceArea.city = city;
      var mapsCityInput = document.getElementById('mapsCity');
      if (mapsCityInput) mapsCityInput.value = city;
    }

    if (lat && lng) {
      cfg.serviceArea.center = {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      };
      var mapsLatInput = document.getElementById('mapsLat');
      var mapsLngInput = document.getElementById('mapsLng');
      if (mapsLatInput) mapsLatInput.value = lat;
      if (mapsLngInput) mapsLngInput.value = lng;
    }

    var mapsEnabledCheck = document.getElementById('mapsEnabled');
    if (mapsEnabledCheck) mapsEnabledCheck.checked = true;

    if (window.updateAdminMapPreview) {
      window.updateAdminMapPreview();
    }

    store.saveConfig(cfg)
      .then(function() {
        updateReviewLinkDisplay(reviewUrl);
        return fetch('/api/google-business/update-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant: tenantSlug,
            locationId: locId,
            websiteUrl: store.buildTenantSiteUrl(tenantSlug)
          })
        });
      })
      .then(function(res) {
        if (!res.ok) console.warn('Failed to sync location selection to server');
        toast('تم حفظ الفرع ورابط التقييم بنجاح', 'success');
      })
      .catch(function(err) {
        console.error(err);
        toast('حدث خطأ أثناء حفظ الفرع: ' + err.message, 'error');
      });
  }

  function populateAiServicesDropdown() {
    var select = document.getElementById('gbpAiPostServiceSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- اختر خدمة (اختياري) --</option>';
    var enabledServices = store.getEnabledServices();
    if (enabledServices && enabledServices.length > 0) {
      enabledServices.forEach(function (svc) {
        var opt = document.createElement('option');
        opt.value = svc.title;
        opt.textContent = svc.title;
        select.appendChild(opt);
      });
    }
  }

  function generateGbpAiPost() {
    var promptInput = document.getElementById('gbpAiPostPrompt');
    var select = document.getElementById('gbpAiPostServiceSelect');
    var generateBtn = document.getElementById('gbpAiGeneratePostBtn');
    var resultBlock = document.getElementById('gbpAiPostResultBlock');
    var resultText = document.getElementById('gbpAiPostResult');
    
    if (!promptInput || !promptInput.value.trim()) {
      toast('يرجى كتابة فكرة أو تفاصيل للمنشور أولاً', 'warning');
      return;
    }
    
    var tenantSlug = getGoogleBusinessTenantSlug();
    var brandName = getBrandName();
    var serviceName = select ? select.value : '';
    
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'جاري التوليد بالذكاء الاصطناعي... 🪄';
    }
    if (resultBlock) resultBlock.hidden = true;
    
    getGbpAiAuthHeaders()
      .then(function (headers) {
        return fetch('/api/google-business/generate-post', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            tenant: tenantSlug,
            prompt: promptInput.value.trim(),
            businessName: brandName,
            serviceName: serviceName
          })
        });
      })
      .then(parseGbpAiResponse)
      .then(function (data) {
        if (resultText) resultText.value = data.text;
        if (resultBlock) resultBlock.hidden = false;
        toast('تم توليد المنشور بنجاح!', 'success');
      })
      .catch(handleGbpAiAuthFailure)
      .finally(function () {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '🪄 توليد منشور سيو محلي';
        }
      });
  }

  function generateGbpAiReply() {
    var reviewInput = document.getElementById('gbpAiReplyText');
    var ratingSelect = document.getElementById('gbpAiReplyRating');
    var generateBtn = document.getElementById('gbpAiGenerateReplyBtn');
    var resultBlock = document.getElementById('gbpAiReplyResultBlock');
    var resultText = document.getElementById('gbpAiReplyResult');
    
    var tenantSlug = getGoogleBusinessTenantSlug();
    var brandName = getBrandName();
    var rating = ratingSelect ? ratingSelect.value : '5';
    var reviewText = reviewInput ? reviewInput.value.trim() : '';
    
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'جاري التوليد بالذكاء الاصطناعي... 🪄';
    }
    if (resultBlock) resultBlock.hidden = true;
    
    getGbpAiAuthHeaders()
      .then(function (headers) {
        return fetch('/api/google-business/generate-reply', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            tenant: tenantSlug,
            reviewText: reviewText,
            rating: rating,
            businessName: brandName
          })
        });
      })
      .then(parseGbpAiResponse)
      .then(function (data) {
        if (resultText) resultText.value = data.text;
        if (resultBlock) resultBlock.hidden = false;
        toast('تم توليد الرد بنجاح!', 'success');
      })
      .catch(handleGbpAiAuthFailure)
      .finally(function () {
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.textContent = '🪄 صياغة رد احترافي';
        }
      });
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function buildSiteSnapshotForNap() {
    var cfg = store.loadConfig() || {};
    var tenantSlug = getGoogleBusinessTenantSlug();
    var booking = cfg.booking || {};
    var wh = booking.workingHours || {};
    var area = cfg.serviceArea || {};
    return {
      name: getBrandName(),
      phone: cfg.phone || '',
      website: store.buildTenantSiteUrl(tenantSlug),
      city: area.city || '',
      hoursStart: wh.start || '',
      hoursEnd: wh.end || ''
    };
  }

  function napStatusLabel(status) {
    var map = {
      match: '✓ متطابق',
      mismatch: '✗ اختلاف',
      missing_site: '⚠ ناقص في الموقع',
      missing_gbp: '⚠ ناقص في جوجل',
      missing_both: '—',
      info: 'ℹ معلومة'
    };
    return map[status] || status;
  }

  function napStatusColor(status) {
    if (status === 'match') return '#2ecc71';
    if (status === 'mismatch') return '#e74c3c';
    if (status === 'missing_site' || status === 'missing_gbp') return '#f39c12';
    return '#888';
  }

  function renderNapAuditReport(report) {
    var summaryEl = document.getElementById('gbpNapAuditSummary');
    var tableWrap = document.getElementById('gbpNapAuditTableWrap');
    var tbody = document.getElementById('gbpNapAuditTableBody');
    if (!report || !summaryEl || !tbody) return;

    var s = report.summary || {};
    var overallText = {
      excellent: 'ممتاز — بيانات NAP متطابقة بالكامل',
      good: 'جيد — بعض الحقول تحتاج إكمال',
      fair: 'مقبول — يوجد اختلاف بسيط',
      poor: 'يحتاج تحسين — عدة اختلافات في NAP'
    };

    summaryEl.style.display = 'block';
    summaryEl.innerHTML =
      '<strong>' + escHtml(overallText[s.overall] || 'نتيجة الفحص') + '</strong><br>' +
      'النتيجة: ' + (s.matched || 0) + ' / ' + (s.total || 0) + ' متطابق (' + (s.scorePercent || 0) + '%)' +
      (s.mismatches ? ' — ' + s.mismatches + ' اختلاف' : '') +
      (report.gbpAddressFull
        ? '<br><span style="font-size:0.8rem;color:#888;">عنوان GBP الكامل: ' + escHtml(report.gbpAddressFull) + '</span>'
        : '');

    tbody.innerHTML = (report.items || []).map(function (item) {
      return '<tr style="border-bottom:1px solid rgba(255,255,255,0.08);">' +
        '<td style="padding:8px;font-weight:bold;">' + escHtml(item.label) + '</td>' +
        '<td style="padding:8px;word-break:break-word;">' + escHtml(item.siteValue) + '</td>' +
        '<td style="padding:8px;word-break:break-word;">' + escHtml(item.gbpValue) + '</td>' +
        '<td style="padding:8px;color:' + napStatusColor(item.status) + ';white-space:nowrap;">' +
        napStatusLabel(item.status) +
        (item.hint ? '<br><span style="font-size:0.75rem;color:#999;">' + escHtml(item.hint) + '</span>' : '') +
        '</td></tr>';
    }).join('');

    if (tableWrap) tableWrap.style.display = 'block';
  }

  function runNapAudit() {
    if (!googleBusinessLocationSelect || !googleBusinessLocationSelect.value) {
      toast('يرجى اختيار فرع/نشاط من القائمة أولاً', 'warning');
      return;
    }

    var btn = document.getElementById('gbpRunNapAuditBtn');
    var tenantSlug = getGoogleBusinessTenantSlug();
    var locationId = googleBusinessLocationSelect.value;
    var site = buildSiteSnapshotForNap();

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري الفحص...';
    }

    getGbpAiAuthHeaders()
      .then(function (headers) {
        return fetch('/api/google-business/nap-audit', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            tenant: tenantSlug,
            locationId: locationId,
            site: site
          })
        });
      })
      .then(parseGbpAiResponse)
      .then(function (data) {
        renderNapAuditReport(data.report);
        toast('اكتمل فحص NAP', 'success');
      })
      .catch(handleGbpAiAuthFailure)
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔍 تشغيل فحص NAP';
        }
      });
  }

  function syncNapFromMken() {
    if (!googleBusinessLocationSelect || !googleBusinessLocationSelect.value) {
      toast('يرجى اختيار فرع/نشاط من القائمة أولاً', 'warning');
      return;
    }

    var tenantSlug = getGoogleBusinessTenantSlug();
    var locationId = googleBusinessLocationSelect.value;
    var site = buildSiteSnapshotForNap();
    var btn = document.getElementById('gbpSyncNapBtn');

    var previewLines = [];
    if (site.name) previewLines.push('• الاسم: ' + site.name);
    if (site.phone) previewLines.push('• الهاتف: ' + (store.formatPhoneDisplay ? store.formatPhoneDisplay(site.phone) : site.phone));
    if (site.website) previewLines.push('• الموقع: ' + site.website);

    var confirmMsg =
      'سيتم تحديث بيانات جوجل بيزنس من mken للحقول غير المتطابقة فقط:\n\n' +
      previewLines.join('\n') +
      '\n\nملاحظة: تغيير الاسم قد يتطلب موافقة Google.\n\nهل تريد المتابعة؟';

    if (!confirm(confirmMsg)) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري المزامنة...';
    }

    getGbpAiAuthHeaders()
      .then(function (headers) {
        return fetch('/api/google-business/sync-nap', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            tenant: tenantSlug,
            locationId: locationId,
            site: site
          })
        });
      })
      .then(parseGbpAiResponse)
      .then(function (data) {
        if (data.report) renderNapAuditReport(data.report);
        var updatedCount = (data.updated && data.updated.length) || 0;
        if (updatedCount > 0) {
          var names = data.updated.map(function (u) { return u.label; }).join('، ');
          toast('تم تحديث: ' + names, 'success');
          checkGoogleBusinessStatus();
        } else {
          toast(data.message || 'لا توجد حقول تحتاج مزامنة', 'warning');
        }
      })
      .catch(handleGbpAiAuthFailure)
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔧 إصلاح تلقائي (mken → جوجل)';
        }
      });
  }

  function checkGoogleRedirectParams() {
    var params = new URLSearchParams(window.location.search);
    var connectStatus = params.get('google_connect');
    if (connectStatus === 'success') {
      toast('تم ربط حساب جوجل بيزنس الخاص بك بنجاح!', 'success');
      // Clean URL parameters
      if (window.history && window.history.replaceState) {
        var cleanUrl = window.location.pathname + '?tenant=' + encodeURIComponent(getGoogleBusinessTenantSlug());
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } else if (connectStatus === 'error') {
      var desc = params.get('error_desc') || 'خطأ غير معروف';
      toast('فشل ربط حساب جوجل: ' + desc, 'error');
      if (window.history && window.history.replaceState) {
        var cleanUrl = window.location.pathname + '?tenant=' + encodeURIComponent(getGoogleBusinessTenantSlug());
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }

  function checkSaaSCallback() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('saas_callback') === '1') {
      var tenantSlug = params.get('tenant');
      var months = parseInt(params.get('months'), 10) || 12;
      var status = params.get('status');
      var paymentId = params.get('id');

      if (status === 'paid' && tenantSlug && paymentId) {
        var payment = {
          id: paymentId,
          amount: params.get('amount') ? parseInt(params.get('amount'), 10) : (getSaaSPrice(months) * 100),
          source: {
            type: 'card',
            company: params.get('message') && params.get('message').indexOf('Mada') !== -1 ? 'mada' : 'creditcard'
          }
        };
        handleSaaSPaymentSuccess(tenantSlug, months, payment);
      } else if (status === 'failed') {
        alert('فشل سداد قيمة تجديد الاشتراك. يرجى مراجعة البطاقة والمحاولة مرة أخرى.');
        window.location.href = window.location.pathname;
      }
    }
  }

  function checkSubscriptionOptionsVisibility() {
    var tenantSlug = store.getCurrentTenantSlug();
    var isSuperAdmin = !tenantSlug || tenantSlug === 'default';
    if (renewSubManualBtn) {
      renewSubManualBtn.style.display = isSuperAdmin ? '' : 'none';
    }
  }

  function refresh() {
    loadApiKeys();
    loadInvoices();
    checkSaaSCallback();
    checkGoogleRedirectParams();
    checkGoogleBusinessStatus();
    checkSubscriptionOptionsVisibility();
  }

  function bindEvents() {
    if (generateApiKeyBtn) {
      generateApiKeyBtn.addEventListener('click', generateApiKey);
    }
    if (renewSubMoyasarBtn) {
      renewSubMoyasarBtn.addEventListener('click', initSaaSPayment);
    }
    if (renewSubManualBtn) {
      renewSubManualBtn.addEventListener('click', function () {
        var select = document.getElementById('renewMonthsSelect');
        var months = select ? parseInt(select.value, 10) : 12;
        processManualRenewal(months);
      });
    }
    if (cancelSaasPaymentBtn) {
      cancelSaasPaymentBtn.addEventListener('click', function () {
        if (saasPaymentBlock) saasPaymentBlock.hidden = true;
      });
    }
    if (googleBusinessConnectBtn) {
      googleBusinessConnectBtn.addEventListener('click', connectGoogleBusiness);
    }
    if (googleBusinessUpdateBtn) {
      googleBusinessUpdateBtn.addEventListener('click', updateGoogleBusinessWebsite);
    }
    if (googleBusinessSyncServicesBtn) {
      googleBusinessSyncServicesBtn.addEventListener('click', syncGoogleBusinessServices);
    }
    if (googleBusinessDisconnectBtn) {
      googleBusinessDisconnectBtn.addEventListener('click', disconnectGoogleBusiness);
    }
    if (googleBusinessLocationSelect) {
      googleBusinessLocationSelect.addEventListener('change', handleLocationSelectChange);
    }

    var napAuditBtn = document.getElementById('gbpRunNapAuditBtn');
    if (napAuditBtn) {
      napAuditBtn.addEventListener('click', runNapAudit);
    }

    var napSyncBtn = document.getElementById('gbpSyncNapBtn');
    if (napSyncBtn) {
      napSyncBtn.addEventListener('click', syncNapFromMken);
    }
    
    var copyReviewBtn = document.getElementById('copyGoogleReviewUrlBtn');
    if (copyReviewBtn) {
      copyReviewBtn.addEventListener('click', function() {
        var reviewUrlInput = document.getElementById('googleBusinessReviewUrl');
        if (reviewUrlInput && reviewUrlInput.value) {
          navigator.clipboard.writeText(reviewUrlInput.value).then(function() {
            copyReviewBtn.textContent = 'تم النسخ';
            setTimeout(function() { copyReviewBtn.textContent = 'نسخ'; }, 1500);
          });
        }
      });
    }

    var generatePostBtn = document.getElementById('gbpAiGeneratePostBtn');
    if (generatePostBtn) {
      generatePostBtn.addEventListener('click', generateGbpAiPost);
    }

    var generateReplyBtn = document.getElementById('gbpAiGenerateReplyBtn');
    if (generateReplyBtn) {
      generateReplyBtn.addEventListener('click', generateGbpAiReply);
    }

    var copyPostBtn = document.getElementById('copyGbpAiPostBtn');
    if (copyPostBtn) {
      copyPostBtn.addEventListener('click', function() {
        var txt = document.getElementById('gbpAiPostResult');
        if (txt && txt.value) {
          navigator.clipboard.writeText(txt.value).then(function() {
            copyPostBtn.textContent = 'تم النسخ';
            setTimeout(function() { copyPostBtn.textContent = 'نسخ النص 📋'; }, 1500);
          });
        }
      });
    }
    
    var copyReplyBtn = document.getElementById('copyGbpAiReplyBtn');
    if (copyReplyBtn) {
      copyReplyBtn.addEventListener('click', function() {
        var txt = document.getElementById('gbpAiReplyResult');
        if (txt && txt.value) {
          navigator.clipboard.writeText(txt.value).then(function() {
            copyReplyBtn.textContent = 'تم النسخ';
            setTimeout(function() { copyReplyBtn.textContent = 'نسخ النص 📋'; }, 1500);
          });
        }
      });
    }

    var aiTabs = document.querySelectorAll('.gbp-ai-tab');
    aiTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        aiTabs.forEach(function (t) {
          t.classList.remove('btn--primary');
          t.classList.add('btn--outline');
        });
        tab.classList.remove('btn--outline');
        tab.classList.add('btn--primary');
        
        var tabName = tab.getAttribute('data-gbp-tab');
        var postPanel = document.getElementById('gbpAiPostPanel');
        var replyPanel = document.getElementById('gbpAiReplyPanel');
        
        if (tabName === 'ai-post') {
          if (postPanel) postPanel.hidden = false;
          if (replyPanel) replyPanel.hidden = true;
        } else {
          if (postPanel) postPanel.hidden = true;
          if (replyPanel) replyPanel.hidden = false;
        }
      });
    });
  }

  window.MkenAdminDeveloper = {
    refresh: refresh
  };

  bindEvents();
  checkSubscriptionOptionsVisibility();
})();
