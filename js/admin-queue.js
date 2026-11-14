/**
 * مَكَن (Mken Platform) - وحدة تحكم إدارة وتشغيل الطوابير المتقدمة (Admin Queue Controller)
 * تدعم مصفوفة الصلاحيات الهرمية (RBAC):
 * - شاشة موظف الاستقبال (High-Density Dispatcher Dashboard): Omni-View, Drag & Drop, Quick Search, Force Call, Manual Tickets.
 * - شاشة موظف الكاونتر (Zero-Distraction Workspace): Scoped Focus, Context Handover, Stopwatch, Shortcuts.
 * - محرك التحويل الذكي (Smart Transfer Routing): أولوية فورية، أسبقية عادلة Fair FIFO، ونهاية الطابور.
 */
(function () {
  'use strict';

  var queueStore = window.MkenQueueStore;
  var servicesStore = window.MkenServicesStore;
  if (!queueStore) return;

  var currentWorkspaceMode = 'dispatcher'; // 'dispatcher', 'counter', 'settings'
  var currentQueues = [];
  var currentCounters = [];
  var currentSettings = {};
  var allActiveTickets = [];
  var activeCounterId = null;
  var pendingTransferTicketId = null;
  var sessionTimer = null;
  var sessionSeconds = 0;

  // DOM Elements - Navigation & Modes
  var viewButtons = document.querySelectorAll('.queue-view-btn');
  var dispatcherWorkspace = document.getElementById('queueDispatcherWorkspace');
  var counterWorkspace = document.getElementById('queueCounterWorkspace');
  var settingsWorkspace = document.getElementById('queueSettingsWorkspace');
  var barWaitingTotal = document.getElementById('queueBarWaitingTotal');
  var barActiveCounters = document.getElementById('queueBarActiveCounters');
  var barLiveClock = document.getElementById('queueBarLiveClock');

  // DOM Elements - Dispatcher View
  var dispatcherCountersGrid = document.getElementById('dispatcherCountersGrid');
  var dispatcherQueuesContainer = document.getElementById('dispatcherQueuesContainer');
  var dispatcherSearchInput = document.getElementById('dispatcherSearchInput');
  var dispatcherSearchResults = document.getElementById('dispatcherSearchResults');
  var dispatcherNewTicketBtn = document.getElementById('dispatcherNewTicketBtn');
  var dispatcherBroadcastBtn = document.getElementById('dispatcherBroadcastBtn');
  var dispAvgWaitTime = document.getElementById('dispAvgWaitTime');
  var dispLongestWait = document.getElementById('dispLongestWait');
  var dispTotalCompletedToday = document.getElementById('dispTotalCompletedToday');

  // DOM Elements - Counter Workspace
  var counterWorkspaceSelect = document.getElementById('counterWorkspaceSelect');
  var counterWorkspaceAgentName = document.getElementById('counterWorkspaceAgentName');
  var counterWorkspaceBreakBtn = document.getElementById('counterWorkspaceBreakBtn');
  var counterIdleBox = document.getElementById('counterIdleBox');
  var counterCallNextBigBtn = document.getElementById('counterCallNextBigBtn');
  var counterServingBox = document.getElementById('counterServingBox');
  var counterActiveTicketNum = document.getElementById('counterActiveTicketNum');
  var counterActiveCustomerName = document.getElementById('counterActiveCustomerName');
  var counterActiveCustomerPhone = document.getElementById('counterActiveCustomerPhone');
  var counterLiveStopwatch = document.getElementById('counterLiveStopwatch');
  var counterContextBadge = document.getElementById('counterContextBadge');
  var counterContextPrevService = document.getElementById('counterContextPrevService');
  var counterContextNotes = document.getElementById('counterContextNotes');
  var counterCompleteBtn = document.getElementById('counterCompleteBtn');
  var counterTransferBtn = document.getElementById('counterTransferBtn');
  var counterHoldBtn = document.getElementById('counterHoldBtn');
  var counterRecallBtn = document.getElementById('counterRecallBtn');
  var counterNextInQueueList = document.getElementById('counterNextInQueueList');
  var counterStatCompletedToday = document.getElementById('counterStatCompletedToday');
  var counterStatAvgEwma = document.getElementById('counterStatAvgEwma');

  // DOM Elements - Settings View
  var serviceModeSelect = document.getElementById('adminQueueServiceMode');
  var saveSettingsBtn = document.getElementById('adminQueueSaveSettingsBtn');
  var targetMinutesInput = document.getElementById('adminQueueTargetMinutes');
  var alertThresholdInput = document.getElementById('adminQueueAlertThreshold');
  var safetyMultiplierInput = document.getElementById('adminQueueSafetyMultiplier');
  var snoozeMinutesInput = document.getElementById('adminQueueSnoozeMinutes');
  var qrCodeImg = document.getElementById('adminQueueQrImg');
  var qrLinkInput = document.getElementById('adminQueueQrLink');
  var openHallDisplayBtn = document.getElementById('adminQueueOpenHallDisplayBtn');

  // DOM Elements - Modals
  var transferModal = document.getElementById('adminTransferModal');
  var transferTicketForm = document.getElementById('transferTicketForm');
  var transferModalTicketNum = document.getElementById('transferModalTicketNum');
  var transferTargetQueueSelect = document.getElementById('transferTargetQueueSelect');
  var transferNotesInput = document.getElementById('transferNotesInput');
  var closeTransferModalBtn = document.getElementById('closeTransferModalBtn');
  var cancelTransferBtn = document.getElementById('cancelTransferBtn');

  var manualTicketModal = document.getElementById('adminManualTicketModal');
  var manualTicketForm = document.getElementById('manualTicketForm');
  var manualTicketQueueSelect = document.getElementById('manualTicketQueueSelect');
  var manualCustomerNameInput = document.getElementById('manualCustomerNameInput');
  var manualCustomerPhoneInput = document.getElementById('manualCustomerPhoneInput');
  var manualTicketNotesInput = document.getElementById('manualTicketNotesInput');
  var closeManualTicketModalBtn = document.getElementById('closeManualTicketModalBtn');
  var cancelManualTicketBtn = document.getElementById('cancelManualTicketBtn');

  var broadcastModal = document.getElementById('adminBroadcastModal');
  var broadcastNoticeForm = document.getElementById('broadcastNoticeForm');
  var broadcastNoticeTextInput = document.getElementById('broadcastNoticeTextInput');
  var closeBroadcastModalBtn = document.getElementById('closeBroadcastModalBtn');
  var cancelBroadcastBtn = document.getElementById('cancelBroadcastBtn');

  function toast(msg, type) {
    if (window.MkenAdminToast) {
      window.MkenAdminToast(msg, type);
    } else {
      alert(msg);
    }
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------
  // 1. الساعة الحية وتبديل مساحات العمل
  // -------------------------------------------------------------
  function updateLiveClock() {
    if (!barLiveClock) return;
    var now = new Date();
    barLiveClock.textContent = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  function switchWorkspaceView(viewMode) {
    currentWorkspaceMode = viewMode;
    viewButtons.forEach(function (btn) {
      btn.classList.toggle('queue-view-btn--active', btn.getAttribute('data-view') === viewMode);
      if (btn.getAttribute('data-view') === viewMode) {
        btn.classList.add('btn--primary');
        btn.classList.remove('btn--outline');
      } else {
        btn.classList.remove('btn--primary');
        btn.classList.add('btn--outline');
      }
    });

    if (dispatcherWorkspace) dispatcherWorkspace.style.display = viewMode === 'dispatcher' ? 'block' : 'none';
    if (counterWorkspace) counterWorkspace.style.display = viewMode === 'counter' ? 'block' : 'none';
    if (settingsWorkspace) settingsWorkspace.style.display = viewMode === 'settings' ? 'block' : 'none';

    refresh();
  }

  // -------------------------------------------------------------
  // 2. تحديث البيانات المركزية الشاملة
  // -------------------------------------------------------------
  function refresh() {
    queueStore.getConfig().then(function (res) {
      if (!res.ok) return;
      currentQueues = res.queues || [];
      currentCounters = res.counters || [];
      currentSettings = res.settings || {};

      queueStore.listQueues().then(function (qRes) {
        if (qRes.ok && qRes.queues) {
          currentQueues = qRes.queues;
          collectAllActiveTickets();
          updateTopBarSummary();

          if (currentWorkspaceMode === 'dispatcher') {
            renderDispatcherDashboard();
          } else if (currentWorkspaceMode === 'counter') {
            renderCounterWorkspace();
          } else if (currentWorkspaceMode === 'settings') {
            renderSettingsView();
          }
        }
      });
    }).catch(function (err) {
      console.warn('[Queue Admin Refresh Error]', err);
    });
  }

  function collectAllActiveTickets() {
    allActiveTickets = [];
    currentQueues.forEach(function (q) {
      if (Array.isArray(q.waitingTickets)) {
        q.waitingTickets.forEach(function (t) {
          t.queue_id = q.id;
          t.queue_name = q.name;
          allActiveTickets.push(t);
        });
      }
    });
  }

  function updateTopBarSummary() {
    var totalWaiting = allActiveTickets.length;
    var activeCountersCount = currentCounters.filter(function (c) { return c.status === 'active'; }).length;

    if (barWaitingTotal) barWaitingTotal.textContent = totalWaiting + ' منتظر إجمالاً';
    if (barActiveCounters) barActiveCounters.textContent = activeCountersCount + ' كاونترات نشطة';
  }

  // -------------------------------------------------------------
  // 3. شاشة موظف الاستقبال (High-Density Dispatcher Dashboard)
  // -------------------------------------------------------------
  function renderDispatcherDashboard() {
    // 3.1 إحصائيات ضغط الصالة
    var totalCompleted = 0;
    currentCounters.forEach(function (c) { totalCompleted += (c.completed_today_count || 0); });
    if (dispTotalCompletedToday) dispTotalCompletedToday.textContent = totalCompleted + ' عميل';

    var totalWaitSec = 0;
    var nowMs = Date.now();
    var maxWaitMs = 0;
    var longestTicketNum = null;

    allActiveTickets.forEach(function (t) {
      var arrTime = new Date(t.first_arrived_at || t.booked_at || nowMs).getTime();
      var diffMs = Math.max(0, nowMs - arrTime);
      totalWaitSec += Math.round(diffMs / 1000);
      if (diffMs > maxWaitMs) {
        maxWaitMs = diffMs;
        longestTicketNum = t.ticket_number;
      }
    });

    var avgMin = allActiveTickets.length ? Math.round((totalWaitSec / allActiveTickets.length) / 60) : 0;
    if (dispAvgWaitTime) dispAvgWaitTime.textContent = (avgMin || 5) + ' دقائق';

    var maxWaitMin = Math.round(maxWaitMs / 60000);
    if (dispLongestWait) {
      if (maxWaitMin >= 15 && longestTicketNum) {
        dispLongestWait.innerHTML = '<span style="color:#ef4444; font-weight:bold;">⚠️ #' + escHtml(longestTicketNum) + ' (' + maxWaitMin + ' د)</span>';
      } else if (longestTicketNum) {
        dispLongestWait.textContent = '#' + longestTicketNum + ' (' + maxWaitMin + ' د)';
      } else {
        dispLongestWait.textContent = 'لا يوجد تأخير';
      }
    }

    // 3.2 شبكة الكاونترات الحية (Counters Grid)
    renderDispatcherCountersGrid();

    // 3.3 أعمدة الطوابير التفاعلية مع السحب والإفلات (Queues Drag & Drop)
    renderDispatcherQueuesColumns();
  }

  function renderDispatcherCountersGrid() {
    if (!dispatcherCountersGrid) return;
    if (!currentCounters.length) {
      dispatcherCountersGrid.innerHTML = '<div style="color:var(--color-text-muted); padding:20px; text-align:center;">لا توجد كاونترات مهيأة.</div>';
      return;
    }

    var html = currentCounters.map(function (c) {
      var isBreak = c.status === 'on_break';
      var isServing = !!c.current_ticket_id;
      var statusBadge = '';
      var cardBorder = 'border: 1px solid var(--color-border);';

      if (isBreak) {
        statusBadge = '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">🟡 في استراحة</span>';
        cardBorder = 'border: 1.5px dashed #f59e0b;';
      } else if (isServing) {
        statusBadge = '<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">🟢 يخدم عميل</span>';
        cardBorder = 'border: 1.5px solid #22c55e; box-shadow: 0 4px 12px rgba(34,197,94,0.1);';
      } else {
        statusBadge = '<span style="background:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">⚪ شاغر / متاح</span>';
      }

      var ticketInfo = isServing
        ? '<div style="margin: 8px 0; font-size: 0.9rem;"><strong>يخدم تذكرة:</strong> <span style="font-size:1.1rem; color:#1e3a8a; font-weight:800;">' + escHtml(c.current_ticket_number || 'جارية...') + '</span></div>'
        : '<div style="margin: 8px 0; font-size: 0.82rem; color:var(--color-text-muted);">بانتظار العميل التالي...</div>';

      var dispatchBtn = (!isBreak)
        ? '<button type="button" class="btn btn--outline btn--sm btn-dispatch-next" data-counter-id="' + c.id + '" style="width:100%; font-size:0.78rem; font-weight:700; margin-top:6px;">' +
            '<span>🔔 طلب التالي للكاونتر</span>' +
          '</button>'
        : '<button type="button" class="btn btn--sm" disabled style="width:100%; font-size:0.78rem; margin-top:6px; opacity:0.5;">في استراحة</button>';

      var supervisorBtn = '<button type="button" class="btn btn--outline btn--sm btn-supervisor-override" data-counter-id="' + c.id + '" style="width:100%; font-size:0.72rem; margin-top:4px; color:#475569;" title="تحكم المشرف عن بُعد">' +
        '⚡ تحكم المشرف والمسارات' +
      '</button>';

      return (
        '<div class="dispatcher-counter-card" style="background:#fff; border-radius:var(--radius); padding:14px; ' + cardBorder + ' display:flex; flex-direction:column; justify-content:space-between;">' +
          '<div>' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
              '<strong style="font-size:0.95rem; color:#1e40af;">' + escHtml(c.name) + '</strong>' +
              statusBadge +
            '</div>' +
            '<div style="font-size:0.82rem; color:var(--color-text-muted);">الموظف: <strong>' + escHtml(c.operator_name || 'موظف') + '</strong></div>' +
            ticketInfo +
          '</div>' +
          '<div>' + dispatchBtn + supervisorBtn + '</div>' +
        '</div>'
      );
    }).join('');

    dispatcherCountersGrid.innerHTML = html;

    dispatcherCountersGrid.querySelectorAll('.btn-dispatch-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cntId = btn.getAttribute('data-counter-id');
        btn.disabled = true;
        btn.textContent = 'جاري النداء...';
        queueStore.dispatchCall({ counterId: cntId }).then(function (res) {
          btn.disabled = false;
          btn.textContent = '🔔 طلب التالي للكاونتر';
          if (res.ok) {
            toast('تم نداء العميل للكاونتر بنجاح', 'success');
            refresh();
          } else {
            toast(res.message || 'لا توجد تذاكر متاحة للنداء.', 'info');
          }
        }).catch(function (err) {
          btn.disabled = false;
          btn.textContent = '🔔 طلب التالي للكاونتر';
          toast(err.message, 'error');
        });
      });
    });

    dispatcherCountersGrid.querySelectorAll('.btn-supervisor-override').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cntId = btn.getAttribute('data-counter-id');
        openSupervisorOverrideModal(cntId);
      });
    });
  }

  function renderDispatcherQueuesColumns() {
    if (!dispatcherQueuesContainer) return;
    if (!currentQueues.length) {
      dispatcherQueuesContainer.innerHTML = '<div style="color:var(--color-text-muted); font-size:0.85rem; text-align:center;">لا توجد أقسام.</div>';
      return;
    }

    var html = currentQueues.map(function (q) {
      var ticketsInQ = allActiveTickets.filter(function (t) { return t.queue_id === q.id; });
      var ticketsHtml = '';

      if (!ticketsInQ.length) {
        ticketsHtml = '<div style="padding:10px; text-align:center; font-size:0.78rem; color:var(--color-text-muted);">الطابور فارغ حالياً</div>';
      } else {
        ticketsHtml = ticketsInQ.map(function (t) {
          var priorityBadge = '';
          if (t.priority_level === 'immediate_next' || t.is_immediate_next) {
            priorityBadge = '<span style="background:#fee2e2; color:#b91c1c; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px;">⚡ فوري</span>';
          } else if (t.priority_level === 'fair_fifo') {
            priorityBadge = '<span style="background:#dcfce7; color:#15803d; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px;">⚖️ FIFO</span>';
          }

          return (
            '<div class="dispatcher-ticket-drag-item" draggable="true" data-ticket-id="' + t.id + '" style="background:#fff; border:1px solid var(--color-border); border-radius:6px; padding:8px 10px; margin-bottom:6px; cursor:grab; box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
              '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                '<strong style="color:#1e3a8a; font-size:0.92rem;">' + escHtml(t.ticket_number) + '</strong>' +
                '<div>' + priorityBadge + '</div>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">' +
                '<span style="font-size:0.8rem; color:var(--color-text);">' + escHtml(t.customer_name) + '</span>' +
                '<button type="button" class="btn btn--sm btn-row-transfer" data-ticket-id="' + t.id + '" style="padding:2px 6px; font-size:0.7rem; border-radius:4px;" title="تحويل التذكرة">' +
                  '🔀' +
                '</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }

      return (
        '<div class="dispatcher-queue-column" data-queue-id="' + q.id + '" style="background:#f8fafc; border:1px solid var(--color-border); border-radius:8px; padding:10px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--color-border); padding-bottom:6px;">' +
            '<strong style="font-size:0.88rem; color:var(--color-text);">' + escHtml(q.name) + '</strong>' +
            '<span style="background:var(--color-primary); color:#fff; font-size:0.75rem; font-weight:700; padding:1px 8px; border-radius:12px;">' + ticketsInQ.length + '</span>' +
          '</div>' +
          '<div class="queue-drop-zone" style="min-height:50px;">' +
            ticketsHtml +
          '</div>' +
        '</div>'
      );
    }).join('');

    dispatcherQueuesContainer.innerHTML = html;

    // تفعيل السحب والإفلات (Drag & Drop) بين الأقسام
    setupDragAndDrop();

    // أزرار التحويل المباشرة
    dispatcherQueuesContainer.querySelectorAll('.btn-row-transfer').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var tId = btn.getAttribute('data-ticket-id');
        openTransferModal(tId);
      });
    });
  }

  function setupDragAndDrop() {
    var dragItems = dispatcherQueuesContainer.querySelectorAll('.dispatcher-ticket-drag-item');
    var dropColumns = dispatcherQueuesContainer.querySelectorAll('.dispatcher-queue-column');

    dragItems.forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', item.getAttribute('data-ticket-id'));
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', function () {
        item.style.opacity = '1';
      });
    });

    dropColumns.forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        col.style.background = '#eff6ff';
        col.style.borderColor = '#3b82f6';
      });
      col.addEventListener('dragleave', function () {
        col.style.background = '#f8fafc';
        col.style.borderColor = 'var(--color-border)';
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.style.background = '#f8fafc';
        col.style.borderColor = 'var(--color-border)';
        var ticketId = e.dataTransfer.getData('text/plain');
        var toQueueId = col.getAttribute('data-queue-id');
        if (ticketId && toQueueId) {
          openTransferModal(ticketId, toQueueId);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 4. شاشة موظف الكاونتر المركزة (Zero-Distraction Workspace)
  // -------------------------------------------------------------
  function renderCounterWorkspace() {
    // 4.1 بناء قائمة الكاونترات المتاحة
    if (counterWorkspaceSelect) {
      var prev = activeCounterId || counterWorkspaceSelect.value;
      counterWorkspaceSelect.innerHTML = currentCounters.map(function (c) {
        return '<option value="' + c.id + '">' + escHtml(c.name) + ' (' + escHtml(c.operator_name || 'موظف') + ')</option>';
      }).join('');

      if (prev && currentCounters.some(function (c) { return c.id === prev; })) {
        counterWorkspaceSelect.value = prev;
        activeCounterId = prev;
      } else if (currentCounters.length) {
        activeCounterId = currentCounters[0].id;
        counterWorkspaceSelect.value = activeCounterId;
      }
    }

    var counter = currentCounters.find(function (c) { return c.id === activeCounterId; });
    if (!counter) return;

    if (counterWorkspaceAgentName) {
      counterWorkspaceAgentName.textContent = 'الموظف: ' + (counter.operator_name || 'سارة علي');
    }

    // زر الاستراحة
    if (counterWorkspaceBreakBtn) {
      if (counter.status === 'on_break') {
        counterWorkspaceBreakBtn.textContent = '☕ في استراحة (اضغط للعودة)';
        counterWorkspaceBreakBtn.className = 'btn btn--warning';
        if (counterCallNextBigBtn) counterCallNextBigBtn.disabled = true;
      } else {
        counterWorkspaceBreakBtn.textContent = '☕ طلب استراحة';
        counterWorkspaceBreakBtn.className = 'btn btn--outline';
        if (counterCallNextBigBtn) counterCallNextBigBtn.disabled = false;
      }
    }

    // شريط تنبيه الاستراحة الفعلي للكاونتر
    if (counterOnBreakBanner) {
      if (counter.status === 'on_break') {
        counterOnBreakBanner.style.display = 'flex';
        if (counterBreakReasonText) counterBreakReasonText.textContent = counter.break_reason || 'استراحة مؤقتة';
      } else {
        counterOnBreakBanner.style.display = 'none';
      }
    }

    // إحصائيات الكاونتر
    if (counterStatCompletedToday) counterStatCompletedToday.textContent = (counter.completed_today_count || 0) + ' عميل';
    if (counterStatAvgEwma) {
      var mins = Math.round((counter.ewma_service_seconds || 300) / 60);
      counterStatAvgEwma.textContent = mins + ' دقائق';
    }

    // 4.2 فحص ما إذا كان الكاونتر يخدم عميلاً حالياً أم شاغر
    if (counter.current_ticket_id) {
      if (counterIdleBox) counterIdleBox.style.display = 'none';
      if (counterServingBox) counterServingBox.style.display = 'block';

      // جلب تفاصيل التذكرة
      queueStore.getTicketStatus(counter.current_ticket_id, true).then(function (res) {
        if (res.ok && res.tickets && res.tickets.length) {
          var ticket = res.tickets[0];
          if (counterActiveTicketNum) counterActiveTicketNum.textContent = ticket.ticket_number;
          if (counterActiveCustomerName) counterActiveCustomerName.textContent = ticket.customer_name;
          if (counterActiveCustomerPhone) counterActiveCustomerPhone.textContent = ticket.customer_phone || 'بدون هاتف';

          // سياق التحويل وملاحظة الموظف السابق (Context Handover)
          if (ticket.last_service_name && counterContextBadge) {
            counterContextBadge.style.display = 'block';
            if (counterContextPrevService) counterContextPrevService.textContent = ticket.last_service_name;
            if (counterContextNotes) counterContextNotes.textContent = ticket.transfer_notes || 'لا توجد ملاحظات إضافية';
          } else if (counterContextBadge) {
            counterContextBadge.style.display = 'none';
          }

          startStopwatch(counter.current_session_started_at || ticket.called_at);
        }
      });
    } else {
      if (counterIdleBox) counterIdleBox.style.display = 'block';
      if (counterServingBox) counterServingBox.style.display = 'none';
      stopStopwatch();
    }

    // 4.3 قائمة الانتظار في مسار هذا الكاونتر فقط (Next 3 in Queue)
    renderCounterQueueSideList(counter);
  }

  function renderCounterQueueSideList(counter) {
    if (!counterNextInQueueList) return;
    var assigned = counter.assigned_queue_ids || [];
    var queueTickets = allActiveTickets.filter(function (t) {
      return assigned.includes(t.queue_id);
    });

    if (!queueTickets.length) {
      counterNextInQueueList.innerHTML = '<div style="padding:14px; text-align:center; font-size:0.85rem; color:var(--color-text-muted);">لا يوجد عملاء منتظرين في مسارك.</div>';
      return;
    }

    var nextThree = queueTickets.slice(0, 3);
    var html = nextThree.map(function (t, idx) {
      var isNext = idx === 0 ? ' style="border-right:3px solid #2563eb; background:#eff6ff;"' : ' style="background:#f8fafc;"';
      return (
        '<div class="counter-side-ticket" ' + isNext + ' style="border:1px solid var(--color-border); border-radius:6px; padding:10px; font-size:0.85rem;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<strong style="color:#1e3a8a;">' + (idx === 0 ? '▶️ التالي: ' : '• ') + escHtml(t.ticket_number) + '</strong>' +
            '<span style="font-size:0.78rem; color:var(--color-text-muted);">متوقع: ~' + (t.etw_minutes || 5) + ' د</span>' +
          '</div>' +
          '<div style="font-size:0.8rem; color:var(--color-text); margin-top:2px;">' + escHtml(t.customer_name) + '</div>' +
        '</div>'
      );
    }).join('');

    counterNextInQueueList.innerHTML = html;
  }

  function startStopwatch(startedIso) {
    stopStopwatch();
    var startMs = startedIso ? new Date(startedIso).getTime() : Date.now();
    sessionTimer = setInterval(function () {
      var elapsed = Math.floor((Date.now() - startMs) / 1000);
      var m = Math.floor(elapsed / 60);
      var s = elapsed % 60;
      var str = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

      if (counterLiveStopwatch) {
        counterLiveStopwatch.textContent = str;
        // تنبيه تجاوز الضعف (2x Target)
        if (elapsed > 1200) {
          counterLiveStopwatch.style.color = '#ef4444';
        } else {
          counterLiveStopwatch.style.color = 'var(--color-primary)';
        }
      }
    }, 1000);
  }

  function stopStopwatch() {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
    if (counterLiveStopwatch) counterLiveStopwatch.textContent = '00:00';
  }

  // -------------------------------------------------------------
  // 5. النوافذ المنبثقة: التحويل والتذكرة اليدوية والإشعار العام
  // -------------------------------------------------------------
  function openTransferModal(ticketId, preselectedToQueueId) {
    pendingTransferTicketId = ticketId;
    var ticket = allActiveTickets.find(function (t) { return t.id === ticketId; });
    var ticketNum = ticket ? ticket.ticket_number : 'A-102';
    if (transferModalTicketNum) transferModalTicketNum.textContent = ticketNum;

    // بناء قائمة الأقسام المستهدفة (استبعاد القسم الحالي)
    if (transferTargetQueueSelect) {
      var targetQueues = currentQueues.filter(function (q) {
        return !ticket || q.id !== ticket.queue_id;
      });
      transferTargetQueueSelect.innerHTML = targetQueues.map(function (q) {
        var selected = preselectedToQueueId === q.id ? ' selected' : '';
        return '<option value="' + q.id + '"' + selected + '>' + escHtml(q.name) + '</option>';
      }).join('');
    }

    if (transferNotesInput) transferNotesInput.value = '';
    if (transferModal) transferModal.style.display = 'flex';
  }

  function closeTransferModal() {
    if (transferModal) transferModal.style.display = 'none';
    pendingTransferTicketId = null;
  }

  function openManualTicketModal() {
    if (manualTicketQueueSelect) {
      manualTicketQueueSelect.innerHTML = currentQueues.map(function (q) {
        return '<option value="' + q.id + '">' + escHtml(q.name) + '</option>';
      }).join('');
    }
    if (manualTicketModal) manualTicketModal.style.display = 'flex';
  }

  function closeManualTicketModal() {
    if (manualTicketModal) manualTicketModal.style.display = 'none';
  }

  function openBroadcastModal() {
    if (broadcastModal) broadcastModal.style.display = 'flex';
  }

  function closeBroadcastModal() {
    if (broadcastModal) broadcastModal.style.display = 'none';
  }

  // -------------------------------------------------------------
  // 5.4 إدارة الورديات وتسليم الكاونترات والاستراحات
  // -------------------------------------------------------------
  var hotSwapModal = document.getElementById('adminHotSwapModal');
  var hotSwapForm = document.getElementById('hotSwapForm');
  var hotSwapActiveNotice = document.getElementById('hotSwapActiveCustomerNotice');
  var hotSwapTicketNum = document.getElementById('hotSwapTicketNum');
  var hotSwapIncomingPin = document.getElementById('hotSwapIncomingPin');
  var hotSwapNotesInput = document.getElementById('hotSwapNotesInput');
  var closeHotSwapModalBtn = document.getElementById('closeHotSwapModalBtn');
  var cancelHotSwapBtn = document.getElementById('cancelHotSwapBtn');
  var counterHotSwapBtn = document.getElementById('counterHotSwapBtn');

  function openHotSwapModal() {
    var cnt = currentCounters.find(function (c) { return c.id === activeCounterId; });
    if (!cnt) return;

    if (cnt.current_ticket_id) {
      if (hotSwapActiveNotice) hotSwapActiveNotice.style.display = 'block';
      if (hotSwapTicketNum) hotSwapTicketNum.textContent = cnt.current_ticket_number || 'العميل الحالي';
    } else {
      if (hotSwapActiveNotice) hotSwapActiveNotice.style.display = 'none';
    }

    if (hotSwapIncomingPin) hotSwapIncomingPin.value = '';
    if (hotSwapNotesInput) hotSwapNotesInput.value = '';
    if (hotSwapModal) hotSwapModal.style.display = 'flex';
  }

  function closeHotSwapModal() {
    if (hotSwapModal) hotSwapModal.style.display = 'none';
  }

  var breakModal = document.getElementById('adminBreakModal');
  var breakRequestForm = document.getElementById('breakRequestForm');
  var closeBreakModalBtn = document.getElementById('closeBreakModalBtn');
  var cancelBreakBtn = document.getElementById('cancelBreakBtn');
  var counterOnBreakBanner = document.getElementById('counterOnBreakBanner');
  var counterBreakReasonText = document.getElementById('counterBreakReasonText');
  var counterEndBreakBtn = document.getElementById('counterEndBreakBtn');

  function openBreakModal() {
    var cnt = currentCounters.find(function (c) { return c.id === activeCounterId; });
    if (!cnt) return;
    if (cnt.current_ticket_id) {
      toast('لا يمكن بدء الاستراحة أثناء خدمة عميل. يرجى إنهاء المعاملة أولاً أو تحويلها.', 'error');
      return;
    }
    if (breakModal) breakModal.style.display = 'flex';
  }

  function closeBreakModal() {
    if (breakModal) breakModal.style.display = 'none';
  }

  var recHandoverModal = document.getElementById('adminReceptionHandoverModal');
  var recHandoverForm = document.getElementById('receptionHandoverForm');
  var closeRecHandoverBtn = document.getElementById('closeReceptionHandoverModalBtn');
  var cancelRecHandoverBtn = document.getElementById('cancelReceptionHandoverBtn');
  var recSummaryWaiting = document.getElementById('recSummaryWaiting');
  var recSummaryOverdue = document.getElementById('recSummaryOverdue');
  var recSummaryServed = document.getElementById('recSummaryServed');
  var recSummaryActiveCounters = document.getElementById('recSummaryActiveCounters');
  var incomingReceptionPin = document.getElementById('incomingReceptionPin');
  var receptionHandoverNotes = document.getElementById('receptionHandoverNotes');
  var dispatcherHandoverBtn = document.getElementById('dispatcherHandoverBtn');

  function openReceptionHandoverModal() {
    queueStore.getReceptionShiftSummary().then(function (res) {
      if (res.ok && res.summary) {
        if (recSummaryWaiting) recSummaryWaiting.textContent = res.summary.waitingTicketsCount;
        if (recSummaryOverdue) recSummaryOverdue.textContent = res.summary.overdueTicketsCount;
        if (recSummaryServed) recSummaryServed.textContent = res.summary.totalServedToday;
        if (recSummaryActiveCounters) recSummaryActiveCounters.textContent = res.summary.activeCountersCount + ' من ' + res.summary.totalCountersCount;
      }
    });

    if (incomingReceptionPin) incomingReceptionPin.value = '';
    if (receptionHandoverNotes) receptionHandoverNotes.value = '';
    if (recHandoverModal) recHandoverModal.style.display = 'flex';
  }

  function closeReceptionHandoverModal() {
    if (recHandoverModal) recHandoverModal.style.display = 'none';
  }

  var supervisorModal = document.getElementById('adminSupervisorOverrideModal');
  var closeOverrideModalBtn = document.getElementById('closeOverrideModalBtn');
  var cancelOverrideBtn = document.getElementById('cancelOverrideBtn');
  var overrideCounterName = document.getElementById('overrideModalCounterName');
  var overrideForceSignoutBtn = document.getElementById('overrideForceSignoutBtn');
  var overrideForceBreakBtn = document.getElementById('overrideForceBreakBtn');
  var overrideQueuesCheckboxes = document.getElementById('overrideQueuesCheckboxes');
  var overrideOperatorSelect = document.getElementById('overrideOperatorSelect');
  var submitOverrideReassignBtn = document.getElementById('submitOverrideReassignBtn');
  var activeOverrideCounterId = null;

  function openSupervisorOverrideModal(counterId) {
    activeOverrideCounterId = counterId;
    var cnt = currentCounters.find(function (c) { return c.id === counterId; });
    if (!cnt) return;

    if (overrideCounterName) overrideCounterName.textContent = cnt.name;

    if (overrideQueuesCheckboxes) {
      overrideQueuesCheckboxes.innerHTML = currentQueues.map(function (q) {
        var isAssigned = Array.isArray(cnt.assigned_queue_ids) && cnt.assigned_queue_ids.includes(q.id);
        return (
          '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0; font-size:0.85rem;">' +
            '<input type="checkbox" name="overrideQueueItem" value="' + q.id + '"' + (isAssigned ? ' checked' : '') + '>' +
            '<span>' + escHtml(q.name) + '</span>' +
          '</label>'
        );
      }).join('');
    }

    queueStore.getConfig().then(function (res) {
      if (res.ok && res.users && overrideOperatorSelect) {
        overrideOperatorSelect.innerHTML = res.users.map(function (u) {
          var isCurrent = u.full_name === cnt.operator_name || u.id === cnt.current_user_id;
          return '<option value="' + u.id + '"' + (isCurrent ? ' selected' : '') + '>' + escHtml(u.full_name) + ' (' + escHtml(u.role) + ')</option>';
        }).join('');
      }
    });

    if (supervisorModal) supervisorModal.style.display = 'flex';
  }

  function closeSupervisorOverrideModal() {
    if (supervisorModal) supervisorModal.style.display = 'none';
    activeOverrideCounterId = null;
  }

  // -------------------------------------------------------------
  // 6. الإعدادات وتحديد نمط الخدمة
  // -------------------------------------------------------------
  function renderSettingsView() {
    if (serviceModeSelect && currentSettings.service_mode) {
      serviceModeSelect.value = currentSettings.service_mode;
    }
    if (targetMinutesInput && currentSettings.target_service_minutes) {
      targetMinutesInput.value = currentSettings.target_service_minutes;
    }
    if (alertThresholdInput && currentSettings.alert_threshold) {
      alertThresholdInput.value = currentSettings.alert_threshold;
    }
    if (safetyMultiplierInput && currentSettings.safety_multiplier) {
      safetyMultiplierInput.value = currentSettings.safety_multiplier;
    }
    if (snoozeMinutesInput && currentSettings.snooze_minutes) {
      snoozeMinutesInput.value = currentSettings.snooze_minutes;
    }

    var tenantSlug = queueStore.getTenantSlug();
    var url = window.location.origin + '/queue.html?tenant=' + encodeURIComponent(tenantSlug);
    if (qrLinkInput) qrLinkInput.value = url;
    if (qrCodeImg) {
      qrCodeImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(url);
    }
  }

  // -------------------------------------------------------------
  // 7. ربط الأحداث وعمليات النقر واختصارات لوحة المفاتيح
  // -------------------------------------------------------------
  function bindEvents() {
    // 7.1 تبديل مساحات العمل (Tabs)
    viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchWorkspaceView(btn.getAttribute('data-view'));
      });
    });

    // 7.2 أحداث الاستقبال (Dispatcher)
    if (dispatcherNewTicketBtn) dispatcherNewTicketBtn.addEventListener('click', openManualTicketModal);
    if (dispatcherBroadcastBtn) dispatcherBroadcastBtn.addEventListener('click', openBroadcastModal);

    // البحث السريع
    if (dispatcherSearchInput) {
      dispatcherSearchInput.addEventListener('input', function () {
        var q = dispatcherSearchInput.value.trim();
        if (q.length < 1) {
          if (dispatcherSearchResults) dispatcherSearchResults.style.display = 'none';
          return;
        }

        queueStore.searchTickets(q).then(function (res) {
          if (!dispatcherSearchResults) return;
          if (!res.ok || !res.tickets || !res.tickets.length) {
            dispatcherSearchResults.innerHTML = '<div style="padding:10px; font-size:0.82rem; color:var(--color-text-muted);">لم يتم العثور على تذاكر مطابقة.</div>';
            dispatcherSearchResults.style.display = 'block';
            return;
          }

          var html = res.tickets.map(function (t) {
            return (
              '<div style="padding:8px 12px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center;">' +
                '<div>' +
                  '<strong style="color:#1e3a8a;">#' + escHtml(t.ticket_number) + '</strong> - ' +
                  '<span style="font-size:0.82rem;">' + escHtml(t.customer_name) + '</span>' +
                  '<div style="font-size:0.75rem; color:var(--color-text-muted);">' + escHtml(t.queue_name) + ' (' + escHtml(t.status) + ')</div>' +
                '</div>' +
                '<button type="button" class="btn btn--sm btn-search-transfer" data-ticket-id="' + t.id + '" style="font-size:0.75rem; padding:3px 8px;">تحويل 🔀</button>' +
              '</div>'
            );
          }).join('');

          dispatcherSearchResults.innerHTML = html;
          dispatcherSearchResults.style.display = 'block';

          dispatcherSearchResults.querySelectorAll('.btn-search-transfer').forEach(function (btn) {
            btn.addEventListener('click', function () {
              dispatcherSearchResults.style.display = 'none';
              openTransferModal(btn.getAttribute('data-ticket-id'));
            });
          });
        });
      });
    }

    // 7.3 أحداث موظف الكاونتر (Counter Workspace)
    if (counterWorkspaceSelect) {
      counterWorkspaceSelect.addEventListener('change', function () {
        activeCounterId = counterWorkspaceSelect.value;
        renderCounterWorkspace();
      });
    }

    // استدعاء العميل التالي (الزر الضخم)
    if (counterCallNextBigBtn) {
      counterCallNextBigBtn.addEventListener('click', function () {
        if (!activeCounterId) return;
        counterCallNextBigBtn.disabled = true;
        counterCallNextBigBtn.textContent = 'جاري البحث في الطابور...';

        queueStore.callNext(activeCounterId).then(function (res) {
          counterCallNextBigBtn.disabled = false;
          counterCallNextBigBtn.innerHTML = '▶️ استدعاء العميل التالي';

          if (res.ok) {
            if (res.ticket) {
              toast('تم نداء العميل: ' + res.ticket.ticket_number, 'success');
              refresh();
            } else if (res.bumpedTicket) {
              toast('العميل قيد الخدمة في مسار آخر وتم حفظ دوره ذكياً (+1 Bump)', 'info');
              refresh();
            } else {
              toast(res.message || 'لا يوجد عملاء في مسارك حالياً.', 'info');
            }
          }
        }).catch(function (err) {
          counterCallNextBigBtn.disabled = false;
          counterCallNextBigBtn.innerHTML = '▶️ استدعاء العميل التالي';
          toast(err.message, 'error');
        });
      });
    }

    // إنهاء المعاملة
    if (counterCompleteBtn) {
      counterCompleteBtn.addEventListener('click', function () {
        if (!activeCounterId) return;
        counterCompleteBtn.disabled = true;
        queueStore.completeService(activeCounterId).then(function (res) {
          counterCompleteBtn.disabled = false;
          if (res.ok) {
            toast('تم إنهاء المعاملة وتحديث كفاءة الكاونتر ✅', 'success');
            refresh();
          }
        }).catch(function (err) {
          counterCompleteBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // تحويل من الكاونتر الحالي
    if (counterTransferBtn) {
      counterTransferBtn.addEventListener('click', function () {
        var cnt = currentCounters.find(function (c) { return c.id === activeCounterId; });
        if (cnt && cnt.current_ticket_id) {
          openTransferModal(cnt.current_ticket_id);
        } else {
          toast('لا توجد معاملة نشطة لتحويلها.', 'error');
        }
      });
    }

    // تعليق مؤقت (Put On Hold)
    if (counterHoldBtn) {
      counterHoldBtn.addEventListener('click', function () {
        if (!activeCounterId) return;
        if (confirm('هل ترغب بتعليق هذه المعاملة مؤقتاً لتتمكن من خدمة العميل التالي؟')) {
          queueStore.holdTicket(activeCounterId).then(function (res) {
            if (res.ok) {
              toast('تم تعليق المعاملة مؤقتاً ⏸️', 'info');
              refresh();
            }
          }).catch(function (err) {
            toast(err.message, 'error');
          });
        }
      });
    }

    // إعادة النداء (Recall)
    if (counterRecallBtn) {
      counterRecallBtn.addEventListener('click', function () {
        if (!activeCounterId) return;
        counterRecallBtn.disabled = true;
        queueStore.recallTicket(activeCounterId).then(function (res) {
          counterRecallBtn.disabled = false;
          if (res.ok) {
            toast('تم إعادة إطلاق النداء والتنبيه الصوتي 📢', 'info');
          }
        }).catch(function (err) {
          counterRecallBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // أحداث استراحة الكاونتر وتبديل الورديات
    if (counterWorkspaceBreakBtn) {
      counterWorkspaceBreakBtn.addEventListener('click', openBreakModal);
    }
    if (closeBreakModalBtn) closeBreakModalBtn.addEventListener('click', closeBreakModal);
    if (cancelBreakBtn) cancelBreakBtn.addEventListener('click', closeBreakModal);

    if (breakRequestForm) {
      breakRequestForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!activeCounterId) return;
        var checkedReason = document.querySelector('input[name="breakReasonOption"]:checked');
        var reason = checkedReason ? checkedReason.value : 'rest';

        var submitBtn = document.getElementById('submitBreakBtn');
        if (submitBtn) submitBtn.disabled = true;

        queueStore.startBreak({ counterId: activeCounterId, reason: reason }).then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          closeBreakModal();
          if (res.ok) {
            toast('تم بدء الاستراحة وسحب الكاونتر من الطاقة الاستيعابية ☕', 'info');
            refresh();
          }
        }).catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    if (counterEndBreakBtn) {
      counterEndBreakBtn.addEventListener('click', function () {
        if (!activeCounterId) return;
        counterEndBreakBtn.disabled = true;
        queueStore.endBreak(activeCounterId).then(function (res) {
          counterEndBreakBtn.disabled = false;
          if (res.ok) {
            toast('تم استئناف العمل وعودة الكاونتر للطاقة الاستيعابية 🟢', 'success');
            refresh();
          }
        }).catch(function (err) {
          counterEndBreakBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // أحداث تسليم الوردية السريع (Hot Swap)
    if (counterHotSwapBtn) counterHotSwapBtn.addEventListener('click', openHotSwapModal);
    if (closeHotSwapModalBtn) closeHotSwapModalBtn.addEventListener('click', closeHotSwapModal);
    if (cancelHotSwapBtn) cancelHotSwapBtn.addEventListener('click', closeHotSwapModal);

    if (hotSwapForm) {
      hotSwapForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!activeCounterId) return;
        var pin = hotSwapIncomingPin ? hotSwapIncomingPin.value.trim() : '';
        var checkedOpt = document.querySelector('input[name="hotSwapHandoverOption"]:checked');
        var option = checkedOpt ? checkedOpt.value : 'handover_active';
        var notes = hotSwapNotesInput ? hotSwapNotesInput.value.trim() : '';

        var submitBtn = document.getElementById('submitHotSwapBtn');
        if (submitBtn) submitBtn.disabled = true;

        queueStore.hotSwapCounter({
          counterId: activeCounterId,
          incomingPin: pin,
          handoverOption: option,
          handoverNotes: notes
        }).then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          closeHotSwapModal();
          if (res.ok) {
            toast('تم تسليم الوردية للموظف البديل (' + res.newAgent.full_name + ') بنجاح دون انقطاع 🚀', 'success');
            refresh();
          }
        }).catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // أحداث تسليم وردية الاستقبال (Reception Handover)
    if (dispatcherHandoverBtn) dispatcherHandoverBtn.addEventListener('click', openReceptionHandoverModal);
    if (closeRecHandoverBtn) closeRecHandoverBtn.addEventListener('click', closeReceptionHandoverModal);
    if (cancelRecHandoverBtn) cancelRecHandoverBtn.addEventListener('click', closeReceptionHandoverModal);

    if (receptionHandoverForm) {
      receptionHandoverForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var pin = incomingReceptionPin ? incomingReceptionPin.value.trim() : '';
        var notes = receptionHandoverNotes ? receptionHandoverNotes.value.trim() : '';

        var submitBtn = document.getElementById('submitReceptionHandoverBtn');
        if (submitBtn) submitBtn.disabled = true;

        queueStore.receptionHandover({
          outgoingUserId: 'usr-rec-default',
          incomingPin: pin,
          handoverNotes: notes
        }).then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          closeReceptionHandoverModal();
          if (res.ok) {
            toast('تم اعتماد تسليم شاشة القيادة للزميل (' + res.incomingUser.full_name + ') بنجاح 📋', 'success');
            refresh();
          }
        }).catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // أحداث تحكم المشرف بالكاونترات (Supervisor Override)
    if (closeOverrideModalBtn) closeOverrideModalBtn.addEventListener('click', closeSupervisorOverrideModal);
    if (cancelOverrideBtn) cancelOverrideBtn.addEventListener('click', closeSupervisorOverrideModal);

    if (overrideForceSignoutBtn) {
      overrideForceSignoutBtn.addEventListener('click', function () {
        if (!activeOverrideCounterId) return;
        if (confirm('هل أنت متأكد من إنهاء جلسة هذا الكاونتر قسرياً؟')) {
          queueStore.supervisorForceSignout({ counterId: activeOverrideCounterId, targetStatus: 'offline' }).then(function (res) {
            closeSupervisorOverrideModal();
            toast('تم إنهاء جلسة الكاونتر قسرياً 🚪', 'info');
            refresh();
          }).catch(function (err) {
            toast(err.message, 'error');
          });
        }
      });
    }

    if (overrideForceBreakBtn) {
      overrideForceBreakBtn.addEventListener('click', function () {
        if (!activeOverrideCounterId) return;
        queueStore.supervisorForceSignout({ counterId: activeOverrideCounterId, targetStatus: 'on_break' }).then(function (res) {
          closeSupervisorOverrideModal();
          toast('تم تحويل الكاونتر إلى استراحة عن بُعد ☕', 'info');
          refresh();
        }).catch(function (err) {
          toast(err.message, 'error');
        });
      });
    }

    if (submitOverrideReassignBtn) {
      submitOverrideReassignBtn.addEventListener('click', function () {
        if (!activeOverrideCounterId) return;
        var selectedQueues = [];
        document.querySelectorAll('input[name="overrideQueueItem"]:checked').forEach(function (cb) {
          selectedQueues.push(cb.value);
        });
        var newUserId = overrideOperatorSelect ? overrideOperatorSelect.value : null;

        submitOverrideReassignBtn.disabled = true;
        queueStore.supervisorReassignCounter({
          counterId: activeOverrideCounterId,
          newQueueIds: selectedQueues,
          newUserId: newUserId
        }).then(function (res) {
          submitOverrideReassignBtn.disabled = false;
          closeSupervisorOverrideModal();
          toast('تم تحديث مسارات الكاونتر والموظف المشغل بنجاح ✅', 'success');
          refresh();
        }).catch(function (err) {
          submitOverrideReassignBtn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // 7.4 أحداث نافذة التحويل الذكي
    if (closeTransferModalBtn) closeTransferModalBtn.addEventListener('click', closeTransferModal);
    if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', closeTransferModal);

    if (transferTicketForm) {
      transferTicketForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!pendingTransferTicketId) return;

        var toQueueId = transferTargetQueueSelect ? transferTargetQueueSelect.value : null;
        var checkedPriority = document.querySelector('input[name="transferPriorityOption"]:checked');
        var priorityLevel = checkedPriority ? checkedPriority.value : 'standard';
        var notes = transferNotesInput ? transferNotesInput.value.trim() : '';

        var confirmBtn = document.getElementById('confirmTransferBtn');
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'جاري التحويل...';
        }

        var isCounterMode = currentWorkspaceMode === 'counter';
        queueStore.transferTicket({
          ticketId: pendingTransferTicketId,
          toQueueId: toQueueId,
          priorityLevel: priorityLevel,
          transferNotes: notes,
          userRole: isCounterMode ? 'counter_agent' : 'receptionist',
          counterId: isCounterMode ? activeCounterId : null
        }).then(function (res) {
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'تأكيد التحويل الآن 🔀';
          }
          closeTransferModal();
          if (res.ok) {
            toast('تم تحويل التذكرة بنجاح إلى القسم المستهدف!', 'success');
            refresh();
          }
        }).catch(function (err) {
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'تأكيد التحويل الآن 🔀';
          }
          toast(err.message, 'error');
        });
      });
    }

    // 7.5 أحداث نافذة التذكرة اليدوية
    if (closeManualTicketModalBtn) closeManualTicketModalBtn.addEventListener('click', closeManualTicketModal);
    if (cancelManualTicketBtn) cancelManualTicketBtn.addEventListener('click', closeManualTicketModal);

    if (manualTicketForm) {
      manualTicketForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var qId = manualTicketQueueSelect ? manualTicketQueueSelect.value : null;
        var name = manualCustomerNameInput ? manualCustomerNameInput.value.trim() : 'مراجع صالة';
        var phone = manualCustomerPhoneInput ? manualCustomerPhoneInput.value.trim() : '';
        var notes = manualTicketNotesInput ? manualTicketNotesInput.value.trim() : '';

        var btn = document.getElementById('submitManualTicketBtn');
        if (btn) btn.disabled = true;

        queueStore.issueManualTicket({
          queueId: qId,
          customerName: name,
          customerPhone: phone,
          notes: notes
        }).then(function (res) {
          if (btn) btn.disabled = false;
          closeManualTicketModal();
          if (res.ok) {
            toast('تم إصدار التذكرة رقم (' + res.ticket.ticket_number + ') بنجاح 🖨️', 'success');
            refresh();
          }
        }).catch(function (err) {
          if (btn) btn.disabled = false;
          toast(err.message, 'error');
        });
      });
    }

    // 7.6 أحداث نافذة الإشعار العام
    if (closeBroadcastModalBtn) closeBroadcastModalBtn.addEventListener('click', closeBroadcastModal);
    if (cancelBroadcastBtn) cancelBroadcastBtn.addEventListener('click', closeBroadcastModal);

    if (broadcastNoticeForm) {
      broadcastNoticeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = broadcastNoticeTextInput ? broadcastNoticeTextInput.value.trim() : '';
        if (!text) return;

        queueStore.broadcastNotice(text).then(function (res) {
          closeBroadcastModal();
          if (res.ok) toast('تم بث الإشعار بنجاح لجميع الشاشات 📢', 'success');
        });
      });
    }

    // 7.7 حفظ الإعدادات
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', function () {
        var newSettings = {
          service_mode: serviceModeSelect ? serviceModeSelect.value : 'hybrid',
          target_service_minutes: targetMinutesInput ? parseInt(targetMinutesInput.value, 10) : 10,
          alert_threshold: alertThresholdInput ? parseInt(alertThresholdInput.value, 10) : 2,
          safety_multiplier: safetyMultiplierInput ? parseFloat(safetyMultiplierInput.value) : 1.15,
          snooze_minutes: snoozeMinutesInput ? parseInt(snoozeMinutesInput.value, 10) : 5
        };

        queueStore.saveConfig({ settings: newSettings }).then(function (res) {
          if (res.ok) {
            if (servicesStore && typeof servicesStore.loadConfig === 'function') {
              var mainCfg = servicesStore.loadConfig();
              mainCfg.queue = Object.assign({}, mainCfg.queue || {}, newSettings);
              servicesStore.saveConfig(mainCfg);
            }
            toast('تم حفظ إعدادات ونمط المنشأة بنجاح! 💾', 'success');
          }
        });
      });
    }

    if (openHallDisplayBtn) {
      openHallDisplayBtn.addEventListener('click', function () {
        var slug = queueStore.getTenantSlug();
        window.open('queue-display.html?tenant=' + encodeURIComponent(slug), '_blank');
      });
    }

    // 7.8 اختصارات لوحة المفاتيح لموظف الكاونتر
    document.addEventListener('keydown', function (e) {
      // فقط عند التواجد في شاشة الكاونتر وعدم وجود نافذة منبثقة مفتوحة
      if (currentWorkspaceMode === 'counter' && (!transferModal || transferModal.style.display === 'none')) {
        // مسافة (Space) للنداء إذا كان الكاونتر شاغراً
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          var cnt = currentCounters.find(function (c) { return c.id === activeCounterId; });
          if (cnt && !cnt.current_ticket_id && counterCallNextBigBtn && !counterCallNextBigBtn.disabled) {
            e.preventDefault();
            counterCallNextBigBtn.click();
          }
        }
        // إنتر (Enter) لإنهاء المعاملة إذا كان يخدم
        if (e.code === 'Enter' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          var cnt = currentCounters.find(function (c) { return c.id === activeCounterId; });
          if (cnt && cnt.current_ticket_id && counterCompleteBtn && !counterCompleteBtn.disabled) {
            e.preventDefault();
            counterCompleteBtn.click();
          }
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 8. الاستماع لأحداث SSE الحية
  // -------------------------------------------------------------
  function setupSSE() {
    queueStore.listenToEvents(function (evt) {
      if (['ticket_created', 'ticket_called', 'ticket_in_service', 'service_completed', 'ticket_transferred', 'ticket_held', 'ticket_snoozed', 'counter_status_changed', 'counter_swapped', 'reception_handover'].indexOf(evt) !== -1) {
        refresh();
      }
    });
  }

  // واجهة الوحدة
  window.MkenAdminQueue = {
    refresh: refresh,
    init: function () {
      bindEvents();
      switchWorkspaceView('dispatcher');
      setupSSE();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.MkenAdminQueue.init);
  } else {
    window.MkenAdminQueue.init();
  }

})();
