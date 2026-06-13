/**
 * سجل رسائل الواتساب والتحكم بها — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var tableBody = document.getElementById('whatsappLogsTableBody');
  var refreshBtn = document.getElementById('refreshWhatsappLogsBtn');
  var clearBtn = document.getElementById('clearWhatsappLogsBtn');
  var searchPhone = document.getElementById('waLogsSearchPhone');
  var filterStatus = document.getElementById('waLogsFilterStatus');

  var statTotal = document.getElementById('waStatTotal');
  var statSuccess = document.getElementById('waStatSuccess');
  var statFailed = document.getElementById('waStatFailed');

  var _logs = [];

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
      return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  function loadLogs() {
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--color-text-muted);">جاري تحميل السجلات...</td></tr>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchWhatsappLogs(tenantSlug)
        .then(function (logs) {
          _logs = logs;
          renderLogs();
        })
        .catch(function (err) {
          console.warn('Failed to load whatsapp logs from Supabase', err);
          loadLocalLogs();
        });
    } else {
      loadLocalLogs();
    }
  }

  function loadLocalLogs() {
    try {
      var raw = localStorage.getItem('mken_whatsapp_logs');
      _logs = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _logs = [];
    }
    renderLogs();
  }

  function saveLocalLogs() {
    try {
      localStorage.setItem('mken_whatsapp_logs', JSON.stringify(_logs));
    } catch (e) {
      console.error('Failed to save logs to localStorage', e);
    }
  }

  function renderLogs() {
    if (!tableBody) return;

    var filtered = _logs.filter(function (log) {
      // 1. Filter by Status
      var statusVal = filterStatus ? filterStatus.value : 'all';
      if (statusVal !== 'all' && log.status !== statusVal) return false;

      // 2. Filter by Phone Search
      var searchVal = searchPhone ? searchPhone.value.trim() : '';
      if (searchVal && log.phone.indexOf(searchVal) === -1) return false;

      return true;
    });

    // Update stats counters
    var successCount = _logs.filter(function (l) { return l.status === 'success'; }).length;
    var failedCount = _logs.filter(function (l) { return l.status === 'failed'; }).length;
    if (statTotal) statTotal.textContent = _logs.length;
    if (statSuccess) statSuccess.textContent = successCount;
    if (statFailed) statFailed.textContent = failedCount;

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--color-text-muted);">لا توجد سجلات مطابقة للبحث.</td></tr>';
      return;
    }

    var html = filtered.map(function (log) {
      var statusBadge = log.status === 'success'
        ? '<span style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:50px; font-size:0.75rem; font-weight:600;">ناجح</span>'
        : '<span style="background:#fce4ec; color:#c62828; padding:3px 8px; border-radius:50px; font-size:0.75rem; font-weight:600; cursor:help;" title="' + esc(log.errorMessage) + '">فشل ⚠️</span>';

      var truncatedBody = log.body.length > 50 ? log.body.slice(0, 50) + '...' : log.body;

      var actionsHtml = '';
      if (log.status === 'failed') {
        actionsHtml += '<button type="button" class="btn btn--primary btn--sm" data-retry-log-id="' + log.id + '" style="padding:3px 8px; font-size:0.75rem; margin-inline-end:5px;">🔄 إعادة إرسال</button>';
      }
      actionsHtml += '<button type="button" class="btn btn--outline btn--sm" data-delete-log-id="' + log.id + '" style="color:#c0392b; border-color:#c0392b15; padding:3px 8px; font-size:0.75rem;">🗑️ حذف</button>';

      var eventAr = {
        'confirmation': 'تأكيد الحجز',
        'reminder': 'تذكير موعد',
        'cancellation': 'إلغاء الحجز',
        'reschedule': 'تعديل موعد',
        'subscription_reminder': 'تذكير اشتراك',
        'subscription_expired': 'انتهاء اشتراك',
        'test': 'رسالة تجريبية'
      }[log.eventType] || log.eventType || 'أخرى';

      var providerAr = {
        'ultramsg': 'UltraMsg',
        'twilio': 'Twilio',
        'custom': 'Custom Webhook',
        'whatsapp_business': 'WhatsApp Business'
      }[log.provider] || log.provider || 'بوابة مخصصة';

      return (
        '<tr style="border-bottom:1px solid var(--color-border);">' +
        '  <td style="padding:10px; font-size:0.8rem;">' + formatDate(log.createdAt) + '</td>' +
        '  <td style="padding:10px; font-family:monospace;">' + esc(log.phone) + '</td>' +
        '  <td style="padding:10px; font-size:0.8rem; font-weight:600;">' + esc(eventAr) + '</td>' +
        '  <td style="padding:10px; font-size:0.8rem;">' + esc(providerAr) + '</td>' +
        '  <td style="padding:10px; font-size:0.8rem; max-width:200px;" title="' + esc(log.body) + '">' + esc(truncatedBody) + '</td>' +
        '  <td style="padding:10px;">' + statusBadge + '</td>' +
        '  <td style="padding:10px; text-align:center; font-family:monospace;">' + log.retryCount + '</td>' +
        '  <td style="padding:10px;">' + actionsHtml + '</td>' +
        '</tr>'
      );
    }).join('');

    tableBody.innerHTML = html;

    // Attach listeners
    tableBody.querySelectorAll('[data-retry-log-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var logId = btn.getAttribute('data-retry-log-id');
        retryLog(logId);
      });
    });

    tableBody.querySelectorAll('[data-delete-log-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var logId = btn.getAttribute('data-delete-log-id');
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
          deleteLog(logId);
        }
      });
    });
  }

  function retryLog(id) {
    var log = _logs.find(function (l) { return l.id === id; });
    if (!log) return;

    toast('جاري محاولة إعادة الإرسال...');

    var config = store.loadConfig();
    if (window.MkenWhatsappAutomation && window.MkenWhatsappAutomation.sendMessage) {
      window.MkenWhatsappAutomation.sendMessage(log.phone, log.body, log.eventType, null, config)
        .then(function () {
          toast('تم إعادة إرسال الرسالة بنجاح!');
          
          if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
            var tenantSlug = store.getCurrentTenantSlug();
            window.MkenSupabaseDb.logWhatsappMessage({
              id: log.id,
              phone: log.phone,
              body: log.body,
              provider: log.provider,
              status: 'success',
              errorMessage: null,
              eventType: log.eventType,
              appointmentId: log.appointmentId,
              retryCount: log.retryCount + 1,
              createdAt: log.createdAt
            }, tenantSlug).then(loadLogs);
          } else {
            log.status = 'success';
            log.errorMessage = null;
            log.retryCount += 1;
            saveLocalLogs();
            renderLogs();
          }
        })
        .catch(function (err) {
          toast('فشلت محاولة إعادة الإرسال: ' + err.message, 'error');
          
          if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
            var tenantSlug = store.getCurrentTenantSlug();
            window.MkenSupabaseDb.logWhatsappMessage({
              id: log.id,
              phone: log.phone,
              body: log.body,
              provider: log.provider,
              status: 'failed',
              errorMessage: err.message || String(err),
              eventType: log.eventType,
              appointmentId: log.appointmentId,
              retryCount: log.retryCount + 1,
              createdAt: log.createdAt
            }, tenantSlug).then(loadLogs);
          } else {
            log.retryCount += 1;
            log.errorMessage = err.message || String(err);
            saveLocalLogs();
            renderLogs();
          }
        });
    }
  }

  function deleteLog(id) {
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      window.MkenSupabaseDb.deleteWhatsappLog(id)
        .then(function () {
          toast('تم حذف السجل من السحابة');
          loadLogs();
        })
        .catch(function (err) {
          toast('فشل حذف السجل: ' + err.message, 'error');
        });
    } else {
      _logs = _logs.filter(function (l) { return l.id !== id; });
      saveLocalLogs();
      renderLogs();
      toast('تم حذف السجل محلياً');
    }
  }

  function clearAllLogs() {
    if (!confirm('هل تريد مسح جميع سجلات الإرسال بشكل نهائي؟')) return;

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      // Direct supabase deletions can be sequential or we can clean local view
      toast('يرجى حذف السجلات فردياً في السحابة لحماية البيانات.', 'warning');
    } else {
      _logs = [];
      saveLocalLogs();
      renderLogs();
      toast('تم تنظيف السجل المحلي بالكامل');
    }
  }

  // Event Listeners
  if (refreshBtn) refreshBtn.addEventListener('click', loadLogs);
  if (clearBtn) clearBtn.addEventListener('click', clearAllLogs);
  if (searchPhone) searchPhone.addEventListener('input', renderLogs);
  if (filterStatus) filterStatus.addEventListener('change', renderLogs);

  // Export module
  window.MkenAdminWhatsappLogs = {
    refresh: loadLogs
  };
})();
