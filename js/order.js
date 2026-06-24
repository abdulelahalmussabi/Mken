/**
 * صفحة الطلبات — سلة متعددة المنتجات + واتساب
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  var orderStore = window.MkenOrderStore;
  if (!store || !orderStore) return;

  var config, activeActivity, activeActivityId, lastSubmittedOrder = null, _dbItems = [];
  var orderApp = document.getElementById('orderApp');
  var orderDisabled = document.getElementById('orderDisabled');
  var orderSteps = document.getElementById('orderSteps');
  var orderProducts = document.getElementById('orderProducts');
  var orderCartList = document.getElementById('orderCartList');
  var orderSummary = document.getElementById('orderSummary');
  var orderForm = document.getElementById('orderForm');
  var orderCartBar = document.getElementById('orderCartBar');
  var activityNav = document.getElementById('orderActivityNav');

  var STEP_LABELS = ['المنتجات', 'السلة', 'البيانات'];

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function parseActivityParam() {
    return new URLSearchParams(window.location.search).get('activity') || '';
  }

  function needsAddress() {
    var orderCfg = activeActivity && activeActivity.order;
    return !!(orderCfg && orderCfg.requiresAddress);
  }

  function showPanel(id) {
    document.querySelectorAll('.order-panel').forEach(function (p) {
      p.hidden = p.id !== id;
    });
  }

  function setStep(step) {
    orderSteps.innerHTML = STEP_LABELS.map(function (label, i) {
      var cls = 'booking-step-indicator';
      if (i + 1 === step) cls += ' booking-step-indicator--active';
      else if (i + 1 < step) cls += ' booking-step-indicator--done';
      return (
        '<div class="' + cls + '">' +
        '<span class="booking-step-indicator__num">' + (i + 1) + '</span>' +
        '<span>' + label + '</span></div>'
      );
    }).join('');
  }

  function applyBrand() {
    var brand = store.getBrand(config);
    document.querySelectorAll('[data-brand="name"]').forEach(function (el) {
      el.textContent = brand.name;
    });
    document.querySelectorAll('[data-brand="tagline"]').forEach(function (el) {
      el.textContent = brand.tagline;
    });
    if (window.MkenBrandLogo) window.MkenBrandLogo.apply(brand);
    document.title = 'اطلب الآن | ' + brand.name;
  }

  function applyContactLinks() {
    var phone = config.phone || store.DEFAULT_PHONE;
    var wa = store.getSocialUrl('whatsapp', config.social) || store.waLink(phone);
    document.querySelectorAll('[data-contact="whatsapp"]').forEach(function (el) {
      el.href = wa;
    });
  }

  function getWhatsAppUrl(message) {
    var phone = config.phone || store.DEFAULT_PHONE;
    var wa = store.getSocialUrl('whatsapp', config.social) || store.waLink(phone);
    var sep = wa.indexOf('?') !== -1 ? '&' : '?';
    return wa + sep + 'text=' + encodeURIComponent(message);
  }

  function getOrderableActivities() {
    return store.getOrderableActivities();
  }

  function pickActivityId() {
    var param = parseActivityParam();
    var list = getOrderableActivities();
    if (param && list.some(function (a) { return a.id === param; })) return param;
    if (config.featuredActivity && list.some(function (a) { return a.id === config.featuredActivity; })) {
      return config.featuredActivity;
    }
    return list.length ? list[0].id : '';
  }

  function renderCartBar() {
    if (!orderCartBar) return;
    var count = orderStore.cartCount(activeActivityId);
    orderCartBar.hidden = count === 0;
    orderCartBar.innerHTML =
      '<span class="order-cart-bar__count">🛒 ' + count + ' في السلة</span>' +
      '<button type="button" class="btn btn--primary btn--sm" id="btnOpenCart">عرض السلة</button>';
    var btn = document.getElementById('btnOpenCart');
    if (btn) {
      btn.addEventListener('click', function () {
        renderCart();
        showPanel('panelCart');
        setStep(2);
      });
    }
  }

  function renderActivityNav() {
    var list = getOrderableActivities();
    if (!activityNav) return;
    if (list.length <= 1) {
      activityNav.hidden = true;
      return;
    }
    activityNav.hidden = false;
    activityNav.innerHTML = list.map(function (act) {
      var active = act.id === activeActivityId ? ' activity-tab--active' : '';
      return (
        '<button type="button" class="activity-tab' + active + '" data-activity="' + act.id + '">' +
        '<span class="activity-tab__icon">' + act.icon + '</span>' +
        '<span class="activity-tab__label">' + esc(act.shortTitle) + '</span></button>'
      );
    }).join('');
    activityNav.querySelectorAll('[data-activity]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = 'order.html?activity=' + encodeURIComponent(btn.getAttribute('data-activity'));
      });
    });
  }

  function renderProducts() {
    if (activeActivityId === 'commerce' && window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      orderProducts.innerHTML = '<p class="admin-hint" style="grid-column: 1/-1; text-align: center; padding: 20px;">جاري تحميل المنتجات من المستودع...</p>';
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchInventoryItems(tenantSlug)
        .then(function (items) {
          _dbItems = items || [];
          var services = _dbItems.map(function (item) {
            return {
              id: item.id,
              title: item.name,
              icon: '📦',
              category: item.sku || 'منتج',
              priceLabel: item.sellPrice.toFixed(2) + ' ريال',
              price: item.sellPrice,
              quantity: item.quantity,
              imageUrl: item.imageUrl
            };
          });
          renderServicesList(services);
        })
        .catch(function (err) {
          console.warn('Failed to load products from database, using static catalog:', err);
          _dbItems = [];
          renderServicesList(store.getEnabledServicesByActivity(activeActivityId));
        });
    } else {
      _dbItems = [];
      renderServicesList(store.getEnabledServicesByActivity(activeActivityId));
    }
  }

  function renderServicesList(services) {
    if (!services || !services.length) {
      orderProducts.innerHTML = '<p class="admin-hint" style="grid-column: 1/-1; text-align: center; padding: 20px;">لا توجد منتجات متوفرة حالياً في المتجر.</p>';
      return;
    }

    orderProducts.innerHTML = services.map(function (s) {
      var price = s.priceLabel ? '<small class="order-price">' + esc(s.priceLabel) + '</small>' : '';
      
      // Stock warning or out of stock
      var stockBadge = '';
      var disabledAttr = '';
      if (s.quantity !== undefined) {
        if (s.quantity <= 0) {
          stockBadge = '<span class="badge" style="background: #fce8e6; color: #c5221f; margin-top: 4px; display: inline-block;">نفد من المخزن</span>';
          disabledAttr = ' disabled';
        } else if (s.quantity <= 5) {
          stockBadge = '<span class="badge" style="background: #fdf6f0; color: #8a6d3b; margin-top: 4px; display: inline-block;">كمية محدودة: ' + s.quantity + '</span>';
        } else {
          stockBadge = '<span class="badge" style="background: #e6f4ea; color: #137333; margin-top: 4px; display: inline-block;">متوفر: ' + s.quantity + '</span>';
        }
      }

      var iconHtml = s.imageUrl
        ? '<img src="' + esc(s.imageUrl) + '" alt="' + esc(s.title) + '" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">'
        : '<span class="booking-service__icon">' + s.icon + '</span>';

      return (
        '<div class="order-product-card" style="opacity: ' + (s.quantity <= 0 ? '0.7' : '1') + ';">' +
        '<button type="button" class="booking-service order-product-card__main" data-service="' + s.id + '"' + disabledAttr + '>' +
        iconHtml +
        '<strong>' + esc(s.title) + '</strong>' +
        price +
        stockBadge +
        '<small>' + esc(s.category) + '</small></button>' +
        '<div class="order-product-card__actions">' +
        '<input type="number" class="order-qty-input" data-qty-for="' + s.id + '" min="1" max="' + (s.quantity || 999) + '" value="1" aria-label="الكمية"' + disabledAttr + '>' +
        '<button type="button" class="btn btn--primary btn--sm" data-add="' + s.id + '"' + disabledAttr + '>' + (s.quantity <= 0 ? 'نفد' : '+ أضف') + '</button>' +
        '</div></div>'
      );
    }).join('');

    orderProducts.querySelectorAll('[data-add]').forEach(function (btn) {
      if (btn.disabled) return;
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-add');
        var svc = services.find(function (x) { return x.id === id; });
        if (!svc) return;
        var qtyEl = orderProducts.querySelector('[data-qty-for="' + id + '"]');
        var qty = qtyEl ? parseInt(qtyEl.value) || 1 : 1;

        // Check if qty exceeds available stock
        if (svc.quantity !== undefined && qty > svc.quantity) {
          alert('الكمية المطلوبة تتجاوز المخزون المتوفر (' + svc.quantity + ')');
          return;
        }

        orderStore.addToCart(activeActivityId, {
          serviceId: svc.id,
          serviceTitle: svc.title,
          icon: svc.imageUrl ? '📦' : svc.icon,
          priceLabel: svc.priceLabel || '',
          price: svc.price,
          quantity: qty,
        });
        renderCartBar();
        btn.textContent = '✓ أُضيف';
        setTimeout(function () { btn.textContent = '+ أضف'; }, 1200);
      });
    });
  }

  function renderCart() {
    var cart = orderStore.getCart(activeActivityId);
    if (!orderCartList) return;

    if (!cart.length) {
      orderCartList.innerHTML = '<p class="admin-hint">السلة فارغة — أضف منتجات من الخطوة السابقة.</p>';
      document.getElementById('btnToForm').disabled = true;
      return;
    }

    orderCartList.innerHTML = cart.map(function (line) {
      return (
        '<div class="order-cart-item" data-line="' + line.lineId + '">' +
        '<div class="order-cart-item__info">' +
        '<span class="order-cart-item__icon">' + line.icon + '</span>' +
        '<div><strong>' + esc(line.serviceTitle) + '</strong>' +
        (line.priceLabel ? '<small class="order-price">' + esc(line.priceLabel) + '</small>' : '') +
        '</div></div>' +
        '<div class="order-cart-item__controls">' +
        '<input type="number" class="order-qty-input" data-line-qty="' + line.lineId + '" min="1" max="999" value="' + line.quantity + '">' +
        '<button type="button" class="btn btn--outline btn--sm" data-remove-line="' + line.lineId + '">حذف</button>' +
        '</div></div>'
      );
    }).join('');

    document.getElementById('btnToForm').disabled = false;

    orderCartList.querySelectorAll('[data-line-qty]').forEach(function (input) {
      input.addEventListener('change', function () {
        var lineId = input.getAttribute('data-line-qty');
        var line = cart.find(function (x) { return x.lineId === lineId; });
        if (!line) return;

        var newQty = parseInt(input.value) || 1;
        newQty = Math.max(1, newQty);

        if (activeActivityId === 'commerce' && _dbItems && _dbItems.length) {
          var dbItem = _dbItems.find(function (x) { return x.id === line.serviceId; });
          if (dbItem && dbItem.quantity !== undefined && newQty > dbItem.quantity) {
            alert('عذراً، الكمية المتوفرة في المخزن لهذا المنتج هي ' + dbItem.quantity + ' فقط.');
            newQty = dbItem.quantity;
            input.value = newQty;
          }
        }

        orderStore.updateCartLine(activeActivityId, lineId, newQty);
        renderCartBar();
        renderCart();
      });
    });

    orderCartList.querySelectorAll('[data-remove-line]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        orderStore.removeCartLine(activeActivityId, btn.getAttribute('data-remove-line'));
        renderCartBar();
        renderCart();
      });
    });
  }

  function renderSummary() {
    var cart = orderStore.getCart(activeActivityId);
    var itemsHtml = cart.map(function (line) {
      return '<li>' + line.icon + ' ' + esc(line.serviceTitle) + ' × ' + line.quantity +
        (line.priceLabel ? ' <small>(' + esc(line.priceLabel) + ')</small>' : '') + '</li>';
    }).join('');

    orderSummary.innerHTML =
      '<dl>' +
      (activeActivity ? '<dt>المتجر</dt><dd>' + activeActivity.icon + ' ' + esc(activeActivity.title) + '</dd>' : '') +
      '<dt>السلة (' + cart.length + ')</dt><dd><ul class="order-summary-list">' + itemsHtml + '</ul></dd>' +
      '</dl>';
  }

  function toggleAddressField() {
    var block = document.getElementById('orderAddressBlock');
    if (block) block.hidden = !needsAddress();
  }

  function calculateCartTotal() {
    var cart = orderStore.getCart(activeActivityId);
    var total = 0;
    var hasValidPrices = true;
    for (var i = 0; i < cart.length; i++) {
      var line = cart[i];
      var priceVal = NaN;
      if (line.price !== undefined && !isNaN(Number(line.price))) {
        priceVal = Number(line.price);
      } else {
        var svc = store.getResolvedService(line.serviceId, config);
        if (svc) {
          priceVal = parseFloat(svc.price);
        } else if (line.priceLabel) {
          priceVal = parseFloat(line.priceLabel.replace(/[^\d.]/g, ''));
        }
      }

      if (isNaN(priceVal) || priceVal <= 0) {
        hasValidPrices = false;
        break;
      }
      total += priceVal * line.quantity;
    }
    return hasValidPrices ? total : 0;
  }

  function deductStockForOrder(order) {
    if (activeActivityId === 'commerce' && window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var client = window.MkenSupabaseDb.getClient();
      var tenantSlug = store.getCurrentTenantSlug() || 'default';
      (order.items || []).forEach(function (item) {
        client.rpc('deduct_inventory_stock', {
          p_tenant: tenantSlug,
          p_item_id: item.serviceId,
          p_quantity: item.quantity,
          p_reference_id: order.id
        }).then(function (res) {
          if (res.error) console.error('Failed to deduct stock:', res.error);
          else if (res.data && !res.data.success) console.warn('Stock warning:', res.data.error);
        }).catch(function (err) {
          console.error('RPC error deduct stock:', err);
        });
      });
    }
  }

  function createInvoiceFromOrder(order) {
    if (activeActivityId === 'commerce' && window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug() || 'default';
      var subtotal = 0;
      var items = (order.items || []).map(function (item) {
        var price = Number(item.price || 0);
        if (!price && item.priceLabel) {
          price = parseFloat(item.priceLabel.replace(/[^\d.]/g, '')) || 0;
        }
        subtotal += (price * item.quantity);
        return {
          itemId: item.serviceId,
          name: item.serviceTitle,
          quantity: item.quantity,
          price: price
        };
      });

      var discount = 0;
      var netSubtotal = Math.max(0, subtotal - discount);
      var taxAmount = netSubtotal * 0.15;
      var totalAmount = netSubtotal + taxAmount;

      var invoice = {
        id: 'inv_' + order.id.replace('ord_', ''),
        customerName: order.customerName,
        customerPhone: order.phone || '',
        items: items,
        subtotal: subtotal,
        discount: discount,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        paymentStatus: order.paymentStatus || 'unpaid',
        paymentMethod: order.paymentMethod || 'whatsapp',
        type: 'invoice',
        createdAt: order.createdAt || new Date().toISOString()
      };

      window.MkenSupabaseDb.saveCustomerInvoice(invoice, tenantSlug)
        .then(function () {
          console.log('Automated sales invoice created successfully:', invoice.id);
        })
        .catch(function (err) {
          console.error('Failed to create automated invoice for order:', err);
        });
    }
  }

  function handlePaymentSuccess(orderId, paymentDetails) {
    var pId = paymentDetails.id;
    var pMethod = paymentDetails.source ? paymentDetails.source.type : 'online';
    if (paymentDetails.source && paymentDetails.source.company) {
      pMethod = paymentDetails.source.company;
    }
    var pAmount = paymentDetails.amount ? (paymentDetails.amount / 100) : 0;

    var list = orderStore.getOrders();
    var req = list.find(function (r) { return r.id === orderId; }) || lastSubmittedOrder;

    var updatedOrder = Object.assign({}, req, {
      id: orderId,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentId: pId,
      paymentMethod: pMethod,
      paymentAmount: pAmount,
      updatedAt: new Date().toISOString()
    });

    orderStore.updateOrder(orderId, updatedOrder);
    deductStockForOrder(updatedOrder);
    createInvoiceFromOrder(updatedOrder);
    orderStore.clearCart(activeActivityId);
    renderCartBar();

    if (window.MkenWhatsappAutomation) {
      window.MkenWhatsappAutomation.sendOrderConfirmation(updatedOrder, config)
        .catch(function (err) {
          console.error('Failed to send auto order confirmation:', err);
        });
      window.MkenWhatsappAutomation.sendOwnerAlert(updatedOrder, 'order', config)
        .catch(function (err) {
          console.error('Failed to send owner alert:', err);
        });
    }

    var brandName = store.getBrand(config).name;
    var message = orderStore.buildCartWhatsAppMessage(brandName, updatedOrder);
    // Replace first header line with confirmation header
    message = message.replace('طلب شراء', 'تم دفع وتأكيد طلب الشراء بنجاح 🎉');
    message = message.replace('يُرجى تأكيد الطلب والسعر النهائي', 'تم سداد الحساب إلكترونياً بنجاح! رقم العملية: ' + pId);

    lastSubmittedOrder = updatedOrder;

    showPanel('panelOrderSuccess');
    setStep(3);

    setTimeout(function () {
      window.open(getWhatsAppUrl(message), '_blank', 'noopener');
    }, 1500);
  }

  function checkPaymentCallback() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('payment_callback') === '1') {
      var orderId = params.get('order_id');
      var status = params.get('status');
      var paymentId = params.get('id');
      var message = params.get('message') || '';

      if (status === 'paid' && orderId && paymentId) {
        var paymentDetails = {
          id: paymentId,
          amount: params.get('amount') ? parseInt(params.get('amount'), 10) : 0,
          source: {
            type: 'card',
            company: params.get('message') && params.get('message').indexOf('Mada') !== -1 ? 'mada' : 'creditcard'
          }
        };

        handlePaymentSuccess(orderId, paymentDetails);
      } else if (status === 'failed') {
        alert('فشلت عملية الدفع: ' + (message || 'يرجى التحقق من بيانات البطاقة والمحاولة مرة أخرى.'));
        showPanel('panelForm');
        setStep(3);
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    var cart = orderStore.getCart(activeActivityId);
    if (!cart.length) return;

    var name = document.getElementById('orderName').value.trim();
    var phone = document.getElementById('orderPhone').value.trim();
    var district = (document.getElementById('orderDistrict').value || '').trim();
    var address = (document.getElementById('orderAddress') && document.getElementById('orderAddress').value || '').trim();
    var notes = document.getElementById('orderNotes').value.trim();
    var needAddr = needsAddress();

    if (!name || !phone) return;
    if (needAddr && !address) return;

    var payload = {
      activityId: activeActivityId,
      activityTitle: activeActivity ? activeActivity.title : '',
      items: cart.slice(),
      customerName: name,
      phone: phone,
      district: district,
      locationAddress: address,
      notes: notes,
    };

    var brandName = store.getBrand(config).name;

    // Check payment
    var payConfig = config.payment || {};
    var priceVal = calculateCartTotal();
    
    if (payConfig.enabled && !isNaN(priceVal) && priceVal > 0 && window.Moyasar) {
      var orderId = 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      var tenantSlug = store.getCurrentTenantSlug() || 'default';
      
      var pendingOrder = Object.assign({
        id: orderId,
        createdAt: new Date().toISOString(),
        status: payConfig.requirePayment ? 'pending' : 'confirmed',
        paymentStatus: 'unpaid',
        paymentAmount: priceVal,
        tenantSlug: tenantSlug
      }, payload);

      orderStore.addPendingOrder(pendingOrder);
      lastSubmittedOrder = pendingOrder;

      showPanel('panelPayment');
      setStep(3);

      var amountLabel = document.getElementById('paymentAmountLabel');
      if (amountLabel) {
        amountLabel.textContent = 'إجمالي قيمة الطلب المستحقة للدفع: ' + priceVal + ' ' + (payConfig.currency || 'SAR');
      }

      var callbackUrl = window.location.origin + window.location.pathname + 
                        '?payment_callback=1&order_id=' + encodeURIComponent(orderId);

      var formContainer = document.querySelector('.mysr-form');
      if (formContainer) formContainer.innerHTML = '';

      window.Moyasar.init({
        element: '.mysr-form',
        amount: Math.round(priceVal * 100),
        currency: payConfig.currency || 'SAR',
        description: 'طلب شراء: ' + (activeActivity ? activeActivity.title : '') + ' - ' + name,
        publishable_api_key: payConfig.publishableKey || '',
        callback_url: callbackUrl,
        methods: ['creditcard', 'mada', 'applepay'],
        metadata: {
          order_id: orderId,
          tenant_slug: tenantSlug,
          type: 'order'
        },
        on_completed: function (payment) {
          handlePaymentSuccess(orderId, payment);
        }
      });
      return;
    }

    var message = orderStore.buildCartWhatsAppMessage(brandName, payload);

    if (!payload.id) payload.id = 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    payload.paymentStatus = 'unpaid';
    payload.paymentMethod = 'whatsapp';
    orderStore.addPendingOrder(payload);
    deductStockForOrder(payload);
    createInvoiceFromOrder(payload);
    orderStore.clearCart(activeActivityId);
    renderCartBar();

    if (window.MkenWhatsappAutomation) {
      window.MkenWhatsappAutomation.sendOwnerAlert(payload, 'order', config)
        .catch(function (err) {
          console.error('Failed to send owner alert:', err);
        });
    }

    window.open(getWhatsAppUrl(message), '_blank', 'noopener');
    showPanel('panelOrderSuccess');
    setStep(3);
  }

  function resetOrder() {
    if (orderForm) orderForm.reset();
    renderProducts();
    renderCart();
    renderCartBar();
    showPanel('panelProduct');
    setStep(1);
  }

  function bindEvents() {
    document.getElementById('btnToCart').addEventListener('click', function () {
      if (orderStore.cartCount(activeActivityId) === 0) return;
      renderCart();
      showPanel('panelCart');
      setStep(2);
    });
    document.getElementById('btnBackProduct').addEventListener('click', function () {
      showPanel('panelProduct');
      setStep(1);
    });
    document.getElementById('btnToForm').addEventListener('click', function () {
      if (!orderStore.getCart(activeActivityId).length) return;
      renderSummary();
      showPanel('panelForm');
      setStep(3);
      toggleAddressField();
    });
    document.getElementById('btnBackCart').addEventListener('click', function () {
      showPanel('panelCart');
      setStep(2);
    });
    var backFormBtn = document.getElementById('btnBackForm');
    if (backFormBtn) {
      backFormBtn.addEventListener('click', function () {
        showPanel('panelForm');
        setStep(3);
      });
    }
    if (orderForm) orderForm.addEventListener('submit', handleSubmit);
    document.getElementById('btnNewOrder').addEventListener('click', resetOrder);
  }

  function initPage() {
    config = store.loadConfig();
    applyBrand();
    applyContactLinks();
    if (config.theme) store.applyTheme(config.theme);

    // Dynamic header links visibility based on features availability
    var hasBookable = store.getBookableActivities && store.getBookableActivities().length > 0;
    document.querySelectorAll('nav a[href="book.html"]').forEach(function (el) {
      el.style.display = hasBookable ? '' : 'none';
    });

    var orderable = getOrderableActivities();
    if (!orderable.length) {
      if (orderApp) orderApp.hidden = true;
      if (orderDisabled) orderDisabled.hidden = false;
      return;
    }

    activeActivityId = pickActivityId();
    activeActivity = store.getResolvedActivity(activeActivityId, config);

    var heroTitle = document.getElementById('orderHeroTitle');
    var heroDesc = document.getElementById('orderHeroDesc');
    if (heroTitle && activeActivity) {
      heroTitle.textContent = (activeActivity.order && activeActivity.order.ctaLabel) || 'اطلب الآن';
    }
    if (heroDesc && activeActivity) {
      heroDesc.textContent = 'أضف منتجات للسلة ثم أكّد طلبك عبر واتساب.';
    }

    if (orderApp) orderApp.hidden = false;
    if (orderDisabled) orderDisabled.hidden = true;

    renderActivityNav();
    renderProducts();
    renderCartBar();
    showPanel('panelProduct');
    setStep(1);
    bindEvents();
    checkPaymentCallback();
  }

  store.init().then(initPage);
})();
