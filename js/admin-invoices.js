/**
 * إدارة الفواتير والمبيعات — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var addNewBtn = document.getElementById('addNewInvoiceBtn');
  var modal = document.getElementById('invoiceModal');
  var form = document.getElementById('invoiceForm');
  var cancelBtn = document.getElementById('invoiceModalCancel');
  var listContainer = document.getElementById('adminInvoicesList');
  
  var addItemBtn = document.getElementById('invoiceAddItemBtn');
  var itemsListTable = document.getElementById('invoiceItemsList');
  var subtotalEl = document.getElementById('invoiceSubtotal');
  var discountInput = document.getElementById('invoiceDiscount');
  var taxEl = document.getElementById('invoiceTax');
  var totalEl = document.getElementById('invoiceTotal');

  // Print Elements
  var printModal = document.getElementById('invoicePrintModal');
  var printCancelBtn = document.getElementById('printInvoiceCancel');
  var printDoBtn = document.getElementById('printInvoiceDoBtn');

  var _invoices = [];
  var _items = []; // Inventory items for selection
  var _customers = []; // Customers list

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function generateId() {
    return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function loadInvoices() {
    if (!listContainer) return;
    listContainer.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;" class="admin-hint">جاري تحميل الفواتير...</td></tr>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      
      // Fetch invoices & items & customers
      Promise.all([
        window.MkenSupabaseDb.fetchCustomerInvoices(tenantSlug),
        window.MkenSupabaseDb.fetchInventoryItems(tenantSlug),
        window.MkenSupabaseDb.fetchCustomers(tenantSlug)
      ])
        .then(function (results) {
          _invoices = results[0];
          _items = results[1];
          _customers = results[2] || [];
          renderInvoices();
          populateCustomerSelect();
        })
        .catch(function (err) {
          console.error('Failed to load invoices from Supabase', err);
          listContainer.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--color-primary);" class="admin-hint">تأكد من إعداد المزامنة السحابية للوصول للفواتير.</td></tr>';
        });
    } else {
      listContainer.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;" class="admin-hint">ميزة الفواتير تتطلب تفعيل المزامنة السحابية.</td></tr>';
    }
  }

  function renderInvoices() {
    if (!_invoices.length) {
      listContainer.innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center;" class="admin-hint">لا توجد فواتير أو عروض أسعار صادرة حالياً.</td></tr>';
      return;
    }

    listContainer.innerHTML = _invoices.map(function (inv) {
      var statusColor = '#777';
      var statusText = 'غير مدفوعة';
      if (inv.paymentStatus === 'paid') { statusColor = '#2e7d32'; statusText = 'مدفوعة'; }
      else if (inv.paymentStatus === 'partial') { statusColor = '#f2994a'; statusText = 'مدفوعة جزئياً'; }

      var methodText = 'نقدي';
      if (inv.paymentMethod === 'card') methodText = 'بطاقة مدى';
      else if (inv.paymentMethod === 'bank') methodText = 'تحويل بنكي';
      else if (inv.paymentMethod === 'whatsapp') methodText = 'دفع إلكتروني';

      var dateStr = '';
      try {
        dateStr = new Date(inv.createdAt).toLocaleDateString('ar-SA');
      } catch (e) {
        dateStr = inv.createdAt;
      }

      var typeText = inv.type === 'estimate' ? 'عرض سعر' : 'فاتورة';
      var typeColor = inv.type === 'estimate' ? '#2f80ed' : '#9b51e0';
      var typeBadge = '<span class="badge" style="background: ' + typeColor + '20; color: ' + typeColor + '; font-weight: bold;">' + typeText + '</span>';

      var convertBtn = '';
      if (inv.type === 'estimate') {
        convertBtn = '<button type="button" class="btn btn--outline btn--sm" data-action="convert-invoice" style="padding: 4px 8px; margin-left: 6px; color: #2e7d32; border-color: #2e7d3220;">🔄 تحويل لفاتورة</button>';
      } else if (inv.type === 'invoice' && inv.paymentStatus === 'unpaid') {
        convertBtn = '<button type="button" class="btn btn--outline btn--sm" data-action="convert-estimate" style="padding: 4px 8px; margin-left: 6px; color: #2f80ed; border-color: #2f80ed20;">🔄 تحويل لعرض سعر</button>';
      }

      return (
        '<tr data-invoice-id="' + inv.id + '" style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: bold; font-family: monospace;">' + esc(inv.id) + '</td>' +
        '  <td style="padding: 12px;">' + typeBadge + '</td>' +
        '  <td style="padding: 12px; font-weight: 500;">' + esc(inv.customerName) + '</td>' +
        '  <td style="padding: 12px; font-weight: bold; color: var(--color-primary);">' + inv.totalAmount.toFixed(2) + ' ريال</td>' +
        '  <td style="padding: 12px;"><span class="badge" style="background: ' + statusColor + '20; color: ' + statusColor + '; font-weight: bold;">' + statusText + '</span></td>' +
        '  <td style="padding: 12px;">' + methodText + '</td>' +
        '  <td style="padding: 12px;">' + esc(dateStr) + '</td>' +
        '  <td style="padding: 12px;">' +
        '    ' + convertBtn +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="print" style="padding: 4px 8px; margin-left: 6px;">🖨️ طباعة</button>' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="delete" style="padding: 4px 8px; color: #c0392b; border-color: #c0392b20;">حذف</button>' +
        '  </td>' +
        '</tr>'
      );
    }).join('');

    // Wire events
    listContainer.querySelectorAll('[data-invoice-id]').forEach(function (row) {
      var id = row.getAttribute('data-invoice-id');
      var inv = _invoices.find(function (x) { return x.id === id; });

      var printBtn = row.querySelector('[data-action="print"]');
      if (printBtn) {
        printBtn.addEventListener('click', function () {
          openPrintModal(inv);
        });
      }

      var convertInvoiceBtn = row.querySelector('[data-action="convert-invoice"]');
      if (convertInvoiceBtn) {
        convertInvoiceBtn.addEventListener('click', function () {
          if (confirm('هل ترغب في تحويل عرض السعر هذا إلى فاتورة مبيعات حقيقية وتطبيق خصم المخزون؟')) {
            toggleInvoiceType(id, 'invoice');
          }
        });
      }

      var convertEstimateBtn = row.querySelector('[data-action="convert-estimate"]');
      if (convertEstimateBtn) {
        convertEstimateBtn.addEventListener('click', function () {
          if (confirm('هل ترغب في تحويل هذه الفاتورة غير المدفوعة إلى عرض سعر؟')) {
            toggleInvoiceType(id, 'estimate');
          }
        });
      }

      var deleteBtn = row.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          if (confirm('هل أنت متأكد من حذف هذا المستند نهائياً؟')) {
            deleteInvoice(id);
          }
        });
      }
    });
  }

  function toggleInvoiceType(id, targetType) {
    var inv = _invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    
    inv.type = targetType;
    if (targetType === 'estimate') {
      inv.paymentStatus = 'unpaid';
    }
    
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.saveCustomerInvoice(inv, tenantSlug)
        .then(function () {
          if (targetType === 'invoice') {
            var client = window.MkenSupabaseDb.getClient();
            var promises = (inv.items || []).map(function (item) {
              return client.rpc('deduct_inventory_stock', {
                p_tenant: tenantSlug,
                p_item_id: item.itemId,
                p_quantity: item.quantity,
                p_reference_id: inv.id
              });
            });
            return Promise.all(promises);
          }
          return Promise.resolve([]);
        })
        .then(function () {
          toast(targetType === 'estimate' ? 'تم تحويل الفاتورة لعرض سعر بنجاح' : 'تم تحويل عرض السعر لفاتورة مبيعات وخصم المخزون بنجاح');
          loadInvoices();
          if (window.MkenAdminInventory) {
            window.MkenAdminInventory.refresh();
          }
        })
        .catch(function (err) {
          toast('حدث خطأ أثناء تحديث المستند في السحابة', 'error');
          console.error(err);
        });
    } else {
      toast('الرجاء تفعيل الربط السحابي لإجراء التحديثات', 'error');
    }
  }

  function openPrintModal(inv) {
    if (!printModal) return;
    printModal.hidden = false;

    var brand = store.getBrand() || { name: 'منصة مكن', tagline: 'حلول ذكية' };
    var phone = store.loadConfig().phone || '966543530333';

    var docTitle = inv.type === 'estimate' ? 'عرض سعر' : 'فاتورة مبيعات';
    document.getElementById('printBrandName').textContent = brand.name + ' - ' + docTitle;
    document.getElementById('printBrandTagline').textContent = brand.tagline;
    document.getElementById('printBrandPhone').textContent = 'الهاتف: ' + phone;

    document.getElementById('printInvoiceNo').textContent = inv.id;
    document.getElementById('printInvoiceDate').textContent = new Date(inv.createdAt).toLocaleString('ar-SA');
    document.getElementById('printCustomerName').textContent = inv.customerName;
    document.getElementById('printCustomerPhone').textContent = inv.customerPhone || '—';

    var itemsContainer = document.getElementById('printInvoiceItems');
    itemsContainer.innerHTML = (inv.items || []).map(function (item) {
      var price = Number(item.price || 0);
      var qty = Number(item.quantity || 0);
      var total = price * qty;
      return (
        '<tr style="border-bottom: 1px dashed #eee;">' +
        '  <td style="padding: 5px 0;">' + esc(item.name) + '</td>' +
        '  <td style="padding: 5px; text-align: center;">' + qty + '</td>' +
        '  <td style="padding: 5px; text-align: left;">' + price.toFixed(2) + '</td>' +
        '  <td style="padding: 5px 0; text-align: left;">' + total.toFixed(2) + ' ريال</td>' +
        '</tr>'
      );
    }).join('');

    document.getElementById('printSubtotal').textContent = inv.subtotal.toFixed(2) + ' ريال';
    document.getElementById('printDiscount').textContent = inv.discount.toFixed(2) + ' ريال';
    document.getElementById('printTax').textContent = inv.taxAmount.toFixed(2) + ' ريال';
    document.getElementById('printTotal').textContent = inv.totalAmount.toFixed(2) + ' ريال';

    // Generate simple QR Code simulation for ZATCA ONLY IF it is a real invoice
    var qrContainer = document.getElementById('printInvoiceQr');
    qrContainer.innerHTML = '';
    
    if (inv.type === 'estimate') {
      qrContainer.style.display = 'none';
    } else {
      qrContainer.style.display = 'flex';
      var qrText = brand.name + '\n' + phone + '\n' + inv.createdAt + '\n' + inv.totalAmount.toFixed(2) + '\n' + inv.taxAmount.toFixed(2);
      var qrImg = document.createElement('img');
      qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(qrText);
      qrImg.style.width = '80px';
      qrImg.style.height = '80px';
      qrContainer.appendChild(qrImg);
    }
  }

  function closePrintModal() {
    if (printModal) printModal.hidden = true;
  }

  function populateCustomerSelect(selectedCustomerId) {
    var select = document.getElementById('invoiceCustomerSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختر العميل --</option>' + _customers.map(function (c) {
      var sel = c.id === selectedCustomerId ? ' selected' : '';
      return '<option value="' + c.id + '"' + sel + ' data-phone="' + esc(c.phone) + '" data-name="' + esc(c.name) + '">' + esc(c.name) + ' (' + esc(c.phone || 'بدون هاتف') + ')</option>';
    }).join('');
  }

  function openInvoiceModal() {
    if (!modal) return;
    modal.hidden = false;

    document.getElementById('invoiceId').value = '';
    document.getElementById('invoiceType').value = 'invoice';
    var custSelect = document.getElementById('invoiceCustomerSelect');
    if (custSelect) custSelect.value = '';
    document.getElementById('invoiceCustomerPhone').value = '';
    document.getElementById('invoicePaymentStatus').value = 'unpaid';
    document.getElementById('invoicePaymentMethod').value = 'cash';
    discountInput.value = '0.00';
    
    itemsListTable.innerHTML = '';
    calculateTotals();
    
    // Auto-add first item row
    addInvoiceItemRow();
  }

  function addInvoiceItemRow(selectedItemId, quantity, price) {
    var rowId = 'row_' + Math.random().toString(36).slice(2, 7);
    var optionsHtml = _items.map(function (item) {
      var selected = item.id === selectedItemId ? ' selected' : '';
      return '<option value="' + item.id + '"' + selected + ' data-price="' + item.sellPrice + '">' + esc(item.name) + ' (' + item.quantity + ' متوفر)</option>';
    }).join('');

    var tr = document.createElement('tr');
    tr.id = rowId;
    tr.style.borderBottom = '1px solid var(--color-border)';
    tr.innerHTML = 
      '  <td style="padding: 6px;">' +
      '    <select class="admin-input invoice-item-select" style="width: 100%; padding: 4px;" required>' +
      '      <option value="">— اختر صنف —</option>' +
      '      ' + optionsHtml +'    </select>' +
      '  </td>' +
      '  <td style="padding: 6px;"><input type="number" class="admin-input invoice-item-qty" min="1" value="' + (quantity || 1) + '" style="width: 100%; padding: 4px;" required></td>' +
      '  <td style="padding: 6px;"><input type="number" step="0.01" class="admin-input invoice-item-price" value="' + (price || 0).toFixed(2) + '" style="width: 100%; padding: 4px;" required></td>' +
      '  <td style="padding: 6px; font-weight: bold; vertical-align: middle;"><span class="invoice-item-total">0.00</span> ريال</td>' +
      '  <td style="padding: 6px; text-align: center;"><button type="button" class="btn btn--outline btn--sm" data-action="remove-row" style="color: #c0392b; border-color: #c0392b20; padding: 2px 6px;">×</button></td>';

    itemsListTable.appendChild(tr);

    // Event listeners
    var select = tr.querySelector('.invoice-item-select');
    var qtyInput = tr.querySelector('.invoice-item-qty');
    var priceInput = tr.querySelector('.invoice-item-price');
    var totalSpan = tr.querySelector('.invoice-item-total');
    var removeBtn = tr.querySelector('[data-action="remove-row"]');

    function updateRowTotal() {
      var q = parseInt(qtyInput.value) || 0;
      var p = parseFloat(priceInput.value) || 0;
      totalSpan.textContent = (q * p).toFixed(2);
      calculateTotals();
    }

    select.addEventListener('change', function () {
      var opt = select.options[select.selectedIndex];
      if (opt && opt.value) {
        var basePrice = parseFloat(opt.getAttribute('data-price')) || 0;
        priceInput.value = basePrice.toFixed(2);
      } else {
        priceInput.value = '0.00';
      }
      updateRowTotal();
    });

    qtyInput.addEventListener('input', updateRowTotal);
    priceInput.addEventListener('input', updateRowTotal);

    removeBtn.addEventListener('click', function () {
      tr.remove();
      calculateTotals();
    });

    updateRowTotal();
  }

  function calculateTotals() {
    var subtotal = 0;
    
    itemsListTable.querySelectorAll('tr').forEach(function (tr) {
      var q = parseInt(tr.querySelector('.invoice-item-qty').value) || 0;
      var p = parseFloat(tr.querySelector('.invoice-item-price').value) || 0;
      subtotal += q * p;
    });

    var discount = parseFloat(discountInput.value) || 0;
    var netSubtotal = Math.max(0, subtotal - discount);
    var tax = netSubtotal * 0.15; // 15% VAT
    var total = netSubtotal + tax;

    subtotalEl.textContent = subtotal.toFixed(2) + ' ريال';
    taxEl.textContent = tax.toFixed(2) + ' ريال';
    totalEl.textContent = total.toFixed(2) + ' ريال';
  }

  function closeInvoiceModal() {
    if (modal) modal.hidden = true;
  }

  function deleteInvoice(id) {
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      window.MkenSupabaseDb.deleteCustomerInvoice(id)
        .then(function () {
          toast('تم حذف الفاتورة بنجاح');
          loadInvoices();
        })
        .catch(function (err) {
          toast('فشل حذف الفاتورة من قاعدة البيانات', 'error');
          console.error(err);
        });
    }
  }

  function bindEvents() {
    if (addNewBtn) {
      addNewBtn.addEventListener('click', openInvoiceModal);
    }

    var custSelect = document.getElementById('invoiceCustomerSelect');
    if (custSelect) {
      custSelect.addEventListener('change', function () {
        var opt = custSelect.options[custSelect.selectedIndex];
        var phoneInput = document.getElementById('invoiceCustomerPhone');
        if (phoneInput) {
          phoneInput.value = (opt && opt.getAttribute('data-phone')) || '';
        }
      });
    }

    var quickAddBtn = document.getElementById('invoiceQuickAddCustomerBtn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', function () {
        if (window.MkenAdminCustomers) {
          window.MkenAdminCustomers.openCreateModal(function (newCustomer) {
            if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
              var tenantSlug = store.getCurrentTenantSlug();
              window.MkenSupabaseDb.fetchCustomers(tenantSlug)
                .then(function (customers) {
                  _customers = customers;
                  populateCustomerSelect(newCustomer.id);
                  var phoneInput = document.getElementById('invoiceCustomerPhone');
                  if (phoneInput) phoneInput.value = newCustomer.phone || '';
                });
            }
          });
        } else {
          toast('إدارة العملاء غير متوفرة حالياً', 'error');
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeInvoiceModal);
    }

    if (addItemBtn) {
      addItemBtn.addEventListener('click', function () {
        addInvoiceItemRow();
      });
    }

    if (discountInput) {
      discountInput.addEventListener('input', calculateTotals);
    }

    if (printCancelBtn) {
      printCancelBtn.addEventListener('click', closePrintModal);
    }

    if (printDoBtn) {
      printDoBtn.addEventListener('click', function () {
        var printContent = document.getElementById('invoicePrintArea').innerHTML;
        var originalContent = document.body.innerHTML;

        // Simplify page structure for print
        var printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>طباعة فاتورة</title>');
        printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">');
        printWindow.document.write('<style>body { font-family: "IBM Plex Sans Arabic", sans-serif; direction: rtl; text-align: right; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; border-bottom: 1px solid #ddd; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        // Trigger print after load
        printWindow.setTimeout(function () {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var custSelect = document.getElementById('invoiceCustomerSelect');
        var customerId = (custSelect && custSelect.value) || null;
        var customerName = '';
        if (custSelect && custSelect.selectedIndex >= 0) {
          customerName = custSelect.options[custSelect.selectedIndex].getAttribute('data-name') || '';
        }
        var customerPhone = document.getElementById('invoiceCustomerPhone').value;
        var paymentStatus = document.getElementById('invoicePaymentStatus').value;
        var paymentMethod = document.getElementById('invoicePaymentMethod').value;
        var discount = parseFloat(discountInput.value) || 0;

        var items = [];
        var isValid = true;

        itemsListTable.querySelectorAll('tr').forEach(function (tr) {
          var select = tr.querySelector('.invoice-item-select');
          var itemId = select.value;
          var qty = parseInt(tr.querySelector('.invoice-item-qty').value) || 0;
          var price = parseFloat(tr.querySelector('.invoice-item-price').value) || 0;

          if (!itemId) {
            isValid = false;
            toast('الرجاء اختيار صنف لكل بند مضاف', 'error');
            return;
          }

          var itemObj = _items.find(function (x) { return x.id === itemId; });
          items.push({
            itemId: itemId,
            name: itemObj ? itemObj.name : 'منتج غير معروف',
            quantity: qty,
            price: price
          });
        });

        if (!isValid) return;
        if (!items.length) {
          toast('يجب إضافة بند واحد على الأقل لإصدار الفاتورة', 'error');
          return;
        }

        var invoiceId = generateId();
        
        // Calculations
        var subtotal = items.reduce(function (sum, item) { return sum + (item.price * item.quantity); }, 0);
        var netSubtotal = Math.max(0, subtotal - discount);
        var tax = netSubtotal * 0.15;
        var total = netSubtotal + tax;

        var invoice = {
          id: invoiceId,
          customerId: customerId,
          customerName: customerName,
          customerPhone: customerPhone,
          items: items,
          subtotal: subtotal,
          discount: discount,
          taxAmount: tax,
          totalAmount: total,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          type: type,
          createdAt: new Date().toISOString()
        };

        if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
          var tenantSlug = store.getCurrentTenantSlug();

          window.MkenSupabaseDb.saveCustomerInvoice(invoice, tenantSlug)
            .then(function () {
              // Deduct stock in DB via rpc calls ONLY IF type is 'invoice'
              if (type === 'invoice') {
                var client = window.MkenSupabaseDb.getClient();
                var promises = items.map(function (item) {
                  return client.rpc('deduct_inventory_stock', {
                    p_tenant: tenantSlug,
                    p_item_id: item.itemId,
                    p_quantity: item.quantity,
                    p_reference_id: invoiceId
                  });
                });
                return Promise.all(promises);
              }
              return Promise.resolve([]);
            })
            .then(function (results) {
              // Check if any deduction failed
              var failed = results.find(function (r) { return r.data && r.data.success === false; });
              if (failed) {
                console.warn('One or more items had stock issues:', failed.data.error);
              }
              toast('تم إصدار الفاتورة وحفظها بنجاح');
              closeInvoiceModal();
              loadInvoices();
              
              // Refresh inventory tab values if open
              if (window.MkenAdminInventory) {
                window.MkenAdminInventory.refresh();
              }
            })
            .catch(function (err) {
              toast('حدث خطأ أثناء إصدار الفاتورة', 'error');
              console.error(err);
            });
        } else {
          toast('الرجاء تفعيل المزامنة السحابية لإصدار الفواتير', 'error');
        }
      });
    }
  }

  function refresh() {
    loadInvoices();
  }

  window.MkenAdminInvoices = {
    refresh: refresh
  };

  bindEvents();
})();
