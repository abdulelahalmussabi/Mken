/**
 * js/unified-session.js — مركز الجلسة الموحدة وتسجيل الدخول الصامت (Unified Session Hub & SSO)
 * منصة مكّن — يدعم استمرارية الهوية للعملاء والموظفين، ومزامنة التبويبات الفورية (Cross-Tab Sync)
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MkenSession = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'mken_unified_session';
  var BROADCAST_CHANNEL_NAME = 'mken_session_bus';
  var bus = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bus = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    }
  } catch (e) {
    bus = null;
  }

  function getSafeStorage() {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    // Mock storage for headless or node test environments
    if (typeof global !== 'undefined' && global.__mockLocalStorage) {
      return global.__mockLocalStorage;
    }
    return null;
  }

  function getSafeSessionStorage() {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
    if (typeof global !== 'undefined' && global.__mockSessionStorage) {
      return global.__mockSessionStorage;
    }
    return null;
  }

  function getSession() {
    var storage = getSafeStorage();
    if (!storage) return null;
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[UnifiedSession] Failed to parse session:', e);
    }

    // Fallback: migrate legacy credentials if present
    return migrateLegacySession();
  }

  function migrateLegacySession() {
    var sessionStore = getSafeSessionStorage();
    var localStore = getSafeStorage();
    var session = {
      version: 1,
      updatedAt: Date.now(),
      customerProfile: {},
      staffAuth: {},
      activeTenant: 'default'
    };

    var migrated = false;

    // 1. Staff PIN / SuperAdmin
    if (sessionStore) {
      var legacyPin = sessionStore.getItem('mken_admin_pin');
      var isSuper = sessionStore.getItem('mken_super_admin') === '1';
      if (legacyPin || isSuper) {
        session.staffAuth['default'] = {
          pin: legacyPin || '',
          isSuperAdmin: isSuper,
          role: isSuper ? 'super_admin' : 'admin',
          authenticatedAt: Date.now()
        };
        migrated = true;
      }
    }

    // 2. Customer Phone & Name from legacy localStorage
    if (localStore) {
      var legacyPhone = localStore.getItem('mken_customer_phone');
      var legacyName = localStore.getItem('mken_customer_name');
      if (legacyPhone || legacyName) {
        session.customerProfile.phone = legacyPhone || '';
        session.customerProfile.name = legacyName || '';
        migrated = true;
      }
    }

    if (migrated) {
      saveSession(session, false);
      return session;
    }

    return null;
  }

  function saveSession(sessionData, broadcast) {
    var storage = getSafeStorage();
    if (!storage) return false;
    try {
      sessionData.updatedAt = Date.now();
      storage.setItem(STORAGE_KEY, JSON.stringify(sessionData));

      if (broadcast !== false && bus) {
        try {
          bus.postMessage({ type: 'SESSION_UPDATED', session: sessionData });
        } catch (e) { /* ignore */ }
      }
      return true;
    } catch (e) {
      console.warn('[UnifiedSession] Failed to save session:', e);
      return false;
    }
  }

  function getCustomerProfile() {
    var session = getSession();
    return (session && session.customerProfile) ? Object.assign({}, session.customerProfile) : null;
  }

  function updateCustomerProfile(profile) {
    if (!profile || typeof profile !== 'object') return false;
    var session = getSession() || {
      version: 1,
      updatedAt: Date.now(),
      customerProfile: {},
      staffAuth: {},
      activeTenant: 'default'
    };

    if (profile.name) session.customerProfile.name = String(profile.name).trim();
    if (profile.phone) session.customerProfile.phone = String(profile.phone).trim();
    if (profile.email) session.customerProfile.email = String(profile.email).trim();
    session.customerProfile.lastSeenAt = Date.now();

    // Mirror to legacy keys for seamless backward compatibility
    var storage = getSafeStorage();
    if (storage) {
      try {
        if (session.customerProfile.name) storage.setItem('mken_customer_name', session.customerProfile.name);
        if (session.customerProfile.phone) storage.setItem('mken_customer_phone', session.customerProfile.phone);
      } catch (e) {}
    }

    return saveSession(session, true);
  }

  function getStaffAuth(tenantSlug) {
    var session = getSession();
    if (!session || !session.staffAuth) return null;
    var slug = tenantSlug || session.activeTenant || 'default';
    return session.staffAuth[slug] || session.staffAuth['default'] || null;
  }

  function setStaffAuth(tenantSlug, authData) {
    if (!authData) return false;
    var session = getSession() || {
      version: 1,
      updatedAt: Date.now(),
      customerProfile: {},
      staffAuth: {},
      activeTenant: tenantSlug || 'default'
    };

    var slug = tenantSlug || session.activeTenant || 'default';
    session.staffAuth[slug] = Object.assign({
      authenticatedAt: Date.now(),
      tenantSlug: slug
    }, authData);
    session.activeTenant = slug;

    // Sync to sessionStorage for legacy callers
    var sessionStore = getSafeSessionStorage();
    if (sessionStore) {
      try {
        if (authData.pin) sessionStore.setItem('mken_admin_pin', authData.pin);
        if (authData.isSuperAdmin) sessionStore.setItem('mken_super_admin', '1');
      } catch (e) {}
    }

    return saveSession(session, true);
  }

  function clearStaffAuth(tenantSlug) {
    var session = getSession();
    if (!session || !session.staffAuth) return false;
    var slug = tenantSlug || session.activeTenant || 'default';
    delete session.staffAuth[slug];

    var sessionStore = getSafeSessionStorage();
    if (sessionStore) {
      try {
        sessionStore.removeItem('mken_admin_pin');
        sessionStore.removeItem('mken_super_admin');
      } catch (e) {}
    }

    return saveSession(session, true);
  }

  function clearSession() {
    var storage = getSafeStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
        storage.removeItem('mken_customer_name');
        storage.removeItem('mken_customer_phone');
      } catch (e) {}
    }
    var sessionStore = getSafeSessionStorage();
    if (sessionStore) {
      try {
        sessionStore.removeItem('mken_admin_pin');
        sessionStore.removeItem('mken_super_admin');
      } catch (e) {}
    }
    if (bus) {
      try {
        bus.postMessage({ type: 'SESSION_CLEARED' });
      } catch (e) {}
    }
    return true;
  }

  function getAuthHeaders(tenantSlug) {
    var headers = {
      'Accept': 'application/json'
    };
    var auth = getStaffAuth(tenantSlug);
    if (auth) {
      if (auth.token) {
        headers['Authorization'] = 'Bearer ' + auth.token;
      }
      if (auth.pin) {
        headers['x-admin-pin'] = auth.pin;
      }
      if (auth.tenantSlug) {
        headers['x-tenant-slug'] = auth.tenantSlug;
      }
    }
    return headers;
  }

  function prefillCustomerInputs() {
    if (typeof document === 'undefined') return;
    var profile = getCustomerProfile();
    if (!profile) return;

    // Common customer name input targets across Mken pages
    var nameSelectors = [
      '#customerNameInput',
      '#customerName',
      '#bookingName',
      '#orderCustomerName',
      '#checkoutCustomerName',
      'input[name="customerName"]',
      'input[name="name"]'
    ];
    // Common phone input targets
    var phoneSelectors = [
      '#customerPhoneInput',
      '#customerPhone',
      '#bookingPhone',
      '#orderCustomerPhone',
      '#checkoutCustomerPhone',
      'input[name="customerPhone"]',
      'input[name="phone"]'
    ];

    if (profile.name) {
      for (var i = 0; i < nameSelectors.length; i++) {
        var el = document.querySelector(nameSelectors[i]);
        if (el && !el.value) {
          el.value = profile.name;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    if (profile.phone) {
      for (var j = 0; j < phoneSelectors.length; j++) {
        var tel = document.querySelector(phoneSelectors[j]);
        if (tel && !tel.value) {
          tel.value = profile.phone;
          tel.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  }

  function autoSyncSession(onUpdateCallback) {
    if (typeof window === 'undefined') return;

    // 1. Cross-tab storage listener
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) {
        var newSession = getSession();
        prefillCustomerInputs();
        if (typeof onUpdateCallback === 'function') {
          onUpdateCallback(newSession);
        }
      }
    });

    // 2. BroadcastChannel listener
    if (bus) {
      bus.onmessage = function (evt) {
        if (evt.data && (evt.data.type === 'SESSION_UPDATED' || evt.data.type === 'SESSION_CLEARED')) {
          prefillCustomerInputs();
          if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(evt.data.session || null);
          }
        }
      };
    }

    // Auto run prefill on DOM readiness
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', prefillCustomerInputs);
    } else {
      prefillCustomerInputs();
    }
  }

  // Auto initialize when loaded in browser
  if (typeof window !== 'undefined') {
    autoSyncSession();
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    getSession: getSession,
    saveSession: saveSession,
    getCustomerProfile: getCustomerProfile,
    updateCustomerProfile: updateCustomerProfile,
    getStaffAuth: getStaffAuth,
    setStaffAuth: setStaffAuth,
    clearStaffAuth: clearStaffAuth,
    clearSession: clearSession,
    getAuthHeaders: getAuthHeaders,
    prefillCustomerInputs: prefillCustomerInputs,
    autoSyncSession: autoSyncSession
  };
});
