/**
 * بوابة المكتب القانوني — إدارة القضايا والاستشارات (المسار ب)
 * تتبع نمط البوابات العميقة (coaching) — تخزين عبر config + localStorage، PIN عبر verify-coach-pin
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  var db = window.MkenSupabaseDb;
  var bookingStore = window.MkenBookingStore;

  var CONFIG_KEY = 'legalPractice';
  var currentTenantSlug = 'default';
  var configObj = {};
  var data = null;
  var isLawyerAuthed = false;
  var editingMatterId = null;
  var bookingReady = null;

  var STATUS_LABELS = {
    new: 'جديدة',
    in_progress: 'قيد النظر',
    postponed: 'مؤجلة',
    settled: 'تسوية/صلح',
    won: 'منتهية لصالح الموكّل',
    lost: 'منتهية',
    closed: 'مغلقة',
  };

  var defaultData = {
    firmName: 'المكتب القانوني',
    firmBio: 'استشارات وترافع قانوني بسرية مهنية.',
    firmPhone: '966543530333',
    firmAvatar: '⚖️',
    coachPin: '1234',
    lawyers: [],
    matters: [],
  };

  // ── أدوات مساعدة ──
  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function genId() {
    return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function cleanPhone(p) {
    var digits = (p || '').replace(/\D/g, '');
    if (store && store.normalizePhone) return store.normalizePhone(p);
    return digits;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d.getTime())) return iso;
    try { return d.toLocaleDateString('ar-SA'); } catch (e) { return iso; }
  }

  function getStorageKey() { return 'mken_legal_practice_' + currentTenantSlug; }

  function getStatusLabel(s) { return STATUS_LABELS[s] || s; }

  var toastTimer = null;
  function showToast(msg) {
    var toast = $('lpToast');
    var m = $('toastMessage');
    if (!toast || !m) return;
    m.textContent = msg;
    toast.classList.add('lp-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('lp-toast--show'); }, 2600);
  }

  function getLegalServices() {
    if (!store || !store.getServicesForActivity) return [];
    return store.getServicesForActivity('legal') || [];
  }

  function nextMatterNumber() {
    var year = new Date().getFullYear();
    var prefix = 'LM-' + year + '-';
    var count = (data.matters || []).filter(function (m) {
      return (m.number || '').indexOf(prefix) === 0;
    }).length;
    return prefix + pad(count + 1);
  }

  // ── التحميل والحفظ ──
  function loadData() {
    currentTenantSlug = (store && store.getCurrentTenantSlug && store.getCurrentTenantSlug()) || 'default';

    if (db && typeof db.isConfigured === 'function' && db.isConfigured()) {
      return db.fetchConfig(currentTenantSlug)
        .then(function (cfg) {
          configObj = cfg || {};
          var extracted = configObj[CONFIG_KEY];
          data = extracted ? Object.assign({}, defaultData, extracted) : Object.assign({}, defaultData);
          if (!Array.isArray(data.matters)) data.matters = [];
          if (!Array.isArray(data.lawyers)) data.lawyers = [];
          applyLoaded();
        })
        .catch(function (err) {
          console.warn('legal-portal: Supabase load failed, using local', err);
          loadLocal();
        });
    }
    loadLocal();
    return Promise.resolve();
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(getStorageKey());
      data = raw ? JSON.parse(raw) : Object.assign({}, defaultData);
    } catch (e) {
      data = Object.assign({}, defaultData);
    }
    if (!Array.isArray(data.matters)) data.matters = [];
    if (!Array.isArray(data.lawyers)) data.lawyers = [];
    applyLoaded();
  }

  function saveData() {
    if (!data) return Promise.resolve();
    try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch (e) { /* ignore */ }

    if (db && typeof db.isConfigured === 'function' && db.isConfigured()) {
      configObj[CONFIG_KEY] = data;
      return db.saveConfig(configObj, currentTenantSlug)
        .catch(function (err) { console.error('legal-portal: Supabase save failed', err); });
    }
    return Promise.resolve();
  }

  function applyLoaded() {
    renderFirm();
    renderClientServices();
    renderLawyers();
    populateLawyerSelects();
    renderStats();
    renderMatters();
    renderSchedule();
    fillFirmForm();
  }

  // ── المحامون ──
  function getLawyerById(id) {
    return (data.lawyers || []).find(function (l) { return l.id === id; });
  }

  function lawyerPillHtml(lawyerId) {
    var l = getLawyerById(lawyerId);
    if (!l) return '<span class="lp-pill lp-pill--none">غير مُسند</span>';
    return '<span class="lp-pill"><span class="lp-pill__dot" style="background:' + esc(l.color || '#1e3d59') + '"></span>' + esc(l.name) + '</span>';
  }

  function lawyerOptionsHtml(selectedId, includeAll, allLabel) {
    var opts = '';
    if (includeAll) opts += '<option value="all">' + esc(allLabel || 'كل المحامين') + '</option>';
    else opts += '<option value="">— غير مُسند —</option>';
    (data.lawyers || []).forEach(function (l) {
      opts += '<option value="' + esc(l.id) + '"' + (l.id === selectedId ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    });
    return opts;
  }

  function populateLawyerSelects() {
    var mf = $('matterLawyerFilter');
    if (mf) { var cur = mf.value; mf.innerHTML = lawyerOptionsHtml(null, true); mf.value = cur || 'all'; }
    var sf = $('scheduleFilter');
    if (sf) { var curS = sf.value; sf.innerHTML = lawyerOptionsHtml(null, true); sf.value = curS || 'all'; }
  }

  function renderLawyers() {
    var box = $('lawyersList');
    if (!box) return;
    if (!(data.lawyers || []).length) {
      box.innerHTML = '<p class="lp-muted" style="margin:0;">لا يوجد محامون مسجّلون بعد. أضف أول محامٍ بالنموذج أدناه.</p>';
      return;
    }
    box.innerHTML = data.lawyers.map(function (l) {
      var count = (data.matters || []).filter(function (m) { return m.lawyerId === l.id; }).length;
      var staffBadge = l.staffRegistered
        ? '<span class="lp-lawyer__staff lp-lawyer__staff--on" title="يدخل عبر staff.html بجواله ورمزه">🟢 موظف بالنظام</span>'
        : '<span class="lp-lawyer__staff lp-lawyer__staff--off">⚪ غير مربوط بالطاقم</span>';
      var staffBtn = l.staffRegistered
        ? '<button class="lp-btn--staff" data-lact="staffinfo" data-id="' + l.id + '">بيانات الدخول</button>'
        : '<button class="lp-btn--staff" data-lact="staff" data-id="' + l.id + '">ربط كموظف</button>';
      return '<div class="lp-lawyer">' +
        '<span class="lp-lawyer__dot" style="background:' + esc(l.color || '#1e3d59') + '"></span>' +
        '<div class="lp-lawyer__info">' +
          '<div class="lp-lawyer__name">' + esc(l.name) + '</div>' +
          '<div class="lp-lawyer__spec">' + esc(l.specialty || 'محامٍ') + ' • ' + count + ' قضية</div>' +
          staffBadge + ' ' + staffBtn +
        '</div>' +
        '<div class="lp-lawyer__actions">' +
          '<button class="lp-icon-btn" data-lact="edit" data-id="' + l.id + '" title="تعديل">✏️</button>' +
          '<button class="lp-icon-btn" data-lact="del" data-id="' + l.id + '" title="حذف">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('button[data-lact]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-lact');
        if (act === 'edit') editLawyer(id);
        else if (act === 'del') deleteLawyer(id);
        else if (act === 'staff') registerLawyerAsStaff(id);
        else if (act === 'staffinfo') showStaffLoginInfo(id);
      });
    });
  }

  function staffLoginUrl() {
    var base = window.location.origin + window.location.pathname.replace(/legal-portal\.html$/, 'staff.html');
    var tenant = (currentTenantSlug && currentTenantSlug !== 'default') ? currentTenantSlug : '';
    return tenant ? (base + '?tenant=' + encodeURIComponent(tenant)) : base;
  }

  function showStaffLoginInfo(id) {
    var l = getLawyerById(id);
    if (!l) return;
    var tenant = (currentTenantSlug && currentTenantSlug !== 'default') ? currentTenantSlug : '(المعرّف الافتراضي)';
    alert('بيانات دخول المحامي إلى بوابة الموظفين:\n\n' +
      'الرابط: ' + staffLoginUrl() + '\n' +
      'المنشأة (tenant): ' + tenant + '\n' +
      'الجوال: ' + (l.phone || '—') + '\n' +
      'الرمز: الرمز الذي تم تعيينه عند الربط (' + (l.pin ? l.pin : '****') + ')\n\n' +
      'بعد الدخول سيرى المحامي مواعيده القانونية الخاصة فقط.');
  }

  function registerLawyerAsStaff(id) {
    var l = getLawyerById(id);
    if (!l) return;
    if (!l.phone) { showToast('أضف جوال المحامي أولاً (مطلوب لتسجيل الدخول)'); editLawyer(id); return; }
    if (!l.pin || !/^\d{4}$/.test(l.pin)) {
      showToast('عيّن رمز دخول من 4 أرقام للمحامي أولاً');
      editLawyer(id);
      setTimeout(function () { if ($('lawyerPin')) $('lawyerPin').focus(); }, 60);
      return;
    }
    if (!(db && typeof db.isConfigured === 'function' && db.isConfigured())) {
      showToast('ربط الطاقم يتطلب تفعيل قاعدة البيانات (Supabase) للمنشأة');
      return;
    }
    showToast('جارٍ ربط المحامي بنظام الموظفين...');
    db.saveStaff({
      id: l.id,
      name: l.name,
      phone: l.phone,
      role: 'lawyer',
      status: 'active',
      pinCode: l.pin,
      createdAt: new Date().toISOString(),
    }, currentTenantSlug).then(function () {
      l.staffRegistered = true;
      l.staffId = l.id;
      return saveData();
    }).then(function () {
      renderLawyers();
      renderClientServices();
      showStaffLoginInfo(id);
      showToast('تم ربط المحامي بنظام الموظفين بنجاح');
    }).catch(function (err) {
      console.error('registerLawyerAsStaff failed', err);
      showToast('تعذّر الربط: ' + (err && err.message ? err.message : 'خطأ غير متوقع'));
    });
  }

  function editLawyer(id) {
    var l = getLawyerById(id);
    if (!l) return;
    $('lawyerId').value = l.id;
    $('lawyerName').value = l.name || '';
    $('lawyerSpecialty').value = l.specialty || '';
    $('lawyerPhone').value = l.phone || '';
    $('lawyerColor').value = l.color || '#1e3d59';
    if ($('lawyerPin')) $('lawyerPin').value = l.pin || '';
    $('lawyerSubmitBtn').textContent = '💾 حفظ التعديل';
    $('lawyerName').focus();
  }

  function resetLawyerForm() {
    $('lawyerId').value = '';
    $('lawyerForm').reset();
    $('lawyerColor').value = '#1e3d59';
    $('lawyerSubmitBtn').textContent = '➕ إضافة محامٍ';
  }

  function deleteLawyer(id) {
    var l = getLawyerById(id);
    if (!l) return;
    if (!confirm('حذف المحامي "' + l.name + '"؟ ستُصبح قضاياه غير مُسندة.')) return;
    data.lawyers = data.lawyers.filter(function (x) { return x.id !== id; });
    (data.matters || []).forEach(function (m) { if (m.lawyerId === id) m.lawyerId = ''; });
    saveData().then(function () {
      renderLawyers(); populateLawyerSelects(); renderMatters(); renderSchedule(); renderStats();
      showToast('تم حذف المحامي');
    });
  }

  function saveLawyerFromForm(e) {
    e.preventDefault();
    var id = $('lawyerId').value || null;
    var name = $('lawyerName').value.trim();
    if (!name) { showToast('أدخل اسم المحامي'); return; }
    var pin = ($('lawyerPin') && $('lawyerPin').value.trim()) || '';
    var payload = {
      name: name,
      specialty: $('lawyerSpecialty').value.trim(),
      phone: $('lawyerPhone').value.trim(),
      color: $('lawyerColor').value || '#1e3d59',
    };
    if (pin) payload.pin = pin;
    var pinChanged = false;
    if (id) {
      var l = getLawyerById(id);
      if (l) {
        if (pin && pin !== l.pin) pinChanged = true;
        Object.assign(l, payload);
      }
    } else {
      data.lawyers.push(Object.assign({ id: genId() }, payload));
    }
    saveData().then(function () {
      resetLawyerForm();
      renderLawyers(); populateLawyerSelects(); renderMatters(); renderSchedule(); renderClientServices();
      showToast('تم حفظ المحامي');
      // إن كان المحامي مربوطاً بالطاقم وتغيّر الرمز، حدّث سجل الموظف
      if (id && pinChanged) {
        var lw = getLawyerById(id);
        if (lw && lw.staffRegistered && db && db.isConfigured && db.isConfigured()) {
          db.saveStaff({ id: lw.id, name: lw.name, phone: lw.phone, role: 'lawyer', status: 'active', pinCode: lw.pin }, currentTenantSlug)
            .then(function () { showToast('تم تحديث رمز دخول الموظف'); })
            .catch(function (err) { console.error('staff pin update failed', err); });
        }
      }
    });
  }

  // ── الجدول الموحّد ──
  function todayISO() {
    var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function renderSchedule() {
    var body = $('scheduleBody');
    if (!body) return;
    var filter = ($('scheduleFilter') && $('scheduleFilter').value) || 'all';
    var today = todayISO();

    var rows = (data.matters || [])
      .filter(function (m) { return m.nextSession && m.nextSession.slice(0, 10) >= today; })
      .filter(function (m) { return filter === 'all' || m.lawyerId === filter; })
      .sort(function (a, b) { return (a.nextSession || '').localeCompare(b.nextSession || ''); });

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="lp-empty">لا توجد مواعيد قادمة' + (filter !== 'all' ? ' لهذا المحامي' : '') + '.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(function (m) {
      return '<tr>' +
        '<td dir="ltr" style="font-weight:600;">' + esc(formatDate(m.nextSession)) + '</td>' +
        '<td>' + esc(m.clientName) + '</td>' +
        '<td dir="ltr">' + esc(m.number) + '</td>' +
        '<td>' + esc(m.typeLabel || '—') + '</td>' +
        '<td>' + lawyerPillHtml(m.lawyerId) + '</td>' +
        '<td><span class="lp-badge lp-badge--' + esc(m.status) + '">' + esc(getStatusLabel(m.status)) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  // ── الرندرة: بيانات المكتب ──
  function renderFirm() {
    if ($('firmNameDisp')) $('firmNameDisp').textContent = data.firmName || 'المكتب القانوني';
    if ($('firmHeroName')) $('firmHeroName').textContent = data.firmName || 'في مكان واحد';
    if ($('firmAvatar')) $('firmAvatar').textContent = data.firmAvatar || '⚖️';
    var cta = $('firmWhatsappCta');
    if (cta) cta.href = 'https://wa.me/' + cleanPhone(data.firmPhone);
    document.title = (data.firmName || 'المكتب القانوني') + ' — بوابة القضايا';
  }

  function fillFirmForm() {
    if ($('firmNameInput')) $('firmNameInput').value = data.firmName || '';
    if ($('firmAvatarInput')) $('firmAvatarInput').value = data.firmAvatar || '';
    if ($('firmPhoneInput')) $('firmPhoneInput').value = data.firmPhone || '';
    if ($('firmBioInput')) $('firmBioInput').value = data.firmBio || '';
  }

  // ── الرندرة: خدمات الموكّل + CTA ──
  function renderClientServices() {
    var box = $('clientServices');
    if (box) {
      var svcs = getLegalServices();
      box.innerHTML = svcs.length
        ? svcs.map(function (s) { return '<span class="lp-chip">' + esc(s.title) + '</span>'; }).join('')
        : '<span class="lp-muted">سيتم عرض الخدمات قريباً.</span>';
    }
    var cta = $('clientBookCta');
    if (cta) {
      var msg = 'السلام عليكم، أرغب في حجز استشارة قانونية مع ' + (data.firmName || 'المكتب') + '.';
      cta.href = 'https://wa.me/' + cleanPhone(data.firmPhone) + '?text=' + encodeURIComponent(msg);
    }
    var params = new URLSearchParams(window.location.search);
    var tenant = params.get('tenant') || params.get('client');
    var tenantSuffix = tenant ? ('&tenant=' + encodeURIComponent(tenant)) : '';

    var calCta = $('clientCalendarCta');
    if (calCta) calCta.href = 'book.html?activity=legal&calendar=1' + tenantSuffix;

    var lawyerBox = $('clientLawyerBooking');
    if (lawyerBox) {
      var lawyers = data.lawyers || [];
      if (!lawyers.length) {
        lawyerBox.innerHTML = '';
      } else {
        lawyerBox.innerHTML = '<div class="lp-lawyer-book__title">أو احجز مع محامٍ محدّد:</div>' +
          lawyers.map(function (l) {
            var staffSuffix = l.staffId ? ('&staffId=' + encodeURIComponent(l.staffId)) : '';
            return '<a href="book.html?activity=legal&calendar=1&lawyer=' + encodeURIComponent(l.id) + '&lawyerName=' + encodeURIComponent(l.name) + staffSuffix + tenantSuffix + '">' +
              '<span class="lp-lawyer-book__dot" style="background:' + esc(l.color || '#1e3d59') + '"></span>' +
              '<span>📅 ' + esc(l.name) + (l.specialty ? ' <span class="lp-lawyer-book__spec">(' + esc(l.specialty) + ')</span>' : '') + '</span>' +
            '</a>';
          }).join('');
      }
    }
  }

  // ── الرندرة: الإحصاءات ──
  function renderStats() {
    var box = $('lawyerStats');
    if (!box) return;
    var matters = data.matters || [];
    var active = matters.filter(function (m) { return ['new', 'in_progress', 'postponed'].indexOf(m.status) !== -1; }).length;
    var postponed = matters.filter(function (m) { return m.status === 'postponed'; }).length;
    var outstanding = matters.reduce(function (sum, m) {
      return sum + Math.max(0, (Number(m.feeTotal) || 0) - (Number(m.feePaid) || 0));
    }, 0);
    var cards = [
      { num: matters.length, label: 'إجمالي القضايا' },
      { num: active, label: 'قضايا نشطة' },
      { num: postponed, label: 'جلسات مؤجلة' },
      { num: outstanding.toLocaleString('en-US'), label: 'أتعاب مستحقة (ر.س)' },
    ];
    box.innerHTML = cards.map(function (c) {
      return '<div class="lp-stat"><div class="lp-stat__num">' + esc(c.num) + '</div><div class="lp-stat__label">' + esc(c.label) + '</div></div>';
    }).join('');
  }

  // ── الرندرة: جدول القضايا ──
  function renderMatters() {
    var body = $('mattersBody');
    if (!body) return;
    var q = ($('matterSearch') && $('matterSearch').value || '').trim().toLowerCase();
    var filter = ($('matterFilter') && $('matterFilter').value) || 'all';
    var lawyerFilter = ($('matterLawyerFilter') && $('matterLawyerFilter').value) || 'all';

    var list = (data.matters || []).slice().sort(function (a, b) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    if (filter !== 'all') list = list.filter(function (m) { return m.status === filter; });
    if (lawyerFilter !== 'all') list = list.filter(function (m) { return (m.lawyerId || '') === lawyerFilter; });
    if (q) {
      list = list.filter(function (m) {
        return (m.clientName || '').toLowerCase().indexOf(q) !== -1 ||
          (m.number || '').toLowerCase().indexOf(q) !== -1 ||
          (m.clientPhone || '').indexOf(q) !== -1;
      });
    }

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="lp-empty">لا توجد قضايا مطابقة.</td></tr>';
      return;
    }

    body.innerHTML = list.map(function (m) {
      return '<tr>' +
        '<td dir="ltr" style="font-weight:600;">' + esc(m.number) + '</td>' +
        '<td>' + esc(m.clientName) + '<br><span class="lp-muted" dir="ltr" style="font-size:.75rem;">' + esc(m.clientPhone) + '</span></td>' +
        '<td>' + esc(m.typeLabel || '—') + '</td>' +
        '<td>' + lawyerPillHtml(m.lawyerId) + '</td>' +
        '<td><span class="lp-badge lp-badge--' + esc(m.status) + '">' + esc(getStatusLabel(m.status)) + '</span></td>' +
        '<td dir="ltr">' + esc(formatDate(m.nextSession)) + '</td>' +
        '<td><div class="lp-row-actions">' +
          '<button class="lp-icon-btn" data-act="edit" data-id="' + m.id + '" title="فتح الملف">📂</button>' +
          '<button class="lp-icon-btn" data-act="wa" data-id="' + m.id + '" title="إبلاغ الموكّل واتساب">📱</button>' +
          '<button class="lp-icon-btn" data-act="del" data-id="' + m.id + '" title="حذف">🗑️</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    body.querySelectorAll('button[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        if (act === 'edit') openMatterModal(id);
        else if (act === 'wa') notifyClient(id);
        else if (act === 'del') deleteMatter(id);
      });
    });
  }

  // ── نموذج القضية ──
  function fillTypeSelect(selected) {
    var sel = $('mType');
    if (!sel) return;
    var svcs = getLegalServices();
    sel.innerHTML = svcs.map(function (s) {
      return '<option value="' + esc(s.title) + '"' + (s.title === selected ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');
  }

  function openMatterModal(id) {
    editingMatterId = id || null;
    var m = id ? (data.matters || []).find(function (x) { return x.id === id; }) : null;

    $('matterModalTitle').textContent = m ? ('الملف: ' + m.number) : 'قضية جديدة';
    $('matterId').value = m ? m.id : '';
    $('mClientName').value = m ? m.clientName : '';
    $('mClientPhone').value = m ? m.clientPhone : '';
    fillTypeSelect(m ? m.typeLabel : '');
    if ($('mLawyer')) $('mLawyer').innerHTML = lawyerOptionsHtml(m ? m.lawyerId : '', false);
    $('mCourt').value = m ? (m.court || '') : '';
    $('mStatus').value = m ? m.status : 'new';
    $('mNextSession').value = m && m.nextSession ? m.nextSession.slice(0, 10) : '';
    $('mFeeTotal').value = m && m.feeTotal != null ? m.feeTotal : '';
    $('mFeePaid').value = m && m.feePaid != null ? m.feePaid : '';
    $('mNotes').value = m ? (m.notes || '') : '';

    var tl = $('timelineSection');
    if (m) { tl.style.display = 'block'; renderTimeline(m); } else { tl.style.display = 'none'; }

    var inv = $('invoicesSection');
    if (inv) {
      if (m) { inv.style.display = 'block'; renderInvoices(m); }
      else { inv.style.display = 'none'; }
    }

    $('matterModal').classList.add('lp-modal--open');
  }

  function closeMatterModal() {
    $('matterModal').classList.remove('lp-modal--open');
    editingMatterId = null;
  }

  function saveMatterFromForm(e) {
    e.preventDefault();
    var id = $('matterId').value || null;
    var existing = id ? (data.matters || []).find(function (x) { return x.id === id; }) : null;

    var payload = {
      clientName: $('mClientName').value.trim(),
      clientPhone: $('mClientPhone').value.trim(),
      typeLabel: $('mType').value,
      lawyerId: $('mLawyer') ? $('mLawyer').value : '',
      court: $('mCourt').value.trim(),
      status: $('mStatus').value,
      nextSession: $('mNextSession').value || '',
      feeTotal: $('mFeeTotal').value !== '' ? Number($('mFeeTotal').value) : null,
      feePaid: $('mFeePaid').value !== '' ? Number($('mFeePaid').value) : null,
      notes: $('mNotes').value.trim(),
    };

    if (!payload.clientName || !payload.clientPhone) return;

    if (existing) {
      var statusChanged = existing.status !== payload.status;
      Object.assign(existing, payload);
      if (statusChanged) {
        existing.timeline = existing.timeline || [];
        existing.timeline.push({ id: genId(), at: new Date().toISOString(), text: 'تحديث الحالة إلى: ' + getStatusLabel(payload.status) });
      }
    } else {
      var matter = Object.assign({
        id: genId(),
        number: nextMatterNumber(),
        createdAt: new Date().toISOString(),
        timeline: [{ id: genId(), at: new Date().toISOString(), text: 'تم فتح الملف' }],
      }, payload);
      data.matters.push(matter);
      editingMatterId = matter.id;
      $('matterId').value = matter.id;
      $('matterModalTitle').textContent = 'الملف: ' + matter.number;
      $('timelineSection').style.display = 'block';
      renderTimeline(matter);
      if ($('invoicesSection')) { $('invoicesSection').style.display = 'block'; renderInvoices(matter); }
    }

    saveData().then(function () {
      renderMatters();
      renderStats();
      renderSchedule();
      renderLawyers();
      showToast('تم حفظ القضية بنجاح');
    });
  }

  function deleteMatter(id) {
    var m = (data.matters || []).find(function (x) { return x.id === id; });
    if (!m) return;
    if (!confirm('حذف قضية "' + m.number + '" للموكّل ' + m.clientName + '؟')) return;
    data.matters = data.matters.filter(function (x) { return x.id !== id; });
    saveData().then(function () {
      renderMatters();
      renderStats();
      renderSchedule();
      renderLawyers();
      showToast('تم حذف القضية');
    });
  }

  // ── الجدول الزمني ──
  function renderTimeline(matter) {
    var ul = $('timelineList');
    if (!ul) return;
    var items = (matter.timeline || []).slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
    if (!items.length) { ul.innerHTML = '<li class="lp-muted">لا توجد مستجدات بعد.</li>'; return; }
    ul.innerHTML = items.map(function (t) {
      return '<li>' +
        '<div class="lp-timeline__date" dir="ltr">' + esc(formatDate(t.at)) + '</div>' +
        '<div class="lp-timeline__text">' + esc(t.text) + '</div>' +
        '<button class="lp-timeline__del" data-tid="' + t.id + '">حذف</button>' +
      '</li>';
    }).join('');
    ul.querySelectorAll('.lp-timeline__del').forEach(function (b) {
      b.addEventListener('click', function () {
        matter.timeline = matter.timeline.filter(function (x) { return x.id !== b.getAttribute('data-tid'); });
        saveData().then(function () { renderTimeline(matter); });
      });
    });
  }

  function addTimelineEntry(e) {
    e.preventDefault();
    var txt = $('timelineText').value.trim();
    if (!txt || !editingMatterId) return;
    var m = (data.matters || []).find(function (x) { return x.id === editingMatterId; });
    if (!m) return;
    m.timeline = m.timeline || [];
    m.timeline.push({ id: genId(), at: new Date().toISOString(), text: txt });
    $('timelineText').value = '';
    saveData().then(function () { renderTimeline(m); showToast('تمت إضافة التحديث'); });
  }

  // ── فواتير الأتعاب (ZATCA) ──
  function countInvoices() {
    return (data.matters || []).reduce(function (sum, m) {
      return sum + ((m.invoices || []).length);
    }, 0);
  }

  function nextInvoiceNumber() {
    return 'INV-' + new Date().getFullYear() + '-' + String(countInvoices() + 1).padStart(4, '0');
  }

  function invoiceStatusLabel(s) {
    if (s === 'REPORTED') return 'مبلّغة لـ ZATCA';
    if (s === 'FAILED') return 'فشل الإبلاغ';
    return 'محفوظة محلياً';
  }

  function invoiceStatusClass(s) {
    if (s === 'REPORTED') return 'reported';
    if (s === 'FAILED') return 'failed';
    return 'local';
  }

  function renderInvoices(matter) {
    var box = $('invoicesList');
    if (!box) return;
    var list = (matter.invoices || []).slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    if (!list.length) {
      box.innerHTML = '<p class="lp-muted" style="margin:0;">لا توجد فواتير صادرة لهذه القضية بعد.</p>';
      return;
    }
    box.innerHTML = list.map(function (inv) {
      var st = invoiceStatusClass(inv.zatcaStatus);
      return '<div class="lp-invoice">' +
        '<div>' +
          '<span class="lp-invoice__num" dir="ltr">' + esc(inv.number) + '</span>' +
          ' <span class="lp-invoice__status lp-invoice__status--' + st + '">' + esc(invoiceStatusLabel(inv.zatcaStatus)) + '</span>' +
          '<div class="lp-muted" style="font-size:.72rem;">' + esc(formatDate(inv.createdAt)) + ' • ' + esc(inv.items && inv.items[0] ? inv.items[0].name : 'أتعاب') + '</div>' +
        '</div>' +
        '<div style="text-align:left;">' +
          '<div class="lp-invoice__amount" dir="ltr">' + Number(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ر.س</div>' +
          '<div class="lp-muted" style="font-size:.68rem;">شامل ضريبة ' + Number(inv.taxAmount || 0).toFixed(2) + '</div>' +
        '</div>' +
        '<div class="lp-invoice__actions">' +
          '<button class="lp-icon-btn" data-iact="print" data-iid="' + inv.id + '" title="طباعة / عرض">🖨️</button>' +
          (inv.zatcaStatus !== 'REPORTED' ? '<button class="lp-icon-btn" data-iact="report" data-iid="' + inv.id + '" title="إبلاغ ZATCA">📤</button>' : '') +
          '<button class="lp-icon-btn" data-iact="del" data-iid="' + inv.id + '" title="حذف">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('button[data-iact]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var iid = btn.getAttribute('data-iid');
        var act = btn.getAttribute('data-iact');
        if (act === 'print') printInvoice(matter.id, iid);
        else if (act === 'report') reportInvoice(matter.id, iid);
        else if (act === 'del') deleteInvoice(matter.id, iid);
      });
    });
  }

  function buildInvoiceObject(matter, amount, desc) {
    var subtotal = Math.round(amount * 100) / 100;
    var taxAmount = Math.round(subtotal * 0.15 * 100) / 100;
    var totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
    return {
      id: genId(),
      number: nextInvoiceNumber(),
      matterNumber: matter.number,
      createdAt: new Date().toISOString(),
      customerName: matter.clientName || 'عميل',
      customerPhone: matter.clientPhone || '',
      items: [{ name: desc || ('أتعاب محاماة — ' + (matter.typeLabel || matter.number)), price: subtotal, quantity: 1 }],
      subtotal: subtotal,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      zatcaStatus: 'local',
      zatcaUuid: '',
      zatcaQrCode: '',
    };
  }

  function reportInvoiceToZatca(inv) {
    var adminPin = '';
    try { adminPin = sessionStorage.getItem('mken_admin_pin') || ''; } catch (e) { /* ignore */ }
    if (!adminPin) return Promise.resolve({ skipped: true });
    return fetch('/api/v1/zatca?action=report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify({ tenantSlug: currentTenantSlug, invoice: inv }),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.success) {
          return { status: r.data.zatcaStatus || 'REPORTED', uuid: r.data.zatcaUuid || '', qr: r.data.zatcaQrCode || '' };
        }
        return { status: 'FAILED', error: (r.data && r.data.error) || 'تعذّر الإبلاغ' };
      })
      .catch(function (err) { return { status: 'FAILED', error: err.message }; });
  }

  function issueInvoiceFromForm(e) {
    e.preventDefault();
    if (!editingMatterId) { showToast('احفظ القضية أولاً'); return; }
    var matter = (data.matters || []).find(function (x) { return x.id === editingMatterId; });
    if (!matter) return;
    var amount = parseFloat($('invAmount').value);
    if (isNaN(amount) || amount <= 0) { showToast('أدخل قيمة أتعاب صحيحة'); return; }
    var desc = $('invDesc').value.trim();
    var inv = buildInvoiceObject(matter, amount, desc);

    matter.invoices = matter.invoices || [];
    matter.invoices.push(inv);

    var btn = $('invoiceSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإصدار...'; }

    reportInvoiceToZatca(inv).then(function (r) {
      if (r && !r.skipped) {
        inv.zatcaStatus = r.status || 'local';
        if (r.uuid) inv.zatcaUuid = r.uuid;
        if (r.qr) inv.zatcaQrCode = r.qr;
      }
      return saveData();
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🧾 إصدار فاتورة'; }
      $('invAmount').value = '';
      $('invDesc').value = '';
      renderInvoices(matter);
      renderStats();
      if (inv.zatcaStatus === 'REPORTED') showToast('تم إصدار الفاتورة وإبلاغها لـ ZATCA');
      else if (inv.zatcaStatus === 'FAILED') showToast('صدرت الفاتورة محلياً — تعذّر الإبلاغ لـ ZATCA');
      else showToast('تم إصدار الفاتورة (محلياً). فعّل ربط ZATCA للإبلاغ التلقائي');
    });
  }

  function reportInvoice(matterId, invId) {
    var matter = (data.matters || []).find(function (x) { return x.id === matterId; });
    if (!matter) return;
    var inv = (matter.invoices || []).find(function (x) { return x.id === invId; });
    if (!inv) return;
    showToast('جارٍ إبلاغ الفاتورة لـ ZATCA...');
    reportInvoiceToZatca(inv).then(function (r) {
      if (r && r.skipped) { showToast('يتطلب الإبلاغ رمز المسؤول (ADMIN PIN) في هذه الجلسة'); return; }
      inv.zatcaStatus = r.status || 'local';
      if (r.uuid) inv.zatcaUuid = r.uuid;
      if (r.qr) inv.zatcaQrCode = r.qr;
      return saveData().then(function () {
        renderInvoices(matter);
        showToast(inv.zatcaStatus === 'REPORTED' ? 'تم الإبلاغ بنجاح' : 'تعذّر الإبلاغ — حاول لاحقاً');
      });
    });
  }

  function deleteInvoice(matterId, invId) {
    var matter = (data.matters || []).find(function (x) { return x.id === matterId; });
    if (!matter) return;
    if (!confirm('حذف هذه الفاتورة؟')) return;
    matter.invoices = (matter.invoices || []).filter(function (x) { return x.id !== invId; });
    saveData().then(function () { renderInvoices(matter); renderStats(); showToast('تم حذف الفاتورة'); });
  }

  function printInvoice(matterId, invId) {
    var matter = (data.matters || []).find(function (x) { return x.id === matterId; });
    if (!matter) return;
    var inv = (matter.invoices || []).find(function (x) { return x.id === invId; });
    if (!inv) return;

    var qrImg = inv.zatcaQrCode
      ? '<img alt="ZATCA QR" style="width:130px;height:130px" src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=' + encodeURIComponent(inv.zatcaQrCode) + '">'
      : '<div style="font-size:11px;color:#888;width:130px;">رمز QR يظهر بعد الإبلاغ لـ ZATCA</div>';

    var rows = (inv.items || []).map(function (it) {
      var sub = Number(it.price) * Number(it.quantity);
      return '<tr><td>' + esc(it.name) + '</td><td>' + it.quantity + '</td><td dir="ltr">' + Number(it.price).toFixed(2) + '</td><td dir="ltr">' + sub.toFixed(2) + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>' + esc(inv.number) + '</title>' +
      '<style>body{font-family:"Segoe UI",Tahoma,sans-serif;color:#1e293b;padding:30px;max-width:720px;margin:auto}' +
      'h1{color:#1e3d59;font-size:20px;margin:0 0 4px}.muted{color:#64748b;font-size:13px}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3d59;padding-bottom:14px;margin-bottom:18px}' +
      'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #e2e8f0;padding:8px;text-align:right;font-size:13px}th{background:#f1f5f9}' +
      '.totals{margin-top:10px;width:280px;margin-right:auto}.totals td{border:none;padding:4px 8px}.grand{font-weight:700;font-size:15px;color:#1e3d59;border-top:2px solid #1e3d59!important}' +
      '.foot{display:flex;justify-content:space-between;align-items:center;margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:16px}' +
      '.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;background:#e7f7ed;color:#1c7a43}</style></head><body>' +
      '<div class="head"><div><h1>' + esc(data.firmName || 'المكتب القانوني') + '</h1>' +
        '<div class="muted">فاتورة ضريبية مبسّطة</div>' +
        '<div class="muted">جوال: ' + esc(data.firmPhone || '') + '</div></div>' +
        '<div style="text-align:left"><div><b>رقم الفاتورة:</b> <span dir="ltr">' + esc(inv.number) + '</span></div>' +
        '<div><b>التاريخ:</b> ' + esc(formatDate(inv.createdAt)) + '</div>' +
        '<div><b>رقم القضية:</b> <span dir="ltr">' + esc(matter.number) + '</span></div>' +
        (inv.zatcaStatus === 'REPORTED' ? '<div class="tag">مبلّغة لـ ZATCA</div>' : '') +
        '</div></div>' +
      '<div><b>العميل:</b> ' + esc(inv.customerName) + (inv.customerPhone ? ' — <span dir="ltr">' + esc(inv.customerPhone) + '</span>' : '') + '</div>' +
      '<table><thead><tr><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<table class="totals"><tr><td>المجموع قبل الضريبة</td><td dir="ltr">' + Number(inv.subtotal).toFixed(2) + ' ر.س</td></tr>' +
        '<tr><td>ضريبة القيمة المضافة (15%)</td><td dir="ltr">' + Number(inv.taxAmount).toFixed(2) + ' ر.س</td></tr>' +
        '<tr class="grand"><td>الإجمالي المستحق</td><td dir="ltr">' + Number(inv.totalAmount).toFixed(2) + ' ر.س</td></tr></table>' +
      '<div class="foot">' + qrImg + '<div class="muted" style="text-align:left">' +
        (inv.zatcaUuid ? '<div>UUID: <span dir="ltr">' + esc(inv.zatcaUuid) + '</span></div>' : '') +
        '<div>شكراً لثقتكم.</div></div></div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>' +
      '</body></html>';

    var w = window.open('', '_blank');
    if (!w) { showToast('فعّل النوافذ المنبثقة لعرض الفاتورة'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ── إبلاغ الموكّل عبر واتساب ──
  function notifyClient(id) {
    var m = (data.matters || []).find(function (x) { return x.id === id; });
    if (!m) return;
    var lines = [
      'تحديث بشأن قضيتك — ' + (data.firmName || 'المكتب القانوني'),
      '━━━━━━━━━━━━━━',
      'رقم القضية: ' + m.number,
      'النوع: ' + (m.typeLabel || '—'),
      'الحالة الحالية: ' + getStatusLabel(m.status),
    ];
    if (m.court) lines.push('الجهة: ' + m.court);
    if (m.nextSession) lines.push('الجلسة القادمة: ' + formatDate(m.nextSession));
    var due = Math.max(0, (Number(m.feeTotal) || 0) - (Number(m.feePaid) || 0));
    if (due > 0) lines.push('أتعاب مستحقة: ' + due.toLocaleString('en-US') + ' ر.س');
    lines.push('━━━━━━━━━━━━━━', 'للاستفسار يرجى الرد على هذه الرسالة.');
    var url = 'https://wa.me/' + cleanPhone(m.clientPhone) + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, '_blank');
  }

  // ── استعلام الموكّل ──
  function handleLookup(e) {
    e.preventDefault();
    var num = $('lookupNumber').value.trim().toUpperCase();
    var phone = cleanPhone($('lookupPhone').value);
    var box = $('lookupResult');

    var m = (data.matters || []).find(function (x) {
      return (x.number || '').toUpperCase() === num && cleanPhone(x.clientPhone) === phone;
    });

    box.style.display = 'block';
    if (!m) {
      box.innerHTML = '<p class="lp-error">لم يتم العثور على قضية مطابقة. تأكد من رقم القضية ورقم الجوال المسجّل، أو تواصل مع المكتب.</p>';
      return;
    }

    var due = Math.max(0, (Number(m.feeTotal) || 0) - (Number(m.feePaid) || 0));
    var timeline = (m.timeline || []).slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
    var tlHtml = timeline.length
      ? '<ul class="lp-timeline">' + timeline.map(function (t) {
          return '<li><div class="lp-timeline__date" dir="ltr">' + esc(formatDate(t.at)) + '</div><div class="lp-timeline__text">' + esc(t.text) + '</div></li>';
        }).join('') + '</ul>'
      : '<p class="lp-muted">لا توجد مستجدات منشورة بعد.</p>';

    box.innerHTML =
      '<div class="lp-result__head">' +
        '<span class="lp-result__num">القضية ' + esc(m.number) + '</span>' +
        '<span class="lp-badge lp-badge--' + esc(m.status) + '">' + esc(getStatusLabel(m.status)) + '</span>' +
      '</div>' +
      '<div class="lp-meta-grid">' +
        '<div class="lp-meta"><b>الموكّل:</b> ' + esc(m.clientName) + '</div>' +
        '<div class="lp-meta"><b>النوع:</b> ' + esc(m.typeLabel || '—') + '</div>' +
        '<div class="lp-meta"><b>الجهة:</b> ' + esc(m.court || '—') + '</div>' +
        '<div class="lp-meta"><b>الجلسة القادمة:</b> <span dir="ltr">' + esc(formatDate(m.nextSession)) + '</span></div>' +
        (due > 0 ? '<div class="lp-meta"><b>أتعاب مستحقة:</b> ' + esc(due.toLocaleString('en-US')) + ' ر.س</div>' : '') +
      '</div>' +
      '<h4 class="lp-card__title"><span class="lp-card__icon">🕓</span> آخر المستجدات</h4>' +
      tlHtml;
  }

  // ── مزامنة الحجوزات مع سجل القضايا ──
  function collectLegalBookings() {
    if (!bookingStore) return [];
    var list = [];
    var seen = {};
    function add(arr) {
      (arr || []).forEach(function (a) {
        if (!a || a.activityId !== 'legal') return;
        if (a.status === 'cancelled') return;
        if (seen[a.id]) return;
        seen[a.id] = true;
        list.push(a);
      });
    }
    try { add(bookingStore.getAppointments()); } catch (e) { /* ignore */ }
    try { add(bookingStore.getPendingRequests()); } catch (e) { /* ignore */ }
    return list;
  }

  function parseBookingLawyerId(apt) {
    var m = (apt.notes || '').match(/\[محامي#([^\]]+)\]/);
    var id = m ? m[1] : '';
    return id && getLawyerById(id) ? id : '';
  }

  function cleanBookingNotes(notes) {
    return (notes || '').split('\n').filter(function (l) { return l.indexOf('[محامي#') === -1; }).join('\n').trim();
  }

  function bookingSessionText(apt) {
    var svc = store && store.getServiceById ? store.getServiceById(apt.serviceId) : null;
    var svcTitle = (svc && svc.title) || apt.serviceTitle || 'استشارة قانونية';
    var when = formatDate(apt.date) + (apt.time ? (' — ' + apt.time) : '');
    var mode = apt.deliveryMode === 'remote' ? ' (عن بُعد)' : (apt.deliveryMode === 'in_person' ? ' (حضوري)' : '');
    return 'حجز عبر التقويم: ' + svcTitle + ' — ' + when + mode;
  }

  function syncBookings(silent) {
    var ready = bookingReady || (bookingStore && bookingStore.init ? bookingStore.init() : Promise.resolve());
    bookingReady = ready;
    return ready.then(function () {
      var bookings = collectLegalBookings();
      if (!bookings.length) { if (!silent) showToast('لا توجد حجوزات قانونية للمزامنة'); return; }

      var linked = {};
      (data.matters || []).forEach(function (m) {
        (m.linkedBookingIds || []).forEach(function (bid) { linked[bid] = true; });
      });

      var created = 0, updated = 0;
      bookings.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });

      bookings.forEach(function (apt) {
        if (linked[apt.id]) return;
        var phone = cleanPhone(apt.phone);
        var svc = store && store.getServiceById ? store.getServiceById(apt.serviceId) : null;
        var svcTitle = (svc && svc.title) || 'استشارة قانونية';

        var matter = (data.matters || []).filter(function (m) {
          return cleanPhone(m.clientPhone) === phone && m.status !== 'closed' && m.status !== 'lost' && m.status !== 'won';
        }).sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); })[0];

        var reqLawyerId = parseBookingLawyerId(apt);

        if (matter) {
          matter.timeline = matter.timeline || [];
          matter.timeline.push({ id: genId(), at: new Date().toISOString(), text: bookingSessionText(apt) });
          matter.linkedBookingIds = matter.linkedBookingIds || [];
          matter.linkedBookingIds.push(apt.id);
          if (apt.date) matter.nextSession = apt.date;
          if (reqLawyerId && !matter.lawyerId) matter.lawyerId = reqLawyerId;
          updated++;
        } else {
          var newMatter = {
            id: genId(),
            number: nextMatterNumber(),
            createdAt: new Date().toISOString(),
            clientName: apt.customerName || 'موكّل',
            clientPhone: apt.phone || '',
            typeLabel: svcTitle,
            lawyerId: reqLawyerId || '',
            court: '',
            status: 'new',
            nextSession: apt.date || '',
            feeTotal: null,
            feePaid: null,
            notes: cleanBookingNotes(apt.notes),
            linkedBookingIds: [apt.id],
            timeline: [
              { id: genId(), at: new Date().toISOString(), text: 'تم فتح الملف تلقائياً من حجز التقويم' },
              { id: genId(), at: new Date().toISOString(), text: bookingSessionText(apt) },
            ],
          };
          data.matters.push(newMatter);
          linked[apt.id] = true;
          created++;
        }
      });

      if (created || updated) {
        return saveData().then(function () {
          renderMatters();
          renderStats();
          renderSchedule();
          renderLawyers();
          if (!silent) showToast('تمت المزامنة: ' + created + ' ملف جديد، ' + updated + ' تحديث');
        });
      }
      if (!silent) showToast('سجل القضايا محدّث — لا حجوزات جديدة');
    }).catch(function (err) {
      console.warn('legal-portal: syncBookings failed', err);
      if (!silent) showToast('تعذّرت مزامنة الحجوزات');
    });
  }

  // ── PIN ودخول المحامي ──
  function verifyPin(pin) {
    if (db && typeof db.isConfigured === 'function' && db.isConfigured() && currentTenantSlug && currentTenantSlug !== 'default') {
      return fetch('/api/v1/auth/admin-login?action=verify-coach-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: currentTenantSlug, pin: pin, coachingType: CONFIG_KEY }),
      })
        .then(function (res) { if (!res.ok) throw new Error('net'); return res.json(); })
        .then(function (d) { return !!d.success; })
        .catch(function () { return pin === (data.coachPin || '1234'); });
    }
    return Promise.resolve(pin === (data.coachPin || '1234'));
  }

  function showLawyerView() {
    $('viewClient').style.display = 'none';
    $('viewLawyer').style.display = 'block';
    $('btnViewLawyer').classList.add('lp-switch-btn--active');
    $('btnViewClient').classList.remove('lp-switch-btn--active');
    syncBookings(true);
  }

  function showClientView() {
    $('viewLawyer').style.display = 'none';
    $('viewClient').style.display = 'block';
    $('btnViewClient').classList.add('lp-switch-btn--active');
    $('btnViewLawyer').classList.remove('lp-switch-btn--active');
  }

  function openPinModal() { $('pinModal').classList.add('lp-modal--open'); setTimeout(function () { $('pinInput').focus(); }, 50); }
  function closePinModal() { $('pinModal').classList.remove('lp-modal--open'); $('pinInput').value = ''; $('pinError').style.display = 'none'; }

  // ── ربط الأحداث ──
  function bindEvents() {
    $('btnViewClient').addEventListener('click', showClientView);
    $('btnViewLawyer').addEventListener('click', function () {
      if (isLawyerAuthed) { showLawyerView(); } else { openPinModal(); }
    });

    $('pinForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pin = $('pinInput').value.trim();
      verifyPin(pin).then(function (ok) {
        if (ok) { isLawyerAuthed = true; closePinModal(); showLawyerView(); renderMatters(); }
        else { $('pinError').style.display = 'block'; $('pinInput').value = ''; $('pinInput').focus(); }
      });
    });

    $('lookupForm').addEventListener('submit', handleLookup);

    $('btnAddMatter').addEventListener('click', function () { openMatterModal(null); });
    $('btnSyncBookings').addEventListener('click', function () { syncBookings(false); });
    $('matterModalClose').addEventListener('click', closeMatterModal);
    $('matterModal').addEventListener('click', function (e) { if (e.target === $('matterModal')) closeMatterModal(); });
    $('matterForm').addEventListener('submit', saveMatterFromForm);
    $('timelineForm').addEventListener('submit', addTimelineEntry);
    if ($('invoiceForm')) $('invoiceForm').addEventListener('submit', issueInvoiceFromForm);

    $('matterSearch').addEventListener('input', renderMatters);
    $('matterFilter').addEventListener('change', renderMatters);
    $('matterLawyerFilter').addEventListener('change', renderMatters);
    $('scheduleFilter').addEventListener('change', renderSchedule);
    $('lawyerForm').addEventListener('submit', saveLawyerFromForm);

    $('firmForm').addEventListener('submit', function (e) {
      e.preventDefault();
      data.firmName = $('firmNameInput').value.trim() || 'المكتب القانوني';
      data.firmAvatar = $('firmAvatarInput').value.trim() || '⚖️';
      data.firmPhone = $('firmPhoneInput').value.trim() || data.firmPhone;
      data.firmBio = $('firmBioInput').value.trim();
      saveData().then(function () { renderFirm(); renderClientServices(); showToast('تم حفظ بيانات المكتب'); });
    });

    $('pinChangeForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var np = $('newPinInput').value.trim();
      if (!/^\d{4}$/.test(np)) { showToast('الرمز يجب أن يكون 4 أرقام'); return; }
      data.coachPin = np;
      saveData().then(function () { $('newPinInput').value = ''; showToast('تم تحديث الرمز السري'); });
    });
  }

  // ── الإقلاع ──
  function start() {
    bindEvents();
    if (bookingStore && bookingStore.init) {
      bookingReady = bookingStore.init().catch(function () {});
    }
    var ready = store && store.init ? store.init() : Promise.resolve();
    ready.then(loadData).catch(function (err) {
      console.warn('legal-portal init fallback', err);
      loadLocal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
