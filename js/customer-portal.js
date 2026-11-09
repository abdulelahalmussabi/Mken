/**
 * بوابة إدارة وحركات مواعيد العملاء — منصة مكّن
 * استرجاع، تعديل، إلغاء، وإضافة التقويمات للمواعيد
 */
(function () {
  'use strict';

  var auth = window.MkenCustomerAuth;
  var db = window.MkenSupabaseDb;
  var store = window.MkenServicesStore;
  var bookingStore = window.MkenBookingStore;
  var calExport = window.MkenCalendarExport;

  var currentAppointments = [];
  var currentFilter = 'upcoming'; // 'upcoming' | 'past' | 'all'
  var activeModalApt = null;
  var selectedRescheduleDate = '';
  var selectedRescheduleTime = '';

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function getTenantSlug() {
    return (store && typeof store.getCurrentTenantSlug === 'function')
      ? store.getCurrentTenantSlug()
      : 'default';
  }

  function getConfig() {
    return (store && typeof store.loadConfig === 'function')
      ? store.loadConfig()
      : {};
  }

  function getEffectiveBooking(service) {
    var cfg = getConfig();
    if (!store) return {};
    return store.getBookingForActivity(service ? service.activityId : null, cfg);
  }

  function showToast(msg, type) {
    if (window.MkenAdminToast) {
      window.MkenAdminToast(msg, type);
      return;
    }
    var toast = document.createElement('div');
    toast.className = 'portal-toast ' + (type || 'info');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('visible'); }, 10);
    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

  function loadAppointments() {
    var container = document.getElementById('portalAppointmentsList');
    if (!container) return;

    container.innerHTML = 
      '<div class="portal-loading">' +
        '<div class="portal-spinner"></div>' +
        '<p>جاري تحميل مواعيدك...</p>' +
      '</div>';

    var user = auth ? auth.getCurrentUser() : null;
    var profile = auth ? auth.getProfile() : null;
    var phoneInput = document.getElementById('guestPhoneLookupInput');
    var lookupPhone = phoneInput ? phoneInput.value.trim() : '';

    var userId = user ? user.id : null;
    var email = user ? user.email : null;
    var phone = (profile && profile.phone) || lookupPhone || '';

    var tenantSlug = getTenantSlug();

    var fetchPromise;
    if (db && db.isConfigured() && (userId || phone || email)) {
      fetchPromise = db.fetchCustomerAppointments(tenantSlug, userId, phone, email);
    } else {
      // جلب من التخزين المحلي كخيار مساند
      var localApts = bookingStore ? bookingStore.getAppointments() : [];
      if (userId || phone || email) {
        localApts = localApts.filter(function (a) {
          return (userId && a.userId === userId) ||
                 (phone && a.phone === phone) ||
                 (email && a.customerEmail === email);
        });
      }
      fetchPromise = Promise.resolve(localApts);
    }

    fetchPromise
      .then(function (apts) {
        currentAppointments = apts || [];
        renderAppointments();
        checkUrlHighlight();
      })
      .catch(function (err) {
        console.error('Failed to load appointments:', err);
        container.innerHTML = 
          '<div class="portal-empty-state">' +
            '<p class="error-text">حدث خطأ أثناء جلب المواعيد: ' + esc(err.message) + '</p>' +
            '<button type="button" class="btn btn--outline" id="retryFetchBtn">إعادة المحاولة</button>' +
          '</div>';
        var retry = document.getElementById('retryFetchBtn');
        if (retry) retry.addEventListener('click', loadAppointments);
      });
  }

  function isUpcoming(apt) {
    if (!apt || !apt.date) return false;
    var aptDateTime = new Date(apt.date + 'T' + (apt.time || '23:59') + ':00');
    return aptDateTime >= new Date() && apt.status !== 'cancelled';
  }

  function filterAppointments() {
    if (currentFilter === 'upcoming') {
      return currentAppointments.filter(isUpcoming);
    } else if (currentFilter === 'past') {
      return currentAppointments.filter(function (a) {
        return !isUpcoming(a) || a.status === 'cancelled';
      });
    }
    return currentAppointments;
  }

  function renderAppointments() {
    var container = document.getElementById('portalAppointmentsList');
    if (!container) return;

    var list = filterAppointments();

    if (!list.length) {
      container.innerHTML = 
        '<div class="portal-empty-state">' +
          '<div class="empty-icon">📅</div>' +
          '<h3>لا توجد مواعيد ' + (currentFilter === 'upcoming' ? 'قادمة' : (currentFilter === 'past' ? 'سابقة' : '')) + '</h3>' +
          '<p>احجز موعدك القادم بسهولة واستفد من خدماتنا المتميزة.</p>' +
          '<a href="book.html" class="btn btn--primary">احجز موعداً جديداً</a>' +
        '</div>';
      return;
    }

    var cfg = getConfig();
    var brandName = (cfg.brand && cfg.brand.name) || 'منصة مكّن';

    container.innerHTML = list.map(function (apt) {
      var svc = store ? store.getServiceById(apt.serviceId) : null;
      var svcTitle = svc ? svc.title : (apt.serviceId || 'خدمة محددة');
      var statusBadge = getStatusBadge(apt);
      var paymentBadge = getPaymentBadge(apt);
      var canModify = isUpcoming(apt) && apt.status !== 'cancelled';

      var dateStr = bookingStore ? bookingStore.formatDateArabic(apt.date) : apt.date;
      var timeStr = bookingStore ? bookingStore.formatTimeArabic(apt.time) : apt.time;

      return (
        '<div class="portal-appointment-card" id="apt-card-' + esc(apt.id) + '" data-id="' + esc(apt.id) + '">' +
          '<div class="apt-card-header">' +
            '<div class="apt-title-group">' +
              '<h4>' + esc(svcTitle) + '</h4>' +
              '<span class="apt-id-tag">رقم الموعد: #' + esc(apt.id.slice(-6).toUpperCase()) + '</span>' +
            '</div>' +
            '<div class="apt-badges">' +
              statusBadge +
              paymentBadge +
            '</div>' +
          '</div>' +

          '<div class="apt-details-grid">' +
            '<div class="apt-detail-item">' +
              '<span class="detail-label">التاريخ والوقت</span>' +
              '<strong class="detail-value">📅 ' + esc(dateStr) + ' — ⏰ ' + esc(timeStr) + '</strong>' +
            '</div>' +
            '<div class="apt-detail-item">' +
              '<span class="detail-label">اسم العميل</span>' +
              '<span class="detail-value">👤 ' + esc(apt.customerName || 'عميل') + '</span>' +
            '</div>' +
            (apt.locationAddress ? 
              '<div class="apt-detail-item">' +
                '<span class="detail-label">الموقع / العنوان</span>' +
                '<span class="detail-value">📍 ' + esc(apt.locationAddress) + '</span>' +
              '</div>' : '') +
            (apt.deliveryMode === 'remote' ? 
              '<div class="apt-detail-item">' +
                '<span class="detail-label">طريقة الحضور</span>' +
                '<span class="detail-value">💻 عن بُعد (Zoom / Teams)</span>' +
              '</div>' : '') +
            (apt.rescheduledCount > 0 ? 
              '<div class="apt-detail-item">' +
                '<span class="detail-label">حالة التعديل</span>' +
                '<span class="detail-value text-muted">تمت إعادة جدولته (' + apt.rescheduledCount + ' مرة)</span>' +
              '</div>' : '') +
          '</div>' +

          '<div class="apt-card-actions">' +
            (canModify ? 
              '<button type="button" class="btn btn--outline btn-sm btn-reschedule" data-id="' + esc(apt.id) + '">' +
                '🔄 إعادة جدولة الموعد' +
              '</button>' +
              '<button type="button" class="btn btn--outline btn-sm btn-cancel-apt text-danger" data-id="' + esc(apt.id) + '">' +
                '❌ إلغاء الموعد' +
              '</button>' : '') +

            '<button type="button" class="btn btn--outline btn-sm btn-add-cal" data-id="' + esc(apt.id) + '">' +
              '📅 إضافة للتقويم' +
            '</button>' +

            '<a href="' + esc(getWhatsAppLink(apt, brandName, svcTitle)) + '" target="_blank" rel="noopener" class="btn btn--outline btn-sm btn-wa">' +
              '💬 محادثة المنشأة' +
            '</a>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    bindAppointmentActions();
  }

  function getStatusBadge(apt) {
    if (apt.status === 'cancelled') {
      return '<span class="status-badge status-cancelled">ملغي</span>';
    }
    if (apt.status === 'confirmed') {
      return '<span class="status-badge status-confirmed">مؤكد</span>';
    }
    return '<span class="status-badge status-pending">قيد التأكيد</span>';
  }

  function getPaymentBadge(apt) {
    if (apt.paymentStatus === 'paid') {
      return '<span class="status-badge status-paid">مدفوع ✅</span>';
    }
    if (apt.paymentAmount) {
      return '<span class="status-badge status-unpaid">غير مدفوع (' + apt.paymentAmount + ' ر.س)</span>';
    }
    return '';
  }

  function getWhatsAppLink(apt, brandName, svcTitle) {
    var phone = (getConfig().phone) || (store && store.DEFAULT_PHONE) || '966500000000';
    var waUrl = (store && typeof store.waLink === 'function') ? store.waLink(phone) : ('https://wa.me/' + phone);
    var dateStr = bookingStore ? bookingStore.formatDateArabic(apt.date) : apt.date;
    var timeStr = bookingStore ? bookingStore.formatTimeArabic(apt.time) : apt.time;

    var text = 'السلام عليكم ' + brandName + '، بخصوص موعدي رقم #' + apt.id.slice(-6) + '\n' +
      'خدمة: ' + svcTitle + '\n' +
      'التاريخ: ' + dateStr + ' ' + timeStr;

    return waUrl + '?text=' + encodeURIComponent(text);
  }

  function bindAppointmentActions() {
    // 1. زر إعادة الجدولة
    document.querySelectorAll('.btn-reschedule').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        openRescheduleModal(id);
      });
    });

    // 2. زر الإلغاء
    document.querySelectorAll('.btn-cancel-apt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        openCancelModal(id);
      });
    });

    // 3. إضافة للتقويم
    document.querySelectorAll('.btn-add-cal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        openCalendarModal(id);
      });
    });
  }

  function openRescheduleModal(aptId) {
    var apt = currentAppointments.find(function (a) { return a.id === aptId; });
    if (!apt) return;
    activeModalApt = apt;

    var modal = document.getElementById('rescheduleModal');
    if (!modal) return;

    var titleEl = document.getElementById('rescheduleModalTitle');
    if (titleEl) {
      var svc = store ? store.getServiceById(apt.serviceId) : null;
      titleEl.textContent = 'إعادة جدولة: ' + (svc ? svc.title : 'الموعد');
    }

    var dateInput = document.getElementById('rescheduleDateInput');
    var slotsContainer = document.getElementById('rescheduleSlotsContainer');
    if (slotsContainer) slotsContainer.innerHTML = '<p class="admin-hint">اختر التاريخ أولاً لعرض الأوقات المتاحة.</p>';

    if (dateInput) {
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
      dateInput.value = apt.date;
      selectedRescheduleDate = apt.date;
      renderRescheduleSlots(apt, apt.date);

      dateInput.onchange = function () {
        selectedRescheduleDate = this.value;
        renderRescheduleSlots(apt, this.value);
      };
    }

    modal.classList.add('active');
  }

  function renderRescheduleSlots(apt, dateStr) {
    var slotsContainer = document.getElementById('rescheduleSlotsContainer');
    if (!slotsContainer || !bookingStore || !store) return;

    var svc = store.getServiceById(apt.serviceId);
    var b = getEffectiveBooking(svc);
    var allApts = bookingStore.getAppointments();

    var slots = bookingStore.getSlotsForDate(dateStr, svc, b, allApts);

    if (!slots || !slots.length) {
      slotsContainer.innerHTML = '<p class="booking-empty">لا توجد أوقات شاغرة في هذا اليوم، يرجى اختيار يوم آخر.</p>';
      selectedRescheduleTime = '';
      return;
    }

    slotsContainer.innerHTML = slots.map(function (s) {
      var activeClass = (s.time === apt.time && dateStr === apt.date) ? 'slot-current' : '';
      var disabled = !s.available ? 'disabled' : '';
      return (
        '<button type="button" class="portal-slot-btn ' + activeClass + '" data-time="' + esc(s.time) + '" ' + disabled + '>' +
          esc(bookingStore.formatTimeArabic(s.time)) +
        '</button>'
      );
    }).join('');

    slotsContainer.querySelectorAll('.portal-slot-btn:not([disabled])').forEach(function (btn) {
      btn.addEventListener('click', function () {
        slotsContainer.querySelectorAll('.portal-slot-btn').forEach(function (b) { b.classList.remove('selected'); });
        this.classList.add('selected');
        selectedRescheduleTime = this.getAttribute('data-time');
        var submitBtn = document.getElementById('confirmRescheduleBtn');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  function confirmReschedule() {
    if (!activeModalApt || !selectedRescheduleDate || !selectedRescheduleTime) {
      alert('يرجى اختيار التاريخ والوقت الجديدين.');
      return;
    }

    var submitBtn = document.getElementById('confirmRescheduleBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري التعديل...';
    }

    var reason = (document.getElementById('rescheduleReasonInput') && document.getElementById('rescheduleReasonInput').value) || '';

    bookingStore.rescheduleAppointment(activeModalApt.id, selectedRescheduleDate, selectedRescheduleTime, reason)
      .then(function () {
        showToast('تمت إعادة جدولة موعدك بنجاح! 🎉', 'success');
        var modal = document.getElementById('rescheduleModal');
        if (modal) modal.classList.remove('active');
        loadAppointments();
      })
      .catch(function (err) {
        alert('تعذر إعادة جدولة الموعد: ' + err.message);
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'تأكيد الموعد الجديد';
        }
      });
  }

  function openCancelModal(aptId) {
    var apt = currentAppointments.find(function (a) { return a.id === aptId; });
    if (!apt) return;
    activeModalApt = apt;

    var modal = document.getElementById('cancelModal');
    if (!modal) return;
    modal.classList.add('active');
  }

  function confirmCancel() {
    if (!activeModalApt) return;
    var submitBtn = document.getElementById('confirmCancelBtn');
    var reasonInput = document.getElementById('cancelReasonInput');
    var reason = reasonInput ? reasonInput.value.trim() : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري الإلغاء...';
    }

    bookingStore.cancelAppointment(activeModalApt.id, reason)
      .then(function () {
        showToast('تم إلغاء الموعد.', 'info');
        var modal = document.getElementById('cancelModal');
        if (modal) modal.classList.remove('active');
        loadAppointments();
      })
      .catch(function (err) {
        alert('تعذر إلغاء الموعد: ' + err.message);
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'تأكيد الإلغاء';
        }
      });
  }

  function openCalendarModal(aptId) {
    var apt = currentAppointments.find(function (a) { return a.id === aptId; });
    if (!apt || !calExport) return;

    var svc = store ? store.getServiceById(apt.serviceId) : null;
    var cfg = getConfig();
    var meta = {
      brandName: (cfg.brand && cfg.brand.name) || 'منصة مكّن',
      serviceTitle: svc ? svc.title : (apt.serviceId || 'موعد'),
      durationMinutes: 30
    };

    var gcalUrl = calExport.buildGoogleCalendarUrl(apt, meta);

    var calModal = document.getElementById('calendarModal');
    if (calModal) {
      var gcalBtn = document.getElementById('gcalLinkBtn');
      if (gcalBtn) gcalBtn.href = gcalUrl;

      var icsBtn = document.getElementById('downloadIcsBtn');
      if (icsBtn) {
        icsBtn.onclick = function () {
          calExport.downloadIcs(apt, meta, 'mken-' + apt.date + '.ics');
        };
      }
      calModal.classList.add('active');
    }
  }

  function checkUrlHighlight() {
    var params = new URLSearchParams(window.location.search);
    var aptId = params.get('apt_id');
    if (aptId) {
      var card = document.getElementById('apt-card-' + aptId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-pulse');
        setTimeout(function () { card.classList.remove('highlight-pulse'); }, 3000);
      }
    }
  }

  function updateAuthUi(user, profile) {
    var authBanner = document.getElementById('portalAuthBanner');
    var loggedInArea = document.getElementById('portalUserSection');
    var guestLookupArea = document.getElementById('portalGuestLookupSection');
    var userNameEl = document.getElementById('portalUserName');
    var userEmailEl = document.getElementById('portalUserEmail');
    var userAvatarEl = document.getElementById('portalUserAvatar');

    if (user && profile) {
      if (authBanner) authBanner.hidden = true;
      if (loggedInArea) loggedInArea.hidden = false;
      if (guestLookupArea) guestLookupArea.hidden = true;

      if (userNameEl) userNameEl.textContent = profile.name || user.email;
      if (userEmailEl) userEmailEl.textContent = profile.email || profile.phone || '';
      if (userAvatarEl) {
        if (profile.avatarUrl) {
          userAvatarEl.src = profile.avatarUrl;
          userAvatarEl.hidden = false;
        } else {
          userAvatarEl.hidden = true;
        }
      }
    } else {
      if (authBanner) authBanner.hidden = false;
      if (loggedInArea) loggedInArea.hidden = true;
      if (guestLookupArea) guestLookupArea.hidden = false;
    }

    loadAppointments();
  }

  function init() {
    // 1. تفعيل التبويبات (قادمة / سابقة)
    document.querySelectorAll('.portal-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.portal-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentFilter = this.getAttribute('data-filter');
        renderAppointments();
      });
    });

    // 2. أزرار تسجيل الدخول والخروج
    var googleBtn = document.getElementById('portalGoogleLoginBtn');
    if (googleBtn && auth) {
      googleBtn.addEventListener('click', function () {
        auth.loginWithGoogle().catch(function (e) { alert('خطأ في تسجيل الدخول: ' + e.message); });
      });
    }

    var appleBtn = document.getElementById('portalAppleLoginBtn');
    if (appleBtn && auth) {
      appleBtn.addEventListener('click', function () {
        auth.loginWithApple().catch(function (e) { alert('خطأ في تسجيل الدخول: ' + e.message); });
      });
    }

    var logoutBtn = document.getElementById('portalLogoutBtn');
    if (logoutBtn && auth) {
      logoutBtn.addEventListener('click', function () {
        auth.logout().then(function () {
          showToast('تم تسجيل الخروج بنجاح.', 'info');
        });
      });
    }

    // 3. البحث برقم الجوال للزوار
    var lookupBtn = document.getElementById('guestLookupBtn');
    if (lookupBtn) {
      lookupBtn.addEventListener('click', function () {
        loadAppointments();
      });
    }

    // 4. تأكيد إعادة الجدولة والإلغاء
    var confirmRescheduleBtn = document.getElementById('confirmRescheduleBtn');
    if (confirmRescheduleBtn) confirmRescheduleBtn.addEventListener('click', confirmReschedule);

    var confirmCancelBtn = document.getElementById('confirmCancelBtn');
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', confirmCancel);

    // 5. إغلاق النوافذ المنبثقة
    document.querySelectorAll('.portal-modal-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var modal = this.closest('.portal-modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // 6. الاستماع لتغير حالة المصادقة
    if (auth) {
      auth.onAuthStateChanged(function (user, profile) {
        updateAuthUi(user, profile);
      });
    } else {
      loadAppointments();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
