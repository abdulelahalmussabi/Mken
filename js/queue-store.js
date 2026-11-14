/**
 * مَكَن (Mken Platform) - مكتبة متجر الطوابير والاتصال بالمحرك (Queue Store SDK)
 * يدعم الاسترجاع اللحظي للتذاكر (State Recovery)، المحرك الزمني EWMA، والربط مع SSE
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;

  function getTenantSlug() {
    if (store && typeof store.getCurrentTenantSlug === 'function') {
      return store.getCurrentTenantSlug() || 'default';
    }
    var params = new URLSearchParams(window.location.search);
    return params.get('tenant') || 'default';
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
    var slug = getTenantSlug();
    var query = '?action=' + encodeURIComponent(action) + '&tenant=' + encodeURIComponent(slug);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        query += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extraParams[k]);
      });
    }

    var options = {
      method: method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
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

  function listenToEvents(onMessageCallback, onErrorCallback) {
    if (activeEventSource) {
      try { activeEventSource.close(); } catch (e) {}
    }

    var slug = getTenantSlug();
    var url = '/api/v1/queue?action=events&tenant=' + encodeURIComponent(slug);

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

    getConfig: function () {
      return apiCall('get-config', 'GET');
    },

    saveConfig: function (configData) {
      return apiCall('save-config', 'POST', configData);
    },

    listQueues: function () {
      return apiCall('list-queues', 'GET');
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

    listenToEvents: listenToEvents
  };

})();
