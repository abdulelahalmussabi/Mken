/**
 * إدارة الموردين وفواتير المشتريات — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  // DOM Elements - Vendors List & Modals
  var addNewVendorBtn = document.getElementById('addNewVendorBtn');
  var vendorModal = document.getElementById('vendorModal');
  var vendorForm = document.getElementById('vendorForm');
  var vendorModalCancel = document.getElementById('vendorModalCancel');
  var adminVendorsList = document.getElementById('adminVendorsList');

  // DOM Elements - Purchase Invoices List & Modals
  var addNewPurchaseInvoiceBtn = document.getElementById('addNewPurchaseInvoiceBtn');
  var purchaseInvoiceModal = document.getElementById('purchaseInvoiceModal');
  var purchaseInvoiceForm = document.getElementById('purchaseInvoiceForm');
  var purchaseInvoiceModalCancel = document.getElementById('purchaseInvoiceModalCancel');
  var adminPurchaseInvoicesList = document.getElementById('adminPurchaseInvoicesList');

  // Form Fields - Purchase Invoice
  var purchaseInvoiceVendorSelect = document.getElementById('purchaseInvoiceVendor');
  var purchaseInvoiceStatusSelect = document.getElementById('purchaseInvoiceStatus');
  var purchaseInvoiceItemsList = document.getElementById('purchaseInvoiceItemsList');
  var purchaseInvoiceAddItemBtn = document.getElementById('purchaseInvoiceAddItemBtn');
  var purchaseInvoiceTotalEl = document.getElementById('purchaseInvoiceTotal');

  // State
  var _vendors = [];
  var _purchaseInvoices = [];
  var _inventoryItems = [];

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function generateVendorId() {
    return 'vnd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function generatePurchaseInvoiceId() {
    return 'pur_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function refresh() {
    loadVendors();
    loadPurchaseInvoices();
  }

  // --- Vendors CRUD ---

  function loadVendors() {
    if (!adminVendorsList) return;
    adminVendorsList.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">جاري تحميل الموردين...</td></tr>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchVendors(tenantSlug)
        .then(function (vendors) {
          _vendors = vendors;
          renderVendors();
          // Update purchase invoice vendor select dropdown option if modal is opened/refreshed
          populateVendorDropdown();
        })
        .catch(function (err) {
          console.error('Failed to fetch vendors', err);
          adminVendorsList.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--color-primary);" class="admin-hint">حدث خطأ أثناء تحميل الموردين.</td></tr>';
        });
    } else {
      adminVendorsList.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">يتطلب الاتصال بـ Supabase.</td></tr>';
    }
  }

  function renderVendors() {
    if (!_vendors.length) {
      adminVendorsList.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">لا يوجد موردين مسجلين حالياً.</td></tr>';
      return;
    }

    adminVendorsList.innerHTML = _vendors.map(function (vendor) {
      return (
        '<tr data-vendor-id="' + vendor.id + '" style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: 500; color: var(--color-text);">' + esc(vendor.name) + '</td>' +
        '  <td style="padding: 12px;">' + esc(vendor.contactPerson || '—') + '</td>' +
        '  <td style="padding: 12px; font-family: monospace;">' + esc(vendor.phone || '—') + '</td>' +
        '  <td style="padding: 12px;">' + esc(vendor.email || '—') + '</td>' +
        '  <td style="padding: 12px;">' + esc(vendor.address || '—') + '</td>' +
        '  <td style="padding: 12px;">' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="edit-vendor" style="padding: 4px 8px; margin-left: 6px;">تعديل</button>' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="delete-vendor" style="padding: 4px 8px; color: #c0392b; border-color: #c0392b20;">حذف</button>' +
        '  </td>' +
        '</tr>'
      );
    }).join('');

    // Wire events
    adminVendorsList.querySelectorAll('[data-vendor-id]').forEach(function (row) {
      var id = row.getAttribute('data-vendor-id');
      var vendor = _vendors.find(function (v) { return v.id === id; });

      var editBtn = row.querySelector('[data-action="edit-vendor"]');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          openVendorModal(vendor);
        });
      }

      var deleteBtn = row.querySelector('[data-action="delete-vendor"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
            window.MkenSupabaseDb.deleteVendor(id)
              .then(function () {
                toast('تم حذف المورد بنجاح');
                loadVendors();
              })
              .catch(function (err) {
                console.error(err);
                toast('خطأ أثناء حذف المورد', 'error');
              });
          }
        });
      }
    });
  }

  function openVendorModal(vendor) {
    if (!vendorModal) return;
    
    var titleEl = document.getElementById('vendorModalTitle');
    var idInput = document.getElementById('vendorId');
    var nameInput = document.getElementById('vendorName');
    var contactInput = document.getElementById('vendorContactPerson');
    var phoneInput = document.getElementById('vendorPhone');
    var emailInput = document.getElementById('vendorEmail');
    var addressInput = document.getElementById('vendorAddress');

    if (vendor) {
      titleEl.textContent = 'تعديل بيانات مورد';
      idInput.value = vendor.id;
      nameInput.value = vendor.name;
      contactInput.value = vendor.contactPerson || '';
      phoneInput.value = vendor.phone || '';
      emailInput.value = vendor.email || '';
      addressInput.value = vendor.address || '';
    } else {
      titleEl.textContent = 'إضافة مورد جديد';
      idInput.value = '';
      nameInput.value = '';
      contactInput.value = '';
      phoneInput.value = '';
      emailInput.value = '';
      addressInput.value = '';
    }

    vendorModal.removeAttribute('hidden');
  }

  function closeVendorModal() {
    if (vendorModal) vendorModal.setAttribute('hidden', '');
  }

  if (addNewVendorBtn) {
    addNewVendorBtn.addEventListener('click', function () {
      openVendorModal(null);
    });
  }

  if (vendorModalCancel) {
    vendorModalCancel.addEventListener('click', closeVendorModal);
  }

  if (vendorForm) {
    vendorForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var idInput = document.getElementById('vendorId');
      var nameInput = document.getElementById('vendorName');
      var contactInput = document.getElementById('vendorContactPerson');
      var phoneInput = document.getElementById('vendorPhone');
      var emailInput = document.getElementById('vendorEmail');
      var addressInput = document.getElementById('vendorAddress');

      var vendor = {
        id: idInput.value || generateVendorId(),
        name: nameInput.value.trim(),
        contactPerson: contactInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        address: addressInput.value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!vendor.name) {
        toast('يرجى إدخال اسم المورد', 'error');
        return;
      }

      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.saveVendor(vendor, tenantSlug)
        .then(function () {
          toast('تم حفظ المورد بنجاح');
          closeVendorModal();
          loadVendors();
        })
        .catch(function (err) {
          console.error(err);
          toast('حدث خطأ أثناء حفظ المورد', 'error');
        });
    });
  }

  // --- Purchase Invoices CRUD ---

  function loadPurchaseInvoices() {
    if (!adminPurchaseInvoicesList) return;
    adminPurchaseInvoicesList.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;" class="admin-hint">جاري تحميل فواتير المشتريات...</td></tr>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      window.MkenSupabaseDb.fetchPurchaseInvoices(tenantSlug)
        .then(function (invoices) {
          _purchaseInvoices = invoices;
          renderPurchaseInvoices();
        })
        .catch(function (err) {
          console.error('Failed to fetch purchase invoices', err);
          adminPurchaseInvoicesList.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--color-primary);" class="admin-hint">حدث خطأ أثناء تحميل الفواتير.</td></tr>';
        });
    } else {
      adminPurchaseInvoicesList.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;" class="admin-hint">يتطلب الاتصال بـ Supabase.</td></tr>';
    }
  }

  function renderPurchaseInvoices() {
    if (!_purchaseInvoices.length) {
      adminPurchaseInvoicesList.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;" class="admin-hint">لا توجد فواتير مشتريات مسجلة حالياً.</td></tr>';
      return;
    }

    adminPurchaseInvoicesList.innerHTML = _purchaseInvoices.map(function (invoice) {
      // Find vendor name
      var vendor = _vendors.find(function (v) { return v.id === invoice.vendorId; });
      var vendorName = vendor ? vendor.name : 'مورد غير معروف';

      var statusColor = '#777';
      var statusText = 'غير مدفوعة';
      if (invoice.paymentStatus === 'paid') {
        statusColor = '#2e7d32';
        statusText = 'مدفوعة';
      } else if (invoice.paymentStatus === 'partially_paid') {
        statusColor = '#f2994a';
        statusText = 'مدفوعة جزئياً';
      }

      var itemsCount = (invoice.items || []).length;
      var dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('ar-EG') : '—';

      return (
        '<tr data-invoice-id="' + invoice.id + '" style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: bold; font-family: monospace;">' + esc(invoice.id) + '</td>' +
        '  <td style="padding: 12px;">' + esc(vendorName) + '</td>' +
        '  <td style="padding: 12px;">' + itemsCount + ' أصناف</td>' +
        '  <td style="padding: 12px; font-weight: bold; color: var(--color-primary);">' + invoice.totalAmount.toFixed(2) + ' ريال</td>' +
        '  <td style="padding: 12px;"><span style="color: ' + statusColor + '; font-weight: bold;">' + statusText + '</span></td>' +
        '  <td style="padding: 12px;">' + dateStr + '</td>' +
        '  <td style="padding: 12px;">' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="delete-invoice" style="padding: 4px 8px; color: #c0392b; border-color: #c0392b20;">حذف الفاتورة</button>' +
        '  </td>' +
        '</tr>'
      );
    }).join('');

    // Wire events
    adminPurchaseInvoicesList.querySelectorAll('[data-invoice-id]').forEach(function (row) {
      var id = row.getAttribute('data-invoice-id');

      var deleteBtn = row.querySelector('[data-action="delete-invoice"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          if (confirm('تنبيه: حذف فاتورة المشتريات لن يقلل المخزون المورد تلقائياً. هل أنت متأكد من حذف سجل هذه الفاتورة؟')) {
            window.MkenSupabaseDb.deletePurchaseInvoice(id)
              .then(function () {
                toast('تم حذف فاتورة المشتريات بنجاح');
                loadPurchaseInvoices();
              })
              .catch(function (err) {
                console.error(err);
                toast('خطأ أثناء حذف فاتورة المشتريات', 'error');
              });
          }
        });
      }
    });
  }

  function populateVendorDropdown() {
    if (!purchaseInvoiceVendorSelect) return;
    var html = '<option value="">-- اختر المورد --</option>';
    _vendors.forEach(function (v) {
      html += '<option value="' + v.id + '">' + esc(v.name) + '</option>';
    });
    purchaseInvoiceVendorSelect.innerHTML = html;
  }

  function openPurchaseInvoiceModal() {
    if (!purchaseInvoiceModal) return;

    var tenantSlug = store.getCurrentTenantSlug();
    
    // Clear and prepare vendor select options
    populateVendorDropdown();
    purchaseInvoiceStatusSelect.value = 'paid';
    document.getElementById('purchaseInvoiceId').value = generatePurchaseInvoiceId();

    purchaseInvoiceItemsList.innerHTML = '';
    purchaseInvoiceTotalEl.textContent = '0.00 ريال';

    // Fetch items from inventory first so the selectors have up to date products
    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      window.MkenSupabaseDb.fetchInventoryItems(tenantSlug)
        .then(function (items) {
          _inventoryItems = items;
          
          // Add one initial empty item row
          addPurchaseInvoiceItemRow();
          
          purchaseInvoiceModal.removeAttribute('hidden');
        })
        .catch(function (err) {
          console.error(err);
          toast('فشل في تحميل قائمة المنتجات من المستودع لتسجيل الفاتورة', 'error');
        });
    } else {
      toast('الرجاء تهيئة الربط السحابي (Supabase) أولاً', 'error');
    }
  }

  function closePurchaseInvoiceModal() {
    if (purchaseInvoiceModal) purchaseInvoiceModal.setAttribute('hidden', '');
  }

  function addPurchaseInvoiceItemRow() {
    if (!purchaseInvoiceItemsList) return;

    var tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--color-border)';

    var itemOptions = '<option value="">-- اختر المنتج --</option>';
    _inventoryItems.forEach(function (item) {
      itemOptions += '<option value="' + item.id + '">' + esc(item.name) + ' (' + esc(item.sku || 'بدون SKU') + ')</option>';
    });

    tr.innerHTML = 
      '  <td style="padding: 8px;">' +
      '    <select class="admin-input purchase-item-select" style="width: 100%;" required>' + itemOptions + '</select>' +
      '  </td>' +
      '  <td style="padding: 8px;">' +
      '    <input type="number" class="admin-input purchase-qty-input" value="1" min="1" required style="width: 100%;">' +
      '  </td>' +
      '  <td style="padding: 8px;">' +
      '    <input type="number" class="admin-input purchase-cost-input" value="0.00" step="0.01" min="0" required style="width: 100%;">' +
      '  </td>' +
      '  <td style="padding: 8px; text-align: center;">' +
      '    <button type="button" class="btn btn--outline btn--sm delete-row-btn" style="color: #c0392b; border-color: #c0392b20;">❌</button>' +
      '  </td>';

    purchaseInvoiceItemsList.appendChild(tr);

    var select = tr.querySelector('.purchase-item-select');
    var qtyInput = tr.querySelector('.purchase-qty-input');
    var costInput = tr.querySelector('.purchase-cost-input');
    var deleteBtn = tr.querySelector('.delete-row-btn');

    // On changing product select, fetch its cost price
    select.addEventListener('change', function () {
      var itemId = select.value;
      var invItem = _inventoryItems.find(function (itm) { return itm.id === itemId; });
      if (invItem) {
        costInput.value = invItem.costPrice.toFixed(2);
      } else {
        costInput.value = '0.00';
      }
      calculatePurchaseInvoiceTotal();
    });

    qtyInput.addEventListener('input', calculatePurchaseInvoiceTotal);
    costInput.addEventListener('input', calculatePurchaseInvoiceTotal);

    deleteBtn.addEventListener('click', function () {
      tr.remove();
      // Ensure at least one row exists
      if (purchaseInvoiceItemsList.children.length === 0) {
        addPurchaseInvoiceItemRow();
      }
      calculatePurchaseInvoiceTotal();
    });

    calculatePurchaseInvoiceTotal();
  }

  function calculatePurchaseInvoiceTotal() {
    if (!purchaseInvoiceItemsList) return;
    
    var total = 0;
    var rows = purchaseInvoiceItemsList.querySelectorAll('tr');
    rows.forEach(function (row) {
      var qty = Number(row.querySelector('.purchase-qty-input').value || 0);
      var cost = Number(row.querySelector('.purchase-cost-input').value || 0);
      total += (qty * cost);
    });

    purchaseInvoiceTotalEl.textContent = total.toFixed(2) + ' ريال';
  }

  if (addNewPurchaseInvoiceBtn) {
    addNewPurchaseInvoiceBtn.addEventListener('click', openPurchaseInvoiceModal);
  }

  if (purchaseInvoiceModalCancel) {
    purchaseInvoiceModalCancel.addEventListener('click', closePurchaseInvoiceModal);
  }

  if (purchaseInvoiceAddItemBtn) {
    purchaseInvoiceAddItemBtn.addEventListener('click', addPurchaseInvoiceItemRow);
  }

  if (purchaseInvoiceForm) {
    purchaseInvoiceForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var tenantSlug = store.getCurrentTenantSlug();
      var id = document.getElementById('purchaseInvoiceId').value;
      var vendorId = purchaseInvoiceVendorSelect.value;
      var paymentStatus = purchaseInvoiceStatusSelect.value;

      if (!vendorId) {
        toast('يرجى تحديد المورد', 'error');
        return;
      }

      var items = [];
      var totalAmount = 0;
      var rows = purchaseInvoiceItemsList.querySelectorAll('tr');
      var itemErrors = false;

      rows.forEach(function (row) {
        var itemId = row.querySelector('.purchase-item-select').value;
        var qty = Number(row.querySelector('.purchase-qty-input').value || 0);
        var cost = Number(row.querySelector('.purchase-cost-input').value || 0);

        if (!itemId) {
          itemErrors = true;
          return;
        }

        var invItem = _inventoryItems.find(function (itm) { return itm.id === itemId; });
        var itemName = invItem ? invItem.name : 'منتج غير معروف';

        items.push({
          itemId: itemId,
          name: itemName,
          quantity: qty,
          costPrice: cost
        });

        totalAmount += (qty * cost);
      });

      if (itemErrors) {
        toast('يرجى تحديد المنتج لكل البنود أو حذف البنود الفارغة', 'error');
        return;
      }

      if (items.length === 0) {
        toast('يرجى إضافة بند واحد على الأقل للفاتورة', 'error');
        return;
      }

      var invoice = {
        id: id,
        vendorId: vendorId,
        items: items,
        totalAmount: totalAmount,
        paymentStatus: paymentStatus,
        createdAt: new Date().toISOString()
      };

      // 1. Save the purchase invoice
      window.MkenSupabaseDb.savePurchaseInvoice(invoice, tenantSlug)
        .then(function () {
          // 2. Atomically increment quantities and update cost prices in Supabase via RPC function
          var client = window.MkenSupabaseDb.getClient();
          var rpcPromises = items.map(function (item) {
            return client.rpc('add_inventory_stock', {
              p_tenant: tenantSlug,
              p_item_id: item.itemId,
              p_quantity: item.quantity,
              p_cost_price: item.costPrice,
              p_reference_id: invoice.id
            }).then(function (res) {
              if (res.error) throw res.error;
              return res;
            });
          });
          return Promise.all(rpcPromises);
        })
        .then(function () {
          toast('تم تسجيل فاتورة المشتريات وتوريد المخزون بنجاح');
          closePurchaseInvoiceModal();
          
          // Refresh active data
          refresh();
          
          // If the inventory module is loaded, refresh it to show updated quantities/prices
          if (window.MkenAdminInventory) {
            window.MkenAdminInventory.refresh();
          }
        })
        .catch(function (err) {
          console.error(err);
          toast('حدث خطأ أثناء توريد المخزون وتحديث قاعدة البيانات', 'error');
        });
    });
  }

  // --- Export ---
  window.MkenAdminPurchases = {
    refresh: refresh
  };

})();
