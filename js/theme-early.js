/** تطبيق الثيم من localStorage قبل رسم الصفحة */
(function () {
  var KEY = 'mken_platform_config';
  var THEMES = ['terracotta', 'ocean', 'forest', 'midnight', 'desert', 'slate'];
  
  function detectTenant() {
    var urlParams = new URLSearchParams(window.location.search);
    var tenantSlug = urlParams.get('tenant') || urlParams.get('client');
    if (!tenantSlug) {
      var hostname = window.location.hostname;
      if (!/^[0-9.]+$/.test(hostname)) {
        var parts = hostname.split('.');
        if (parts.length === 2 && parts[1] === 'localhost') {
          tenantSlug = parts[0] !== 'www' ? parts[0] : null;
        } else if (parts.length > 2) {
          var isPlatform = false;
          var root = parts.slice(-2).join('.');
          if (['mken.live', 'mken.app', 'mken.com', 'ronaq.live', 'ronaq.app', 'ronaq.com'].indexOf(root) !== -1) {
            isPlatform = true;
          }
          if (!isPlatform) {
            if (parts[0] === 'www') {
              if (parts.length > 3) {
                tenantSlug = parts[1];
              }
            } else {
              tenantSlug = parts[0];
            }
          }
        }
      }
    }
    if (tenantSlug) {
      tenantSlug = tenantSlug.trim().toLowerCase();
      if (tenantSlug === 'almahrusa') {
        tenantSlug = 'almahrosa';
      }
    }
    return tenantSlug || null;
  }

  try {
    var tenant = detectTenant();
    var key = tenant ? (KEY + '_' + tenant) : KEY;
    var raw = localStorage.getItem(key);
    if (!raw) return;
    var cfg = JSON.parse(raw);
    if (cfg.theme && THEMES.indexOf(cfg.theme) !== -1) {
      document.documentElement.setAttribute('data-theme', cfg.theme);
    }
  } catch (e) { /* ignore */ }
})();
