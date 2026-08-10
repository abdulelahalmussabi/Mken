(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var config = {};
  var activeActivityId = '';
  var activeActivity = null;
  var enabled = [];
  var selectedService = null;

  var params = new URLSearchParams(window.location.search || '');
  var requestedActivity = (params.get('activity') || '').trim();
  var requestedService = (params.get('service') || '').trim();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyWhatsAppLinks() {
    var phone = config.phone || store.DEFAULT_PHONE;
    var wa = store.getSocialUrl('whatsapp', config.social) || store.waLink(phone);
    document.querySelectorAll('[data-contact="whatsapp"]').forEach(function (el) {
      el.href = wa;
    });
  }

  function updateHero() {
    var h1 = document.getElementById('quoteHeroTitle');
    var p = document.getElementById('quoteHeroDesc');
    if (!activeActivity) return;
    if (h1) {
      h1.textContent = (activeActivity.booking && activeActivity.booking.ctaLabel) ||
        ('اطلب عرض سعر — ' + activeActivity.title);
    }
    if (p) p.textContent = activeActivity.description;
    document.title = ((activeActivity.booking && activeActivity.booking.ctaLabel) || 'طلب عرض سعر') +
      ' | ' + ((config.brand && config.brand.name) || 'مكّن');
  }

  function renderActivityNav() {
    var nav = document.getElementById('quoteActivityNav');
    if (!nav) return;
    var acts = store.getQuoteActivities();
    if (acts.length <= 1) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    nav.innerHTML = acts.map(function (act) {
      var active = act.id === activeActivityId ? ' activity-tab--active' : '';
      return (
        '<a href="quote.html?activity=' + encodeURIComponent(act.id) + '" class="activity-tab' + active + '">' +
        '<span class="activity-tab__icon">' + act.icon + '</span>' +
        '<span class="activity-tab__label">' + esc(act.shortTitle) + '</span></a>'
      );
    }).join('');
  }

  function renderServices() {
    var box = document.getElementById('quoteServices');
    if (!box) return;
    if (!enabled.length) {
      box.innerHTML = '<p class="booking-empty">لا توجد خدمات مفعّلة لهذا النشاط.</p>';
      return;
    }
    if (!selectedService) selectedService = enabled[0];
    box.innerHTML = enabled.map(function (s) {
      var sel = selectedService && selectedService.id === s.id ? ' booking-service--selected' : '';
      return (
        '<button type="button" class="booking-service' + sel + '" data-id="' + s.id + '">' +
        '<span class="booking-service__icon">' + s.icon + '</span>' +
        '<span>' + esc(s.shortTitle) + '</span>' +
        '</button>'
      );
    }).join('');
    box.querySelectorAll('.booking-service').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        selectedService = enabled.find(function (s) { return s.id === id; }) || null;
        renderServices();
      });
    });
  }

  function switchActivity(activityId) {
    activeActivityId = activityId;
    activeActivity = store.getResolvedActivity(activityId, config);
    enabled = store.getEnabledServicesByActivity(activityId);
    selectedService = enabled[0] || null;
    if (requestedService) {
      var match = enabled.find(function (s) { return s.id === requestedService; });
      if (match) selectedService = match;
    }
    updateHero();
    renderActivityNav();
    renderServices();
  }

  function buildMessage(data) {
    var brand = (config.brand && config.brand.name) || 'منشأتنا';
    var lines = [
      'طلب عرض سعر جديد — ' + brand,
      'النشاط: ' + (activeActivity && activeActivity.title ? activeActivity.title : activeActivityId),
      'الخدمة: ' + (selectedService ? selectedService.title : 'غير محددة'),
      'الاسم: ' + data.name,
      'الجوال: ' + data.phone,
      'المدينة/الحي: ' + data.city,
    ];
    if (data.area) lines.push('المساحة: ' + data.area);
    if (data.address) lines.push('العنوان: ' + data.address);
    if (data.details) lines.push('التفاصيل: ' + data.details);
    if (data.media) lines.push('وسائط: ' + data.media);
    return lines.join('\n');
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!selectedService) {
      alert('اختر نوع الخدمة أولاً');
      return;
    }
    var name = (document.getElementById('quoteName').value || '').trim();
    var phone = (document.getElementById('quotePhone').value || '').trim();
    var city = (document.getElementById('quoteCity').value || '').trim();
    var area = (document.getElementById('quoteArea').value || '').trim();
    var address = (document.getElementById('quoteAddress').value || '').trim();
    var details = (document.getElementById('quoteDetails').value || '').trim();
    var media = (document.getElementById('quoteMedia').value || '').trim();
    if (!name || !phone || !city) {
      alert('الاسم والجوال والمدينة مطلوبة');
      return;
    }
    var message = buildMessage({
      name: name,
      phone: phone,
      city: city,
      area: area,
      address: address,
      details: details,
      media: media,
    });
    var businessPhone = config.phone || store.DEFAULT_PHONE;
    var wa = store.waLink(businessPhone, message);
    window.open(wa, '_blank', 'noopener');
  }

  function initUi() {
    var form = document.getElementById('quoteForm');
    if (form) form.addEventListener('submit', onSubmit);
    var menuToggle = document.getElementById('menuToggle');
    var nav = document.getElementById('nav');
    if (menuToggle && nav) {
      menuToggle.addEventListener('click', function () {
        var open = nav.classList.toggle('nav--open');
        menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  store.init().then(function () {
    config = store.loadConfig();
    store.applyTheme && store.applyTheme(config.theme);
    if (window.MkenBrandLogo) window.MkenBrandLogo.apply(config);
    document.querySelectorAll('[data-brand="name"]').forEach(function (el) {
      el.textContent = (config.brand && config.brand.name) || el.textContent;
    });
    document.querySelectorAll('[data-brand="tagline"]').forEach(function (el) {
      el.textContent = (config.brand && config.brand.tagline) || el.textContent;
    });
    applyWhatsAppLinks();
    initUi();

    var quoteActs = store.getQuoteActivities();
    var app = document.getElementById('quoteApp');
    var disabled = document.getElementById('quoteDisabled');

    if (!quoteActs.length) {
      if (app) app.hidden = true;
      if (disabled) disabled.hidden = false;
      return;
    }

    if (disabled) disabled.hidden = true;
    if (app) app.hidden = false;

    var startId = requestedActivity;
    if (!startId || quoteActs.every(function (a) { return a.id !== startId; })) {
      startId = quoteActs[0].id;
    }
    switchActivity(startId);
  });
})();
