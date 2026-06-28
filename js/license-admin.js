/**
 * مكن — لوحة إدارة التراخيص (واجهة الدومين الفرعي)
 * تتصل بـ /api/license مع الهيدر X-Admin-Token.
 */
(function () {
  'use strict';

  var API = '/api/license';
  var TOKEN_KEY = 'mken_license_admin_token';

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

  function api(action, method, body) {
    var url = API + '?action=' + action;
    return fetch(url, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token()
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || ('خطأ ' + r.status));
        return data;
      });
    });
  }

  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2800);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ar-SA'); } catch (e) { return iso; }
  }

  function statusBadge(s) {
    var label = s === 'active' ? 'فعّال' : (s === 'suspended' ? 'موقوف' : 'ملغى');
    return '<span class="badge ' + s + '">' + label + '</span>';
  }

  var Admin = {
    login: function () {
      var v = document.getElementById('adminToken').value.trim();
      if (!v) { toast('أدخل الرمز', true); return; }
      sessionStorage.setItem(TOKEN_KEY, v);
      Admin.load().then(function () {
        document.getElementById('gate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
      }).catch(function (e) {
        sessionStorage.removeItem(TOKEN_KEY);
        toast(e.message || 'فشل الدخول', true);
      });
    },

    logout: function () {
      sessionStorage.removeItem(TOKEN_KEY);
      location.reload();
    },

    issue: function () {
      var body = {
        customerName: val('f_name'),
        phone: val('f_phone'),
        email: val('f_email'),
        crNumber: val('f_cr_number'),
        taxNumber: val('f_tax_number'),
        plan: val('f_plan'),
        billingCycle: val('f_cycle'),
        months: Number(val('f_months')) || 12,
        maxDevices: Number(val('f_devices')) || 1,
        notes: val('f_notes')
      };
      if (!body.customerName) { toast('أدخل اسم العميل', true); return; }
      if (!body.crNumber) { toast('أدخل رقم السجل التجاري أو وثيقة العمل الحر', true); return; }
      if (body.taxNumber && !/^[0-9]{15}$/.test(body.taxNumber)) { toast('الرقم الضريبي غير صالح (يجب أن يتكون من 15 رقماً)', true); return; }
      api('issue', 'POST', body).then(function (res) {
        var key = res.license.license_key;
        toast('تم إصدار الترخيص: ' + key);
        try { navigator.clipboard.writeText(key); } catch (e) {}
        ['f_name', 'f_phone', 'f_email', 'f_cr_number', 'f_tax_number', 'f_notes'].forEach(function (id) { document.getElementById(id).value = ''; });
        Admin.load();
      }).catch(function (e) { toast(e.message, true); });
    },

    setStatus: function (key, action) {
      api(action, 'POST', { licenseKey: key }).then(function () {
        toast('تم التحديث'); Admin.load();
      }).catch(function (e) { toast(e.message, true); });
    },

    copyKey: function (key) {
      try { navigator.clipboard.writeText(key); toast('تم نسخ المفتاح'); } catch (e) { toast(key); }
    },

    load: function () {
      var status = val('statusFilter');
      var q = val('q');
      var qs = (status ? '&status=' + encodeURIComponent(status) : '') + (q ? '&q=' + encodeURIComponent(q) : '');
      return fetch(API + '?action=list' + qs, { headers: { 'X-Admin-Token': token() } })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'خطأ'); return d; }); })
        .then(function (data) {
          renderStats(data.licenses);
          renderTable(data.licenses);
        });
    }
  };

  function renderStats(list) {
    var active = list.filter(function (l) { return l.status === 'active'; }).length;
    var suspended = list.filter(function (l) { return l.status === 'suspended'; }).length;
    var revoked = list.filter(function (l) { return l.status === 'revoked'; }).length;
    var devices = list.reduce(function (s, l) { return s + (l.device_count || 0); }, 0);
    var now = new Date();
    var expiringSoon = list.filter(function (l) {
      return l.expires_at && l.status === 'active' &&
        (new Date(l.expires_at) - now) < 30 * 86400000 && new Date(l.expires_at) > now;
    }).length;

    document.getElementById('stats').innerHTML =
      stat('إجمالي التراخيص', list.length, 'blue') +
      stat('فعّالة', active, 'green') +
      stat('موقوفة', suspended, 'amber') +
      stat('ملغاة', revoked, 'red') +
      stat('أجهزة مفعّلة', devices, 'blue') +
      stat('تنتهي خلال 30 يوم', expiringSoon, 'amber');
  }

  function stat(label, val, cls) {
    return '<div class="stat ' + cls + '"><div class="v">' + val + '</div><div class="l">' + label + '</div></div>';
  }

  function renderTable(list) {
    if (!list.length) {
      document.getElementById('tableWrap').innerHTML = '<p class="muted">لا توجد تراخيص.</p>';
      return;
    }
    var rows = list.map(function (l) {
      var actions = '<div class="row-actions">' +
        '<button class="btn tiny ghost" onclick="LicenseAdmin.copyKey(\'' + l.license_key + '\')">نسخ</button>' +
        (l.status === 'active'
          ? '<button class="btn tiny warn" onclick="LicenseAdmin.setStatus(\'' + l.license_key + '\',\'suspend\')">إيقاف</button>'
          : (l.status === 'suspended'
            ? '<button class="btn tiny ok" onclick="LicenseAdmin.setStatus(\'' + l.license_key + '\',\'resume\')">تفعيل</button>'
            : '')) +
        (l.status !== 'revoked'
          ? '<button class="btn tiny danger" onclick="LicenseAdmin.setStatus(\'' + l.license_key + '\',\'revoke\')">إلغاء</button>'
          : '') +
        '</div>';
      var clientInfo = (l.customer_name || '—') + '<br><span class="muted">' + (l.customer_phone || '') + '</span>';
      if (l.commercial_registry_number) {
        clientInfo += '<br><small class="muted">س.ت: ' + l.commercial_registry_number + '</small>';
      }
      if (l.tax_number) {
        clientInfo += '<br><small class="muted">ضريبي: ' + l.tax_number + '</small>';
      }
      return '<tr>' +
        '<td class="key">' + l.license_key + '</td>' +
        '<td>' + clientInfo + '</td>' +
        '<td>' + l.plan + '</td>' +
        '<td>' + statusBadge(l.status) + '</td>' +
        '<td>' + (l.device_count || 0) + ' / ' + l.max_devices + '</td>' +
        '<td>' + fmtDate(l.expires_at) + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');

    document.getElementById('tableWrap').innerHTML =
      '<table><thead><tr><th>المفتاح</th><th>العميل</th><th>الباقة</th><th>الحالة</th><th>الأجهزة</th><th>الانتهاء</th><th>إجراءات</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
  }

  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  // دخول تلقائي إن وُجد رمز محفوظ
  document.addEventListener('DOMContentLoaded', function () {
    var q = document.getElementById('q');
    var sf = document.getElementById('statusFilter');
    if (q) q.addEventListener('input', debounce(Admin.load, 400));
    if (sf) sf.addEventListener('change', Admin.load);

    if (token()) {
      Admin.load().then(function () {
        document.getElementById('gate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
      }).catch(function () { sessionStorage.removeItem(TOKEN_KEY); });
    }
  });

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  window.LicenseAdmin = Admin;
})();
