/**
 * مَكَن (Mken Platform) - وحدة تحكم العميل لطابور الانتظار (Queue Client Controller)
 * يدعم PWA Zero-Friction، استرجاع الحالة، التنبيه المزدوج، وتحديثات EWMA اللحظية
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  var queueStore = window.MkenQueueStore;
  if (!queueStore) return;

  var currentTenantSlug = queueStore.getTenantSlug();
  var activeTickets = [];
  var selectedTicketIndex = 0;
  var availableQueues = [];
  var refreshTimer = null;

  // DOM Elements
  var bookingView = document.getElementById('queueBookingView');
  var trackerView = document.getElementById('queueTrackerView');
  var servicesContainer = document.getElementById('servicesListContainer');
  var joinForm = document.getElementById('joinQueueForm');
  var customerNameInput = document.getElementById('customerNameInput');
  var customerPhoneInput = document.getElementById('customerPhoneInput');
  var submitJoinBtn = document.getElementById('submitJoinQueueBtn');

  // Tracker DOM Elements
  var concurrentTabs = document.getElementById('concurrentTabsContainer');
  var ticketServiceLabel = document.getElementById('ticketServiceLabel');
  var ticketNumberDisplay = document.getElementById('ticketNumberDisplay');
  var ticketStatusBadge = document.getElementById('ticketStatusBadge');
  var ticketStatusText = document.getElementById('ticketStatusText');
  var calledBanner = document.getElementById('calledAlertBanner');
  var calledCounterText = document.getElementById('calledCounterBannerText');
  var antiCollisionBanner = document.getElementById('antiCollisionBanner');
  var antiCollisionDesc = document.getElementById('antiCollisionDesc');
  var metricAhead = document.getElementById('metricAheadCount');
  var metricEtw = document.getElementById('metricEtwMinutes');
  var refreshTicketBtn = document.getElementById('refreshTicketBtn');
  var leaveQueueBtn = document.getElementById('leaveQueueBtn');
  var enablePushBtn = document.getElementById('enablePushBtn');
  var webPushBanner = document.getElementById('webPushBanner');

  // Transfer Journey Elements
  var transferJourneyCard = document.getElementById('transferJourneyCard');
  var transferPrevService = document.getElementById('transferPrevService');
  var transferCurrentService = document.getElementById('transferCurrentService');
  var transferTicketRef = document.getElementById('transferTicketRef');
  var transferNotesBox = document.getElementById('transferNotesBox');
  var transferNotesText = document.getElementById('transferNotesText');

  // Brand elements
  var tenantLogo = document.getElementById('tenantLogo');
  var tenantTitle = document.getElementById('tenantTitle');
  var tenantTagline = document.getElementById('tenantTagline');

  // -------------------------------------------------------------
  // 1. تهيئة البراند وهوية التاجر
  // -------------------------------------------------------------
  function initBrand() {
    if (store && typeof store.loadConfig === 'function') {
      var cfg = store.loadConfig();
      if (cfg && cfg.brand) {
        if (cfg.brand.name && tenantTitle) {
          tenantTitle.textContent = cfg.brand.name + ' | نظام الطوابير';
        }
        if (cfg.brand.tagline && tenantTagline) {
          tenantTagline.textContent = cfg.brand.tagline;
        }
        if (cfg.brand.logo && tenantLogo) {
          tenantLogo.src = cfg.brand.logo;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. تحميل المسارات وبناء نموذج الحجز
  // -------------------------------------------------------------
  function loadAvailableQueues() {
    queueStore.listQueues().then(function (res) {
      if (!res.ok || !res.queues) return;
      availableQueues = res.queues;
      renderServicesList(availableQueues);
    }).catch(function (err) {
      console.warn('[Queue Load Error]', err);
      if (servicesContainer) {
        servicesContainer.innerHTML = '<div style="color:var(--q-danger); text-align:center; padding:15px;">تعذر تحميل المسارات حالياً. يُرجى إعادة المحاولة.</div>';
      }
    });
  }

  function renderServicesList(queues) {
    if (!servicesContainer) return;
    if (!queues.length) {
      servicesContainer.innerHTML = '<div style="color:var(--q-text-muted); text-align:center; padding:15px;">لا توجد مسارات نشطة حالياً.</div>';
      return;
    }

    var html = queues.map(function (q, idx) {
      var isFirst = idx === 0 ? ' selected' : '';
      var activeCount = q.activeCountersCount || 0;
      var waitingCount = q.waitingCount || 0;
      var waitTime = q.estimatedWaitMinutes || q.target_service_minutes || 10;

      return (
        '<div class="q-service-item' + isFirst + '" data-queue-id="' + q.id + '">' +
          '<div class="q-service-item__info">' +
            '<span class="q-service-item__name">' + escHtml(q.name) + '</span>' +
            '<div class="q-service-item__meta">' +
              '<span>👥 في الانتظار: <strong>' + waitingCount + '</strong></span>' +
              '<span>⏱️ وقت متوقع: <strong>~' + waitTime + ' د</strong></span>' +
              '<span>🟢 كاونترات: <strong>' + activeCount + '</strong></span>' +
            '</div>' +
          '</div>' +
          '<div class="q-service-item__check">' + (isFirst ? '✓' : '') + '</div>' +
        '</div>'
      );
    }).join('');

    servicesContainer.innerHTML = html;

    // تفعيل الاختيار المتعدد (Multi-queue selection)
    var items = servicesContainer.querySelectorAll('.q-service-item');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var isSelected = item.classList.contains('selected');
        var selectedCount = servicesContainer.querySelectorAll('.q-service-item.selected').length;
        
        // السماح باختيار مسار واحد أو أكثر
        if (isSelected && selectedCount > 1) {
          item.classList.remove('selected');
          var check = item.querySelector('.q-service-item__check');
          if (check) check.textContent = '';
        } else {
          item.classList.add('selected');
          var check = item.querySelector('.q-service-item__check');
          if (check) check.textContent = '✓';
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 3. تقديم طلب الحجز واستلام التذكرة
  // -------------------------------------------------------------
  if (joinForm) {
    joinForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var selectedElements = servicesContainer.querySelectorAll('.q-service-item.selected');
      var queueIds = [];
      selectedElements.forEach(function (el) {
        queueIds.push(el.getAttribute('data-queue-id'));
      });

      if (!queueIds.length) {
        alert('الرجاء اختيار مسار أو خدمة واحدة على الأقل.');
        return;
      }

      var name = customerNameInput ? customerNameInput.value.trim() : '';
      var phone = customerPhoneInput ? customerPhoneInput.value.trim() : '';

      if (!name || !phone) {
        alert('يرجى إدخال الاسم ورقم الجوال.');
        return;
      }

      if (submitJoinBtn) {
        submitJoinBtn.disabled = true;
        submitJoinBtn.textContent = 'جاري حجز التذكرة...';
      }

      queueStore.joinQueue({
        queueIds: queueIds,
        customerName: name,
        customerPhone: phone
      }).then(function (res) {
        if (submitJoinBtn) {
          submitJoinBtn.disabled = false;
          submitJoinBtn.innerHTML = '<span>احجز تذكرتك واستلم دورك الآن</span> <span>🎟️</span>';
        }

        if (res.ok && res.tickets && res.tickets.length) {
          activeTickets = res.tickets;
          selectedTicketIndex = 0;
          
          // حفظ الجلسة في localStorage للاسترجاع الفوري (State Recovery)
          queueStore.saveSession({
            sessionToken: res.sessionToken,
            ticketIds: res.tickets.map(function (t) { return t.id; }),
            tenantSlug: currentTenantSlug,
            createdAt: new Date().toISOString()
          });

          // مزامنة الملف التعريفي في الجلسة الموحدة (SSO Continuity)
          if (window.MkenSession && typeof window.MkenSession.updateCustomerProfile === 'function') {
            window.MkenSession.updateCustomerProfile({
              name: name,
              phone: phone
            });
          }

          // التبديل لشاشة التتبع اللحظية
          showTrackerView();
          renderActiveTicket();
        }
      }).catch(function (err) {
        if (submitJoinBtn) {
          submitJoinBtn.disabled = false;
          submitJoinBtn.innerHTML = '<span>احجز تذكرتك واستلم دورك الآن</span> <span>🎟️</span>';
        }
        alert('حدث خطأ أثناء حجز التذكرة: ' + err.message);
      });
    });
  }

  // -------------------------------------------------------------
  // 4. استرجاع الحالة اللحظية (State Recovery)
  // -------------------------------------------------------------
  function checkSavedSession() {
    var params = new URLSearchParams(window.location.search);
    var urlToken = params.get('session_token') || params.get('token');

    var savedSession = queueStore.getSavedSession(currentTenantSlug);
    var tokenToUse = urlToken || (savedSession ? savedSession.sessionToken : null);

    if (tokenToUse) {
      queueStore.getTicketStatus(tokenToUse).then(function (res) {
        if (res.ok && res.tickets && res.tickets.length) {
          activeTickets = res.tickets;
          selectedTicketIndex = 0;
          showTrackerView();
          renderActiveTicket();
        } else {
          showBookingView();
        }
      }).catch(function () {
        showBookingView();
      });
    } else {
      showBookingView();
    }
  }

  function showBookingView() {
    if (bookingView) bookingView.style.display = 'block';
    if (trackerView) trackerView.style.display = 'none';
    loadAvailableQueues();
  }

  function showTrackerView() {
    if (bookingView) bookingView.style.display = 'none';
    if (trackerView) trackerView.style.display = 'block';
    startAutoPolling();
  }

  // -------------------------------------------------------------
  // 5. عرض التذكرة النشطة ومؤشرات الوقت EWMA
  // -------------------------------------------------------------
  function renderActiveTicket() {
    if (!activeTickets.length) return;
    var ticket = activeTickets[selectedTicketIndex] || activeTickets[0];

    // تحديث ألسنة التذاكر المتزامنة (Concurrent Queues)
    renderConcurrentTabs();

    // شريط تنبيه تبديل الوردية للـ 24 ساعة
    var shiftBanner = document.getElementById('shiftHandoverBanner');
    var shiftText = document.getElementById('shiftHandoverText');
    if (shiftBanner) {
      if (ticket.shift_handover_notice) {
        shiftBanner.style.display = 'flex';
        if (shiftText) shiftText.textContent = ticket.shift_handover_notice;
      } else {
        shiftBanner.style.display = 'none';
      }
    }

    // بطاقة رحلة التحويل الحي
    if (transferJourneyCard) {
      if (ticket.last_service_name) {
        transferJourneyCard.style.display = 'block';
        if (transferPrevService) transferPrevService.textContent = 'تم الانتهاء من: ' + ticket.last_service_name;
        if (transferCurrentService) transferCurrentService.textContent = ticket.queue_name;
        if (transferTicketRef) transferTicketRef.textContent = ticket.ticket_number;
        if (transferNotesBox && transferNotesText) {
          if (ticket.transfer_notes) {
            transferNotesBox.style.display = 'block';
            transferNotesText.textContent = ticket.transfer_notes;
          } else {
            transferNotesBox.style.display = 'none';
          }
        }
      } else {
        transferJourneyCard.style.display = 'none';
      }
    }

    if (ticketServiceLabel) ticketServiceLabel.textContent = ticket.queue_name || 'الخدمة';
    if (ticketNumberDisplay) ticketNumberDisplay.textContent = ticket.ticket_number || 'A-01';

    // تحديث حالة التذكرة
    updateStatusBadge(ticket.status);

    // حالة النداء (Called)
    if (ticket.status === 'called') {
      if (calledBanner) calledBanner.style.display = 'block';
      if (calledCounterText) {
        calledCounterText.textContent = 'تفضل فوراً إلى: ' + (ticket.called_counter_number ? 'كاونتر ' + ticket.called_counter_number : 'شباك الخدمة');
      }
      // إطلاق تنبيه صوتي واهتزاز
      if (typeof window.playCallChime === 'function') window.playCallChime();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 400]);
    } else {
      if (calledBanner) calledBanner.style.display = 'none';
    }

    // حالة الإزاحة الذكية لحفظ الدور (+1 Bump)
    if (ticket.is_bumped || ticket.status === 'bumped') {
      if (antiCollisionBanner) antiCollisionBanner.style.display = 'flex';
      if (antiCollisionDesc) {
        antiCollisionDesc.textContent = ticket.notes || 'تم تأمين موقعك ذكياً (+1 Bump) نظراً لوجودك عند كاونتر آخر؛ دورك محفوظ ولن يتم إلغاؤه.';
      }
    } else {
      if (antiCollisionBanner) antiCollisionBanner.style.display = 'none';
    }

    // تحديث العدادات اللحظية
    if (metricAhead) {
      if (ticket.status === 'called' || ticket.status === 'in_service') {
        metricAhead.textContent = 'دورك الآن!';
      } else {
        var pos = ticket.currentPosition || ticket.position || 1;
        var ahead = Math.max(0, pos - 1);
        metricAhead.textContent = ahead === 0 ? 'أنت التالي!' : ahead;
      }
    }

    if (metricEtw) {
      if (ticket.status === 'in_service') {
        metricEtw.textContent = 'قيد الخدمة';
      } else if (ticket.status === 'called') {
        metricEtw.textContent = 'الآن';
      } else {
        var etw = ticket.liveETW || ticket.etw_minutes || 5;
        metricEtw.textContent = '~' + etw + ' د';
      }
    }
  }

  function updateStatusBadge(status) {
    if (!ticketStatusBadge || !ticketStatusText) return;

    ticketStatusBadge.className = 'ticket-status-pill';

    if (status === 'waiting') {
      ticketStatusBadge.classList.add('status-waiting');
      ticketStatusText.innerHTML = '<span>⏳</span> في الانتظار (Pooled)';
    } else if (status === 'sync_watch') {
      ticketStatusBadge.classList.add('status-waiting');
      ticketStatusText.innerHTML = '<span>👁️</span> مراقبة التزامن (Sync Watch)';
    } else if (status === 'called') {
      ticketStatusBadge.classList.add('status-called');
      ticketStatusText.innerHTML = '<span>🔔</span> تم النداء - تفضل للكاونتر!';
    } else if (status === 'in_service') {
      ticketStatusBadge.classList.add('status-in_service');
      ticketStatusText.innerHTML = '<span>⚡</span> قيد المعالجة بالخدمة';
    } else if (status === 'bumped') {
      ticketStatusBadge.classList.add('status-bumped');
      ticketStatusText.innerHTML = '<span>🛡️</span> دورك محفوظ (+1 Bump)';
    } else if (status === 'snoozed') {
      ticketStatusBadge.classList.add('status-snoozed');
      ticketStatusText.innerHTML = '<span>⏱️</span> مؤجل لعدم الحضور (5 د)';
    } else if (status === 'on_hold') {
      ticketStatusBadge.classList.add('status-snoozed');
      ticketStatusText.innerHTML = '<span>⏸️</span> معلقة مؤقتاً (On Hold)';
    } else if (status === 'completed') {
      ticketStatusBadge.classList.add('status-completed');
      ticketStatusText.innerHTML = '<span>✅</span> تم إنجاز الخدمة';
    } else {
      ticketStatusBadge.classList.add('status-waiting');
      ticketStatusText.textContent = status;
    }
  }

  function renderConcurrentTabs() {
    if (!concurrentTabs) return;
    if (activeTickets.length <= 1) {
      concurrentTabs.style.display = 'none';
      return;
    }

    concurrentTabs.style.display = 'flex';
    var html = activeTickets.map(function (t, idx) {
      var activeClass = idx === selectedTicketIndex ? ' active' : '';
      var statusIcon = t.status === 'called' ? '🔔 ' : (t.status === 'in_service' ? '⚡ ' : '');
      return (
        '<button type="button" class="concurrent-tab' + activeClass + '" data-idx="' + idx + '">' +
          statusIcon + escHtml(t.ticket_number) + ' - ' + escHtml(t.queue_name) +
        '</button>'
      );
    }).join('');

    concurrentTabs.innerHTML = html;
    concurrentTabs.querySelectorAll('.concurrent-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        selectedTicketIndex = parseInt(tab.getAttribute('data-idx'), 10) || 0;
        renderActiveTicket();
      });
    });
  }

  // -------------------------------------------------------------
  // 6. الربط الحي عبر SSE (Server-Sent Events) والنسخ الاحتياطي
  // -------------------------------------------------------------
  function setupSSE() {
    queueStore.listenToEvents(function (eventName, data) {
      console.log('[SSE Event]', eventName, data);

      if (['ticket_called', 'ticket_in_service', 'service_completed', 'ticket_snoozed', 'ticket_held', 'ticket_transferred', 'counter_status_changed', 'counter_swapped', 'reception_handover'].indexOf(eventName) !== -1) {
        // تحديث حالة تذاكر العميل فورياً
        refreshActiveTickets();
        if (eventName === 'ticket_transferred') {
          if (typeof window.playCallChime === 'function') window.playCallChime();
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
          showToast('🔄 تم توجيهك إلى قسم جديد (نفس رقمك المرجعي محفوظ)');
        } else if (eventName === 'reception_handover') {
          showToast('🔄 تجري الآن عملية تبديل وردية العمل، قد يطرأ تعديل طفيف على دقة التوقيت');
        }
      }

      if (eventName === 'system_notice' && data.message) {
        showToast(data.message, 'warning');
      }
    });
  }

  function refreshActiveTickets() {
    var saved = queueStore.getSavedSession(currentTenantSlug);
    if (!saved || !saved.sessionToken) return;

    queueStore.getTicketStatus(saved.sessionToken).then(function (res) {
      if (res.ok && res.tickets && res.tickets.length) {
        activeTickets = res.tickets;
        renderActiveTicket();
      }
    }).catch(function (e) {
      console.warn('[Refresh Status Error]', e);
    });
  }

  function startAutoPolling() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshActiveTickets, 10000); // تحديث دوري كل 10 ثوانٍ كخط دفاع ثانٍ
  }

  // -------------------------------------------------------------
  // 7. تفعيل إشعارات الويب بنقرة واحدة (Web Push API)
  // -------------------------------------------------------------
  if (enablePushBtn) {
    enablePushBtn.addEventListener('click', function () {
      if (!('Notification' in window)) {
        alert('متصفحك لا يدعم تنبيهات الويب.');
        return;
      }

      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          if (webPushBanner) {
            webPushBanner.innerHTML = '<span style="color:#166534; font-weight:600;">✅ تم تفعيل تنبيهات الشاشة بنجاح! ستصلك التحديثات لحظياً.</span>';
          }
        } else {
          alert('تم رفض إذن التنبيهات من المتصفح.');
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 8. أزرار التحكم: تحديث ومغادرة الطابور
  // -------------------------------------------------------------
  if (refreshTicketBtn) {
    refreshTicketBtn.addEventListener('click', function () {
      refreshActiveTickets();
      showToast('تم تحديث البيانات لحظياً 🔄');
    });
  }

  if (leaveQueueBtn) {
    leaveQueueBtn.addEventListener('click', function () {
      if (confirm('هل أنت متأكد من رغبتك في مغادرة الطابور وإلغاء تذكرتك؟')) {
        queueStore.clearSession(currentTenantSlug);
        activeTickets = [];
        showBookingView();
      }
    });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fff; padding:10px 18px; border-radius:30px; font-size:0.88rem; font-weight:600; z-index:99999; box-shadow:0 10px 25px rgba(0,0,0,0.2);';
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 3000);
  }

  // بدء التشغيل
  initBrand();
  if (window.MkenSession && typeof window.MkenSession.prefillCustomerInputs === 'function') {
    window.MkenSession.prefillCustomerInputs();
  }
  checkSavedSession();
  setupSSE();

})();
