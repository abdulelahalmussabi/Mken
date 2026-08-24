/**
 * Mken Trust SDK — Device Fingerprint + Cloudflare Turnstile + Authentica OTP
 * Zero-Trust client for trust-challenge / trust-verify / authentica-fallback
 *
 * Usage:
 *   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async></script>
 *   <script src="/js/mken-trust-sdk.js"></script>
 *   <script>
 *     // Production (recommended): same-origin BFF sets Domain=.mken.live cookie
 *     MkenTrust.init({
 *       bffBaseUrl: '/api/v1/trust',
 *       turnstileSiteKey: 'YOUR_TURNSTILE_SITE_KEY',
 *       tenantSlug: 'salon'
 *     });
 *     // Direct Edge (dev only — cookie Domain may not stick on *.supabase.co):
 *     // MkenTrust.init({ functionsBaseUrl: '.../functions/v1', anonKey: '...', turnstileSiteKey: '...' });
 *     MkenTrust.mountTurnstile('#turnstile');
 *     MkenTrust.loginWithPhone({ phone: '+9665...', onOtpRequired: showOtpUi });
 *   </script>
 *
 * PDPL: لا يُجمع MAC/IMEI/Serial؛ البصمة = SHA-256 لإشارات غير معرِّفة للهوية.
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var STORAGE_CONSENT_KEY = 'mken_trust_device_consent';

  /** @type {MkenTrustConfig|null} */
  var _cfg = null;
  /** @type {string|null} */
  var _turnstileWidgetId = null;
  /** @type {string|null} */
  var _lastFpHash = null;
  /** @type {object|null} */
  var _lastChallenge = null;

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  /**
   * @typedef {Object} MkenTrustConfig
   * @property {string} [bffBaseUrl] - e.g. /api/v1/trust (preferred on *.mken.live)
   * @property {string} [functionsBaseUrl] - direct Edge base (dev / custom domain)
   * @property {string} [anonKey] - required only for direct Edge mode
   * @property {string} turnstileSiteKey
   * @property {string} [tenantSlug]
   * @property {string} [turnstileTheme] - auto | light | dark
   * @property {boolean} [credentials] - default true (HttpOnly cookie)
   * @property {number} [fallbackWaitMs] - client hint; server already waits 15s
   * @property {function(Error):void} [onError]
   */

  function init(config) {
    if (!config || !config.turnstileSiteKey) {
      throw new Error('MkenTrust.init: turnstileSiteKey required');
    }
    var bff = config.bffBaseUrl ? String(config.bffBaseUrl).replace(/\/+$/, '') : '';
    var edge = config.functionsBaseUrl
      ? String(config.functionsBaseUrl).replace(/\/+$/, '')
      : '';
    if (!bff && !edge) {
      throw new Error('MkenTrust.init: bffBaseUrl or functionsBaseUrl required');
    }
    if (edge && !bff && !config.anonKey) {
      throw new Error('MkenTrust.init: anonKey required when using functionsBaseUrl');
    }
    _cfg = {
      mode: bff ? 'bff' : 'edge',
      bffBaseUrl: bff || null,
      functionsBaseUrl: edge || null,
      anonKey: config.anonKey ? String(config.anonKey) : '',
      turnstileSiteKey: String(config.turnstileSiteKey),
      tenantSlug: config.tenantSlug ? String(config.tenantSlug).toLowerCase() : null,
      turnstileTheme: config.turnstileTheme || 'auto',
      credentials: config.credentials !== false,
      fallbackWaitMs: typeof config.fallbackWaitMs === 'number' ? config.fallbackWaitMs : 15000,
      onError: typeof config.onError === 'function' ? config.onError : null,
    };
    return api;
  }

  function requireCfg() {
    if (!_cfg) throw new Error('MkenTrust.init() must be called first');
    return _cfg;
  }

  function resolveTenant(explicit) {
    var cfg = requireCfg();
    if (explicit) return String(explicit).toLowerCase();
    if (cfg.tenantSlug) return cfg.tenantSlug;
    if (global.MkenServicesStore && typeof global.MkenServicesStore.getCurrentTenantSlug === 'function') {
      var s = global.MkenServicesStore.getCurrentTenantSlug();
      if (s) return String(s).toLowerCase();
    }
    var host = (global.location && global.location.hostname) || '';
    var m = host.match(/^([a-z0-9-]+)\.mken\.(live|app|com)$/i);
    if (m && m[1] !== 'www' && m[1] !== 'api') return m[1].toLowerCase();
    throw new Error('MkenTrust: tenantSlug required');
  }

  // ---------------------------------------------------------------------------
  // Crypto / fingerprint (no PII)
  // ---------------------------------------------------------------------------

  function bufToHex(buf) {
    var bytes = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += ('00' + bytes[i].toString(16)).slice(-2);
    }
    return hex;
  }

  function sha256Hex(message) {
    var data = new TextEncoder().encode(message);
    return crypto.subtle.digest('SHA-256', data).then(function (digest) {
      return bufToHex(digest);
    });
  }

  function safeCall(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }

  function canvasHash() {
    return safeCall(function () {
      var canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      var ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 120, 60);
      ctx.fillStyle = '#069';
      ctx.fillText('mken-trust', 2, 2);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('مَكِّن', 2, 22);
      return canvas.toDataURL();
    }, 'canvas-blocked');
  }

  function webglInfo() {
    return safeCall(function () {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { vendor: 'no-webgl', renderer: 'no-webgl' };
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '') : '',
        renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '',
      };
    }, { vendor: 'webgl-blocked', renderer: 'webgl-blocked' });
  }

  function parseUaFamily() {
    var ua = navigator.userAgent || '';
    var browser = 'Unknown';
    var os = 'Unknown';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    return { browserFamily: browser, osFamily: os };
  }

  /**
   * Canonical signals — stable-ish, zero direct PII.
   * Server re-hashes with SERVER_PEPPER.
   */
  function collectSignals() {
    var screenObj = global.screen || {};
    var gl = webglInfo();
    var tz = safeCall(function () {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    }, '');
    var families = parseUaFamily();

    return {
      v: 1,
      ua: String(navigator.userAgent || '').slice(0, 300),
      lang: String(navigator.language || ''),
      langs: Array.isArray(navigator.languages)
        ? navigator.languages.slice(0, 5).join(',')
        : '',
      tz: tz,
      tzOffset: new Date().getTimezoneOffset(),
      platform: String(navigator.platform || ''),
      hwConc: Number(navigator.hardwareConcurrency) || 0,
      mem: Number(navigator.deviceMemory) || 0,
      touch: Number(navigator.maxTouchPoints) || 0,
      colorDepth: Number(screenObj.colorDepth) || 0,
      pixelRatio: Number(global.devicePixelRatio) || 1,
      screenW: Number(screenObj.width) || 0,
      screenH: Number(screenObj.height) || 0,
      availW: Number(screenObj.availWidth) || 0,
      availH: Number(screenObj.availHeight) || 0,
      canvas: canvasHash(),
      webglVendor: gl.vendor,
      webglRenderer: gl.renderer,
      cookieEnabled: navigator.cookieEnabled === true,
      // Incognito-friendly: do not require persistent storage for hash
      storageAccess: probeStorageMode(),
      browserFamily: families.browserFamily,
      osFamily: families.osFamily,
    };
  }

  function probeStorageMode() {
    try {
      var k = '__mken_trust_probe__';
      global.sessionStorage.setItem(k, '1');
      global.sessionStorage.removeItem(k);
      return 'session';
    } catch (e) {
      return 'blocked';
    }
  }

  function stableStringify(obj) {
    var keys = Object.keys(obj).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = obj[k];
      parts.push(JSON.stringify(k) + ':' + JSON.stringify(v));
    }
    return '{' + parts.join(',') + '}';
  }

  /**
   * @returns {Promise<{deviceFpHash:string, meta:object}>}
   */
  function getDeviceFingerprint() {
    var signals = collectSignals();
    var canonical = stableStringify(signals);
    return sha256Hex(canonical).then(function (hash) {
      _lastFpHash = hash;
      return {
        deviceFpHash: hash,
        meta: {
          browserFamily: signals.browserFamily,
          osFamily: signals.osFamily,
          storageAccess: signals.storageAccess,
          labelHint: signals.osFamily + ' — ' + signals.browserFamily,
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // PDPL consent (remember device)
  // ---------------------------------------------------------------------------

  function getDeviceConsent() {
    try {
      return global.localStorage.getItem(STORAGE_CONSENT_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setDeviceConsent(granted) {
    try {
      if (granted) global.localStorage.setItem(STORAGE_CONSENT_KEY, '1');
      else global.localStorage.removeItem(STORAGE_CONSENT_KEY);
    } catch (e) {
      /* private mode — consent stays in-memory via call args */
    }
    return granted === true;
  }

  // ---------------------------------------------------------------------------
  // Turnstile
  // ---------------------------------------------------------------------------

  function waitForTurnstile(timeoutMs) {
    var limit = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function poll() {
        if (global.turnstile && typeof global.turnstile.render === 'function') {
          resolve(global.turnstile);
          return;
        }
        if (Date.now() - start > limit) {
          reject(new Error('Turnstile script not loaded'));
          return;
        }
        setTimeout(poll, 50);
      })();
    });
  }

  /**
   * @param {string|HTMLElement} container
   * @param {object} [opts]
   * @returns {Promise<string>} widgetId
   */
  function mountTurnstile(container, opts) {
    var cfg = requireCfg();
    opts = opts || {};
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return Promise.reject(new Error('Turnstile container not found'));

    return waitForTurnstile().then(function (turnstile) {
      if (_turnstileWidgetId != null) {
        try {
          turnstile.remove(_turnstileWidgetId);
        } catch (e) { /* ignore */ }
        _turnstileWidgetId = null;
      }
      el.innerHTML = '';
      _turnstileWidgetId = turnstile.render(el, {
        sitekey: cfg.turnstileSiteKey,
        theme: opts.theme || cfg.turnstileTheme,
        appearance: opts.appearance || 'always',
        callback: typeof opts.callback === 'function' ? opts.callback : undefined,
        'error-callback': typeof opts.onError === 'function' ? opts.onError : undefined,
        'expired-callback': function () {
          if (typeof opts.onExpired === 'function') opts.onExpired();
        },
      });
      return _turnstileWidgetId;
    });
  }

  function resetTurnstile() {
    return waitForTurnstile().then(function (turnstile) {
      if (_turnstileWidgetId != null) turnstile.reset(_turnstileWidgetId);
    });
  }

  function getTurnstileToken() {
    return waitForTurnstile().then(function (turnstile) {
      if (_turnstileWidgetId == null) {
        throw new Error('Turnstile not mounted — call mountTurnstile() first');
      }
      var token = turnstile.getResponse(_turnstileWidgetId);
      if (!token) throw new Error('Turnstile token missing — complete the challenge');
      return token;
    });
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  /** Map Edge function names → BFF paths */
  var BFF_PATHS = {
    'trust-challenge': 'challenge',
    'trust-verify': 'verify',
    'authentica-fallback': 'fallback',
  };

  function apiUrl(path) {
    var cfg = requireCfg();
    var name = String(path).replace(/^\//, '');
    if (cfg.mode === 'bff') {
      var suffix = BFF_PATHS[name] || name;
      return cfg.bffBaseUrl + '/' + suffix;
    }
    return cfg.functionsBaseUrl + '/' + name;
  }

  function postJson(path, body) {
    var cfg = requireCfg();
    var headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (cfg.mode === 'edge' && cfg.anonKey) {
      headers.apikey = cfg.anonKey;
      headers.Authorization = 'Bearer ' + cfg.anonKey;
    }
    return fetch(apiUrl(path), {
      method: 'POST',
      credentials: cfg.credentials ? 'include' : 'same-origin',
      headers: headers,
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = { error: 'invalid_json', raw: text };
        }
        if (!res.ok) {
          var err = new Error((data && data.error) || ('http_' + res.status));
          err.status = res.status;
          err.payload = data;
          if (cfg.onError) cfg.onError(err);
          throw err;
        }
        return data;
      });
    });
  }

  function normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    var p = phone.trim().replace(/[\s\-()]/g, '');
    if (p.indexOf('00') === 0) p = '+' + p.slice(2);
    if (/^05\d{8}$/.test(p)) p = '+966' + p.slice(1);
    if (/^5\d{8}$/.test(p)) p = '+966' + p;
    if (!/^\+[1-9]\d{7,14}$/.test(p)) return null;
    return p;
  }

  // ---------------------------------------------------------------------------
  // API: challenge / verify / fallback
  // ---------------------------------------------------------------------------

  /**
   * @param {object} opts
   * @param {string} opts.phone
   * @param {string} [opts.tenantSlug]
   * @param {string} [opts.turnstileToken]
   * @param {boolean} [opts.rememberDevice]
   * @param {string} [opts.fallbackEmail]
   */
  function challenge(opts) {
    opts = opts || {};
    var phone = normalizePhone(opts.phone);
    if (!phone) return Promise.reject(new Error('invalid_phone'));

    var tenantSlug = resolveTenant(opts.tenantSlug);
    var remember =
      typeof opts.rememberDevice === 'boolean'
        ? opts.rememberDevice
        : getDeviceConsent();

    var tokenPromise = opts.turnstileToken
      ? Promise.resolve(opts.turnstileToken)
      : getTurnstileToken();

    return Promise.all([getDeviceFingerprint(), tokenPromise]).then(function (pair) {
      var fp = pair[0];
      var token = pair[1];
      return postJson('trust-challenge', {
        tenantSlug: tenantSlug,
        phone: phone,
        deviceFpHash: fp.deviceFpHash,
        turnstileToken: token,
        rememberDevice: remember,
        fallbackEmail: opts.fallbackEmail || undefined,
      }).then(function (res) {
        _lastChallenge = {
          phone: phone,
          tenantSlug: tenantSlug,
          deviceFpHash: fp.deviceFpHash,
          meta: fp.meta,
          rememberDevice: remember,
          response: res,
        };
        return Object.assign({ deviceMeta: fp.meta }, res);
      });
    }).then(function (res) {
      resetTurnstile().catch(function () { /* ignore */ });
      return res;
    });
  }

  /**
   * @param {object} opts
   * @param {string} opts.otp
   * @param {string} [opts.phone]
   * @param {string} [opts.tenantSlug]
   * @param {string} [opts.challengeId]
   * @param {string} [opts.challengeNonce]
   * @param {boolean} [opts.rememberDevice]
   * @param {string} [opts.deviceLabel]
   * @param {string} [opts.approxCity]
   */
  function verify(opts) {
    opts = opts || {};
    var otp = String(opts.otp || '').trim();
    if (!/^\d{4,8}$/.test(otp)) return Promise.reject(new Error('invalid_otp'));

    var prev = _lastChallenge || {};
    var phone = normalizePhone(opts.phone || prev.phone);
    if (!phone) return Promise.reject(new Error('invalid_phone'));

    var tenantSlug = resolveTenant(opts.tenantSlug || prev.tenantSlug);
    var remember =
      typeof opts.rememberDevice === 'boolean'
        ? opts.rememberDevice
        : (typeof prev.rememberDevice === 'boolean' ? prev.rememberDevice : getDeviceConsent());

    if (remember) setDeviceConsent(true);

    var fpPromise = prev.deviceFpHash
      ? Promise.resolve({
        deviceFpHash: prev.deviceFpHash,
        meta: prev.meta || parseUaFamily(),
      })
      : getDeviceFingerprint();

    return fpPromise.then(function (fp) {
      var families = fp.meta || parseUaFamily();
      var challengeRes = (prev.response) || {};
      return postJson('trust-verify', {
        tenantSlug: tenantSlug,
        phone: phone,
        otp: otp,
        deviceFpHash: fp.deviceFpHash,
        challengeId: opts.challengeId || challengeRes.challengeId,
        challengeNonce: opts.challengeNonce || challengeRes.challengeNonce,
        rememberDevice: remember,
        deviceLabel: opts.deviceLabel || families.labelHint ||
          (families.osFamily + ' — ' + families.browserFamily),
        browserFamily: families.browserFamily,
        osFamily: families.osFamily,
        approxCity: opts.approxCity || undefined,
      });
    }).then(function (res) {
      if (res && res.session && res.session.access_token && global.supabase) {
        tryApplySupabaseSession(res.session);
      }
      return res;
    });
  }

  function tryApplySupabaseSession(session) {
    try {
      if (global.MkenDB && typeof global.MkenDB.getClient === 'function') {
        var client = global.MkenDB.getClient();
        if (client && client.auth && typeof client.auth.setSession === 'function') {
          client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }
    } catch (e) {
      /* optional */
    }
  }

  /**
   * Manual SMS/Email escalation (if server waitUntil missed).
   */
  function fallback(opts) {
    opts = opts || {};
    var prev = _lastChallenge || {};
    var phone = normalizePhone(opts.phone || prev.phone);
    if (!phone) return Promise.reject(new Error('invalid_phone'));
    var tenantSlug = resolveTenant(opts.tenantSlug || prev.tenantSlug);
    var challengeRes = prev.response || {};
    var channel = opts.channel === 'email' ? 'email' : 'sms';

    var tokenPromise = opts.turnstileToken
      ? Promise.resolve(opts.turnstileToken)
      : getTurnstileToken();

    return tokenPromise.then(function (token) {
      return postJson('authentica-fallback', {
        tenantSlug: tenantSlug,
        phone: phone,
        challengeId: opts.challengeId || challengeRes.challengeId,
        challengeNonce: opts.challengeNonce || challengeRes.challengeNonce,
        channel: channel,
        email: opts.email,
        turnstileToken: token,
      });
    }).then(function (res) {
      resetTurnstile().catch(function () { /* ignore */ });
      return res;
    });
  }

  /**
   * High-level login:
   * 1) challenge
   * 2) if skipOtp → done
   * 3) else onOtpRequired(challengeRes) then wait for verify via returned helpers
   *
   * @param {object} opts
   * @param {string} opts.phone
   * @param {function(object):void|Promise<void>} opts.onOtpRequired
   * @param {boolean} [opts.rememberDevice]
   * @param {boolean} [opts.autoSmsFallback=true]
   * @param {string} [opts.tenantSlug]
   * @param {string} [opts.fallbackEmail]
   * @returns {Promise<object>} challenge or verify result
   */
  function loginWithPhone(opts) {
    opts = opts || {};
    if (typeof opts.onOtpRequired !== 'function') {
      return Promise.reject(new Error('onOtpRequired callback required'));
    }

    return challenge({
      phone: opts.phone,
      tenantSlug: opts.tenantSlug,
      rememberDevice: opts.rememberDevice,
      fallbackEmail: opts.fallbackEmail,
      turnstileToken: opts.turnstileToken,
    }).then(function (res) {
      if (res.trust === true && res.skipOtp === true) {
        return { phase: 'trusted', result: res };
      }

      var fallbackTimer = null;
      var autoSms = opts.autoSmsFallback !== false;
      var cfg = requireCfg();

      if (autoSms && res.fallbackAt) {
        var wait = Math.max(0, new Date(res.fallbackAt).getTime() - Date.now());
        if (!isFinite(wait)) wait = cfg.fallbackWaitMs;
        fallbackTimer = setTimeout(function () {
          // Server already sends SMS via waitUntil; this is a safety net only.
          fallback({ channel: 'sms' }).catch(function () { /* ignore */ });
        }, wait + 500);
      }

      var ctx = {
        challenge: res,
        verify: function (otp, extra) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          extra = extra || {};
          return verify({
            otp: otp,
            phone: opts.phone,
            tenantSlug: opts.tenantSlug,
            rememberDevice: opts.rememberDevice,
            approxCity: extra.approxCity,
            deviceLabel: extra.deviceLabel,
          }).then(function (v) {
            return { phase: 'verified', result: v };
          });
        },
        sendSmsFallback: function () {
          return fallback({ channel: 'sms' });
        },
        sendEmailFallback: function (email) {
          return fallback({ channel: 'email', email: email });
        },
        cancelFallbackTimer: function () {
          if (fallbackTimer) clearTimeout(fallbackTimer);
        },
      };

      return Promise.resolve(opts.onOtpRequired(ctx)).then(function () {
        return { phase: 'otp_required', challenge: res, ctx: ctx };
      });
    });
  }

  /**
   * List trusted devices for the signed-in user (via Supabase client + view).
   */
  function listMyDevices() {
    if (!global.MkenDB || typeof global.MkenDB.getClient !== 'function') {
      return Promise.reject(new Error('MkenDB client unavailable'));
    }
    var client = global.MkenDB.getClient();
    if (!client) return Promise.reject(new Error('Supabase not configured'));
    return client.from('v_my_trusted_devices').select('*').order('created_at', {
      ascending: false,
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function revokeMyDevice(deviceId, reason) {
    if (!global.MkenDB || typeof global.MkenDB.getClient !== 'function') {
      return Promise.reject(new Error('MkenDB client unavailable'));
    }
    var client = global.MkenDB.getClient();
    if (!client) return Promise.reject(new Error('Supabase not configured'));
    return client.rpc('revoke_trusted_device', {
      p_device_id: deviceId,
      p_reason: reason || 'user_revoked',
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  var api = {
    version: VERSION,
    init: init,
    getDeviceFingerprint: getDeviceFingerprint,
    collectSignals: collectSignals,
    mountTurnstile: mountTurnstile,
    resetTurnstile: resetTurnstile,
    getTurnstileToken: getTurnstileToken,
    getDeviceConsent: getDeviceConsent,
    setDeviceConsent: setDeviceConsent,
    challenge: challenge,
    verify: verify,
    fallback: fallback,
    loginWithPhone: loginWithPhone,
    listMyDevices: listMyDevices,
    revokeMyDevice: revokeMyDevice,
    normalizePhone: normalizePhone,
    /** @deprecated test helper */
    _getLastChallenge: function () {
      return _lastChallenge;
    },
  };

  global.MkenTrust = api;
})(typeof window !== 'undefined' ? window : globalThis);
