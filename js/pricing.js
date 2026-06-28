/**
 * Mken Lite — صفحة التسعير والاشتراك (Moyasar)
 * تجلب الباقات والمفتاح المنشور من /api/license-checkout/config،
 * وتُهيّئ نموذج Moyasar مع metadata لإصدار الترخيص آلياً عبر الـ webhook.
 */
(function () {
  'use strict';

  var CONFIG = null;
  var cycle = 'annual';
  var selected = null;

  function api(path) {
    return fetch('/api/license-checkout/' + path).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'خطأ'); return d; });
    });
  }

  function loadConfig() {
    api('config').then(function (cfg) {
      CONFIG = cfg;
      renderPlans();
    }).catch(function (e) {
      document.getElementById('plans').innerHTML = '<p style="text-align:center;color:#b91c1c">تعذّر تحميل الباقات: ' + e.message + '</p>';
    });
  }

  function planFeatures(key) {
    var common = ['فوترة + فاتورة ضريبية ZATCA', 'مخزون وتقارير تشغيل', 'يعمل بدون إنترنت', 'نسخ احتياطي محلي'];
    if (key === 'Lite') return common.concat(['جهاز واحد', 'دعم أساسي']);
    if (key === 'Pro') return common.concat(['حتى 3 أجهزة', 'فروع وورديات', 'دعم أولوية']);
    return common.concat(['حتى 25 جهازاً', 'كل مزايا Pro', 'مزامنة سحابية اختيارية', 'دعم مخصص']);
  }

  function renderPlans() {
    var plans = CONFIG.plans || [];
    document.getElementById('plans').innerHTML = plans.map(function (p) {
      var price = cycle === 'perpetual' ? p.perpetual : p.annual;
      var unit = cycle === 'perpetual' ? 'لمرة واحدة' : '/ سنوياً';
      var feats = planFeatures(p.key).map(function (f) { return '<li>' + f + '</li>'; }).join('');
      return '<div class="plan' + (p.key === 'Pro' ? ' popular' : '') + '">'
        + '<h3>' + p.label + '</h3>'
        + '<div class="price">' + price + ' <small>ر.س ' + unit + '</small></div>'
        + '<ul class="feat">' + feats + '</ul>'
        + '<button class="btn" onclick="Pricing.choose(\'' + p.key + '\')">اشترك الآن</button>'
        + '</div>';
    }).join('');
  }

  function setCycle(c) {
    cycle = c;
    document.getElementById('cycleAnnual').classList.toggle('active', c === 'annual');
    document.getElementById('cyclePerpetual').classList.toggle('active', c === 'perpetual');
    renderPlans();
  }

  function choose(key) {
    var plan = (CONFIG.plans || []).filter(function (p) { return p.key === key; })[0];
    if (!plan) return;
    selected = plan;
    var price = cycle === 'perpetual' ? plan.perpetual : plan.annual;
    document.getElementById('checkoutTitle').textContent = 'اشتراك ' + plan.label;
    document.getElementById('checkoutSub').textContent = price + ' ر.س — '
      + (cycle === 'perpetual' ? 'رخصة دائمة' : 'اشتراك سنوي') + ' · حتى ' + plan.maxDevices + ' جهاز';
    document.getElementById('moyasar-form').innerHTML = '';
    document.getElementById('proceedBtn').style.display = 'block';
    showErr('');
    document.getElementById('overlay').classList.add('show');
  }

  function close() {
    document.getElementById('overlay').classList.remove('show');
  }

  function showErr(msg) {
    var e = document.getElementById('formErr');
    e.textContent = msg; e.style.display = msg ? 'block' : 'none';
  }

  function cleanPhone(p) {
    var d = (p || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('966') === 0) return d;
    if (d.indexOf('0') === 0) return '966' + d.slice(1);
    if (d.length === 9) return '966' + d;
    return d;
  }

  function proceed() {
    if (!CONFIG.publishableKey) { showErr('بوابة الدفع غير مهيّأة. تواصل مع الدعم.'); return; }
    var name = val('c_name'), phone = cleanPhone(val('c_phone')), email = val('c_email');
    var crNumber = val('c_cr_number'), taxNumber = val('c_tax_number');

    if (!name) { showErr('أدخل اسم المنشأة'); return; }
    if (phone.length < 12) { showErr('أدخل رقم جوال صحيح'); return; }
    if (!crNumber) { showErr('أدخل رقم السجل التجاري أو وثيقة العمل الحر'); return; }
    if (taxNumber && !/^[0-9]{15}$/.test(taxNumber)) { showErr('الرقم الضريبي غير صالح (يجب أن يتكون من 15 رقماً)'); return; }
    showErr('');

    var price = cycle === 'perpetual' ? selected.perpetual : selected.annual;
    var amount = Math.round(price * 100); // هللات

    document.getElementById('proceedBtn').style.display = 'none';

    window.Moyasar.init({
      element: '#moyasar-form',
      amount: amount,
      currency: 'SAR',
      description: 'Mken Lite — ' + selected.label + ' (' + (cycle === 'perpetual' ? 'دائم' : 'سنوي') + ')',
      publishable_api_key: CONFIG.publishableKey,
      callback_url: window.location.origin + '/license-success.html',
      methods: ['creditcard', 'mada', 'applepay', 'stcpay'],
      metadata: {
        type: 'mken_lite_license',
        plan: selected.key,
        billing_cycle: cycle,
        max_devices: selected.maxDevices,
        customer_name: name,
        phone: phone,
        email: email,
        commercial_registry_number: crNumber,
        tax_number: taxNumber || null
      }
    });
  }

  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  window.Pricing = { setCycle: setCycle, choose: choose, close: close, proceed: proceed };
  document.addEventListener('DOMContentLoaded', loadConfig);
})();
