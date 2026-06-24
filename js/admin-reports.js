/**
 * لوحة التقارير والرسوم البيانية — منصة مكن
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  // DOM Elements
  var periodSelect = document.getElementById('reportsPeriodSelect');
  var repTotalRevenue = document.getElementById('repTotalRevenue');
  var repTotalCost = document.getElementById('repTotalCost');
  var repTotalProfit = document.getElementById('repTotalProfit');
  var repProfitMargin = document.getElementById('repProfitMargin');
  var repTotalPurchases = document.getElementById('repTotalPurchases');
  var reportsTopItemsList = document.getElementById('reportsTopItemsList');

  // Chart Canvas Elements
  var revenueProfitCtx = document.getElementById('revenueProfitChart');
  var salesPurchasesCtx = document.getElementById('salesPurchasesChart');
  var topItemsCtx = document.getElementById('topItemsChart');

  // State & Data
  var _salesInvoices = [];
  var _purchaseInvoices = [];
  var _inventoryItems = [];

  // Chart instances to prevent canvas overlapping
  var _charts = {
    revenueProfit: null,
    salesPurchases: null,
    topItems: null
  };

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function refresh() {
    loadReportsData();
  }

  function loadReportsData() {
    if (!window.MkenSupabaseDb || !window.MkenSupabaseDb.isConfigured()) {
      toast('الرجاء تهيئة المزامنة السحابية (Supabase) أولاً لعرض التقارير', 'error');
      return;
    }

    var tenantSlug = store.getCurrentTenantSlug();

    Promise.all([
      window.MkenSupabaseDb.fetchCustomerInvoices(tenantSlug),
      window.MkenSupabaseDb.fetchPurchaseInvoices(tenantSlug),
      window.MkenSupabaseDb.fetchInventoryItems(tenantSlug)
    ])
      .then(function (results) {
        _salesInvoices = (results[0] || []).filter(function (x) { return x.type === 'invoice'; });
        _purchaseInvoices = results[1] || [];
        _inventoryItems = results[2] || [];

        processAndRenderReports();
      })
      .catch(function (err) {
        console.error('Failed to load reports data', err);
        toast('حدث خطأ أثناء تحميل بيانات التقارير السحابية', 'error');
      });
  }

  // Event Listener for period filter change
  if (periodSelect) {
    periodSelect.addEventListener('change', function () {
      processAndRenderReports();
    });
  }

  function processAndRenderReports() {
    var period = periodSelect ? periodSelect.value : '30days';
    var dateRange = getDateRangeForPeriod(period);

    // Filter Sales and Purchase Invoices
    var filteredSales = _salesInvoices.filter(function (inv) {
      var d = new Date(inv.createdAt);
      return d >= dateRange.start && d <= dateRange.end;
    });

    var filteredPurchases = _purchaseInvoices.filter(function (pin) {
      var d = new Date(pin.createdAt);
      return d >= dateRange.start && d <= dateRange.end;
    });

    // 1. Calculate Stats
    var totalRevenue = 0;
    var totalCOGS = 0;
    var totalPurchases = 0;

    // Calculate Sales stats
    filteredSales.forEach(function (inv) {
      // Revenue = subtotal - discount (pre-tax net revenue)
      var rev = Number(inv.subtotal || 0) - Number(inv.discount || 0);
      totalRevenue += Math.max(0, rev);

      // COGS
      (inv.items || []).forEach(function (item) {
        var qty = Number(item.quantity || 0);
        var product = _inventoryItems.find(function (p) { return p.id === item.itemId; });
        var cost = product ? Number(product.costPrice || 0) : 0;
        totalCOGS += (qty * cost);
      });
    });

    // Calculate Purchases total
    filteredPurchases.forEach(function (pin) {
      totalPurchases += Number(pin.totalAmount || 0);
    });

    var totalProfit = totalRevenue - totalCOGS;
    var profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Render Stats
    if (repTotalRevenue) repTotalRevenue.textContent = totalRevenue.toFixed(2) + ' ريال';
    if (repTotalCost) repTotalCost.textContent = totalCOGS.toFixed(2) + ' ريال';
    if (repTotalProfit) {
      repTotalProfit.textContent = totalProfit.toFixed(2) + ' ريال';
      repTotalProfit.style.color = totalProfit >= 0 ? '#2e7d32' : '#c0392b';
    }
    if (repProfitMargin) repProfitMargin.textContent = profitMargin.toFixed(1) + '%';
    if (repTotalPurchases) repTotalPurchases.textContent = totalPurchases.toFixed(2) + ' ريال';

    // 2. Process Top Products Table
    renderTopItemsTable(filteredSales);

    // 3. Draw Charts
    renderCharts(filteredSales, filteredPurchases, period, dateRange);
  }

  function getDateRangeForPeriod(period) {
    var now = new Date();
    var start = new Date();
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === '7days') {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (period === '30days') {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else {
      // all
      start = new Date(2020, 0, 1, 0, 0, 0, 0);
    }

    return { start: start, end: end };
  }

  function renderTopItemsTable(salesInvoices) {
    if (!reportsTopItemsList) return;

    var productMap = {};

    salesInvoices.forEach(function (inv) {
      (inv.items || []).forEach(function (item) {
        var itemId = item.itemId;
        if (!itemId) return;

        if (!productMap[itemId]) {
          var product = _inventoryItems.find(function (p) { return p.id === itemId; });
          productMap[itemId] = {
            name: item.name || (product ? product.name : 'منتج غير معروف'),
            quantitySold: 0,
            revenue: 0,
            cost: 0,
            costPrice: product ? Number(product.costPrice || 0) : 0
          };
        }

        var qty = Number(item.quantity || 0);
        var price = Number(item.price || 0);

        productMap[itemId].quantitySold += qty;
        productMap[itemId].revenue += (qty * price);
        productMap[itemId].cost += (qty * productMap[itemId].costPrice);
      });
    });

    var productsList = [];
    for (var key in productMap) {
      if (productMap.hasOwnProperty(key)) {
        var p = productMap[key];
        p.profit = p.revenue - p.cost;
        productsList.push(p);
      }
    }

    // Sort by quantity sold descending
    productsList.sort(function (a, b) {
      return b.quantitySold - a.quantitySold;
    });

    if (!productsList.length) {
      reportsTopItemsList.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;" class="admin-hint">لا توجد مبيعات مسجلة في هذه الفترة.</td></tr>';
      return;
    }

    reportsTopItemsList.innerHTML = productsList.map(function (p) {
      return (
        '<tr style="border-bottom: 1px solid var(--color-border);">' +
        '  <td style="padding: 12px; font-weight: 500;">' + esc(p.name) + '</td>' +
        '  <td style="padding: 12px;">' + p.quantitySold + '</td>' +
        '  <td style="padding: 12px; font-weight: bold;">' + p.revenue.toFixed(2) + ' ريال</td>' +
        '  <td style="padding: 12px; color: var(--color-text-muted);">' + p.cost.toFixed(2) + ' ريال</td>' +
        '  <td style="padding: 12px; font-weight: bold; color: ' + (p.profit >= 0 ? '#2e7d32' : '#c0392b') + ';">' + p.profit.toFixed(2) + ' ريال</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderCharts(sales, purchases, period, dateRange) {
    if (!window.Chart) {
      console.warn('Chart.js library is not loaded');
      return;
    }

    var chartData = groupDataByTimeline(sales, purchases, period, dateRange);

    // Colors
    var colorRevenue = '#2e7d32'; // Green
    var colorProfit = '#c0392b'; // Dark Red / Terracotta
    var colorPurchases = '#f2994a'; // Orange
    var colorBlue = '#2d82b7'; // Blue

    // 1. Revenue & Profit Line Chart
    if (revenueProfitCtx) {
      if (_charts.revenueProfit) {
        _charts.revenueProfit.destroy();
      }
      _charts.revenueProfit = new Chart(revenueProfitCtx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: 'الإيرادات (المبيعات)',
              data: chartData.revenue,
              borderColor: colorRevenue,
              backgroundColor: 'rgba(46, 125, 50, 0.1)',
              borderWidth: 2.5,
              tension: 0.4,
              fill: true
            },
            {
              label: 'صافي الأرباح',
              data: chartData.profit,
              borderColor: colorBlue,
              backgroundColor: 'rgba(45, 130, 183, 0.1)',
              borderWidth: 2.5,
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { font: { family: 'IBM Plex Sans Arabic' } }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: { ticks: { callback: function (val) { return val + ' ر.س'; } } }
          }
        }
      });
    }

    // 2. Sales vs Purchases Bar Chart
    if (salesPurchasesCtx) {
      if (_charts.salesPurchases) {
        _charts.salesPurchases.destroy();
      }
      _charts.salesPurchases = new Chart(salesPurchasesCtx, {
        type: 'bar',
        data: {
          labels: chartData.labels,
          datasets: [
            {
              label: 'المبيعات',
              data: chartData.revenue,
              backgroundColor: colorRevenue,
              borderRadius: 4
            },
            {
              label: 'المشتريات',
              data: chartData.purchases,
              backgroundColor: colorPurchases,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { font: { family: 'IBM Plex Sans Arabic' } }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: { ticks: { callback: function (val) { return val + ' ر.س'; } } }
          }
        }
      });
    }

    // 3. Top Products Doughnut Chart
    if (topItemsCtx) {
      if (_charts.topItems) {
        _charts.topItems.destroy();
      }

      // Aggregate top 5 products by quantity
      var productQty = {};
      sales.forEach(function (inv) {
        (inv.items || []).forEach(function (item) {
          if (!item.itemId) return;
          productQty[item.name] = (productQty[item.name] || 0) + Number(item.quantity || 0);
        });
      });

      var sortedItems = [];
      for (var name in productQty) {
        if (productQty.hasOwnProperty(name)) {
          sortedItems.push({ name: name, qty: productQty[name] });
        }
      }
      sortedItems.sort(function (a, b) { return b.qty - a.qty; });

      var top5 = sortedItems.slice(0, 5);
      var doughnutLabels = top5.map(function (x) { return x.name; });
      var doughnutData = top5.map(function (x) { return x.qty; });

      if (!doughnutData.length) {
        doughnutLabels = ['لا توجد مبيعات'];
        doughnutData = [1];
      }

      _charts.topItems = new Chart(topItemsCtx, {
        type: 'doughnut',
        data: {
          labels: doughnutLabels,
          datasets: [{
            data: doughnutData,
            backgroundColor: [
              '#2e7d32', // Green
              '#2d82b7', // Blue
              '#f2994a', // Orange
              '#c0392b', // Terracotta
              '#9b59b6'  // Purple
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'IBM Plex Sans Arabic', size: 10 }
              }
            }
          }
        }
      });
    }
  }

  function groupDataByTimeline(sales, purchases, period, dateRange) {
    var labels = [];
    var revenueMap = {};
    var profitMap = {};
    var purchasesMap = {};

    var timelineMode = 'daily'; // daily vs monthly
    if (period === 'thisYear' || period === 'all') {
      timelineMode = 'monthly';
    }

    if (timelineMode === 'daily') {
      // Initialize daily slots
      var cur = new Date(dateRange.start);
      while (cur <= dateRange.end) {
        var key = formatDateKey(cur);
        var label = formatDateLabel(cur);
        labels.push(label);
        revenueMap[key] = 0;
        profitMap[key] = 0;
        purchasesMap[key] = 0;
        cur.setDate(cur.getDate() + 1);
      }

      // Populate Sales
      sales.forEach(function (inv) {
        var k = formatDateKey(new Date(inv.createdAt));
        if (revenueMap[k] !== undefined) {
          var rev = Number(inv.subtotal || 0) - Number(inv.discount || 0);
          revenueMap[k] += Math.max(0, rev);

          // Calculate cost of items in this invoice
          var cost = 0;
          (inv.items || []).forEach(function (item) {
            var product = _inventoryItems.find(function (p) { return p.id === item.itemId; });
            cost += Number(item.quantity || 0) * (product ? Number(product.costPrice || 0) : 0);
          });
          profitMap[k] += (Math.max(0, rev) - cost);
        }
      });

      // Populate Purchases
      purchases.forEach(function (pin) {
        var k = formatDateKey(new Date(pin.createdAt));
        if (purchasesMap[k] !== undefined) {
          purchasesMap[k] += Number(pin.totalAmount || 0);
        }
      });

    } else {
      // Monthly slots grouping
      var cur = new Date(dateRange.start);
      // For all time, we might want to start from the oldest invoice date
      if (period === 'all') {
        var oldest = new Date();
        sales.concat(purchases).forEach(function (x) {
          var d = new Date(x.createdAt);
          if (d < oldest) oldest = d;
        });
        cur = new Date(oldest.getFullYear(), oldest.getMonth(), 1);
      }

      var end = new Date(dateRange.end);
      while (cur <= end) {
        var key = formatMonthKey(cur);
        var label = formatMonthLabel(cur);
        labels.push(label);
        revenueMap[key] = 0;
        profitMap[key] = 0;
        purchasesMap[key] = 0;
        cur.setMonth(cur.getMonth() + 1);
      }

      // Populate Sales
      sales.forEach(function (inv) {
        var k = formatMonthKey(new Date(inv.createdAt));
        if (revenueMap[k] !== undefined) {
          var rev = Number(inv.subtotal || 0) - Number(inv.discount || 0);
          revenueMap[k] += Math.max(0, rev);

          var cost = 0;
          (inv.items || []).forEach(function (item) {
            var product = _inventoryItems.find(function (p) { return p.id === item.itemId; });
            cost += Number(item.quantity || 0) * (product ? Number(product.costPrice || 0) : 0);
          });
          profitMap[k] += (Math.max(0, rev) - cost);
        }
      });

      // Populate Purchases
      purchases.forEach(function (pin) {
        var k = formatMonthKey(new Date(pin.createdAt));
        if (purchasesMap[k] !== undefined) {
          purchasesMap[k] += Number(pin.totalAmount || 0);
        }
      });
    }

    // Convert map to ordered arrays
    var revenue = [];
    var profit = [];
    var purchaseList = [];

    labels.forEach(function (label, idx) {
      // Find the corresponding key
      var key = '';
      if (timelineMode === 'daily') {
        // Find key by looking up key for label
        // Simple map key lookup
        key = Object.keys(revenueMap)[idx];
      } else {
        key = Object.keys(revenueMap)[idx];
      }
      revenue.push(revenueMap[key] || 0);
      profit.push(profitMap[key] || 0);
      purchaseList.push(purchasesMap[key] || 0);
    });

    return {
      labels: labels,
      revenue: revenue,
      profit: profit,
      purchases: purchaseList
    };
  }

  // Helper date formatting functions
  function formatDateKey(date) {
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    var d = ('0' + date.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }

  var monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  function formatDateLabel(date) {
    var d = date.getDate();
    var m = monthsAr[date.getMonth()];
    return d + ' ' + m;
  }

  function formatMonthKey(date) {
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    return y + '-' + m;
  }

  function formatMonthLabel(date) {
    var y = date.getFullYear();
    var m = monthsAr[date.getMonth()];
    return m + ' ' + y;
  }

  // --- Export ---
  window.MkenAdminReports = {
    refresh: refresh
  };

})();
