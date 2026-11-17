/**
 * إدارة العملاء والمدفوعات الآجلة — لوحة الإدارة
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  var listContainer = document.getElementById('adminCustomersList');
  var customerModal = document.getElementById('customerModal');
  var customerForm = document.getElementById('customerForm');
  var addNewCustomerBtn = document.getElementById('addNewCustomerBtn');
  var customerModalCancel = document.getElementById('customerModalCancel');
  var customerLedgerCloseBtn = document.getElementById('customerLedgerCloseBtn');

  var _customers = [];
  var _invoices = [];
  var editingId = null;
  var currentCallback = null;

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function generateCustomerId() {
    return 'cst_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function loadCustomers() {
    if (!listContainer) return Promise.resolve();
    listContainer.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">جاري تحميل قائمة العملاء...</td></tr>';

    if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
      var tenantSlug = store.getCurrentTenantSlug();
      return Promise.all([
        window.MkenSupabaseDb.fetchCustomers(tenantSlug),
        window.MkenSupabaseDb.fetchCustomerInvoices(tenantSlug)
      ])
        .then(function (results) {
          _customers = results[0] || [];
          _invoices = results[1] || [];
          renderCustomers();
        })
        .catch(function (err) {
          console.error('Failed to fetch customers/invoices from Supabase', err);
          listContainer.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--color-primary);" class="admin-hint">حدث خطأ أثناء تحميل البيانات.</td></tr>';
        });
    } else {
      listContainer.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">ميزة إدارة العملاء تتطلب تفعيل المزامنة السحابية.</td></tr>';
      return Promise.resolve();
    }
  }

  function renderCustomers() {
    if (!_customers.length) {
      listContainer.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;" class="admin-hint">لا يوجد عملاء مسجلين حالياً.</td></tr>';
      return;
    }

    listContainer.innerHTML = _customers.map(function (c) {
      // Calculate outstanding debt for this customer
      var customerInvoices = _invoices.filter(function (inv) {
        return inv.customerId === c.id && inv.type === 'invoice';
      });

      var outstandingDebt = customerInvoices.reduce(function (sum, inv) {
        if (inv.paymentStatus !== 'paid') {
          return sum + inv.totalAmount;
        }
        return sum;
      }, 0);

      var debtColor = outstandingDebt > 0 ? 'red' : 'green';
      var debtText = outstandingDebt > 0 ? (outstandingDebt.toFixed(2) + ' ر.س') : '0.00 ر.س (لا يوجد ديون)';

      return (
        '<tr data-customer-id="' + c.id + '" style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: 500;">' + esc(c.name) + '</td>' +
        '  <td style="padding: 12px;">' + esc(c.phone || '-') + '</td>' +
        '  <td style="padding: 12px;">' + esc(c.email || '-') + '</td>' +
        '  <td style="padding: 12px;">' + esc(c.address || '-') + '</td>' +
        '  <td style="padding: 12px; font-weight: bold; color: ' + debtColor + ';">' + debtText + '</td>' +
        '  <td style="padding: 12px;">' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="ledger" style="padding: 4px 8px; margin-left: 6px;">كشف الحساب</button>' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="edit" style="padding: 4px 8px; margin-left: 6px; color: var(--color-primary); border-color: var(--color-primary-light);">تعديل</button>' +
        '    <button type="button" class="btn btn--outline btn--sm" data-action="delete" style="padding: 4px 8px; color: red; border-color: rgba(255,0,0,0.1);">حذف</button>' +
        '  </td>' +
        '</tr>'
      );
    }).join('');
  }

  function openCreateModal(callback) {
    currentCallback = callback;
    editingId = null;
    document.getElementById('customerModalTitle').textContent = 'إضافة عميل جديد';
    if (customerForm) customerForm.reset();
    document.getElementById('customerId').value = '';
    if (customerModal) customerModal.hidden = false;
  }

  function openEditModal(c) {
    currentCallback = null;
    editingId = c.id;
    document.getElementById('customerModalTitle').textContent = 'تعديل بيانات العميل';
    document.getElementById('customerId').value = c.id;
    document.getElementById('customerName').value = c.name;
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerEmail').value = c.email || '';
    document.getElementById('customerAddress').value = c.address || '';
    if (customerModal) customerModal.hidden = false;
  }

  function closeCustomerModal() {
    if (customerModal) customerModal.hidden = true;
  }

  function deleteCustomer(id) {
    if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
      if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
        window.MkenSupabaseDb.deleteCustomer(id)
          .then(function () {
            toast('تم حذف العميل بنجاح');
            loadCustomers();
            if (window.MkenAdminInvoices) {
              window.MkenAdminInvoices.refresh();
            }
          })
          .catch(function (err) {
            toast('فشل حذف العميل', 'error');
            console.error(err);
          });
      }
    }
  }

  function openLedgerModal(customer) {
    var ledgerModal = document.getElementById('customerLedgerModal');
    var ledgerTitle = document.getElementById('customerLedgerTitle');
    var ledgerTotalSales = document.getElementById('ledgerTotalSales');
    var ledgerTotalPaid = document.getElementById('ledgerTotalPaid');
    var ledgerOutstandingDebt = document.getElementById('ledgerOutstandingDebt');
    var transactionsList = document.getElementById('customerLedgerTransactionsList');

    if (!ledgerModal) return;

    ledgerTitle.textContent = 'كشف حساب العميل: ' + customer.name;
    ledgerModal.hidden = false;

    // Filter invoices for this customer
    var customerInvoices = _invoices.filter(function (inv) {
      return inv.customerId === customer.id && inv.type === 'invoice';
    });

    var totalSales = 0;
    var totalPaid = 0;
    var outstandingDebt = 0;

    if (!customerInvoices.length) {
      transactionsList.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;" class="admin-hint">لا توجد حركات مسجلة للعميل.</td></tr>';
      ledgerTotalSales.textContent = '0.00 ر.س';
      ledgerTotalPaid.textContent = '0.00 ر.س';
      ledgerOutstandingDebt.textContent = '0.00 ر.س';
      return;
    }

    transactionsList.innerHTML = customerInvoices.map(function (inv) {
      totalSales += inv.totalAmount;
      if (inv.paymentStatus === 'paid') {
        totalPaid += inv.totalAmount;
      } else {
        outstandingDebt += inv.totalAmount;
      }

      var statusColor = '#777';
      var statusText = 'غير مدفوعة';
      if (inv.paymentStatus === 'paid') { statusColor = 'green'; statusText = 'مدفوعة'; }
      else if (inv.paymentStatus === 'partial') { statusColor = 'orange'; statusText = 'مدفوعة جزئياً'; }

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

      return (
        '<tr style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: bold; font-family: monospace;">' + esc(inv.id) + '</td>' +
        '  <td style="padding: 12px;">' + dateStr + '</td>' +
        '  <td style="padding: 12px;">' + methodText + '</td>' +
        '  <td style="padding: 12px;"><span style="color: ' + statusColor + '; font-weight: bold;">' + statusText + '</span></td>' +
        '  <td style="padding: 12px; font-weight: bold; color: var(--color-primary);">' + inv.totalAmount.toFixed(2) + ' ر.س</td>' +
        '</tr>'
      );
    }).join('');

    ledgerTotalSales.textContent = totalSales.toFixed(2) + ' ر.س';
    ledgerTotalPaid.textContent = totalPaid.toFixed(2) + ' ر.س';
    ledgerOutstandingDebt.textContent = outstandingDebt.toFixed(2) + ' ر.س';
  }

  function closeLedgerModal() {
    var ledgerModal = document.getElementById('customerLedgerModal');
    if (ledgerModal) ledgerModal.hidden = true;
  }

  function bindEvents() {
    if (addNewCustomerBtn) {
      addNewCustomerBtn.addEventListener('click', function () {
        openCreateModal();
      });
    }

    if (customerModalCancel) {
      customerModalCancel.addEventListener('click', closeCustomerModal);
    }

    if (customerLedgerCloseBtn) {
      customerLedgerCloseBtn.addEventListener('click', closeLedgerModal);
    }

    if (customerForm) {
      customerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = document.getElementById('customerId').value;
        var isNew = !id;
        if (isNew) {
          id = generateCustomerId();
        }

        var customer = {
          id: id,
          name: document.getElementById('customerName').value,
          phone: document.getElementById('customerPhone').value || '',
          email: document.getElementById('customerEmail').value || '',
          address: document.getElementById('customerAddress').value || '',
          createdAt: isNew ? new Date().toISOString() : undefined
        };

        if (window.MkenSupabaseDb && window.MkenSupabaseDb.isConfigured()) {
          var tenantSlug = store.getCurrentTenantSlug();
          window.MkenSupabaseDb.saveCustomer(customer, tenantSlug)
            .then(function (savedCustomer) {
              toast(isNew ? 'تم إضافة العميل بنجاح' : 'تم تحديث بيانات العميل بنجاح');
              closeCustomerModal();
              loadCustomers().then(function () {
                if (isNew && currentCallback) {
                  currentCallback(savedCustomer);
                }
                if (window.MkenAdminInvoices) {
                  window.MkenAdminInvoices.refresh();
                }
              });
            })
            .catch(function (err) {
              toast('حدث خطأ أثناء حفظ بيانات العميل', 'error');
              console.error(err);
            });
        } else {
          toast('الرجاء تهيئة المزامنة السحابية لحفظ العميل', 'error');
        }
      });
    }

    if (listContainer) {
      listContainer.addEventListener('click', function (e) {
        var btn = e.target;
        if (!btn || btn.tagName !== 'BUTTON') return;
        var tr = btn.closest('tr');
        if (!tr) return;
        var customerId = tr.getAttribute('data-customer-id');
        var customer = _customers.find(function (c) { return c.id === customerId; });
        if (!customer) return;

        var action = btn.getAttribute('data-action');
        if (action === 'edit') {
          openEditModal(customer);
        } else if (action === 'delete') {
          deleteCustomer(customerId);
        } else if (action === 'ledger') {
          openLedgerModal(customer);
        }
      });
    }
  }

  function refresh() {
    loadCustomers();
  }

  window.MkenAdminCustomers = {
    refresh: refresh,
    openCreateModal: openCreateModal
  };

  bindEvents();
})();
