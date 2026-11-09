/**
 * وحدة مصادقة وإدارة حسابات العملاء — منصة مكّن
 * تدعم تسجيل الدخول عبر Google OAuth و Sign in with Apple و Supabase Auth
 */
(function () {
  'use strict';

  var SESSION_STORAGE_KEY = 'mken_customer_session';
  var PROFILE_STORAGE_KEY = 'mken_customer_profile';
  var listeners = [];
  var _currentUser = null;
  var _currentProfile = null;

  function getSupabase() {
    if (window.MkenSupabaseDb && typeof window.MkenSupabaseDb.getClient === 'function') {
      return window.MkenSupabaseDb.getClient();
    }
    return null;
  }

  function getTenantSlug() {
    if (window.MkenServicesStore && typeof window.MkenServicesStore.getCurrentTenantSlug === 'function') {
      return window.MkenServicesStore.getCurrentTenantSlug();
    }
    return 'default';
  }

  function notifyListeners(user, profile) {
    _currentUser = user;
    _currentProfile = profile;
    listeners.forEach(function (fn) {
      try {
        fn(user, profile);
      } catch (e) {
        console.error('Customer Auth listener error:', e);
      }
    });
  }

  function loadCachedSession() {
    try {
      var rawUser = localStorage.getItem(SESSION_STORAGE_KEY);
      var rawProf = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (rawUser) _currentUser = JSON.parse(rawUser);
      if (rawProf) _currentProfile = JSON.parse(rawProf);
    } catch (e) {
      console.warn('Failed to parse cached customer session', e);
    }
  }

  function saveCachedSession(user, profile) {
    try {
      if (user) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (profile) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save customer session to storage', e);
    }
  }

  function syncProfileWithDb(user) {
    if (!user) return Promise.resolve(null);
    var sb = getSupabase();
    var tenantSlug = getTenantSlug();
    var userMeta = user.user_metadata || {};

    var name = userMeta.full_name || userMeta.name || (user.email ? user.email.split('@')[0] : 'عميل مكّن');
    var email = user.email || userMeta.email || null;
    var phone = user.phone || userMeta.phone || '';
    var avatar = userMeta.avatar_url || userMeta.picture || null;
    var provider = user.app_metadata ? user.app_metadata.provider : (userMeta.provider || 'social');

    var profileData = {
      id: 'cst_' + user.id.slice(0, 8),
      userId: user.id,
      tenantSlug: tenantSlug,
      name: name,
      email: email,
      phone: phone,
      avatarUrl: avatar,
      authProvider: provider,
      updatedAt: new Date().toISOString()
    };

    saveCachedSession(user, profileData);

    if (sb) {
      return sb
        .from('mken_customers')
        .upsert({
          id: profileData.id,
          tenant_slug: tenantSlug,
          user_id: user.id,
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          avatar_url: profileData.avatarUrl,
          auth_provider: profileData.authProvider,
          updated_at: profileData.updatedAt
        })
        .then(function () {
          return profileData;
        })
        .catch(function (err) {
          console.warn('Sync customer profile to DB warning:', err.message);
          return profileData;
        });
    }

    return Promise.resolve(profileData);
  }

  function init() {
    loadCachedSession();
    var sb = getSupabase();

    if (sb && sb.auth) {
      sb.auth.getSession().then(function (res) {
        if (res.data && res.data.session && res.data.session.user) {
          var user = res.data.session.user;
          syncProfileWithDb(user).then(function (prof) {
            notifyListeners(user, prof);
          });
        } else if (!_currentUser) {
          notifyListeners(null, null);
        }
      });

      sb.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_IN' && session && session.user) {
          syncProfileWithDb(session.user).then(function (prof) {
            notifyListeners(session.user, prof);
          });
        } else if (event === 'SIGNED_OUT') {
          saveCachedSession(null, null);
          notifyListeners(null, null);
        }
      });
    }

    return Promise.resolve({ user: _currentUser, profile: _currentProfile });
  }

  function loginWithOAuth(provider, customRedirect) {
    var sb = getSupabase();
    var redirectUrl = customRedirect || (window.location.origin + '/auth/callback');

    try {
      localStorage.setItem('mken_auth_redirect_to', window.location.href);
    } catch (e) {}

    if (!sb || !sb.auth) {
      // محاكاة سريعة في حال عدم ربط Supabase Auth حياً
      var mockUser = {
        id: 'usr_' + Date.now().toString(36),
        email: 'customer@' + provider + '.com',
        user_metadata: {
          full_name: provider === 'google' ? 'عميل جوجل' : 'عميل أبل',
          provider: provider
        }
      };
      return syncProfileWithDb(mockUser).then(function (prof) {
        notifyListeners(mockUser, prof);
        return { user: mockUser, profile: prof };
      });
    }

    var options = {
      redirectTo: redirectUrl
    };

    if (provider === 'google') {
      options.queryParams = {
        access_type: 'offline',
        prompt: 'consent'
      };
    } else if (provider === 'apple') {
      options.scopes = 'name email';
    }

    return sb.auth.signInWithOAuth({
      provider: provider,
      options: options
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function loginWithGoogle(customRedirect) {
    return loginWithOAuth('google', customRedirect);
  }

  function loginWithApple(customRedirect) {
    return loginWithOAuth('apple', customRedirect);
  }

  function logout() {
    var sb = getSupabase();
    saveCachedSession(null, null);
    notifyListeners(null, null);

    if (sb && sb.auth) {
      return sb.auth.signOut().catch(function (e) {
        console.warn('Sign out warning:', e);
      });
    }
    return Promise.resolve();
  }

  function getCurrentUser() {
    return _currentUser;
  }

  function getProfile() {
    return _currentProfile;
  }

  function isLoggedIn() {
    return !!_currentUser;
  }

  function onAuthStateChanged(fn) {
    if (typeof fn === 'function') {
      listeners.push(fn);
      if (_currentUser || _currentProfile) {
        fn(_currentUser, _currentProfile);
      }
    }
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  /**
   * بناء نافذة منبثقة أو أزرار تسجيل الدخول السريع
   */
  function renderAuthModal() {
    var existingModal = document.getElementById('mkenCustomerAuthModal');
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = 'mkenCustomerAuthModal';
    modal.className = 'customer-auth-modal-overlay';
    modal.innerHTML = 
      '<div class="customer-auth-modal" dir="rtl">' +
        '<button type="button" class="auth-modal-close" id="closeAuthModalBtn" aria-label="إغلاق">&times;</button>' +
        '<div class="auth-modal-header">' +
          '<div class="auth-modal-icon">🔐</div>' +
          '<h3>تسجيل الدخول إلى حسابك</h3>' +
          '<p>سجّل دخولك لحفظ واسترجاع مواعيدك وتعديلها بسهولة في أي وقت.</p>' +
        '</div>' +
        '<div class="auth-social-buttons">' +
          '<button type="button" class="btn-social btn-google" id="btnAuthGoogle">' +
            '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' +
            '<span>الدخول عبر حساب Google</span>' +
          '</button>' +
          '<button type="button" class="btn-social btn-apple" id="btnAuthApple">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.87-.9.04-2 0.6-2.64 1.35-.57.65-1.07 1.72-.94 2.76 1.01.08 2.04-.49 2.66-1.24z"/></svg>' +
            '<span>الدخول عبر Apple ID</span>' +
          '</button>' +
        '</div>' +
        '<div class="auth-modal-footer">' +
          '<p class="auth-privacy-note">🔒 بياناتك محمية ومشفرة وفق أعلى معايير الخصوصية والأمان (PDPL).</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('closeAuthModalBtn').addEventListener('click', function () {
      modal.classList.remove('active');
    });

    document.getElementById('btnAuthGoogle').addEventListener('click', function () {
      loginWithGoogle().catch(function (err) {
        alert('تعذر تسجيل الدخول عبر جوجل: ' + err.message);
      });
    });

    document.getElementById('btnAuthApple').addEventListener('click', function () {
      loginWithApple().catch(function (err) {
        alert('تعذر تسجيل الدخول عبر أبل: ' + err.message);
      });
    });

    setTimeout(function () {
      modal.classList.add('active');
    }, 10);
  }

  window.MkenCustomerAuth = {
    init: init,
    loginWithGoogle: loginWithGoogle,
    loginWithApple: loginWithApple,
    loginWithOAuth: loginWithOAuth,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getProfile: getProfile,
    isLoggedIn: isLoggedIn,
    onAuthStateChanged: onAuthStateChanged,
    renderAuthModal: renderAuthModal
  };

  // تشغيل التهيئة التلقائية
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
