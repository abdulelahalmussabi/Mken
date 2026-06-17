/**
 * إدارة حسابات العملاء والاشتراكات (SaaS Client Management) — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var clientsSearchInput = document.getElementById('clientsSearchInput');
  var refreshClientsBtn = document.getElementById('refreshClientsBtn');
  var adminClientsList = document.getElementById('adminClientsList');
  var adminRegisterForm = document.getElementById('adminRegisterForm');

  var _clients = [];

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function getPin() {
    var pin = sessionStorage.getItem('mken_admin_pin');
    if (!pin) {
      pin = prompt('الرجاء إدخال الرمز السري الرئيسي لتأكيد الصلاحيات (Master PIN):');
      if (pin) {
        sessionStorage.setItem('mken_admin_pin', pin);
      }
    }
    return pin || 'mken2026';
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('ar-SA') + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  function loadClients() {
    if (adminClientsList) {
      adminClientsList.innerHTML = '<tr><td colspan="7" class="admin-hint" style="text-align:center; padding:20px;">جاري تحميل قائمة العملاء...</td></tr>';
    }

    var pin = getPin();

    fetch('/api/v1/auth/admin-login?action=list-clients', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': pin
      }
    })
    .then(function (res) {
      if (res.status === 401) {
        sessionStorage.removeItem('mken_admin_pin'); // Clear wrong pin
        throw new Error('الرمز السري الرئيسي غير صحيح أو انتهت الجلسة.');
      }
      if (!res.ok) {
        throw new Error('فشل تحميل قائمة العملاء من الخادم.');
      }
      return res.json();
    })
    .then(function (data) {
      if (data && data.success) {
        _clients = data.clients || [];
        renderClients();
      } else {
        throw new Error(data.error || 'حدث خطأ غير معروف.');
      }
    })
    .catch(function (err) {
      console.error(err);
      if (adminClientsList) {
        adminClientsList.innerHTML = '<tr><td colspan="7" class="admin-error" style="text-align:center; padding:20px; color:#e74c3c;">' + esc(err.message) + '</td></tr>';
      }
      toast(err.message, 'error');
    });
  }

  function renderClients() {
    if (!adminClientsList) return;

    var filter = (clientsSearchInput ? clientsSearchInput.value : '').trim().toLowerCase();
    var filtered = _clients.filter(function (c) {
      return (
        esc(c.business_name).toLowerCase().indexOf(filter) !== -1 ||
        esc(c.tenant_slug).toLowerCase().indexOf(filter) !== -1 ||
        esc(c.email).toLowerCase().indexOf(filter) !== -1 ||
        esc(c.phone).toLowerCase().indexOf(filter) !== -1
      );
    });

    if (!filtered.length) {
      adminClientsList.innerHTML = '<tr><td colspan="7" class="admin-hint" style="text-align:center; padding:20px;">لا يوجد عملاء مطابقين للبحث.</td></tr>';
      return;
    }

    var html = filtered.map(function (c) {
      var isExpired = c.subscription_status === 'expired' || (c.subscription_end && new Date(c.subscription_end) < new Date());
      var statusText = isExpired ? 'منتهي الاشتراك' : 'نشط';
      var statusColor = isExpired ? '#e74c3c' : '#2ecc71';
      var statusBg = isExpired ? '#fdf2f2' : '#f4fbf7';
      
      // Build site link
      var siteUrl = store.buildTenantSiteUrl(c.tenant_slug);

      return (
        '<tr style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding:12px 10px; font-weight:500;">' + esc(c.business_name) + '</td>' +
        '  <td style="padding:12px 10px;"><a href="' + siteUrl + '" target="_blank" style="color:var(--color-primary); font-weight:bold; text-decoration:underline;">' + esc(c.tenant_slug) + '</a></td>' +
        '  <td style="padding:12px 10px;" dir="ltr">' + esc(c.email) + '</td>' +
        '  <td style="padding:12px 10px;" dir="ltr">' + esc(c.phone) + '</td>' +
        '  <td style="padding:12px 10px;">' +
        '    <span class="admin-status-badge" style="background:' + statusBg + '; color:' + statusColor + '; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">' + statusText + '</span>' +
        '  </td>' +
        '  <td style="padding:12px 10px;" dir="ltr">' + formatDate(c.subscription_end) + '</td>' +
        '  <td style="padding:12px 10px; text-align:center;">' +
        '    <div style="display:inline-flex; gap:6px;">' +
        '      <button type="button" class="btn btn--outline btn--sm" data-extend-slug="' + esc(c.tenant_slug) + '" style="padding:4px 10px; font-size:0.78rem;">➕ تمديد</button>' +
        '      <button type="button" class="btn btn--outline btn--sm" data-delete-slug="' + esc(c.tenant_slug) + '" style="padding:4px 10px; font-size:0.78rem; color:#e74c3c; border-color:#e74c3c20;">🗑️ حذف</button>' +
        '    </div>' +
        '  </td>' +
        '</tr>'
      );
    }).join('');

    adminClientsList.innerHTML = html;

    // Bind action listeners
    adminClientsList.querySelectorAll('[data-extend-slug]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-extend-slug');
        var months = prompt('أدخل عدد الأشهر لتمديد الاشتراك (مثال: 6 أو 12):', '12');
        if (months) {
          var mInt = parseInt(months, 10);
          if (isNaN(mInt) || mInt <= 0) {
            alert('الرجاء إدخال عدد أشهر صحيح.');
            return;
          }
          extendSubscription(slug, mInt);
        }
      });
    });

    adminClientsList.querySelectorAll('[data-delete-slug]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-delete-slug');
        if (confirm('⚠️ هل أنت متأكد من حذف العميل "' + slug + '" نهائياً؟ سيتم مسح المنشأة وملف مستخدم تسجيل الدخول المرتبط بها فوراً!')) {
          deleteClient(slug);
        }
      });
    });
  }

  function extendSubscription(tenantSlug, months) {
    var pin = getPin();
    
    fetch('/api/v1/auth/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: pin,
        action: 'extend-client',
        tenantSlug: tenantSlug,
        months: months
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('فشل تمديد الاشتراك.');
      return res.json();
    })
    .then(function (data) {
      if (data && data.success) {
        toast('تم تمديد اشتراك العميل بنجاح! 🎉');
        loadClients();
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء التمديد.');
      }
    })
    .catch(function (err) {
      toast(err.message, 'error');
    });
  }

  function deleteClient(tenantSlug) {
    var pin = getPin();

    fetch('/api/v1/auth/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: pin,
        action: 'delete-client',
        tenantSlug: tenantSlug
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('فشل حذف العميل.');
      return res.json();
    })
    .then(function (data) {
      if (data && data.success) {
        toast('تم حذف حساب العميل بنجاح.');
        loadClients();
      } else {
        throw new Error(data.error || 'حدث خطأ أثناء حذف العميل.');
      }
    })
    .catch(function (err) {
      toast(err.message, 'error');
    });
  }

  function registerClient(e) {
    e.preventDefault();

    var slug = document.getElementById('adminRegTenantSlug').value.trim().toLowerCase();
    var name = document.getElementById('adminRegBusinessName').value.trim();
    var email = document.getElementById('adminRegEmail').value.trim();
    var password = document.getElementById('adminRegPassword').value;
    var phone = document.getElementById('adminRegPhone').value.trim();

    var regError = document.getElementById('adminRegisterError');
    var regBtn = document.getElementById('adminRegisterSubmitBtn');

    if (regError) regError.hidden = true;
    if (regBtn) {
      regBtn.disabled = true;
      regBtn.textContent = 'جاري تسجيل حساب العميل...';
    }

    var pin = getPin();

    fetch('/api/v1/auth/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: pin,
        action: 'register-client',
        tenantSlug: slug,
        businessName: name,
        email: email,
        password: password,
        phone: phone
      })
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (errData) {
          throw new Error(errData.error || errData.message || 'فشل التسجيل.');
        });
      }
      return res.json();
    })
    .then(function (data) {
      if (data && data.success) {
        toast('تم تسجيل العميل الجديد بنجاح وتفعيل موقعه! 🚀');
        if (adminRegisterForm) adminRegisterForm.reset();
        loadClients();
      } else {
        throw new Error(data.error || 'فشل التسجيل.');
      }
    })
    .catch(function (err) {
      console.error(err);
      if (regError) {
        regError.textContent = err.message || 'فشل تسجيل العميل.';
        regError.hidden = false;
      }
    })
    .finally(function () {
      if (regBtn) {
        regBtn.disabled = false;
        regBtn.textContent = 'إنشاء حساب المنشأة وتفعيلها';
      }
    });
  }

  function bindEvents() {
    if (refreshClientsBtn) {
      refreshClientsBtn.addEventListener('click', loadClients);
    }
    if (clientsSearchInput) {
      clientsSearchInput.addEventListener('input', renderClients);
    }
    if (adminRegisterForm) {
      adminRegisterForm.addEventListener('submit', registerClient);
    }
  }

  function refresh() {
    loadClients();
  }

  window.MkenAdminClients = {
    refresh: refresh
  };

  bindEvents();
})();
