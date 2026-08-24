(function () {
  'use strict';

  var form = document.getElementById('signupForm');
  var slugInput = document.getElementById('tenantSlug');
  var slugPreview = document.getElementById('slugPreview');
  var errorEl = document.getElementById('signupError');
  var successEl = document.getElementById('signupSuccess');
  var submitBtn = document.getElementById('signupSubmit');

  if (!form) return;

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    if (successEl) successEl.style.display = 'none';
  }

  function showSuccess(html) {
    if (!successEl) return;
    successEl.innerHTML = html;
    successEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    form.hidden = true;
  }

  if (slugInput && slugPreview) {
    slugInput.addEventListener('input', function () {
      var v = slugInput.value.trim().toLowerCase() || 'اسمك';
      slugPreview.textContent = v.replace(/[^a-z0-9-]/g, '') || 'اسمك';
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      tenantSlug: slugInput.value.trim().toLowerCase(),
      businessName: document.getElementById('businessName').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      phone: document.getElementById('phone').value.trim(),
      activityId: document.getElementById('activityId').value,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري إنشاء حسابك...';
    }
    if (errorEl) errorEl.style.display = 'none';

    fetch('/api/v1/auth/register-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'فشل التسجيل');
          return data;
        });
      })
      .then(function (data) {
        var adminUrl = data.adminUrl || ('https://' + payload.tenantSlug + '.mken.live/admin');
        var siteUrl = data.siteUrl || ('https://' + payload.tenantSlug + '.mken.live/');
        showSuccess(
          '<strong>🎉 تم إنشاء حسابك!</strong><br><br>' +
          'تجربتك المجانية: <strong>14 يوماً</strong><br><br>' +
          '<a href="' + adminUrl + '">افتح لوحة الإدارة ←</a><br>' +
          '<a href="' + siteUrl + '" style="margin-top:8px;display:inline-block;">عرض موقعك ←</a>'
        );
        setTimeout(function () {
          window.location.href = adminUrl + '?welcome=trial';
        }, 4000);
      })
      .catch(function (err) {
        showError(err.message || 'حدث خطأ، حاول مرة أخرى.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'إنشاء الحساب والبدء';
        }
      });
  });
})();
