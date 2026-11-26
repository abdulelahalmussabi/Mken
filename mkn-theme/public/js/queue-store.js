/**
 * مَكَن (Mken Platform) - مكتبة متجر الطوابير والاتصال بالمحرك (Queue Store SDK)
 * يدعم الاسترجاع اللحظي للتذاكر (State Recovery)، المحرك الزمني EWMA، والربط مع SSE
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;

  function slugFromLocation() {
    if (typeof window === 'undefined' || !window.location) return '';
    var host = String(window.location.hostname || '').toLowerCase();
    var skip = { www: 1, admin: 1, mken: 1, license: 1, licenses: 1, api: 1 };
    if (host === 'rewa.care' || host === 'www.rewa.care') return 'rewa';
    if (host.endsWith('.mken.live')) {
      var parts = host.slice(0, -'.mken.live'.length).split('.');
      var head = parts[0] === 'www' ? parts[1] : parts[0];
      if (head && !skip[head]) return head;
    }
    if (host.endsWith('.localhost')) {
      var localHead = host.split('.')[0];
      if (localHead && localHead !== 'www') return localHead;
    }
    return '';
  }

  function getTenantSlug() {
    var fromHost = slugFromLocation();
    if (fromHost) return fromHost;
    if (store && typeof store.getCurrentTenantSlug === 'function') {
      var slug = store.getCurrentTenantSlug();
      if (slug && slug !== 'default') return slug;
    }
    return '';
  }

  function getSessionStorageKey(slug) {
    return 'mken_queue_session_' + (slug || getTenantSlug());
  }

  function getSavedSession(slug) {
    try {
      var raw = localStorage.getItem(getSessionStorageKey(slug));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(sessionData, slug) {
    try {
      localStorage.setItem(getSessionStorageKey(slug), JSON.stringify(sessionData));
    } catch (e) {
      console.warn('[Queue Session Save Error]', e);
    }
  }

  function clearSession(slug) {
    try {
      localStorage.removeItem(getSessionStorageKey(slug));
    } catch (e) {}
  }

  function apiCall(action, method, body, extraParams) {
    var query = '?action=' + encodeURIComponent(action);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        query += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extraParams[k]);
      });
    }

    var headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    try {
      if (window.MkenSession && typeof window.MkenSession.getAuthHeaders === 'function') {
        var authH = window.MkenSession.getAuthHeaders(getTenantSlug());
        Object.assign(headers, authH);
      }
      var adminPin = sessionStorage.getItem('mken_admin_pin') || localStorage.getItem('mken_admin_pin');
      if (adminPin && !headers['x-admin-pin']) {
        headers['x-admin-pin'] = adminPin;
      }
      var staffTok = sessionStorage.getItem('mken_queue_staff_token');
      if (staffTok) {
        headers['x-queue-staff-token'] = staffTok;
      }
      var kioskTok = sessionStorage.getItem('mken_kiosk_token') || localStorage.getItem('mken_kiosk_token');
      if (kioskTok) {
        headers['x-kiosk-token'] = kioskTok;
      }
      var devId = localStorage.getItem('mken_device_id');
      if (!devId) {
        try {
          devId = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
          localStorage.setItem('mken_device_id', devId);
        } catch (e) {}
      }
      if (devId) {
        headers['x-device-id'] = devId;
      }
      if (store && typeof store.isAdminLoggedIn === 'function' && store.isAdminLoggedIn()) {
        headers['x-admin-authenticated'] = '1';
      }
      if (window.MkenAdminAuth && typeof window.MkenAdminAuth.isSuperAdmin === 'function' && window.MkenAdminAuth.isSuperAdmin()) {
        headers['x-is-super-admin'] = '1';
      }
      var activeRev = sessionStorage.getItem('mken_queue_state_revision');
      var activeDelta = sessionStorage.getItem('mken_queue_capacity_delta');
      if (activeRev) headers['x-state-revision'] = activeRev;
      if (activeDelta) headers['x-override-delta'] = activeDelta;
    } catch (e) {}

    var options = {
      method: method || 'GET',
      headers: headers,
      credentials: 'same-origin'
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch('/api/v1/queue' + query, options).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error || 'فشل الاتصال بمحرك الطوابير (' + res.status + ')');
        });
      }
      return res.json();
    });
  }

  // -------------------------------------------------------------
  // الاستماع للأحداث الحية عبر Server-Sent Events (SSE)
  // -------------------------------------------------------------
  var activeEventSource = null;

  function listenToEvents(onMessageCallback, onErrorCallback, options) {
    if (activeEventSource) {
      try { activeEventSource.close(); } catch (e) {}
    }

    var url = '/api/v1/queue?action=events';
    if (options && typeof options === 'object') {
      if (options.branchId) url += '&branchId=' + encodeURIComponent(options.branchId);
      if (options.zoneId) url += '&zoneId=' + encodeURIComponent(options.zoneId);
      if (options.sessionToken) url += '&sessionToken=' + encodeURIComponent(options.sessionToken);
    }

    if (typeof EventSource === 'undefined') {
      console.warn('[SSE] EventSource is not supported in this browser; fallback to polling');
      return null;
    }

    try {
      activeEventSource = new EventSource(url);

      var eventNames = [
        'connected', 
        'ticket_created', 
        'ticket_called', 
        'ticket_in_service', 
        'service_completed', 
        'ticket_snoozed', 
        'ticket_held',
        'ticket_transferred',
        'counter_status_changed',
        'counter_swapped',
        'agent_break_started',
        'agent_break_ended',
        'counter_forced_signout',
        'counter_reassigned',
        'reception_handover',
        'override_applied',
        'config_updated', 
        'system_notice'
      ];

      eventNames.forEach(function (evtName) {
        activeEventSource.addEventListener(evtName, function (e) {
          try {
            var data = JSON.parse(e.data);
            if (typeof onMessageCallback === 'function') {
              onMessageCallback(evtName, data);
            }
          } catch (err) {
            console.error('[SSE Parse Error]', err);
          }
        });
      });

      activeEventSource.onerror = function (err) {
        if (typeof onErrorCallback === 'function') onErrorCallback(err);
      };

      return activeEventSource;
    } catch (err) {
      console.warn('[SSE Init Error]', err);
      return null;
    }
  }

  // -------------------------------------------------------------
  // واجهة برمجة تطبيقات كائن المتجر (Public SDK)
  // -------------------------------------------------------------
  window.MkenQueueStore = {
    getTenantSlug: getTenantSlug,
    getSavedSession: getSavedSession,
    saveSession: saveSession,
    clearSession: clearSession,

    getConfig: function (extraParams) {
      return apiCall('get-config', 'GET', null, extraParams);
    },

    getStaffConfig: function (extraParams) {
      return apiCall('staff-config', 'GET', null, extraParams);
    },

    listZones: function (params) {
      return apiCall('list-zones', 'GET', null, params);
    },

    upsertZone: function (payload) {
      return apiCall('upsert-zone', 'POST', payload);
    },

    deleteZone: function (zoneId) {
      return apiCall('delete-zone', 'POST', { zoneId: zoneId });
    },

    saveConfig: function (configData) {
      return apiCall('save-config', 'POST', configData);
    },

    listQueues: function (extraParams) {
      return apiCall('list-queues', 'GET', null, extraParams);
    },

    listStaffQueues: function (extraParams) {
      return apiCall('staff-board', 'GET', null, extraParams);
    },

    joinQueue: function (payload) {
      return apiCall('join-queue', 'POST', payload);
    },

    getTicketStatus: function (tokenOrId, isId) {
      var params = isId ? { ticket_id: tokenOrId } : { session_token: tokenOrId };
      return apiCall('get-ticket-status', 'GET', null, params);
    },

    callNext: function (counterId) {
      return apiCall('call-next', 'POST', { counterId: counterId });
    },

    startService: function (counterId) {
      return apiCall('start-service', 'POST', { counterId: counterId });
    },

    completeService: function (counterId) {
      return apiCall('complete-service', 'POST', { counterId: counterId });
    },

    transferTicket: function (payload) {
      return apiCall('transfer-ticket', 'POST', payload);
    },

    holdTicket: function (counterId) {
      return apiCall('hold-ticket', 'POST', { counterId: counterId });
    },

    recallTicket: function (counterId) {
      return apiCall('recall-ticket', 'POST', { counterId: counterId });
    },

    dispatchCall: function (payload) {
      return apiCall('dispatch-call', 'POST', payload);
    },

    issueManualTicket: function (payload) {
      return apiCall('manual-ticket', 'POST', payload);
    },

    restoreTicket: function (payload) {
      return apiCall('restore-ticket', 'POST', payload);
    },

    searchTickets: function (q) {
      return apiCall('search-tickets', 'GET', null, { q: q });
    },

    broadcastNotice: function (message) {
      return apiCall('broadcast-notice', 'POST', { message: message });
    },

    snoozeNoShow: function (counterId) {
      return apiCall('snooze-no-show', 'POST', { counterId: counterId });
    },

    setCounterStatus: function (counterId, status) {
      return apiCall('counter-status', 'POST', { counterId: counterId, status: status });
    },

    checkLongTransactions: function () {
      return apiCall('check-long-transactions', 'GET');
    },

    hotSwapCounter: function (payload) {
      return apiCall('hot-swap-authenticate', 'POST', payload);
    },

    startBreak: function (payload) {
      return apiCall('start-break', 'POST', payload);
    },

    endBreak: function (counterId) {
      return apiCall('end-break', 'POST', { counterId: counterId });
    },

    supervisorForceSignout: function (payload) {
      return apiCall('supervisor-force-signout', 'POST', payload);
    },

    supervisorReassignCounter: function (payload) {
      return apiCall('supervisor-reassign-counter', 'POST', payload);
    },

    getReceptionShiftSummary: function () {
      return apiCall('reception-shift-summary', 'GET');
    },

    receptionHandover: function (payload) {
      return apiCall('reception-handover', 'POST', payload);
    },

    addCounter: function (payload) {
      return apiCall('add-counter', 'POST', payload);
    },

    updateCounter: function (payload) {
      return apiCall('update-counter', 'POST', payload);
    },

    deleteCounter: function (counterId) {
      return apiCall('delete-counter', 'POST', { counterId: counterId });
    },

    createQueue: function (payload) {
      return apiCall('create-queue', 'POST', payload);
    },

    updateQueue: function (payload) {
      return apiCall('update-queue', 'POST', payload);
    },

    deleteQueue: function (queueId) {
      return apiCall('delete-queue', 'POST', { queueId: queueId });
    },

    manualOverride: function (payload) {
      return apiCall('manual-override', 'POST', payload);
    },

    getOverrideState: function () {
      return apiCall('get-override-state', 'GET');
    },

    publicGate: function () {
      return apiCall('public-gate', 'GET');
    },

    getHallPolicy: function () {
      return apiCall('get-hall-policy', 'GET');
    },

    saveHallPolicy: function (payload) {
      return apiCall('save-hall-policy', 'POST', payload);
    },

    previewDisplay: function (payload) {
      return apiCall('preview-display', 'POST', payload);
    },

    bindPlace: function (payload) {
      return apiCall('bind-place', 'POST', payload);
    },

    staffLogin: function (pin) {
      return apiCall('staff-login', 'POST', { pin: pin });
    },

    appointmentCheckin: function (payload) {
      return apiCall('appointment-checkin', 'POST', payload);
    },

    hisAppointmentSync: function (payload) {
      return apiCall('his-appointment-sync', 'POST', payload);
    },

    listKiosks: function (params) {
      return apiCall('list-kiosks', 'GET', null, params);
    },

    upsertKiosk: function (payload) {
      return apiCall('upsert-kiosk', 'POST', payload);
    },

    rotateKioskToken: function (kioskId) {
      return apiCall('rotate-kiosk-token', 'POST', { kioskId: kioskId });
    },

    getBillingSummary: function () {
      return apiCall('billing-summary', 'GET');
    },

    purchaseExtraZones: function (quantity) {
      return apiCall('purchase-extra-zones', 'POST', { quantity: quantity || 1 });
    },

    enableOnPremiseAddon: function (hardwareFingerprint) {
      return apiCall('enable-on-premise-addon', 'POST', { hardwareFingerprint: hardwareFingerprint || null });
    },

    setKioskToken: function (token) {
      try {
        if (token) {
          sessionStorage.setItem('mken_kiosk_token', token);
        } else {
          sessionStorage.removeItem('mken_kiosk_token');
        }
      } catch (e) {}
    },

    getDeviceId: function () {
      try {
        var devId = localStorage.getItem('mken_device_id');
        if (!devId) {
          devId = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
          localStorage.setItem('mken_device_id', devId);
        }
        return devId;
      } catch (e) {
        return null;
      }
    },

    listenToEvents: listenToEvents
  };

})();
